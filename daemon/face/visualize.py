"""
Visual debug window — smooth live camera feed via MJPEG stream.

The daemon pushes annotated frames continuously via /stream.
This script just displays them — no camera access needed here.

Run with face_daemon.py running in Window 1:
    python -m daemon.face.visualize

Controls:
    Q  — quit
    R  — reload embeddings in daemon
"""

import cv2
import requests

from . import config

STREAM_URL = f"http://localhost:{config.DAEMON_PORT}/stream"
STATS_URL  = f"http://localhost:{config.DAEMON_PORT}/stats"
RELOAD_URL = f"http://localhost:{config.DAEMON_PORT}/reload"


def main():
    # Verify daemon is running
    try:
        stats = requests.get(STATS_URL, timeout=2).json()
        print(f"✅ Daemon connected — {stats['people_enrolled']} people enrolled, "
              f"{stats['embeddings_loaded']} embeddings loaded")
    except Exception:
        print("❌ face_daemon not reachable at localhost:5002. Start it in Window 1 first.")
        return

    print(f"📷 Opening MJPEG stream at {STREAM_URL}")
    print("   Press Q to quit, R to reload embeddings.\n")

    cap = cv2.VideoCapture(STREAM_URL)

    if not cap.isOpened():
        print("❌ Could not open stream. Is face_daemon running?")
        return

    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            print("⚠️  Stream interrupted — retrying...")
            cap.release()
            cap = cv2.VideoCapture(STREAM_URL)
            continue

        cv2.imshow("NightMarket — Face Recognition Debug (Q=quit R=reload)", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            try:
                requests.post(RELOAD_URL, timeout=2)
                stats = requests.get(STATS_URL, timeout=2).json()
                print(f"🔄 Reloaded — {stats['embeddings_loaded']} embeddings")
            except Exception:
                print("❌ Reload failed")

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
