"""
MediaPipe 478-point face landmark wrapper.

These dense landmarks are used for:
1. Precise alignment (better than 5-point landmarks)
2. Pose estimation
3. Occlusion detection (% of landmarks visible)
"""

from __future__ import annotations
from typing import Optional
import numpy as np


class LandmarkExtractor:
    """Lazy-loaded MediaPipe FaceMesh."""

    def __init__(self) -> None:
        self._mesher = None

    def _load(self) -> None:
        if self._mesher is not None:
            return
        import mediapipe as mp
        self._mesher = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def extract(self, frame_rgb: np.ndarray) -> Optional[np.ndarray]:
        """
        Run FaceMesh on RGB frame. Returns 478×3 array of (x, y, z) in pixel coords,
        or None if no face found.
        """
        self._load()
        results = self._mesher.process(frame_rgb)
        if not results.multi_face_landmarks:
            return None

        h, w = frame_rgb.shape[:2]
        landmarks_3d = np.array(
            [(lm.x * w, lm.y * h, lm.z * w) for lm in results.multi_face_landmarks[0].landmark],
            dtype=np.float32,
        )
        return landmarks_3d
