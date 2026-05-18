"""
NFC Daemon — runs on Raspberry Pi 5 alongside the Digital Directory Kiosk.
Exposes GET /nfc → { "uid": "04:AB:CD:EF" | null, "timestamp": "..." }

Hardware: RC522 RFID module via SPI
Library:  mfrc522 (pip install mfrc522 spidev)

SPI wiring (RC522 → Pi 5):
    SDA (SS)  → GPIO 8   (Pin 24)
    SCK       → GPIO 11  (Pin 23)
    MOSI      → GPIO 10  (Pin 19)
    MISO      → GPIO 9   (Pin 21)
    RST       → GPIO 25  (Pin 22)
    3.3V      → Pin 1    ← 3.3V ONLY, never 5V
    GND       → Pin 6

Run:
    python nfc_daemon.py
"""

import time
import threading
from datetime import datetime, timezone
from flask import Flask, jsonify

app = Flask(__name__)

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

_lock = threading.Lock()
_last = {"uid": None, "timestamp": None, "seen_at": 0.0}

# How long (seconds) a tapped UID stays "visible" before returning null
TAP_TTL = 3.0


def _uid_bytes_to_string(uid_bytes: list) -> str:
    """Convert RC522 UID byte list to colon-hex format: 04:AB:CD:EF"""
    return ":".join(f"{b:02X}" for b in uid_bytes)


def _uid_int_to_string(uid_int: int) -> str:
    """Convert RC522 integer UID to colon-hex: 04:AB:CD:EF"""
    byte_len = max(4, (uid_int.bit_length() + 7) // 8)
    uid_bytes = uid_int.to_bytes(byte_len, byteorder='big')
    return ":".join(f"{b:02X}" for b in uid_bytes)


def _make_reader():
    from mfrc522 import SimpleMFRC522
    return SimpleMFRC522()


def _reader_loop():
    """
    Continuously polls RC522. Reinitialises reader on error.
    """
    print("[nfc_daemon] RC522 ready (SPI)")

    while True:
        try:
            reader = _make_reader()
            while True:
                try:
                    uid, _ = reader.read_no_block()
                except Exception:
                    # Reader error — break inner loop to reinitialise
                    break

                if uid is not None:
                    uid_str = _uid_int_to_string(uid)
                    ts = datetime.now(timezone.utc).isoformat()
                    with _lock:
                        if _last["uid"] != uid_str:
                            print(f"[nfc_daemon] Card detected: {uid_str}")
                        _last["uid"] = uid_str
                        _last["timestamp"] = ts
                        _last["seen_at"] = time.monotonic()

                time.sleep(0.2)

        except Exception as e:
            print(f"[nfc_daemon] Reader error ({e}), reinitialising in 1s...")
            time.sleep(1)


@app.get("/nfc")
def get_nfc():
    with _lock:
        if _last["uid"] and (time.monotonic() - _last["seen_at"]) < TAP_TTL:
            return jsonify({"uid": _last["uid"], "timestamp": _last["timestamp"]})
    return jsonify({"uid": None, "timestamp": datetime.now(timezone.utc).isoformat()})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    t = threading.Thread(target=_reader_loop, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=5001)
