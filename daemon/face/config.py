"""
Face recognition pipeline configuration.

All thresholds, paths, and tuning parameters in one place.
Change values here, not in pipeline code.
"""

from pathlib import Path
import os

# ── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
FACES_DB = BASE_DIR / "faces.db"                  # SQLite — local embedding store
ENROLLMENT_DIR = BASE_DIR / "enrollments"         # Raw enrollment photos (optional)
SYNC_TMP_DIR = BASE_DIR / "sync_tmp"              # Downloaded photos from backend
LOG_FILE = BASE_DIR / "face_daemon.log"

# ── Camera ───────────────────────────────────────────────────────────────────

# Camera source — overridden per environment
# Laptop dev: 0 (default USB webcam)
# Pi 5 + Arducam CSI: use picamera2 — see camera.py for switching logic
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "0"))
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720
CAMERA_FPS = 30

# Process every Nth frame for detection (frame skipping for speed)
DETECT_EVERY_N_FRAMES = 2

# ── Quality Pre-Filter ───────────────────────────────────────────────────────

QUALITY_BLUR_THRESHOLD = 100        # Laplacian variance — Arducam fixed mount (was 20 for webcam)
QUALITY_BRIGHTNESS_MIN = 40         # 0–255 mean pixel
QUALITY_BRIGHTNESS_MAX = 220

# ── Detection (RetinaFace) ───────────────────────────────────────────────────

# Proximity trigger — face bbox width as fraction of frame width
# 0.25 = kiosk arm's-length (Arducam); was 0.10 for laptop webcam at desk distance
PROXIMITY_BBOX_RATIO = 0.25

# Minimum face size before we even consider it
MIN_FACE_PIXELS = 80

# RetinaFace variant — "buffalo_l" (R50, most accurate) or "buffalo_sc" (MobileNet, faster)
INSIGHTFACE_MODEL_PACK = "buffalo_l"

# ── Quality Gates (post-detection) ───────────────────────────────────────────

MAX_POSE_DEGREES = 30               # Reject faces tilted more than 30° yaw/pitch (Arducam)
MIN_LANDMARK_VISIBILITY = 0.90      # 90% of landmarks must be visible (Arducam)

# ── Recognition ──────────────────────────────────────────────────────────────

EMBEDDING_DIM = 512                 # ArcFace buffalo_l output dimension

# Tiered match thresholds (cosine similarity)
THRESHOLD_CONFIRMED = 0.62          # stranger scores ~0.4x; genuine ~0.65+ (raise to 0.65 for Arducam)
THRESHOLD_POSSIBLE = 0.50           # >= this but < CONFIRMED → wait for more frames
                                    # < POSSIBLE → unknown

# ── Temporal Smoothing ───────────────────────────────────────────────────────

SMOOTHING_BUFFER_SIZE = 5           # Keep last N frames' predictions
SMOOTHING_VOTES_REQUIRED = 4        # Need N-of-buffer agreement to confirm

# How long a confirmed match stays "active" before requiring re-detection
MATCH_TTL_SECONDS = 3.0

# ── Display stream (MJPEG) ───────────────────────────────────────────────────

# Resolution for the /stream MJPEG endpoint — lower = faster encode
DISPLAY_WIDTH = 640
DISPLAY_HEIGHT = 480
DISPLAY_JPEG_QUALITY = 60      # 0–100; 60 is good quality at fast encode speed
DISPLAY_FPS = 30               # Target FPS for the MJPEG stream

# ── Flask Daemon ─────────────────────────────────────────────────────────────

DAEMON_HOST = "0.0.0.0"
DAEMON_PORT = 5002

# ── Sync Service ─────────────────────────────────────────────────────────────

BACKEND_URL = os.environ.get("BACKEND_URL", "https://warungtek-backend.onrender.com")
SYNC_INTERVAL_SECONDS = 300         # 5 minutes
SYNC_PHOTOS_ENDPOINT = "/api/face/photos"

# ── Logging ──────────────────────────────────────────────────────────────────

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
