-- Migration 006: Face recognition support for kiosk auto-login
-- Adds photo upload, consent tracking, and physical card status to cards.
-- Face embeddings live locally on the Pi in faces.db (SQLite) — never stored here.
-- Only the original photo URL and metadata are stored centrally.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS photo_url         VARCHAR(500);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_physical_card BOOLEAN DEFAULT FALSE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS face_enrolled_at  TIMESTAMPTZ;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS face_consent      BOOLEAN DEFAULT FALSE;

-- Backfill: existing cards are assumed to be physical cards
UPDATE cards SET has_physical_card = TRUE WHERE has_physical_card IS NULL;

-- Index for the Pi sync query (only fetch rows where a photo exists + consent given)
CREATE INDEX IF NOT EXISTS idx_cards_face_sync
    ON cards(face_enrolled_at)
    WHERE photo_url IS NOT NULL AND face_consent = TRUE;
