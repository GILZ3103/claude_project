"""
Live recognition test — polls the daemon every 0.5s and prints results in real-time.
Run this in Window 2 while face_daemon.py is running in Window 1.

Usage:
    python -m daemon.face.test_live
"""

import time
import requests

URL = "http://localhost:5002/face/recognized"
STATS_URL = "http://localhost:5002/stats"

def main():
    # Show stats first
    try:
        stats = requests.get(STATS_URL, timeout=2).json()
        print(f"\n{'='*50}")
        print(f"  Face Daemon — Live Test")
        print(f"  People enrolled : {stats['people_enrolled']}")
        print(f"  Embeddings      : {stats['embeddings_loaded']}")
        print(f"  FPS             : {stats['fps']}")
        print(f"  Threshold       : {stats['thresholds']['confirmed']}")
        print(f"{'='*50}")
        print("  Sit in front of your camera. Press Ctrl+C to stop.\n")
    except Exception:
        print("❌ Daemon not reachable at localhost:5002. Is it running?")
        return

    last_uid = None

    while True:
        try:
            res = requests.get(URL, timeout=2)

            if res.status_code == 200:
                data = res.json()
                uid = data["uid"]

                if uid != last_uid:
                    print(f"\n✅ RECOGNISED: {data['owner_name']}")
                    print(f"   UID        : {uid}")
                    print(f"   Confidence : {data['confidence']:.3f}")
                    print(f"   Frames     : {data['frames_confirmed']}")
                    last_uid = uid
                else:
                    # Already printed this person — just show a dot to show it's live
                    print(f"   . still seeing {data['owner_name']} ({data['confidence']:.3f})", end="\r")

            elif res.status_code == 204:
                if last_uid is not None:
                    print("\n👋 Face left frame — back to watching...")
                    last_uid = None
                else:
                    print("👁  Watching... (no face detected)", end="\r")

        except requests.exceptions.ConnectionError:
            print("❌ Lost connection to daemon.")
            break
        except KeyboardInterrupt:
            print("\n\nStopped.")
            break

        time.sleep(0.5)

if __name__ == "__main__":
    main()
