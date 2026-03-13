import math
import cv2
import numpy as np
import os
import urllib.request
import time

import mediapipe as mp
from mediapipe.tasks.python import vision

# ── Download model if needed ─────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pose_landmarker_lite.task")
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"

if not os.path.exists(MODEL_PATH):
    print("Downloading pose model (~4 MB)...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("Model downloaded.")

L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_ANKLE, R_ANKLE = 27, 28

CONNECTIONS = [
    (11, 13), (13, 15), (12, 14), (14, 16),
    (11, 12), (11, 23), (12, 24), (23, 24),
    (23, 25), (25, 27), (24, 26), (26, 28),
    (27, 29), (29, 31), (28, 30), (30, 32),
]

def calculate_angle(a, b, c):
    """Return the angle (degrees) at point b formed by points a-b-c."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    rad = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(rad * 180.0 / np.pi)
    if angle > 180:
        angle = 360 - angle
    return angle

class PushupTracker:
    DOWN_ANGLE       = 90    # elbow angle below this -> down position
    UP_ANGLE         = 160   # elbow angle above this -> up position
    BODY_ALIGN_MIN   = 160   # shoulder-hip-ankle angle; below this = bad alignment
    HIP_SAG_LIMIT    = 150   # if body angle below this -> hip is sagging
    HIP_PIKE_LIMIT   = 190   # not used with 0-180 range, but check > 175 for pike

    def __init__(self):
        options = vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)
        self.pushup_count = 0
        self.stage = "up"
        self.elbow_angle = 0.0
        self.body_angle = 0.0
        self.feedback = []
        self.frame_ts = int(time.time() * 1000)

    def process_frame(self, frame):
        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        
        self.frame_ts += 33
        results = self.landmarker.detect_for_video(mp_image, self.frame_ts)
        
        self.feedback = []
        landmarks = None
        
        if results.pose_landmarks and len(results.pose_landmarks) > 0:
            landmarks = results.pose_landmarks[0]
            
            def pt(idx):
                return (int(landmarks[idx].x * w), int(landmarks[idx].y * h))
            
            shoulder = pt(L_SHOULDER)
            elbow = pt(L_ELBOW)
            wrist = pt(L_WRIST)
            hip = pt(L_HIP)
            ankle = pt(L_ANKLE)
            
            self.elbow_angle = calculate_angle(shoulder, elbow, wrist)
            self.body_angle = calculate_angle(shoulder, hip, ankle)
            
            if self.elbow_angle < self.DOWN_ANGLE:
                self.stage = "down"
            if self.elbow_angle > self.UP_ANGLE and self.stage == "down":
                self.stage = "up"
                self.pushup_count += 1
                
            if self.stage == "down":
                if self.elbow_angle > 110:
                    self.feedback.append("Go lower - chest should nearly touch the ground")
                else:
                    self.feedback.append("Good depth!")
                    
            if self.body_angle < self.HIP_SAG_LIMIT:
                self.feedback.append("Hips sagging - tighten your core!")
            elif self.body_angle > 175:
                self.feedback.append("Hips piking up - lower your hips in line")
            else:
                self.feedback.append("Good body alignment!")
                
            if self.stage == "up" and self.elbow_angle < 155:
                self.feedback.append("Fully extend your arms at the top")
            
            self._draw_skeleton(frame, landmarks, w, h)
            self._draw_angle_arc(frame, elbow, self.elbow_angle, (0, 255, 200))
            self._draw_angle_arc(frame, hip, self.body_angle, (255, 200, 0))
            self._draw_hud(frame)
            
        else:
            self._draw_hud(frame)
            
        return {
            "pushup_count": self.pushup_count,
            "stage": self.stage,
            "elbow_angle": round(self.elbow_angle, 1),
            "body_angle": round(self.body_angle, 1),
            "feedback": self.feedback,
            "landmarks": landmarks,
            "annotated_frame": frame,
        }

    def _draw_skeleton(self, frame, lms, w, h):
        pts = [(int(lm.x * w), int(lm.y * h)) for lm in lms]
        for (i, j) in CONNECTIONS:
            if i < len(pts) and j < len(pts):
                cv2.line(frame, pts[i], pts[j], (255, 255, 255), 2)
        for x, y in pts:
            cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)

    @staticmethod
    def _draw_angle_arc(frame, center, angle, color):
        cv2.putText(
            frame, f"{angle:.0f}",
            (center[0] - 20, center[1] - 15),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
        )

    def _draw_hud(self, frame):
        h, w, _ = frame.shape
        overlay = frame.copy()
        
        cv2.rectangle(overlay, (0, 0), (400, 240), (30, 30, 30), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        cv2.putText(frame, "PUSHUP TRACKER", (15, 35),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)
        cv2.putText(frame, f"Pushups: {self.pushup_count}", (15, 75),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                     
        stage_color = (0, 200, 255) if self.stage == "down" else (200, 200, 200)
        cv2.putText(frame, f"Stage: {self.stage.upper()}", (15, 110),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)
                     
        cv2.putText(frame, f"Elbow angle: {self.elbow_angle:.1f} deg", (15, 150),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)
        cv2.putText(frame, f"Body align:  {self.body_angle:.1f} deg", (15, 180),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)
                     
        if self.stage == "down":
            progress = max(0, min(1, (110 - self.elbow_angle) / 20))
        else:
            progress = 0
        bar_w = int(350 * progress)
        cv2.rectangle(frame, (15, 200), (365, 220), (60, 60, 60), -1)
        cv2.rectangle(frame, (15, 200), (15 + bar_w, 220), (0, 200, 255), -1)
        cv2.putText(frame, "DEPTH", (15, 195),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)
                     
        y_start = h - 25 * len(self.feedback) - 10
        for i, tip in enumerate(self.feedback):
            color = (0, 255, 0) if "Good" in tip else (0, 100, 255)
            cv2.putText(frame, tip, (15, y_start + i * 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

    def reset(self):
        self.pushup_count = 0
        self.stage = "up"
        self.elbow_angle = 0.0
        self.body_angle = 0.0
        self.feedback = []

    def release(self):
        self.landmarker.close()
