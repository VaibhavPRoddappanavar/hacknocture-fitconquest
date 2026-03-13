"""
record_squats.py – Record a squat session with pose overlay to video file
=========================================================================
Run:  python record_squats.py
Press 'q' to stop recording, 'r' to reset counter.
Output: recordings/squat_session_<timestamp>.avi
"""

import os, cv2
from datetime import datetime
from squat_detector import SquatDetector


def main():
    os.makedirs("recordings", exist_ok=True)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = f"recordings/squat_session_{timestamp}.mp4"
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    detector = SquatDetector()

    print(f"=== Recording Squats → {out_path} ===")
    print("Press 'q' to stop, 'r' to reset counter.\n")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        result = detector.process_frame(frame)
        writer.write(result["annotated_frame"])
        cv2.imshow("Recording Squats – FitConquest", result["annotated_frame"])

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("r"):
            detector.reset()
            print("Counter reset!")

    detector.release()
    cap.release()
    writer.release()
    cv2.destroyAllWindows()
    print(f"\nDone – {detector.squat_count} squats recorded → {out_path}")


if __name__ == "__main__":
    main()
