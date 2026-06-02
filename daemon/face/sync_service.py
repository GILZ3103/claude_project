"""
Sync service — pulls face photos from the backend and enrolls them locally.

Called at daemon startup and every SYNC_INTERVAL_SECONDS thereafter.
Never crashes the daemon — all errors are caught and logged.
"""

from __future__ import annotations

import logging
from pathlib import Path

import requests

from . import config, faces_db
from .enroll import enroll_photo

log = logging.getLogger("sync_service")


def sync_from_backend(force: bool = False) -> int:
    """
    Fetch all registered face photos from backend, enroll any that are
    new or changed (detected via photo_url difference), reload daemon cache.

    If force=True, re-enroll everyone regardless of whether their photo URL
    has changed (used on startup to ensure faces.db always matches backend).

    Returns number of people newly enrolled or updated.
    """
    config.SYNC_TMP_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Fetch list from backend
    try:
        resp = requests.get(
            f"{config.BACKEND_URL}{config.SYNC_PHOTOS_ENDPOINT}",
            timeout=10,
        )
        resp.raise_for_status()
        people = resp.json().get("data", [])
    except Exception as e:
        log.warning(f"Could not reach backend for face sync: {e}")
        return 0

    backend_uids: set[str] = set()
    changed = 0

    for person in people:
        uid: str | None = person.get("uid")
        owner_name: str = person.get("owner_name") or "Unknown"
        photo_url: str | None = person.get("photo_url")

        if not uid or not photo_url:
            continue

        backend_uids.add(uid)

        # 2. Skip if already enrolled with the same photo URL (unless force=True)
        if not force:
            existing = faces_db.get_person(uid)
            if existing and existing.get("photo_url") == photo_url:
                continue

        # 3. Download photo to tmp dir
        tmp_path: Path = config.SYNC_TMP_DIR / f"{uid}.jpg"
        try:
            img_resp = requests.get(photo_url, timeout=15)
            img_resp.raise_for_status()
            tmp_path.write_bytes(img_resp.content)
        except Exception as e:
            log.warning(f"Photo download failed for {uid}: {e}")
            continue

        # 4. Re-enroll (clear old embeddings first)
        faces_db.clear_embeddings_for(uid)
        ok = enroll_photo(
            uid, owner_name, tmp_path,
            source_label="api_sync",
            auto_augment=True,
        )
        if not ok:
            log.warning(f"No face detected in photo for {owner_name} ({uid}) — skipping")
            continue

        # 5. Update person record so next sync can detect future photo changes
        faces_db.upsert_person(uid, owner_name, has_physical_card=False, photo_url=photo_url)
        log.info(f"Synced face: {owner_name} ({uid})")
        changed += 1

    # 6. Purge anyone in local faces.db who is NOT in the Supabase response.
    #    This removes manually-enrolled people who were never registered via the app.
    for local in faces_db.list_people():
        local_uid = local["uid"]
        if local_uid not in backend_uids:
            faces_db.delete_person(local_uid)
            log.info(f"Purged locally-enrolled face not in Supabase: {local.get('owner_name')} ({local_uid})")
            changed += 1

    # 7. Reload daemon's in-memory embeddings cache if anything changed
    if changed > 0:
        from .face_daemon import reload_embeddings_cache  # lazy import — avoids circular
        reload_embeddings_cache()
        log.info(f"Cache reloaded — {changed} changes total")

    return changed
