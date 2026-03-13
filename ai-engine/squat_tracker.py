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

L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28
L_SHOULDER, R_SHOULDER = 11, 12

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

class SquatTracker:
    # Thresholds
    DOWN_ANGLE = 100        # knee angle below this -> down position
    UP_ANGLE   = 160        # knee angle above this -> up position
    BACK_LEAN_LIMIT = 45    # torso lean limit
    KNEE_TOE_RATIO  = 1.15  # knee over toe check

    def __init__(self):
        options = vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)
        self.squat_count = 0
        self.stage = "up"
        self.knee_angle = 0.0
        self.back_angle = 0.0
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
            
            # Helper to get pixel coords
            def pt(idx):
                return (int(landmarks[idx].x * w), int(landmarks[idx].y * h))
            
            # Using left side (can make it dynamic based on visibility vs presence)
            hip = pt(L_HIP)
            knee = pt(L_KNEE)
            ankle = pt(L_ANKLE)
            shoulder = pt(L_SHOULDER)
            
            self.knee_angle = calculate_angle(hip, knee, ankle)
            
            vertical_point = (hip[0], hip[1] - 100)
            self.back_angle = calculate_angle(shoulder, hip, vertical_point)
            
            # Squat counting logic (matching original squat_detector logic)
            if self.knee_angle < self.DOWN_ANGLE:
                self.stage = "down"
            if self.knee_angle > self.UP_ANGLE and self.stage == "down":
                self.stage = "up"
                self.squat_count += 1
                
            # Posture feedback
            if self.stage == "down":
                if self.knee_angle > 120:
                    self.feedback.append("Go deeper - thighs parallel to ground")
                else:
                    self.feedback.append("Good depth!")
                    
                if self.back_angle > self.BACK_LEAN_LIMIT:
                    self.feedback.append("Keep your back more upright")
                else:
                    self.feedback.append("Good back position!")
                    
                if knee[0] > ankle[0] * self.KNEE_TOE_RATIO:
                    self.feedback.append("Knees going too far over toes")
            
            # Draw skeleton
            self._draw_skeleton(frame, landmarks, w, h)
            self._draw_hud(frame)
            
        else:
            self._draw_hud(frame)
            
        return {
            "squat_count": self.squat_count,
            "stage": self.stage,
            "knee_angle": round(self.knee_angle, 1),
            "back_angle": round(self.back_angle, 1),
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

    def _draw_hud(self, frame):
        h, w, _ = frame.shape
        overlay = frame.copy()
        
        cv2.rectangle(overlay, (0, 0), (380, 220), (30, 30, 30), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        cv2.putText(frame, "SQUAT TRACKER", (15, 35),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 200), 2)
        cv2.putText(frame, f"Squats: {self.squat_count}", (15, 75),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                     
        stage_color = (0, 200, 255) if self.stage == "down" else (200, 200, 200)
        cv2.putText(frame, f"Stage: {self.stage.upper()}", (15, 110),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)
                     
        cv2.putText(frame, f"Knee angle: {self.knee_angle:.1f} deg", (15, 145),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)
        cv2.putText(frame, f"Back lean:  {self.back_angle:.1f} deg", (15, 175),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)
                     
        y_start = h - 20 * len(self.feedback) - 10
        for i, tip in enumerate(self.feedback):
            color = (0, 255, 0) if "Good" in tip else (0, 100, 255)
            cv2.putText(frame, tip, (15, y_start + i * 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

    def reset(self):
        self.squat_count = 0
        self.stage = "up"
        self.knee_angle = 0.0
        self.back_angle = 0.0
        self.feedback = []

    def release(self):
        self.landmarker.close()
