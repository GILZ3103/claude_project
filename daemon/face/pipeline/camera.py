"""
Camera abstraction — picamera2 (Arducam CSI on Pi) or OpenCV (USB webcam on laptop).

Returns frames as BGR numpy arrays regardless of backend, so the rest of the
pipeline (insightface, OpenCV annotation) works unchanged.

Backend selection:
    USE_PICAMERA2=1  → picamera2 / libcamera  (Arducam CSI on Raspberry Pi)
    default          → cv2.VideoCapture        (USB webcam on laptop)
"""

from __future__ import annotations
import os
import logging

import numpy as np

log = logging.getLogger("face_daemon")

USE_PICAMERA2 = os.environ.get("USE_PICAMERA2", "").lower() in ("1", "true", "yes")


class Camera:
    """Unified camera interface. Call open() once, then read() in a loop."""

    def __init__(self, width: int, height: int, fps: int) -> None:
        self._w = width
        self._h = height
        self._fps = fps
        self._backend = None          # cv2.VideoCapture OR ("picamera2", Picamera2)

    def open(self) -> None:
        if USE_PICAMERA2:
            self._open_picamera2()
        else:
            self._open_opencv()

    def _open_opencv(self) -> None:
        import cv2
        from .. import config
        cap = cv2.VideoCapture(config.CAMERA_INDEX)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._w)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._h)
        cap.set(cv2.CAP_PROP_FPS, self._fps)
        if not cap.isOpened():
            raise RuntimeError(f"OpenCV camera index {config.CAMERA_INDEX} failed to open")
        self._backend = cap
        log.info("Camera opened via OpenCV (USB webcam)")

    def _open_picamera2(self) -> None:
        from picamera2 import Picamera2
        picam = Picamera2()
        cfg = picam.create_video_configuration(
            main={"size": (self._w, self._h), "format": "RGB888"}
        )
        picam.configure(cfg)
        picam.start()
        self._backend = ("picamera2", picam)
        log.info("Camera opened via picamera2 (Arducam CSI)")

    def read(self) -> tuple[bool, np.ndarray | None]:
        """Return (ok, frame). frame is a BGR ndarray on success, None on failure."""
        if isinstance(self._backend, tuple):  # picamera2
            import cv2
            _, picam = self._backend
            frame_rgb = picam.capture_array()
            if frame_rgb is None:
                return False, None
            # picamera2 gives RGB; insightface/OpenCV expect BGR
            return True, cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
        else:  # OpenCV
            return self._backend.read()

    def release(self) -> None:
        if isinstance(self._backend, tuple):
            self._backend[1].stop()
        elif self._backend is not None:
            self._backend.release()
