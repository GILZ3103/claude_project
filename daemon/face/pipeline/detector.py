"""
RetinaFace detection wrapper.

Uses InsightFace's bundled RetinaFace from the buffalo_l model pack.
Returns face bounding boxes + 5-point landmarks + detection scores.
"""

from __future__ import annotations
from typing import Optional
import numpy as np

from .. import config


class FaceDetector:
    """Lazy-loaded RetinaFace via InsightFace."""

    def __init__(self) -> None:
        self._app = None

    def _load(self) -> None:
        if self._app is not None:
            return
        # Import inside _load so module can be imported without insightface installed
        from insightface.app import FaceAnalysis
        self._app = FaceAnalysis(
            name=config.INSIGHTFACE_MODEL_PACK,
            allowed_modules=["detection", "recognition"],
        )
        # ctx_id=-1 → CPU (Pi 5 has no GPU). On laptop with CUDA, set to 0.
        self._app.prepare(ctx_id=-1, det_size=(640, 640))

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Detect faces in BGR frame.

        Returns list of dicts:
        [{
            "bbox": (x1, y1, x2, y2),
            "score": float,
            "kps": np.ndarray (5, 2),      # 5-point landmarks
            "embedding": np.ndarray (512,) # ArcFace embedding (since FaceAnalysis runs both)
        }]
        """
        self._load()
        faces = self._app.get(frame)

        results = []
        for f in faces:
            x1, y1, x2, y2 = f.bbox.astype(int)
            results.append({
                "bbox": (int(x1), int(y1), int(x2), int(y2)),
                "score": float(f.det_score),
                "kps": f.kps,
                "embedding": f.embedding,   # InsightFace returns it directly
            })
        return results

    def detect_closest(self, frame: np.ndarray) -> Optional[dict]:
        """Detect and return only the largest (closest) face, or None."""
        faces = self.detect(frame)
        if not faces:
            return None
        # Sort by bbox area, return largest
        def area(f):
            x1, y1, x2, y2 = f["bbox"]
            return (x2 - x1) * (y2 - y1)
        return max(faces, key=area)
