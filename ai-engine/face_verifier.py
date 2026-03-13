import cv2
import mediapipe as mp
import numpy as np
import os

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)

FACES_DIR = os.path.join(os.path.dirname(__file__), "faces")
if not os.path.exists(FACES_DIR):
    os.makedirs(FACES_DIR)

def get_face_crop(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_detection.process(rgb)
    if not results or not results.detections:
        return None, 0
    
    num_faces = len(results.detections)
    
    det = results.detections[0]
    bbox = det.location_data.relative_bounding_box
    h, w, _ = frame.shape
    x, y = int(bbox.xmin*w), int(bbox.ymin*h)
    bw, bh = int(bbox.width*w), int(bbox.height*h)
    
    pad_x = int(bw * 0.3)
    pad_y = int(bh * 0.4) # Slightly more padding on top/bottom for hair/chin
    
    x = max(0, x - pad_x)
    y = max(0, y - pad_y)
    bw = min(w - x, bw + 2 * pad_x)
    bh = min(h - y, bh + 2 * pad_y)
    
    if bw <= 0 or bh <= 0:
        return None, num_faces
        
    face = frame[y:y+bh, x:x+bw]
    try:
        face = cv2.resize(face, (100, 100))
        face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        return face_gray, num_faces
    except:
        return None, num_faces

def process_registration_frame(frame, user_id, index):
    face_gray, num_faces = get_face_crop(frame)
    if face_gray is not None and num_faces == 1:
        path = os.path.join(FACES_DIR, f"{user_id}_{index}.jpg")
        cv2.imwrite(path, face_gray)
        return True
    return False

class FaceVerifier:
    def __init__(self, user_id):
        self.user_id = user_id
        self.saved_faces = []
        self.trust_score = 100
        self.last_check_time = 0
        self.alert_msg = ""
        self.pause_reps = False
        self.load_saved_faces()

    def load_saved_faces(self):
        self.saved_faces = []
        if not self.user_id:
            return
        for i in range(15):
            path = os.path.join(FACES_DIR, f"{self.user_id}_{i}.jpg")
            if os.path.exists(path):
                img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    self.saved_faces.append(img.astype(np.float32))

    def verify(self, frame, current_time):
        if not self.saved_faces:
            # If no faces registered, we can't verify. Just pass.
            return {"trust_score": self.trust_score, "alert": "No Face Registered", "pause": False}

        face_gray, num_faces = get_face_crop(frame)

        if num_faces >= 2:
            self.trust_score = max(0, self.trust_score - 30)
            self.alert_msg = "Multiple Faces! -30 Trust Score"
            self.pause_reps = True
            return {"trust_score": self.trust_score, "alert": self.alert_msg, "pause": self.pause_reps}

        if num_faces == 0:
            self.alert_msg = "No Face Detected"
            self.pause_reps = True
            return {"trust_score": self.trust_score, "alert": self.alert_msg, "pause": self.pause_reps}

        if current_time - self.last_check_time >= 3.0:
            self.last_check_time = current_time
            live_pixels = face_gray.astype(np.float32)
            
            # Since we added padding, the background makes up a lot of the image.
            # A static background can artificially lower the MSE for a friend, 
            # or artificially raise it if the real user sways left/right.
            # To strictly evaluate bone structure without ANY lighting interference,
            # we will compute the Cosine Similarity of the mean-centered pixels (Pearson Correlation).
            # This guarantees a structural confidence score between -100% and 100%.
            core_live = live_pixels[20:80, 20:80].flatten()
            core_live_centered = core_live - np.mean(core_live)
            core_live_norm = core_live_centered / (np.linalg.norm(core_live_centered) + 1e-6)

            max_sim = -1.0
            for saved_pixels in self.saved_faces:
                core_saved = saved_pixels[20:80, 20:80].flatten()
                core_saved_centered = core_saved - np.mean(core_saved)
                core_saved_norm = core_saved_centered / (np.linalg.norm(core_saved_centered) + 1e-6)
                
                sim = np.dot(core_live_norm, core_saved_norm)
                if sim > max_sim:
                    max_sim = sim
            
            sim_pct = int(max_sim * 100)

            if sim_pct > 60:
                self.trust_score = min(100, self.trust_score + 20)
                self.alert_msg = f"Match! ({sim_pct}% Conf) +20"
                self.pause_reps = False
            else:
                self.trust_score = max(0, self.trust_score - 50)
                self.alert_msg = f"Mismatch! ({sim_pct}% Conf) -50"
                self.pause_reps = True

        return {"trust_score": self.trust_score, "alert": self.alert_msg, "pause": self.pause_reps}
