# Face Recognition — Plan & Pipeline

The WarungTek kiosk recognises returning customers via a Raspberry Pi camera (Arducam in production; laptop webcam during prototype). When a face is confirmed, the kiosk auto-enters user mode and shows a personalised UserBar — **without** requiring the customer to tap their NFC card.

This document explains the goals, the pipeline stage-by-stage, the libraries used, and what the system actually achieves.

---

## What it achieves

| Capability | Outcome |
|---|---|
| **Identify returning customers** | Recognises a face in ~0.5s, looks up the customer profile, opens UserBar |
| **Branch the user journey** | `has_physical_card=true` → "Tap card to earn 5 pts" / `false` → "Visit counter to get a card" |
| **No false positives** | Temporal smoothing requires 3-of-5 frame agreement before confirming an identity |
| **Privacy-first** | Face embeddings (512-dim vectors) live only on the Pi in `faces.db`; never sent to the cloud |
| **Multi-embedding** | 8+ embeddings per person (varied angles, expressions, lighting) — far more robust than single-photo systems |
| **Cold-start from one photo** | Enrollment auto-augments a single photo into 8 synthetic variants if needed |

End-to-end target: **recognise an enrolled customer in under 1 second, with confidence ≥ 0.65 (production threshold) or ≥ 0.40 (laptop-webcam prototype threshold)**.

---

## Why local + privacy by design

Cloud face recognition APIs (AWS Rekognition, Azure Face) would solve this in two API calls — but they require uploading the customer's face image with every recognition attempt. That:
1. Costs $1+ per 1,000 recognitions (rapidly adds up at a busy market)
2. Adds 200–500ms network latency on every frame
3. Means face images live on a third party's servers

The kiosk does everything **on-device**:
- Detection, embedding, matching → 100% local
- Cloud only sees the `uid` after recognition completes (same as an NFC tap would send)
- `faces.db` (SQLite) is never copied off the Pi

---

## Pipeline — Stage by Stage

```
Camera frame (BGR, 1280×720, 30 FPS)
        │
        ▼
┌──────────────────────┐
│ 1. Quality pre-filter│ ← Reject blurry / too dark / too bright frames before
│  (quality.py)         │   spending compute on the heavy models
└──────────┬───────────┘
           │ passes
           ▼
┌──────────────────────┐
│ 2. RetinaFace detect │ ← Find the face, return bbox + 5 landmarks +
│  (detector.py)        │   ArcFace embedding in one shot
└──────────┬───────────┘
           │ closest face only
           ▼
┌──────────────────────┐
│ 3. Proximity gate    │ ← Reject faces too far / too small for accurate
│  (quality.py)         │   recognition (PROXIMITY_BBOX_RATIO)
└──────────┬───────────┘
           │ close enough
           ▼
┌──────────────────────┐
│ 4. Multi-embedding   │ ← Cosine similarity against every embedding in
│    matcher           │   faces.db; max similarity per person wins
│  (matcher.py)         │
└──────────┬───────────┘
           │ (uid, similarity, decision)
           ▼
┌──────────────────────┐
│ 5. Temporal smoother │ ← Need 3-of-5 frame agreement before declaring
│  (smoother.py)        │   "confirmed" — kills false positives
└──────────┬───────────┘
           │ confirmed
           ▼
┌──────────────────────┐
│ 6. /face/recognized  │ ← Flask endpoint; TTL 10s
│    endpoint           │   React kiosk polls this every 1s
└──────────────────────┘
```

---

## Module Reference

### 1. `quality.py` — Pre-filter
**Job:** Reject obviously unusable frames before running expensive models.

| Check | Threshold | Why |
|---|---|---|
| Blur (Laplacian variance) | `≥ 20` (webcam) / `≥ 100` (Arducam) | Out-of-focus faces produce noisy embeddings |
| Brightness | 40 ≤ mean pixel ≤ 220 | Detection fails on near-black or blown-out frames |
| Face bbox ratio | `≥ 0.10` (webcam) / `≥ 0.25` (Arducam) | Too-far faces give low-quality embeddings |
| Min face pixels | `≥ 50px` width | RetinaFace can detect smaller, but recognition degrades |

**Library:** OpenCV (cv2)
**Cost:** ~1ms per frame — negligible

