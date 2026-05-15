"""
Temporal smoothing — vote across recent frames to confirm identity.

Solo-frame predictions are unstable. The same person looking slightly
different across frames (motion blur, expression, lighting) can flicker
between match decisions. Requiring 4-of-last-5 frames to agree on the
same identity eliminates almost all false positives.
"""

from __future__ import annotations
from collections import deque
from dataclasses import dataclass
from typing import Optional

from .. import config


@dataclass
class SmoothedResult:
    uid: Optional[str]
    owner_name: Optional[str]
    confidence: float           # Average similarity of winning votes
    frames_confirmed: int
    decision: str               # "confirmed" | "pending" | "unknown"


class TemporalSmoother:
    """Sliding window vote tally over the last N frame predictions."""

    def __init__(self) -> None:
        # Each entry is (uid_or_None, similarity, owner_name_or_None)
        self._buffer: deque = deque(maxlen=config.SMOOTHING_BUFFER_SIZE)

    def add(self, uid: Optional[str], similarity: float, owner_name: Optional[str] = None) -> SmoothedResult:
        """Add a frame's prediction and return the current smoothed verdict."""
        self._buffer.append((uid, similarity, owner_name))

        # Tally votes per uid (None = unknown frame)
        votes: dict[Optional[str], list[tuple[float, Optional[str]]]] = {}
        for u, sim, name in self._buffer:
            votes.setdefault(u, []).append((sim, name))

        # Winner = uid with most votes (ties broken by avg similarity)
        winner_uid = max(votes.keys(), key=lambda u: (
            len(votes[u]),
            sum(s for s, _ in votes[u]) / len(votes[u]) if votes[u] else 0,
        ))
        winner_votes = votes[winner_uid]
        avg_sim = sum(s for s, _ in winner_votes) / len(winner_votes)
        owner_name = next((n for _, n in winner_votes if n), None)

        if winner_uid is not None and len(winner_votes) >= config.SMOOTHING_VOTES_REQUIRED:
            decision = "confirmed"
        elif winner_uid is not None and len(winner_votes) >= 2:
            decision = "pending"
        else:
            decision = "unknown"

        return SmoothedResult(
            uid=winner_uid,
            owner_name=owner_name,
            confidence=avg_sim,
            frames_confirmed=len(winner_votes),
            decision=decision,
        )

    def reset(self) -> None:
        """Clear the buffer — call when the face leaves the frame."""
        self._buffer.clear()
