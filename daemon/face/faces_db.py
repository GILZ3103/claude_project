"""
SQLite-backed local face database.

Stores multiple embeddings per person (multi-embedding enrollment).
Embeddings stored as BLOB (numpy float32 bytes).
Never sent to cloud — local-only on the Pi.
"""

from __future__ import annotations
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional
import numpy as np

from . import config


SCHEMA = """
CREATE TABLE IF NOT EXISTS embeddings (
    embedding_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    uid            TEXT NOT NULL,
    owner_name     TEXT,
    embedding      BLOB NOT NULL,
    photo_url      TEXT,
    source_label   TEXT,           -- e.g. "frontal" | "left_30" | "smile"
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_embeddings_uid ON embeddings(uid);

CREATE TABLE IF NOT EXISTS people (
    uid                TEXT PRIMARY KEY,
    owner_name         TEXT,
    has_physical_card  INTEGER DEFAULT 0,
    photo_url          TEXT,
    last_synced_at     TEXT,
    threshold_override REAL    -- per-person threshold tuning (optional)
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(config.FACES_DB))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def emb_to_blob(emb: np.ndarray) -> bytes:
    return emb.astype(np.float32).tobytes()


def blob_to_emb(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


# ── People ───────────────────────────────────────────────────────────────────

def upsert_person(
    uid: str,
    owner_name: Optional[str],
    has_physical_card: bool,
    photo_url: Optional[str],
) -> None:
    """Insert or update a person record. Called by sync service."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO people (uid, owner_name, has_physical_card, photo_url, last_synced_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                owner_name=excluded.owner_name,
                has_physical_card=excluded.has_physical_card,
                photo_url=excluded.photo_url,
                last_synced_at=excluded.last_synced_at
            """,
            (uid, owner_name, int(has_physical_card), photo_url, datetime.utcnow().isoformat()),
        )


def delete_person(uid: str) -> None:
    """Remove a person and all their embeddings — called when user deletes photo."""
    with _connect() as conn:
        conn.execute("DELETE FROM embeddings WHERE uid = ?", (uid,))
        conn.execute("DELETE FROM people WHERE uid = ?", (uid,))


def get_person(uid: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM people WHERE uid = ?", (uid,)).fetchone()
        return dict(row) if row else None


def list_people() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM people").fetchall()
        return [dict(r) for r in rows]


# ── Embeddings ───────────────────────────────────────────────────────────────

def add_embedding(
    uid: str,
    owner_name: Optional[str],
    embedding: np.ndarray,
    photo_url: Optional[str] = None,
    source_label: Optional[str] = None,
) -> int:
    """Add a new embedding for a person. Returns embedding_id."""
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO embeddings (uid, owner_name, embedding, photo_url, source_label)
            VALUES (?, ?, ?, ?, ?)
            """,
            (uid, owner_name, emb_to_blob(embedding), photo_url, source_label),
        )
        return cur.lastrowid


def clear_embeddings_for(uid: str) -> None:
    """Remove all embeddings for a uid (used before re-enrolling)."""
    with _connect() as conn:
        conn.execute("DELETE FROM embeddings WHERE uid = ?", (uid,))


def load_all_embeddings() -> list[dict]:
    """Load every embedding for matching. Called once at daemon startup + after sync."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT embedding_id, uid, owner_name, embedding FROM embeddings"
        ).fetchall()
        return [
            {
                "embedding_id": r["embedding_id"],
                "uid": r["uid"],
                "owner_name": r["owner_name"],
                "embedding": blob_to_emb(r["embedding"]),
            }
            for r in rows
        ]


def embedding_count() -> int:
    with _connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]


def person_count() -> int:
    with _connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM people").fetchone()[0]
