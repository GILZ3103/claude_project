"""
Face alignment — affine transform to canonical 112×112 ArcFace input.

Poor alignment is the #1 silent killer of recognition accuracy.
This module computes the transform from detected landmarks to ArcFace's
expected face position (eyes horizontal, nose centred, mouth below).
"""

import cv2
import numpy as np


# ArcFace canonical 112×112 reference points
# From the InsightFace repo — these are the standard reference landmarks
ARCFACE_REF_KPS_112 = np.array([
    [38.2946, 51.6963],   # left eye
    [73.5318, 51.5014],   # right eye
    [56.0252, 71.7366],   # nose tip
    [41.5493, 92.3655],   # left mouth corner
    [70.7299, 92.2041],   # right mouth corner
], dtype=np.float32)


def align_from_5_kps(frame: np.ndarray, kps: np.ndarray, size: int = 112) -> np.ndarray:
    """
    Align face using 5-point landmarks from RetinaFace.

    Args:
        frame: BGR image
        kps:   (5, 2) array of (x, y) — left_eye, right_eye, nose, left_mouth, right_mouth
        size:  output crop size (default 112 for ArcFace)

    Returns:
        Aligned (size, size, 3) BGR image
    """
    # Scale reference points if size differs from 112
    ref = ARCFACE_REF_KPS_112 * (size / 112.0)

    # Estimate similarity transform (translation + rotation + uniform scale)
    M, _ = cv2.estimateAffinePartial2D(kps, ref, method=cv2.LMEDS)
    if M is None:
        # Fallback to identity — caller should reject this face
        return cv2.resize(frame, (size, size))

    aligned = cv2.warpAffine(frame, M, (size, size), borderValue=0.0)
    return aligned


def align_from_mediapipe(frame: np.ndarray, landmarks_3d: np.ndarray, size: int = 112) -> np.ndarray:
    """
    Align using MediaPipe's denser landmarks.

    Extracts the 5 reference points from MediaPipe's 478 landmarks and
    delegates to align_from_5_kps. This gives better accuracy because
    MediaPipe's landmarks are more stable across poses.
    """
    # MediaPipe FaceMesh landmark indices for ArcFace's 5 reference points
    LEFT_EYE_CENTER = 468   # iris centre (refined landmarks)
    RIGHT_EYE_CENTER = 473
    NOSE_TIP = 1
    LEFT_MOUTH = 61
    RIGHT_MOUTH = 291

    # If iris landmarks unavailable (refine_landmarks=False), fall back to eye corners
    if landmarks_3d.shape[0] < 478:
        LEFT_EYE_CENTER = 33
        RIGHT_EYE_CENTER = 263

    kps = np.array([
        landmarks_3d[LEFT_EYE_CENTER][:2],
        landmarks_3d[RIGHT_EYE_CENTER][:2],
        landmarks_3d[NOSE_TIP][:2],
        landmarks_3d[LEFT_MOUTH][:2],
        landmarks_3d[RIGHT_MOUTH][:2],
    ], dtype=np.float32)

    return align_from_5_kps(frame, kps, size)
