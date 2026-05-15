"""
Enrollment script — generate embeddings from photos and store them in faces.db.

Two usage modes:

  1. Enroll from a folder of photos (laptop dev / batch enrollment)
       python enroll.py --uid TEST001 --name "Alice" --dir ./enrollments/alice/

  2. Enroll a single photo
       python enroll.py --uid TEST001 --name "Alice" --photo alice_frontal.jpg --label frontal

Best practice: enroll 5–10 photos per person captured under varied conditions
(different angles, expressions, lighting). Multi-embedding enrollment is the
single biggest accuracy boost in real-world deployment.
"""

from __future__ import annotations
import argparse
import logging
import sys
from pathlib import Path

import cv2

from . import config, faces_db
from .pipeline.augment import augment_face, should_augment
from .pipeline.recognizer import FaceRecognizer


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enroll")


def enroll_photo(
    uid: str,
    owner_name: str,
    photo_path: Path,
    source_label: str | None = None,
    recognizer: FaceRecognizer | None = None,
    auto_augment: bool = False,
) -> bool:
    """
    Embed a single photo and add to faces.db. Returns True on success.

    If auto_augment=True, generates 8 augmented variants from the one photo
    and enrolls all of them — compensating for having only a single source image.
    """
    if recognizer is None:
        recognizer = FaceRecognizer()

    if not photo_path.exists():
        log.error(f"Photo not found: {photo_path}")
        return False

    frame = cv2.imread(str(photo_path))
    if frame is None:
        log.error(f"Failed to read image: {photo_path}")
        return False

    if auto_augment:
        variants = augment_face(frame)
        success = 0
        for i, variant in enumerate(variants):
            emb = recognizer.embed_photo(variant)
            if emb is None:
                continue
            label = f"{source_label or photo_path.stem}_aug{i}"
            faces_db.add_embedding(uid=uid, owner_name=owner_name,
                                   embedding=emb, photo_url=str(photo_path),
                                   source_label=label)
            success += 1
        log.info(f"✅ Enrolled {success}/{len(variants)} augmented variants of {photo_path.name} for {owner_name}")
        return success > 0

    emb = recognizer.embed_photo(frame)
    if emb is None:
        log.warning(f"No face detected in {photo_path}")
        return False

    label = source_label or photo_path.stem
    embedding_id = faces_db.add_embedding(
        uid=uid, owner_name=owner_name, embedding=emb,
        photo_url=str(photo_path), source_label=label,
    )
    log.info(f"✅ Enrolled {photo_path.name} for {owner_name} ({uid}) — embedding_id={embedding_id}")
    return True


def enroll_folder(
    uid: str,
    owner_name: str,
    folder: Path,
    clear_first: bool = False,
) -> int:
    """Enroll all images in a folder. Returns number of successful embeddings."""
    if not folder.exists() or not folder.is_dir():
        log.error(f"Folder not found: {folder}")
        return 0

    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    photos = sorted(p for p in folder.iterdir() if p.suffix.lower() in extensions)

    if not photos:
        log.error(f"No images found in {folder}")
        return 0

    if clear_first:
        log.info(f"Clearing existing embeddings for {uid}")
        faces_db.clear_embeddings_for(uid)

    # Upsert person record
    faces_db.upsert_person(uid=uid, owner_name=owner_name, has_physical_card=False, photo_url=None)

    recognizer = FaceRecognizer()
    # Auto-augment if fewer than 4 real photos — turns 1 photo into 8 embeddings
    do_augment = should_augment(len(photos))
    if do_augment:
        log.info(f"Only {len(photos)} photo(s) — auto-augmentation enabled (8 variants per photo)")

    success = 0
    for photo in photos:
        if enroll_photo(uid, owner_name, photo, recognizer=recognizer, auto_augment=do_augment):
            success += 1

    log.info(f"Enrolled {success}/{len(photos)} photos for {owner_name}")
    return success


def main():
    parser = argparse.ArgumentParser(description="Enroll faces into local faces.db")
    parser.add_argument("--uid", required=True, help="Card UID (e.g. ABCD1234)")
    parser.add_argument("--name", required=True, help="Owner display name")
    parser.add_argument("--photo", help="Single photo path")
    parser.add_argument("--dir", help="Folder of photos for multi-embedding enrollment")
    parser.add_argument("--label", help="Source label (e.g. 'frontal', 'smile') for single photo")
    parser.add_argument("--clear", action="store_true", help="Clear existing embeddings for this uid first")
    args = parser.parse_args()

    if not args.photo and not args.dir:
        parser.error("Must provide either --photo or --dir")

    if args.dir:
        n = enroll_folder(args.uid, args.name, Path(args.dir), clear_first=args.clear)
        sys.exit(0 if n > 0 else 1)
    else:
        if args.clear:
            faces_db.clear_embeddings_for(args.uid)
        faces_db.upsert_person(uid=args.uid, owner_name=args.name, has_physical_card=False, photo_url=None)
        # Single photo — always auto-augment
        ok = enroll_photo(args.uid, args.name, Path(args.photo),
                          source_label=args.label, auto_augment=True)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
