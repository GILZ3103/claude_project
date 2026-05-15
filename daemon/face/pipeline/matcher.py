"""
Multi-embedding matcher with tiered thresholds.

Compares a query embedding against the local faces.db, which stores
multiple embeddings per person (varied angles, expressions, lighting).
Returns the best match using max-similarity across all enrolled embeddings.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import numpy as np

from .. import config


@dataclass
class MatchResult:
    uid: Optional[str]
    owner_name: Optional[str]
    similarity: float
    decision: str               # "confirmed" | "possible" | "unknown"
    matched_embedding_id: Optional[int] = None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two L2-normalised embeddings."""
    return float(np.dot(a, b))


def match_against_db(query_emb: np.ndarray, db_rows: list[dict]) -> MatchResult:
    """
    Find best match for query_emb among all enrolled embeddings.

    db_rows: list of {
        "embedding_id": int,
        "uid": str,
        "owner_name": str,
        "embedding": np.ndarray (512,),
    }

    Strategy: max similarity across all embeddings for each person.
    The person with the highest max-similarity wins.
    """
    if not db_rows:
        return MatchResult(uid=None, owner_name=None, similarity=0.0, decision="unknown")

    # Best similarity per person
    per_person_best: dict[str, dict] = {}
    for row in db_rows:
        uid = row["uid"]
        sim = cosine_similarity(query_emb, row["embedding"])
        if uid not in per_person_best or sim > per_person_best[uid]["similarity"]:
            per_person_best[uid] = {
                "uid": uid,
                "owner_name": row["owner_name"],
                "similarity": sim,
                "embedding_id": row["embedding_id"],
            }

    best = max(per_person_best.values(), key=lambda r: r["similarity"])
    sim = best["similarity"]

    if sim >= config.THRESHOLD_CONFIRMED:
        decision = "confirmed"
    elif sim >= config.THRESHOLD_POSSIBLE:
        decision = "possible"
    else:
        decision = "unknown"

    return MatchResult(
        uid=best["uid"] if decision != "unknown" else None,
        owner_name=best["owner_name"] if decision != "unknown" else None,
        similarity=sim,
        decision=decision,
        matched_embedding_id=best["embedding_id"] if decision != "unknown" else None,
    )
