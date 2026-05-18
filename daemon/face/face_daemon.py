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
from .pipeline.matcher import match_against_db
from .pipeline.smoother import TemporalSmoother


# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(str(config.LOG_FILE))],
)
log = logging.getLogger("face_daemon")


# ── Shared State (protected by _state_lock) ─────────────────────────────────

# Latest annotated frame for the /frame endpoint
_frame_lock = threading.Lock()
_latest_frame: bytes = b""   # JPEG bytes


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


# ── Camera Loop — split into fast capture + slow detection ───────────────────

# Latest raw frame shared between capture thread and detection thread
_capture_lock = threading.Lock()
_latest_capture: np.ndarray | None = None


def _capture_loop():
    """
    Fast thread — just reads frames from camera at full speed and encodes
    them for the /frame display endpoint. No detection here.
    """
    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAMERA_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, config.CAMERA_FPS)

    if not cap.isOpened():
        log.error(f"Camera at index {config.CAMERA_INDEX} failed to open.")
        return

    log.info("Camera opened. Capture loop running.")

    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            time.sleep(0.01)
            continue

        # Store latest frame for detection thread
        with _capture_lock:
            global _latest_capture
            _latest_capture = frame.copy()

        # Overlay current recognition state on frame before encoding
        with _state_lock:
            name = _current.owner_name if (time.monotonic() - _current.seen_at) < config.MATCH_TTL_SECONDS else None
            conf = _current.confidence if name else 0.0
            bbox = getattr(_current, "_last_bbox", None)

        display = frame.copy()
        if bbox:
            _annotate_frame(display, bbox, name, conf)

        _encode_frame(display)


def _camera_loop():
    """
    Slow thread — runs detection + recognition on the latest captured frame.
    Runs as fast as the model allows (~2 FPS on CPU).
    """
    detector = FaceDetector()
    smoother = TemporalSmoother()
    last_seen_face = 0.0
    fps_window_start = time.monotonic()
    fps_frames = 0

    log.info("Detection loop running.")

    while True:
        with _capture_lock:
            frame = _latest_capture.copy() if _latest_capture is not None else None

        if frame is None:
            time.sleep(0.05)
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
            if time.monotonic() - last_seen_face > config.MATCH_TTL_SECONDS:
                with _state_lock:
                    if _current.uid is not None:
                        log.debug("Face left frame, clearing state")
                        _current.uid = None
                        _current.owner_name = None
                        _current._last_bbox = None
                        smoother.reset()
            continue

        last_seen_face = time.monotonic()

        # Store bbox for display overlay
        with _state_lock:
            _current._last_bbox = face["bbox"]

        # Proximity + size gate
        ok, reason = quality.is_face_usable(face["bbox"], frame.shape[1])
        if not ok:
            log.debug(f"Face rejected: {reason}")
            continue

        # Match
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

        # Annotate frame with recognition result
        with _state_lock:
            name = _current.owner_name if (time.monotonic() - _current.seen_at) < config.MATCH_TTL_SECONDS else None
            conf = _current.confidence if name else 0.0
        _annotate_frame(frame, face["bbox"], name, conf)
        _encode_frame(frame)


# ── Frame annotation helpers ─────────────────────────────────────────────────

def _annotate_frame(frame: np.ndarray, bbox: tuple, name, confidence) -> None:
    import cv2 as _cv2
    x1, y1, x2, y2 = bbox
    color = (0, 220, 80) if name else (0, 200, 255)
    _cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    label = name if name else "Identifying..."
    _cv2.putText(frame, label, (x1, y1 - 8), _cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)
    if name and confidence:
        _cv2.putText(frame, f"conf:{confidence:.1f}", (x1, y2 + 18),
                     _cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)


def _encode_frame(frame) -> None:
    import cv2 as _cv2
    global _latest_frame
    # Resize to display resolution before encoding — much faster JPEG encode
    display = _cv2.resize(frame, (config.DISPLAY_WIDTH, config.DISPLAY_HEIGHT))
    _, buf = _cv2.imencode(".jpg", display, [_cv2.IMWRITE_JPEG_QUALITY, config.DISPLAY_JPEG_QUALITY])
    with _frame_lock:
        _latest_frame = buf.tobytes()


# ── Flask App ────────────────────────────────────────────────────────────────


app = Flask(__name__)


@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


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


@app.get("/frame")
def get_frame():
    """Return the latest annotated camera frame as a single JPEG."""
    from flask import Response
    with _frame_lock:
        data = _latest_frame
    if not data:
        return ("", 204)
    return Response(data, mimetype="image/jpeg")


@app.get("/stream")
def get_stream():
    """
    MJPEG stream — push frames continuously as multipart/x-mixed-replace.
    Use with cv2.VideoCapture('http://localhost:5002/stream') for smooth display.
    """
    from flask import Response

    def generate():
        interval = 1.0 / config.DISPLAY_FPS
        while True:
            t0 = time.monotonic()
            with _frame_lock:
                data = _latest_frame
            if data:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + data + b"\r\n"
                )
            # Sleep only the remaining time in this frame slot
            elapsed = time.monotonic() - t0
            sleep_for = max(0.0, interval - elapsed)
            time.sleep(sleep_for)

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/reload")
def post_reload():
    """Force reload of embeddings cache — called by sync service after updates."""
    count = reload_embeddings_cache()
    return jsonify({"reloaded": count})


# ── Entry Point ──────────────────────────────────────────────────────────────


def main():
    reload_embeddings_cache()
    log.info(f"face_daemon starting on {config.DAEMON_HOST}:{config.DAEMON_PORT}")
    # Fast capture thread — runs at camera FPS for smooth display
    threading.Thread(target=_capture_loop, daemon=True).start()
    # Slow detection thread — runs at ~2 FPS (model-limited)
    threading.Thread(target=_camera_loop, daemon=True).start()
    app.run(host=config.DAEMON_HOST, port=config.DAEMON_PORT, threaded=True)


if __name__ == "__main__":
    main()
