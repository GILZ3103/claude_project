"""
ArcFace embedding wrapper.

Generates 512-dim embeddings from aligned 112×112 face crops.
Uses the same FaceAnalysis instance as detector.py — the buffalo_l
model pack bundles RetinaFace + ArcFace together.

If you call detector.detect() / detect_closest(), the embedding is
already attached to each result — so this module is mainly for the
enrollment path where you feed in a still photo and want the embedding.
"""

from __future__ import annotations
from typing import Optional
import numpy as np

from .. import config


class FaceRecognizer:
    """Lazy-loaded ArcFace from InsightFace."""

    def __init__(self) -> None:
        self._app = None

    def _load(self) -> None:
        if self._app is not None:
            return
        from insightface.app import FaceAnalysis
        self._app = FaceAnalysis(
            name=config.INSIGHTFACE_MODEL_PACK,
            allowed_modules=["detection", "recognition"],
        )
        self._app.prepare(ctx_id=-1, det_size=(640, 640))

    def embed_photo(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Detect the largest face in a still photo and return its embedding.
        Used during enrollment when processing photos downloaded from backend.

        Returns None if no face detected.
        """
        self._load()
        faces = self._app.get(frame)
        if not faces:
            return None
        # Return largest face's embedding
        largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb: np.ndarray = largest.embedding
        # L2-normalise — InsightFace already does this but be explicit
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb

    @staticmethod
    def normalize(emb: np.ndarray) -> np.ndarray:
        """L2-normalise an embedding vector."""
        n = np.linalg.norm(emb)
        return emb / n if n > 0 else emb
