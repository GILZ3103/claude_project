"""
Quality pre-filter — reject frames that won't yield reliable detections.

Cheap checks (Laplacian variance, brightness) run on every frame before
spending compute on RetinaFace + MediaPipe + ArcFace.
"""

import cv2
import numpy as np

from .. import config


def is_frame_usable(frame: np.ndarray) -> tuple[bool, str]:
    """
    Pre-detection quality check.

    Returns (ok, reason). reason is empty when ok=True.
    """
    if frame is None or frame.size == 0:
        return False, "empty_frame"

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Blur check — Laplacian variance
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_score < config.QUALITY_BLUR_THRESHOLD:
        return False, f"blurry({blur_score:.0f})"

    # Brightness check
    mean_brightness = gray.mean()
    if mean_brightness < config.QUALITY_BRIGHTNESS_MIN:
        return False, f"too_dark({mean_brightness:.0f})"
    if mean_brightness > config.QUALITY_BRIGHTNESS_MAX:
        return False, f"too_bright({mean_brightness:.0f})"

    return True, ""


def is_face_usable(bbox: tuple[int, int, int, int], frame_width: int) -> tuple[bool, str]:
    """
    Proximity + size gate for a detected face bounding box.
    bbox = (x1, y1, x2, y2)
    """
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1

    if width < config.MIN_FACE_PIXELS or height < config.MIN_FACE_PIXELS:
        return False, f"face_too_small({width}x{height})"

    proximity_ratio = width / frame_width
    if proximity_ratio < config.PROXIMITY_BBOX_RATIO:
        return False, f"too_far({proximity_ratio:.2f})"

    return True, ""


def estimate_pose_degrees(landmarks_3d: np.ndarray) -> tuple[float, float]:
    """
    Rough yaw + pitch estimation from MediaPipe 3D landmarks.
    Returns (yaw_deg, pitch_deg).

    Uses nose tip relative to eye midpoint and chin midpoint.
    Approximate — good enough for "is the face roughly frontal".
    """
    # MediaPipe FaceMesh landmark indices
    NOSE_TIP = 1
    LEFT_EYE = 33
    RIGHT_EYE = 263
    CHIN = 152
    FOREHEAD = 10

    nose = landmarks_3d[NOSE_TIP]
    eye_mid = (landmarks_3d[LEFT_EYE] + landmarks_3d[RIGHT_EYE]) / 2
    chin = landmarks_3d[CHIN]
    forehead = landmarks_3d[FOREHEAD]

    # Yaw: nose horizontal offset from eye midpoint
    eye_width = abs(landmarks_3d[RIGHT_EYE][0] - landmarks_3d[LEFT_EYE][0])
    yaw_offset = nose[0] - eye_mid[0]
    yaw_deg = np.degrees(np.arctan2(yaw_offset, eye_width * 1.5)) if eye_width > 0 else 0

    # Pitch: nose vertical offset between forehead and chin
    face_height = abs(chin[1] - forehead[1])
    nose_vertical = nose[1] - (forehead[1] + chin[1]) / 2
    pitch_deg = np.degrees(np.arctan2(nose_vertical, face_height)) if face_height > 0 else 0

    return abs(float(yaw_deg)), abs(float(pitch_deg))


def passes_pose_gate(landmarks_3d: np.ndarray) -> tuple[bool, str]:
    """Return (ok, reason) — rejects extreme poses."""
    yaw, pitch = estimate_pose_degrees(landmarks_3d)
    if yaw > config.MAX_POSE_DEGREES:
        return False, f"yaw_too_extreme({yaw:.0f})"
    if pitch > config.MAX_POSE_DEGREES:
        return False, f"pitch_too_extreme({pitch:.0f})"
    return True, ""
