# Face Recognition Daemon

High-accuracy face recognition pipeline for the NightMarket kiosk.
Runs on the Raspberry Pi 5 (CPU-only) and exposes results via HTTP for the React kiosk app to consume.

**Pipeline**: RetinaFace detection → MediaPipe 478 landmarks → ArcFace embedding → multi-embedding match → temporal smoothing.

---

## Project Structure

```
daemon/face/
├── config.py              ← Thresholds, paths, camera settings (edit here, not in code)
├── face_daemon.py         ← Live recognition service (Flask, port 5002)
├── enroll.py              ← Multi-embedding enrollment from photo files
├── faces_db.py            ← SQLite helpers — local embedding store
├── pipeline/
│   ├── detector.py        ← RetinaFace wrapper (insightface)
│   ├── landmarks.py       ← MediaPipe 478-point landmarks
│   ├── aligner.py         ← Affine transform to canonical 112×112
│   ├── quality.py         ← Blur / brightness / pose / size gates
│   ├── recognizer.py      ← ArcFace embedding (for enrollment path)
│   ├── matcher.py         ← Cosine similarity + multi-embedding
│   └── smoother.py        ← Temporal smoothing (4-of-5 vote)
├── requirements.txt
└── README.md (this file)
```

---

## Phase 2 — Local Development (Laptop)

### Setup (Windows / macOS / Linux)

```bash
cd daemon/face

# Create virtual environment
python -m venv face-env
# Windows:
face-env\Scripts\activate
# macOS/Linux:
source face-env/bin/activate

pip install -r requirements.txt
```

First run will download the `buffalo_l` model pack (~250 MB) to `~/.insightface/models/`.

### Smoke test the daemon

```bash
# Start the daemon (uses your webcam)
python -m daemon.face.face_daemon
```

Then in another terminal:

```bash
curl http://localhost:5002/health
# → {"status": "ok", "service": "face_daemon"}

curl http://localhost:5002/stats
# → {"people_enrolled": 0, "embeddings_loaded": 0, "fps": 1.8, ...}

curl http://localhost:5002/face/recognized
# → 204 No Content (no faces enrolled yet)
```

You should see your webcam light come on. Move close so your face fills ~25% of frame width.

### Enroll a test face

1. Take 5–10 photos of yourself with your phone — vary angles, expressions, lighting
2. Save them to `daemon/face/enrollments/test_user/`
3. Run:

```bash
python -m daemon.face.enroll --uid TEST001 --name "Test User" --dir daemon/face/enrollments/test_user/ --clear
```

4. Restart the daemon — it loads embeddings at startup
5. Walk up to your webcam
6. After ~1.5–2 seconds:

```bash
curl http://localhost:5002/face/recognized
# → {"uid": "TEST001", "owner_name": "Test User", "confidence": 0.87, "frames_confirmed": 4, ...}
```

---

## Phase 3 — Calibration

Critical step. Real-world accuracy comes from tuning, not just models.

1. Collect ~50 same-person photo pairs (different photos of the same people)
2. Collect ~50 different-person pairs
3. Run the pipeline on each, compute cosine similarities
4. Plot the distribution to find your optimal `THRESHOLD_CONFIRMED`
5. Update `config.py`

(A `calibrate.py` script will be added in a future iteration.)

---

## Phase 4 — Pi Deployment

### Hardware
- Raspberry Pi 5 (4GB)
- Arducam B01678MP 8MP PTZ camera (CSI ribbon)
- Proper 27W USB-C PSU (5V/2.4A power bank is NOT sufficient)

### Install on Pi

```bash
# On the Pi via SSH
sudo apt update
sudo apt install -y python3-pip python3-venv \
                    libatlas-base-dev libopenblas-dev \
                    libhdf5-dev libcamera-dev

cd /home/hokahheng11
python3 -m venv face-env
source face-env/bin/activate

# Install — same requirements + picamera2
pip install -r daemon/face/requirements.txt
pip install picamera2
```

### Switch camera source

In `config.py`, set `CAMERA_INDEX=0` and use V4L2 path via `cv2.VideoCapture`, **OR** swap `_camera_loop` in `face_daemon.py` to use `picamera2` for the CSI camera (Arducam recommends this).

### Run as systemd service

Create `/etc/systemd/system/face-daemon.service`:

```ini
[Unit]
Description=NightMarket Face Recognition Daemon
After=network.target

[Service]
Type=simple
User=hokahheng11
WorkingDirectory=/home/hokahheng11/claude_project
ExecStart=/home/hokahheng11/face-env/bin/python -m daemon.face.face_daemon
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now face-daemon
sudo systemctl status face-daemon
```

---

## Tuning Reference (config.py)

| Setting | Default | When to change |
|---|---|---|
| `PROXIMITY_BBOX_RATIO` | 0.25 | Higher → user must stand closer to trigger |
| `MIN_FACE_PIXELS` | 80 | Lower if camera is far from subjects |
| `QUALITY_BLUR_THRESHOLD` | 100 | Lower in dim environments (more false positives though) |
| `THRESHOLD_CONFIRMED` | 0.65 | Higher = fewer false accepts; lower = fewer false rejects |
| `SMOOTHING_VOTES_REQUIRED` | 4 (of 5) | Higher = more stable but slower to confirm |
| `MATCH_TTL_SECONDS` | 3.0 | How long after face leaves before state clears |
| `DETECT_EVERY_N_FRAMES` | 2 | Increase to reduce CPU at cost of latency |

---

## HTTP API (for React kiosk app)

| Method | Endpoint | Response |
|---|---|---|
| GET | `/face/recognized` | 200 `{uid, owner_name, confidence, frames_confirmed, timestamp}` OR 204 |
| GET | `/health` | 200 `{status: "ok", service: "face_daemon"}` |
| GET | `/stats` | 200 `{people_enrolled, embeddings_loaded, fps, thresholds}` |
| POST | `/reload` | 200 `{reloaded: N}` — forces embedding cache reload after sync |

The React app should poll `/face/recognized` every 1s from HomePanel.

---

## Performance Notes

| Stage | Pi 5 timing |
|---|---|
| Camera capture | ~30 ms |
| Quality pre-filter | ~10 ms |
| RetinaFace detection | ~150–200 ms |
| MediaPipe landmarks | ~50 ms |
| ArcFace embedding | ~200–250 ms (bundled with detection in InsightFace) |
| Matching | ~5–20 ms |
| **Full pipeline** | **~450–550 ms (~2 FPS)** |

Time to confirmed match with 4-of-5 voting: **~1.8 seconds**.

If too slow:
1. `DETECT_EVERY_N_FRAMES = 3`
2. Drop `CAMERA_WIDTH/HEIGHT` to 640×480
3. Switch `INSIGHTFACE_MODEL_PACK` to `buffalo_sc` (MobileNet variant)
4. Add a Coral USB Accelerator (~$60, ~10× speedup)

---

## Next Steps (Phase 7+ — after recognition works reliably)

1. Backend endpoints to upload + list photos
2. Web app photo upload UI
3. `face_sync.py` — pull photos from backend → run enroll pipeline → POST /reload
4. Kiosk React integration (poll `/face/recognized`)
5. NfcDispenserPanel for the "Get NFC card?" flow

See main project plan for full integration.
