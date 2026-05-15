"""
Face Recognition Daemon — the live "brain" service.

Runs continuously on the Pi, polling the camera and exposing
recognition results via HTTP for the React kiosk app to consume.

Architecture:
  Camera → quality filter → RetinaFace detect → proximity gate →
  MediaPipe landmarks → pose gate → alignment →
  ArcFace embedding (from detector.detect result) → multi-embedding match →
  temporal smoothing → set "recognised" state

Endpoints:
  GET /face/recognized → 200 with match details, or 204 no current match
  GET /health          → 200 status check
  GET /stats           → daemon stats (enrolled people, embeddings, FPS)

Run:
  python face_daemon.py
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional

import cv2
from flask import Flask, jsonify

from . import config, faces_db
from .pipeline import quality
from .pipeline.detector import FaceDetector
from .pipeline.landmarks import LandmarkExtractor
from .pipeline.matcher import match_against_db
from .pipeline.recognizer import FaceRecognizer
from .pipeline.smoother import TemporalSmoother


# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(str(config.LOG_FILE))],
)
log = logging.getLogger("face_daemon")


# ── Shared State (protected by _state_lock) ──────────────────────────────────


@dataclass
class RecognizedState:
    uid: Optional[str]
    owner_name: Optional[str]
    confidence: float
    frames_confirmed: int
    timestamp: str
    seen_at: float              # time.monotonic() — used for TTL


_state_lock = threading.Lock()
_current: RecognizedState = RecognizedState(None, None, 0.0, 0, "", 0.0)

# Loaded once at startup, reloaded after sync
_embeddings_cache: list[dict] = []
_embeddings_lock = threading.Lock()

# FPS counter (rough)
_fps_lock = threading.Lock()
_fps = 0.0


# ── Helpers ──────────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def reload_embeddings_cache() -> int:
    """Reload from SQLite. Called at startup and on demand after sync."""
    global _embeddings_cache
    rows = faces_db.load_all_embeddings()
    with _embeddings_lock:
        _embeddings_cache = rows
    log.info(f"Loaded {len(rows)} embeddings from faces.db")
    return len(rows)


# ── Camera Loop ──────────────────────────────────────────────────────────────


def _camera_loop():
    """Background thread: capture → detect → match → smooth → update state."""
    detector = FaceDetector()
    extractor = LandmarkExtractor()
    recognizer = FaceRecognizer()   # unused here directly — detector returns embedding
    smoother = TemporalSmoother()

    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAMERA_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, config.CAMERA_FPS)

    if not cap.isOpened():
        log.error(f"Camera at index {config.CAMERA_INDEX} failed to open. Daemon will idle.")
        return

    log.info("Camera opened. Starting recognition loop.")
    frame_no = 0
    last_seen_face = 0.0
    fps_window_start = time.monotonic()
    fps_frames = 0

    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            time.sleep(0.05)
            continue

        frame_no += 1

        # Frame skipping
        if frame_no % config.DETECT_EVERY_N_FRAMES != 0:
            continue

        # FPS tracking
        fps_frames += 1
        if time.monotonic() - fps_window_start >= 2.0:
            with _fps_lock:
                global _fps
                _fps = fps_frames / (time.monotonic() - fps_window_start)
            fps_window_start = time.monotonic()
            fps_frames = 0

        # Quality pre-filter
        ok, reason = quality.is_frame_usable(frame)
        if not ok:
            continue

        # Detection
        face = detector.detect_closest(frame)
        if face is None:
            # No face — if we had one recently, decay the state
            if time.monotonic() - last_seen_face > config.MATCH_TTL_SECONDS:
                with _state_lock:
                    if _current.uid is not None:
                        log.debug("Face left frame, clearing state")
                        _current.uid = None
                        _current.owner_name = None
                        smoother.reset()
            continue

        last_seen_face = time.monotonic()

        # Proximity + size gate
        ok, reason = quality.is_face_usable(face["bbox"], frame.shape[1])
        if not ok:
            log.debug(f"Face rejected: {reason}")
            continue

        # MediaPipe pose gate (optional — costs ~50ms)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        landmarks_3d = extractor.extract(frame_rgb)
        if landmarks_3d is not None:
            ok, reason = quality.passes_pose_gate(landmarks_3d)
            if not ok:
                log.debug(f"Pose rejected: {reason}")
                continue

        # Match against DB (embedding already attached by detector)
        with _embeddings_lock:
            embeddings = list(_embeddings_cache)
        result = match_against_db(face["embedding"], embeddings)

        # Temporal smoothing
        smoothed = smoother.add(result.uid, result.similarity, result.owner_name)

        # Update shared state
        if smoothed.decision == "confirmed" and smoothed.uid is not None:
            with _state_lock:
                _current.uid = smoothed.uid
                _current.owner_name = smoothed.owner_name
                _current.confidence = smoothed.confidence
                _current.frames_confirmed = smoothed.frames_confirmed
                _current.timestamp = _now_iso()
                _current.seen_at = time.monotonic()
            log.info(
                f"✅ Recognised: {smoothed.owner_name} ({smoothed.uid}) "
                f"@ {smoothed.confidence:.3f} after {smoothed.frames_confirmed} frames"
            )


# ── Flask App ────────────────────────────────────────────────────────────────


app = Flask(__name__)


@app.get("/face/recognized")
def get_recognized():
    """
    Return current recognised face, if any.

    Response:
      200 { uid, owner_name, confidence, frames_confirmed, timestamp }
      204 No Content (no current match)
    """
    with _state_lock:
        if _current.uid and (time.monotonic() - _current.seen_at) < config.MATCH_TTL_SECONDS:
            return jsonify({
                "uid": _current.uid,
                "owner_name": _current.owner_name,
                "confidence": round(_current.confidence, 3),
                "frames_confirmed": _current.frames_confirmed,
                "timestamp": _current.timestamp,
            })
    return ("", 204)


@app.get("/health")
def get_health():
    return jsonify({"status": "ok", "service": "face_daemon"})


@app.get("/stats")
def get_stats():
    with _embeddings_lock:
        emb_count = len(_embeddings_cache)
    with _fps_lock:
        fps = round(_fps, 2)
    return jsonify({
        "people_enrolled": faces_db.person_count(),
        "embeddings_loaded": emb_count,
        "fps": fps,
        "thresholds": {
            "confirmed": config.THRESHOLD_CONFIRMED,
            "possible": config.THRESHOLD_POSSIBLE,
        },
    })


@app.post("/reload")
def post_reload():
    """Force reload of embeddings cache — called by sync service after updates."""
    count = reload_embeddings_cache()
    return jsonify({"reloaded": count})


# ── Entry Point ──────────────────────────────────────────────────────────────


def main():
    reload_embeddings_cache()
    log.info(f"face_daemon starting on {config.DAEMON_HOST}:{config.DAEMON_PORT}")
    t = threading.Thread(target=_camera_loop, daemon=True)
    t.start()
    app.run(host=config.DAEMON_HOST, port=config.DAEMON_PORT, threaded=True)


if __name__ == "__main__":
    main()
