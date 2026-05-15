"""
Face augmentation — generates multiple synthetic variants from a single photo.

Used during enrollment when only one photo is available (e.g., web app upload).
Turns 1 photo → 8 embeddings, covering the variation that multiple real
photos would provide.

Augmentations applied:
    1. Original (no change)
    2. Rotate +5°
    3. Rotate -5°
    4. Rotate +10°
    5. Brightness +20%
    6. Brightness -20%
    7. Horizontal flip
    8. Slight Gaussian blur (sigma=0.8)
"""

import cv2
import numpy as np


def augment_face(frame: np.ndarray) -> list[np.ndarray]:
    """
    Generate 8 augmented variants of a face image.

    Args:
        frame: BGR image (any size — typically the full photo from upload)

    Returns:
        List of 8 BGR images (same size as input)
    """
    h, w = frame.shape[:2]
    cx, cy = w / 2, h / 2
    variants = []

    # 1 — Original
    variants.append(frame.copy())

    # 2 & 3 — Rotation ±5°
    for angle in (5, -5):
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        variants.append(cv2.warpAffine(frame, M, (w, h), borderMode=cv2.BORDER_REPLICATE))

    # 4 — Rotation +10°
    M = cv2.getRotationMatrix2D((cx, cy), 10, 1.0)
    variants.append(cv2.warpAffine(frame, M, (w, h), borderMode=cv2.BORDER_REPLICATE))

    # 5 & 6 — Brightness ±20%
    for factor in (1.2, 0.8):
        bright = np.clip(frame.astype(np.float32) * factor, 0, 255).astype(np.uint8)
        variants.append(bright)

    # 7 — Horizontal flip
    variants.append(cv2.flip(frame, 1))

    # 8 — Slight Gaussian blur
    variants.append(cv2.GaussianBlur(frame, (0, 0), sigmaX=0.8))

    return variants


def should_augment(n_photos: int) -> bool:
    """Return True if augmentation is recommended (fewer than 4 real photos)."""
    return n_photos < 4
