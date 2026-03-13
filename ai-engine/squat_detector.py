"""
Squat Detector using MediaPipe Pose Estimation
===============================================
Detects squat posture, counts reps, and provides real-time form feedback.

Key landmarks used:
  - Hip (LEFT_HIP / RIGHT_HIP)
  - Knee (LEFT_KNEE / RIGHT_KNEE)
  - Ankle (LEFT_ANKLE / RIGHT_ANKLE)
  - Shoulder (LEFT_SHOULDER / RIGHT_SHOULDER)

Posture checks:
  1. Knee angle (thigh-shin angle) to detect squat depth
  2. Back angle (torso lean) to detect forward lean
  3. Knee-over-toe check to detect knees caving or going too far forward
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


# ── Squat Detector Class ─────────────────────────────────────────────────────
class SquatDetector:
    """
    Stateful detector that processes video frames and returns:
      - squat_count          (int)
      - stage                ('up' | 'down')
      - knee_angle           (float, degrees)
      - back_angle           (float, degrees – torso vs vertical)
      - feedback             (list[str] – posture tips)
      - landmarks            (NormalizedLandmarkList or None)
    """

    # Thresholds (tune for your use-case)
    DOWN_ANGLE = 100        # knee angle below this → "down" position
    UP_ANGLE   = 160        # knee angle above this → "up" position
    BACK_LEAN_LIMIT = 45    # torso lean in degrees; more = bad posture
    KNEE_TOE_RATIO  = 1.15  # knee x > toe x * ratio → knees too far forward

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
        self.squat_count = 0
        self.stage = "up"          # 'up' or 'down'
        self.knee_angle = 0.0
        self.back_angle = 0.0
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

            # ── Extract key landmarks (use the side more visible) ────────
            left_vis  = lm[mp_pose.PoseLandmark.LEFT_HIP].visibility
            right_vis = lm[mp_pose.PoseLandmark.RIGHT_HIP].visibility

            if left_vis >= right_vis:
                hip      = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_HIP], frame)
                knee     = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_KNEE], frame)
                ankle    = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_ANKLE], frame)
                shoulder = self._lm_xy(lm[mp_pose.PoseLandmark.LEFT_SHOULDER], frame)
            else:
                hip      = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_HIP], frame)
                knee     = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_KNEE], frame)
                ankle    = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_ANKLE], frame)
                shoulder = self._lm_xy(lm[mp_pose.PoseLandmark.RIGHT_SHOULDER], frame)

            # ── Knee angle ───────────────────────────────────────────────
            self.knee_angle = calculate_angle(hip, knee, ankle)

            # ── Back / torso angle (shoulder→hip vs vertical) ────────────
            vertical_point = (hip[0], hip[1] - 100)  # point directly above hip
            self.back_angle = calculate_angle(shoulder, hip, vertical_point)

            # ── Squat counting state machine ─────────────────────────────
            if self.knee_angle < self.DOWN_ANGLE:
                self.stage = "down"
            if self.knee_angle > self.UP_ANGLE and self.stage == "down":
                self.stage = "up"
                self.squat_count += 1

            # ── Posture feedback ─────────────────────────────────────────
            if self.stage == "down":
                # Depth check
                if self.knee_angle > 120:
                    self.feedback.append("Go deeper – thighs should be parallel to the ground")
                else:
                    self.feedback.append("Good depth!")

                # Back lean
                if self.back_angle > self.BACK_LEAN_LIMIT:
                    self.feedback.append("Keep your back more upright – too much forward lean")
                else:
                    self.feedback.append("Good back position!")

                # Knee-over-toe (simple x-coordinate check)
                if knee[0] > ankle[0] * self.KNEE_TOE_RATIO:
                    self.feedback.append("Knees going too far over toes")

            # ── Draw landmarks & skeleton on frame ───────────────────────
            mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style(),
            )

            # ── HUD overlay ──────────────────────────────────────────────
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

    # ── helpers ────────────────────────────────────────────────────────────
    @staticmethod
    def _lm_xy(landmark, frame):
        """Convert normalized landmark → pixel (x, y)."""
        h, w, _ = frame.shape
        return (int(landmark.x * w), int(landmark.y * h))

    def _draw_hud(self, frame):
        """Draw a translucent HUD panel on the frame."""
        h, w, _ = frame.shape
        overlay = frame.copy()

        # Semi-transparent dark rectangle
        cv2.rectangle(overlay, (0, 0), (380, 220), (30, 30, 30), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

        # Title
        cv2.putText(frame, "SQUAT TRACKER", (15, 35),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 200), 2)

        # Squat count
        cv2.putText(frame, f"Squats: {self.squat_count}", (15, 75),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        # Stage
        stage_color = (0, 200, 255) if self.stage == "down" else (200, 200, 200)
        cv2.putText(frame, f"Stage: {self.stage.upper()}", (15, 110),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)

        # Knee angle
        cv2.putText(frame, f"Knee angle: {self.knee_angle:.1f} deg", (15, 145),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)

        # Back angle
        cv2.putText(frame, f"Back lean:  {self.back_angle:.1f} deg", (15, 175),
                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 1)

        # Feedback (bottom of screen)
        y_start = h - 20 * len(self.feedback) - 10
        for i, tip in enumerate(self.feedback):
            color = (0, 255, 0) if "Good" in tip else (0, 100, 255)
            cv2.putText(frame, tip, (15, y_start + i * 25),
                         cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

    def reset(self):
        """Reset the counter and state."""
        self.squat_count = 0
        self.stage = "up"
        self.knee_angle = 0.0
        self.back_angle = 0.0
        self.feedback = []

    def release(self):
        """Release MediaPipe resources."""
        self.pose.close()
