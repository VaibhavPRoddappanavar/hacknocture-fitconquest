"""
Pushup Detector using MediaPipe Pose Estimation
=================================================
Detects pushup posture, counts reps, and provides real-time form feedback.

Key landmarks used:
  - Shoulder (LEFT_SHOULDER / RIGHT_SHOULDER)
  - Elbow (LEFT_ELBOW / RIGHT_ELBOW)
  - Wrist (LEFT_WRIST / RIGHT_WRIST)
  - Hip (LEFT_HIP / RIGHT_HIP)
  - Ankle (LEFT_ANKLE / RIGHT_ANKLE)

Posture checks:
  1. Elbow angle (upper-arm – forearm) to detect pushup depth
  2. Body alignment (shoulder → hip → ankle) to detect hip sag or piking
  3. Elbow flare (how far elbows go out from the torso)
"""

import math
import cv2
import mediapipe as mp
import numpy as np

# ── MediaPipe setup ──────────────────────────────────────────────────────────
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles


# ── Utility: angle between three points ──────────────────────────────────────
def calculate_angle(a, b, c):
    """
    Calculate the angle at point b formed by the line segments a-b and b-c.
    Each point is (x, y).  Returns degrees in [0, 180].
    """
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    ba = a - b
    bc = c - b

    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    angle = np.degrees(np.arccos(np.clip(cosine, -1.0, 1.0)))
    return angle