### 2. `detector.py` — RetinaFace
**Library:** [InsightFace](https://github.com/deepinsight/insightface) — `buffalo_l` model pack
**What it returns per face:**
- `bbox`: `(x1, y1, x2, y2)` pixel coords
- `kps`: 5-point landmarks (eyes, nose, mouth corners)
- `score`: detection confidence 0–1
- `embedding`: **512-dim ArcFace vector** (returned in the same call — InsightFace runs detection + recognition together)

**Models downloaded** (`~/.insightface/models/buffalo_l/`):
| Model | Purpose | Size |
|---|---|---|
| `det_10g.onnx` | RetinaFace ResNet-50 face detector | ~17 MB |
| `w600k_r50.onnx` | ArcFace ResNet-50 face recogniser | ~166 MB |
| `2d106det.onnx`, `1k3d68.onnx`, `genderage.onnx` | Loaded but ignored (we only need det + rec) | — |

**Cost:** ~400–500ms per frame on Pi 5 CPU, ~100–150ms on a laptop CPU. No GPU on Pi.
**Strategy:** `detect_closest()` returns only the largest face (biggest bbox area), since the kiosk only cares about whoever is standing right in front of it.

### 3. ArcFace embedding (called via detector)
**Output:** 512-dim L2-normalised float32 vector.

ArcFace's key property: embeddings of the same person cluster together in 512-dim space, while embeddings of different people are far apart — measured by **cosine similarity**.

> Same person, different photos: cosine sim ≈ 0.7–0.9
> Different people: cosine sim ≈ 0.0–0.3

This means a single scalar threshold (`THRESHOLD_CONFIRMED`) cleanly separates "same person" from "different person" in most cases.

### 4. `matcher.py` — Multi-embedding cosine match
**Strategy:** "Max similarity per person."

For each enrolled person with N embeddings:
1. Compute cosine similarity of the query embedding against all N
2. Take the **max** as that person's score
3. Whichever person has the highest max wins

This is far more robust than averaging — if a person was enrolled with 8 photos and the customer happens to look like one specific photo today, that one strong match is enough.

**Tiered decisions:**
| Cosine sim | Decision |
|---|---|
| `≥ THRESHOLD_CONFIRMED` (0.40 dev / 0.65 prod) | `confirmed` |
| `≥ THRESHOLD_POSSIBLE` (0.25 dev / 0.45 prod) | `possible` (don't act yet, wait for more frames) |
| `< THRESHOLD_POSSIBLE` | `unknown` |

### 5. `smoother.py` — Temporal voting
**Why:** A single frame is unreliable — motion blur, expression changes, and momentary occlusions can produce one bad prediction.

**Algorithm:** Sliding window over the last 5 frame predictions:
- Tally votes per `uid`
- Winner = uid with the most votes (tied → highest avg similarity)
- If winner has **≥ 3 votes** (`SMOOTHING_VOTES_REQUIRED`) → `confirmed`
- 2 votes → `pending`
- 0–1 votes → `unknown`

**Reset trigger:** Face leaves frame for > 3s → buffer cleared, smoother starts fresh.

### 6. `augment.py` — Single-photo enrollment expansion
When a customer enrols with just one photo (e.g. web app upload), we synthesise 8 variants:

| # | Augmentation |
|---|---|
| 1 | Original |
| 2 | Rotate +5° |
| 3 | Rotate −5° |
| 4 | Rotate +10° |
| 5 | Brightness +20% |
| 6 | Brightness −20% |
| 7 | Horizontal flip |
| 8 | Slight Gaussian blur (σ=0.8) |

Each variant runs through RetinaFace + ArcFace independently, producing 8 embeddings stored under the same `uid`. Dramatically boosts recall under varied real-world conditions vs. a single embedding.

### 7. `faces_db.py` — Local SQLite store
**Schema:**
```sql
embeddings(embedding_id, uid, owner_name, embedding BLOB, photo_url, source_label, created_at)
people(uid, owner_name, has_physical_card, photo_url, last_synced_at, threshold_override)
```

- `embedding BLOB` = `numpy.float32` bytes, 2048 bytes per row (512 × 4)
- One person → many rows in `embeddings`; one row in `people`
- Stored at `daemon/face/faces.db` — **never** synced to cloud

---

## Daemon Loop (`face_daemon.py`)

Runs **two threads**:

| Thread | FPS | Job |
|---|---|---|
| **Capture loop** | 30 (camera rate) | Read frames; overlay last bbox/name for `/stream` MJPEG endpoint |
| **Detection loop** | ~2 (model-limited) | Run quality → detect → match → smoother → update shared state |

State shared via locks. The capture loop produces smooth video at full camera FPS; the detection loop runs in the background at whatever speed the models allow. The customer-visible animations stay smooth even while CPU-bound recognition is in progress.

---

## HTTP API

| Endpoint | Method | Returns |
|---|---|---|
| `/face/recognized` | GET | `200 {uid, owner_name, confidence, frames_confirmed, timestamp}` if a confirmed match is within TTL (10s); else `204` |
| `/health` | GET | `{status: "ok"}` |
| `/stats` | GET | `{people_enrolled, embeddings_loaded, fps, thresholds}` |
| `/frame` | GET | Latest annotated frame as JPEG (one-shot) |
| `/stream` | GET | MJPEG multipart stream — live annotated camera feed |
| `/reload` | POST | Reload `_embeddings_cache` from `faces.db` (called by sync service after photo upload) |

CORS is open (`Access-Control-Allow-Origin: *`) so the React kiosk on `http://localhost:8080` can poll without preflight issues.

---

## Enrollment (`enroll.py`)

CLI for adding a face to the local DB. Run from the project root so the package imports resolve:

```powershell
# Multiple photos (best)
python -m daemon.face.enroll --uid "83:1A:53:08" --name "Lee Tian You" --dir enrollments/lee/

# Single photo (auto-augments to 8 variants)
python -m daemon.face.enroll --uid "83:1A:53:08" --name "Lee Tian You" --photo lee.jpg
```

For each photo:
1. RetinaFace finds the face → gets bbox + 5 landmarks
2. ArcFace generates a 512-dim embedding
3. Embedding stored as a BLOB row in `embeddings`

After enrolment, the daemon's `_embeddings_cache` reloads via the `POST /reload` endpoint (or daemon restart).

---

## Tuning constants (current laptop-webcam values)

In [`config.py`](config.py) — restore to **Arducam values** in the right column once hardware arrives:

| Constant | Webcam (current) | Arducam (target) |
|---|---|---|
| `PROXIMITY_BBOX_RATIO` | 0.10 | 0.25 |
| `MIN_FACE_PIXELS` | 50 | 80 |
| `QUALITY_BLUR_THRESHOLD` | 20 | 100 |
| `MIN_LANDMARK_VISIBILITY` | 0.70 | 0.90 |
| `MAX_POSE_DEGREES` | 40 | 30 |
| `THRESHOLD_CONFIRMED` | 0.40 | 0.65 |
| `THRESHOLD_POSSIBLE` | 0.25 | 0.45 |
| `SMOOTHING_VOTES_REQUIRED` | 3 | 4 |
| `MATCH_TTL_SECONDS` | 10.0 | 3.0 |

The webcam values are deliberately permissive to compensate for a typical laptop camera shooting at desk distance under office lighting. The Arducam mounted at the kiosk will operate at fixed arm's-length under controlled illumination, where stricter thresholds give zero false positives.

---

## What the recognition pipeline does NOT do

To set expectations clearly:

- **No liveness detection.** A high-quality printed photo of an enrolled customer would also match. Mitigation: NFC card is still required for any points/wallet operation; face only personalises the UI.
- **No anti-spoofing.** Same reason as above.
- **No identification of strangers.** Unknown faces produce `decision="unknown"` → kiosk stays in guest mode silently.
- **No mass enrolment from CCTV.** Customers explicitly opt-in by uploading a photo via the web app (with `face_consent=true` in the DB).
- **No demographic estimation.** The `genderage.onnx` model exists but is disabled.

---

## End-to-end timing budget (Pi 5)

| Stage | Cost |
|---|---|
| Camera capture | ~33 ms |
| Quality pre-filter | ~1 ms |
| RetinaFace + ArcFace (combined `app.get`) | ~450 ms |
| Cosine similarity (16 embeddings) | ~0.1 ms |
| Smoother + state update | ~0.1 ms |
| **Total per detection cycle** | **~480 ms** → ~2 FPS detection |
| Time to first confirmed match (3 frames) | ~1.5 s |

The 1.5s feels instant to a customer walking up to a kiosk — by the time they're settled and looking at the screen, the UserBar is already there.

---

## Related files

- [`face_daemon.py`](face_daemon.py) — Flask service + capture/detection threads
- [`enroll.py`](enroll.py) — CLI enrolment
- [`config.py`](config.py) — All tuning constants
- [`faces_db.py`](faces_db.py) — SQLite wrapper
- [`pipeline/`](pipeline/) — detector, recognizer, matcher, smoother, quality, augment, aligner, landmarks
- [`../../apps/kiosk/src/App.tsx`](../../apps/kiosk/src/App.tsx) — React polling + UserBar + FaceRecognizedModal triggers
- [`../../apps/kiosk/README.md`](../../apps/kiosk/README.md) — Kiosk app overview
