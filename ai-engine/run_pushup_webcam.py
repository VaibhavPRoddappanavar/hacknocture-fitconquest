"""
run_pushup_webcam.py – Standalone webcam demo for the Pushup Detector
=====================================================================
Run:
    python run_pushup_webcam.py

Press 'q' to quit, 'r' to reset the counter.
"""

import cv2
from pushup_detector import PushupDetector


def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    # Set resolution (optional – adjust for your camera)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    detector = PushupDetector()

    print("=== Pushup Detector ===")
    print("Position yourself side-on to the camera for best results.")
    print("Press 'q' to quit, 'r' to reset counter.\n")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Mirror the frame so it feels natural
        frame = cv2.flip(frame, 1)

        result = detector.process_frame(frame)

        cv2.imshow("Pushup Detector – FitConquest", result["annotated_frame"])

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("r"):
            detector.reset()
            print("Counter reset!")

    detector.release()
    cap.release()
    cv2.destroyAllWindows()
    print(f"\nSession complete – Total pushups: {detector.pushup_count}")


if __name__ == "__main__":
    main()