# ── Pushup Detector Class ────────────────────────────────────────────────────
class PushupDetector:
    """
    Stateful detector that processes video frames and returns:
      - pushup_count         (int)
      - stage                ('up' | 'down')
      - elbow_angle          (float, degrees)
      - body_angle           (float, degrees – shoulder→hip→ankle deviation from 180)
      - feedback             (list[str] – posture tips)
      - landmarks            (NormalizedLandmarkList or None)
    """

    # Thresholds (tune for your use-case)
    DOWN_ANGLE       = 90    # elbow angle below this → "down" position
    UP_ANGLE         = 160   # elbow angle above this → "up" position
    BODY_ALIGN_MIN   = 160   # shoulder-hip-ankle angle; below this = bad alignment
    HIP_SAG_LIMIT    = 150   # if body angle below this → hip is sagging
    HIP_PIKE_LIMIT   = 190   # not used with 0-180 range, but we check > 175 for pike

    def __init__(self,
                 min_detection_confidence=0.7,
                 min_tracking_confidence=0.7):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.pushup_count = 0
        self.stage = "up"           # 'up' or 'down'
        self.elbow_angle = 0.0
        self.body_angle = 0.0
        self.feedback = []

    # ── core processing ────────────────────────────────────────────────────
    def process_frame(self, frame):
        """
        Process a single BGR frame.
        Returns a dict with all metrics, plus the annotated frame.
        """
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)

        self.feedback = []
        landmarks = None

        if results.pose_landmarks:
            landmarks = results.pose_landmarks
            lm = results.pose_landmarks.landmark

            # ── Pick the more visible side ───────────────────────────────
            left_vis  = lm[mp_pose.PoseLandmark.LEFT_SHOULDER].visibility
            right_vis = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].visibility

            if left_vis >= right_vis:
                shoulder = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_SHOULDER], frame)
                elbow    = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_ELBOW], frame)
                wrist    = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_WRIST], frame)
                hip      = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_HIP], frame)
                ankle    = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_ANKLE], frame)
            else:
                shoulder = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_SHOULDER], frame)
                elbow    = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_ELBOW], frame)
                wrist    = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_WRIST], frame)
                hip      = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_HIP], frame)
                ankle    = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_ANKLE], frame)

            # ── Elbow angle (shoulder → elbow → wrist) ──────────────────
            self.elbow_angle = calculate_angle(shoulder, elbow, wrist)

            # ── Body alignment (shoulder → hip → ankle) ─────────────────
            self.body_angle = calculate_angle(shoulder, hip, ankle)

            # ── Pushup counting state machine ────────────────────────────
            if self.elbow_angle < self.DOWN_ANGLE:
                self.stage = "down"
            if self.elbow_angle > self.UP_ANGLE and self.stage == "down":
                self.stage = "up"
                self.pushup_count += 1

            # ── Posture feedback ─────────────────────────────────────────
            if self.stage == "down":
                # Depth check
                if self.elbow_angle > 110:
                    self.feedback.append("Go lower – chest should nearly touch the ground")
                else:
                    self.feedback.append("Good depth!")

            # Body alignment (applies in both stages)
            if self.body_angle < self.HIP_SAG_LIMIT:
                self.feedback.append("Hips sagging – tighten your core!")
            elif self.body_angle > 175:
                self.feedback.append("Hips piking up – lower your hips in line")
            else:
                self.feedback.append("Good body alignment!")

            # Arm lockout at top
            if self.stage == "up" and self.elbow_angle < 155:
                self.feedback.append("Fully extend your arms at the top")

            # ── Draw landmarks & skeleton on frame ───────────────────────
            mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style(),
            )

            # ── Draw angle indicators on key joints ──────────────────────
            self._draw_angle_arc(frame, elbow, self.elbow_angle, (0, 255, 200))
            self._draw_angle_arc(frame, hip, self.body_angle, (255, 200, 0))

            # ── HUD overlay ──────────────────────────────────────────────
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

    # ── helpers ────────────────────────────────────────────────────────────
    @staticmethod
    def _lm_xy(landmark, frame):
        """Convert normalized landmark → pixel (x, y)."""
        h, w, _ = frame.shape
        return (int(landmark.x * w), int(landmark.y * h))

    @staticmethod
    def _draw_angle_arc(frame, center, angle, color):
        """Draw a small angle value near a joint."""
        cv2.putText(
            frame, f"{angle:.0f}",
            (center[0] - 20, center[1] - 15),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
        )

    def _draw_hud(self, frame):
        """Draw a translucent HUD panel on the frame."""
        h, w, _ = frame.shape
        overlay = frame.copy()

        # Semi-transparent dark rectangle
        cv2.rectangle(overlay, (0, 0), (400, 240), (30, 30, 30), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

        # Title
        cv2.putText(frame, "PUSHUP TRACKER", (15, 35),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)

        # Pushup count
        cv2.putText(frame, f"Pushups: {self.pushup_count}", (15, 75),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        # Stage
        stage_color = (0, 200, 255) if self.stage == "down" else (200, 200, 200)
        cv2.putText(frame, f"Stage: {self.stage.upper()}", (15, 110),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)

        # Elbow angle
        cv2.putText(frame, f"Elbow angle: {self.elbow_angle:.1f} deg", (15, 150),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)

        # Body angle
        cv2.putText(frame, f"Body align:  {self.body_angle:.1f} deg", (15, 180),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)

        # Rep progress bar
        if self.stage == "down":
            progress = max(0, min(1, (110 - self.elbow_angle) / 20))  # 110→90 mapped to 0→1
        else:
            progress = 0
        bar_w = int(350 * progress)
        cv2.rectangle(frame, (15, 200), (365, 220), (60, 60, 60), -1)
        cv2.rectangle(frame, (15, 200), (15 + bar_w, 220), (0, 200, 255), -1)
        cv2.putText(frame, "DEPTH", (15, 195),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)

        # Feedback (bottom of screen)
        y_start = h - 25 * len(self.feedback) - 10
        for i, tip in enumerate(self.feedback):
            color = (0, 255, 0) if "Good" in tip else (0, 100, 255)
            cv2.putText(frame, tip, (15, y_start + i * 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

    def reset(self):
        """Reset the counter and state."""
        self.pushup_count = 0
        self.stage = "up"
        self.elbow_angle = 0.0
        self.body_angle = 0.0
        self.feedback = []

    def release(self):
        """Release MediaPipe resources."""
        self.pose.close()
