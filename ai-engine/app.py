"""
app.py – Flask API for Squat & Pushup Detectors
=================================================
Provides:
  1. Video streaming endpoints (MJPEG) for both exercises
  2. REST endpoints for stats, reset, and exercise switching

Run:
    python app.py
"""

import cv2
import json
import threading
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from squat_detector import SquatDetector
from pushup_detector import PushupDetector

app = Flask(__name__)
CORS(app)

# ── Global state ─────────────────────────────────────────────────────────────
detectors = {
    "squat": SquatDetector(),
    "pushup": PushupDetector(),
}
active_exercise = "squat"  # default exercise

camera = None
camera_lock = threading.Lock()
latest_result = {
    "exercise": "squat",
    "count": 0,
    "stage": "up",
    "angles": {},
    "feedback": [],
}


def get_camera():
    """Lazy-initialize the camera."""
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return camera


def generate_frames():
    """Generator that yields MJPEG frames for the /video_feed endpoint."""
    global latest_result

    while True:
        with camera_lock:
            cap = get_camera()
            ret, frame = cap.read()

        if not ret:
            continue

        frame = cv2.flip(frame, 1)

        detector = detectors[active_exercise]
        result = detector.process_frame(frame)

        # Build unified stats (use .get() to avoid KeyError across exercise types)
        count = result.get("squat_count", result.get("pushup_count", 0))
        angles = {}
        if "knee_angle" in result:
            angles["knee_angle"] = result["knee_angle"]
            angles["back_angle"] = result["back_angle"]
        if "elbow_angle" in result:
            angles["elbow_angle"] = result["elbow_angle"]
            angles["body_angle"] = result["body_angle"]

        latest_result = {
            "exercise": active_exercise,
            "count": count,
            "stage": result.get("stage", "up"),
            "angles": angles,
            "feedback": result.get("feedback", []),
        }

        _, buffer = cv2.imencode(".jpg", result["annotated_frame"])
        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
        )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({
        "service": "FitConquest AI Engine",
        "active_exercise": active_exercise,
        "endpoints": {
            "/video_feed":    "MJPEG video stream with pose overlay",
            "/stats":         "Current exercise stats (GET)",
            "/reset":         "Reset the counter (POST)",
            "/exercise":      "Get or set active exercise (GET / POST {exercise: 'squat'|'pushup'})",
        }
    })


@app.route("/video_feed")
def video_feed():
    """Stream annotated webcam frames as multipart JPEG."""
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/stats")
def stats():
    """Return the latest exercise metrics as JSON."""
    return jsonify(latest_result)


@app.route("/reset", methods=["POST"])
def reset():
    """Reset the counter for the active exercise."""
    detectors[active_exercise].reset()
    return jsonify({"message": f"{active_exercise} counter reset", "count": 0})


@app.route("/exercise", methods=["GET", "POST"])
def exercise():
    """Get or switch the active exercise."""
    global active_exercise

    if request.method == "GET":
        return jsonify({
            "active_exercise": active_exercise,
            "available": list(detectors.keys()),
        })

    data = request.get_json(force=True)
    new_exercise = data.get("exercise", "").lower()

    if new_exercise not in detectors:
        return jsonify({
            "error": f"Unknown exercise '{new_exercise}'",
            "available": list(detectors.keys()),
        }), 400

    active_exercise = new_exercise
    detectors[active_exercise].reset()
    return jsonify({
        "message": f"Switched to {active_exercise}",
        "active_exercise": active_exercise,
    })


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Starting FitConquest AI Engine …")
    print(f"  Active exercise: {active_exercise}")
    print(f"  Available:       {list(detectors.keys())}")
    print()
    print("  Video feed:  http://localhost:5050/video_feed")
    print("  Stats:       http://localhost:5050/stats")
    print("  Reset:       POST http://localhost:5050/reset")
    print("  Exercise:    GET/POST http://localhost:5050/exercise")
    app.run(host="0.0.0.0", port=5050, debug=False, threaded=True)
