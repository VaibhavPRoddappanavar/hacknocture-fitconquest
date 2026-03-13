"""
record_pushups.py – Record a pushup session with pose overlay to video file
============================================================================
Run:  python record_pushups.py
Press 'q' to stop recording, 'r' to reset counter.
Output: recordings/pushup_session_<timestamp>.avi
"""

import os, cv2
from datetime import datetime
from pushup_detector import PushupDetector


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
    out_path = f"recordings/pushup_session_{timestamp}.mp4"
    writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    detector = PushupDetector()

    print(f"=== Recording Pushups → {out_path} ===")
    print("Position yourself side-on to the camera for best results.")
    print("Press 'q' to stop, 'r' to reset counter.\n")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        result = detector.process_frame(frame)
        writer.write(result["annotated_frame"])
        cv2.imshow("Recording Pushups – FitConquest", result["annotated_frame"])

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
    print(f"\nDone – {detector.pushup_count} pushups recorded → {out_path}")


if __name__ == "__main__":
    main()
