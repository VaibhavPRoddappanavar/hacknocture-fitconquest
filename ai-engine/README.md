# 🏋️ FitConquest – AI Exercise Detector

Real-time exercise posture analysis and rep counting powered by **MediaPipe Pose**.

## Supported Exercises

| Exercise | File | Key Metrics |
|---|---|---|
| **Squats** | `squat_detector.py` | Knee angle, back lean, knee-over-toe |
| **Pushups** | `pushup_detector.py` | Elbow angle, body alignment, hip sag/pike |

## Features

| Feature | Details |
|---|---|
| **Rep counting** | Automatic counting via angle-based state machine (down ↔ up) |
| **Posture feedback** | Real-time tips on form (depth, alignment, etc.) |
| **Live HUD** | On-screen overlay with count, stage, angles, and feedback |
| **Flask API** | MJPEG stream + REST endpoints for frontend integration |
| **Multi-exercise** | Switch between exercises via API at runtime |

## Quick Start

### 1. Install dependencies

```bash
cd ai-engine
pip install -r requirements.txt
```

### 2a. Standalone webcam demos

**Squats:**
```bash
python run_webcam.py
```

**Pushups:**
```bash
python run_pushup_webcam.py
```

- Press **q** to quit
- Press **r** to reset the counter
- For pushups, position yourself **side-on** to the camera for best results

### 2b. Flask API (for frontend integration)

```bash
python app.py
```

| Endpoint | Method | Description |
|---|---|---|
| `/video_feed` | GET | MJPEG video stream with pose overlay |
| `/stats` | GET | JSON: `{ exercise, count, stage, angles, feedback }` |
| `/reset` | POST | Reset the rep counter |
| `/exercise` | GET | Get active exercise and available list |
| `/exercise` | POST | Switch exercise: `{ "exercise": "squat" \| "pushup" }` |

### Using in your frontend

```html
<!-- Embed the live video feed -->
<img src="http://localhost:5050/video_feed" alt="Exercise Detector" />
```

```javascript
// Poll stats
const res = await fetch("http://localhost:5050/stats");
const data = await res.json();
// data = { exercise: "squat", count: 5, stage: "up", angles: {...}, feedback: [...] }

// Switch to pushups
await fetch("http://localhost:5050/exercise", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ exercise: "pushup" }),
});
```

## How It Works

### Squats
1. **MediaPipe Pose** detects 33 body landmarks.
2. Calculates **knee angle** (hip → knee → ankle) and **back angle** (shoulder → hip vs. vertical).
3. State machine: knee angle < 100° → **down**, > 160° → **up** → count +1.
4. Posture feedback on depth, back lean, and knee-over-toe.

### Pushups
1. **MediaPipe Pose** detects 33 body landmarks.
2. Calculates **elbow angle** (shoulder → elbow → wrist) and **body alignment** (shoulder → hip → ankle).
3. State machine: elbow angle < 90° → **down**, > 160° → **up** → count +1.
4. Posture feedback on depth, hip sag/pike, and arm lockout.

## Configuration

### Squat thresholds (`squat_detector.py`)
```python
DOWN_ANGLE      = 100   # knee angle to enter "down" state
UP_ANGLE        = 160   # knee angle to return to "up" state
BACK_LEAN_LIMIT = 45    # max torso lean (degrees) before warning
KNEE_TOE_RATIO  = 1.15  # knee-x / ankle-x ratio for knee-over-toe warning
```

### Pushup thresholds (`pushup_detector.py`)
```python
DOWN_ANGLE      = 90    # elbow angle to enter "down" state
UP_ANGLE        = 160   # elbow angle to return to "up" state
BODY_ALIGN_MIN  = 160   # shoulder-hip-ankle angle; below = bad alignment
HIP_SAG_LIMIT   = 150   # body angle below this = hips sagging
```

## File Structure

```
ai-engine/
├── squat_detector.py       # Core squat detection class
├── pushup_detector.py      # Core pushup detection class
├── run_webcam.py           # Standalone squat webcam demo
├── run_pushup_webcam.py    # Standalone pushup webcam demo
├── app.py                  # Flask API (supports both exercises)
├── requirements.txt        # Python dependencies
└── README.md               # This file
```
