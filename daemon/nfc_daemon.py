"""
NFC Daemon — runs on Raspberry Pi 4 alongside the Digital Directory Kiosk.
Exposes GET /nfc → { "uid": "04:AB:CD:EF" | null, "timestamp": "..." }

Hardware: PN532 NFC module via I2C
Library:  adafruit-circuitpython-pn532

Install:
  pip install flask adafruit-circuitpython-pn532

Run:
  python nfc_daemon.py
"""

import time
import threading
from datetime import datetime, timezone
from flask import Flask, jsonify

app = Flask(__name__)

# Last seen NFC tap (uid, timestamp). Protected by a lock.
_lock = threading.Lock()
_last = {"uid": None, "timestamp": None, "seen_at": 0.0}

# How long (seconds) a tapped UID stays "visible" before returning null
TAP_TTL = 3.0

# ── PN532 reader thread ───────────────────────────────────────────────────────

def _uid_to_string(uid_bytes: bytes) -> str:
    return ":".join(f"{b:02X}" for b in uid_bytes)

def _reader_loop():
    """
    Continuously polls PN532 for an NFC card. Runs in a background thread.
    Gracefully degrades to no-op if PN532 library is not available (dev mode).
    """
    try:
        import board
        import busio
        from adafruit_pn532.i2c import PN532_I2C

        i2c = busio.I2C(board.SCL, board.SDA)
        pn532 = PN532_I2C(i2c, debug=False)
        pn532.SAM_configuration()
        print("[nfc_daemon] PN532 ready")

        while True:
            uid = pn532.read_passive_target(timeout=0.5)
            if uid:
                uid_str = _uid_to_string(uid)
                ts = datetime.now(timezone.utc).isoformat()
                with _lock:
                    _last["uid"] = uid_str
                    _last["timestamp"] = ts
                    _last["seen_at"] = time.monotonic()
            time.sleep(0.1)

    except Exception as e:
        print(f"[nfc_daemon] PN532 unavailable ({e}). Running in stub mode — no UIDs will be detected.")
        # In stub mode the thread just parks here
        while True:
            time.sleep(60)


# ── Flask routes ──────────────────────────────────────────────────────────────

@app.get("/nfc")
def get_nfc():
    with _lock:
        if _last["uid"] and (time.monotonic() - _last["seen_at"]) < TAP_TTL:
            return jsonify({"uid": _last["uid"], "timestamp": _last["timestamp"]})
    return jsonify({"uid": None, "timestamp": datetime.now(timezone.utc).isoformat()})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    t = threading.Thread(target=_reader_loop, daemon=True)
    t.start()
    # Listen on all interfaces so the kiosk app (same Pi) can reach it
    app.run(host="0.0.0.0", port=5001)
