# WarungTek — System Design: Critical Thinking & Solutions

> A distilled record of the **doubts, logical challenges, and trade-offs** raised while building
> WarungTek, paired with the **decision that resolved each one** and where that decision now lives
> in the code. It is the "why it is the way it is" companion to the *what* in
> [master.md](../master.md) and the *how* in [technical-report.md](technical-report.md).

---

## 1. Purpose & method

This document is **reconstructed from durable project artifacts**, not from a transcript of every
conversation. The evidence base is:

- **Git history** — 40+ commits, where the recurring `fix(...)` / `feat(...)` pairs expose what
  broke and how it was repaired (e.g. `fix(ble): fix YOU-pin coordinate formula`,
  `fix(kiosk): retry stall fetch to survive Render cold starts`).
- **Recorded engineering decisions** — point-in-time notes kept across sessions (camera choice,
  Pi GPU constraints, deploy gotchas, firmware-flow change).
- **"Honest constraints" sections** already embedded in the deep-dive docs
  ([backend-sync-dataflow](backend-sync-dataflow.md) §5, [face daemon README](../daemon/face/README.md) §14,
  [map-navigation](features/map-navigation.md)).
- **Source comments** that capture a deliberate choice (e.g. the BCC-byte UID resolver in
  [`backend/src/routes/tap.ts`](../backend/src/routes/tap.ts)).

**How to read it.** §2 is the one-screen index — every major decision as a single row. §3 expands
each theme with the reasoning behind the row. §4 lists what is still open. Each row ends with a
*pointer* (file or commit) so a claim can be checked against the code rather than taken on trust.

---

## 2. Master decision log

| # | Area | The doubt / challenge | Options weighed | Resolution | Lives in |
|---|------|-----------------------|-----------------|------------|----------|
| 1 | Architecture | Where does the "truth" live when three device families can all mutate state? | Per-device local truth + sync; vs. one cloud as the only writer | **Cloud is the single source of truth; every device is a thin client** that reads/writes one API | [`backend/src/index.ts`](../backend/src/index.ts) |
| 2 | Face / camera | Pi 5 + Arducam CSI camera kept timing out (`Camera frontend has timed out`) | Debug CSI driver; switch USB webcam on Pi; run daemon on laptop, stream to Pi over LAN | **Abandon Arducam; run the face daemon on a laptop webcam, kiosk polls it over LAN** | `daemon/face/` + recorded decision |
| 3 | Face / accuracy | Single Supabase enrollment photo gave weak matches at the standard 0.62 threshold | Keep strict threshold; collect more photos; lower threshold + add temporal voting | **Lower `THRESHOLD_CONFIRMED` to 0.40, gate with 3-of-5 frame voting** | [`daemon/face/config.py`](../daemon/face/config.py) |
| 4 | Face / false positives | A confirmed match could "stick" to the wrong person | Instant single-frame match; vs. require agreement over time | **Smoothing buffer counts only *confirmed* votes; match expires after `MATCH_TTL=3 s`** | [`daemon/face/config.py`](../daemon/face/config.py) |
| 5 | Privacy | Is it acceptable to send face images to the cloud for recognition? | Cloud recognition; on-device recognition | **All embeddings computed and stored on-device (`faces.db`); only photos are pulled, never pushed** | [`daemon/face/README.md`](../daemon/face/README.md) |
| 6 | Vendor terminal | How do you bill "a scoop of food" fairly without a per-item barcode? | Flat price; weigh absolute mass; weigh mass *removed* from a shared tray | **Two-tap mass-deduction: tap 1 tares the tray to zero, tap 2 reads grams removed** | [`vendor-terminal.ino`](../firmware/vendor-terminal-arduino/vendor-terminal/vendor-terminal.ino) |
| 7 | Vendor terminal | Original 4-key flow (T/B/F/N) was clumsy for a vendor mid-service | Keep 4 keys; reduce to the minimum | **Reduced to 2 keys — `N` start session, `F` field-calibrate** | `vendor-terminal.ino` (commit `d76afe3c`) |
| 8 | Load cell | Calibration factor differs per physical cell — reflashing on-site is impractical | Hardcode + reflash; serial command to set & persist | **`F<number>` sets the scale factor and writes it to NVS — no reflash** | `vendor-terminal.ino` `loop()` |
| 9 | Load cell | The same card can't re-tap because a halted PICC ignores the next REQA | Force card removal; cycle the RC522 antenna | **Antenna off→on after each tap re-energises the same card as "new"** | `vendor-terminal.ino` `loop()` |
| 10 | NFC | Three readers emit three UID formats for one physical card | Force one format in firmware; reconcile server-side | **Server-side 3-step resolver: `uid` → `nfc_uid` → colon-insert + prefix `ilike` (BCC byte)** | [`tap.ts`](../backend/src/routes/tap.ts) L50–64 |
| 11 | Positioning | Should the phone broadcast or listen? | Phone as beacon; phone as scanner | **Phone is the scanner; fixed ESP32 stalls are the beacons** | [`useLivePosition.ts`](../apps/web/src/lib/useLivePosition.ts) |
| 12 | Positioning | RSSI is noisy; a raw reading jitters the "you are here" dot | Raw RSSI; smoothing | **EMA per-anchor (α=0.3) → log-distance model → least-squares trilateration** | [`trilaterate.ts`](../apps/web/src/lib/trilaterate.ts) |
| 13 | Positioning | Web Bluetooth scanning is Android-Chrome-only and needs an experimental flag | Drop the feature on iOS; build a native path | **Feature-detect + graceful fallback; optional Capacitor native BLE scan** | `useLivePosition.ts`, `nativeScan.ts` |
| 14 | Kiosk perf | Opening overlays on the Pi hung for *seconds* | Throttle animations; remove the cost | **Removed all 17 `backdrop-blur` usages — Pi GPU stalls on full-viewport blur** | recorded decision (2026-06-20) |
| 15 | Kiosk input | The capacitive touch panel reports as a plain pointer — native swipe-scroll dead | CSS overflow only; JS press-and-drag | **In-app drag-to-scroll (`dragScroll.ts`); hide scrollbars** | commit `6bce2b77` |
| 16 | Kiosk ops | `pkill -f chromium` over SSH killed the deploy session itself | `-f` match; exact `-x` match | **Use `pkill -x chromium` / `fuser -k` — never `-f` (it self-matches the SSH command)** | recorded deploy note |
| 17 | Backend | Render free tier cold-starts; first kiosk fetch 500s/times out | Accept failures; retry with backoff | **Kiosk retries the stall fetch to survive cold starts** | commit `ee73eade` |
| 18 | Backend | Should a card be blocked from visiting the same stall twice in a day? | One-visit-per-day guard; allow repeats | **Allow multiple visits per card per day (real markets re-buy)** | commit `9d9e55d1` |
| 19 | Web UX | Map was "too small / awkward to zoom" on a phone | Polish the +/- buttons; rework the layout | **Queued rework: full-screen map + draggable bottom sheet + pinch-zoom** (deferred) | recorded decision |
| 20 | Tooling | `python` on this machine resolved to the wrong interpreter | Fix PATH; pin the launcher | **Always invoke `py -3.11` for every Python command** | recorded preference |

---

## 3. Themes in depth

### 3.1 Face recognition & camera

The hardest single sub-system. Three linked challenges surfaced in sequence:

| Challenge | Reasoning | Resolution |
|-----------|-----------|------------|
| CSI camera unreliable on the Pi | The Arducam CSI frontend timed out repeatedly and was not converging; the laptop webcam was already validated | Keep the **laptop webcam**, bind the daemon to `0.0.0.0:5002`, have the Pi kiosk poll it over the LAN |
| Weak matches from one enrollment photo | A single cloud photo gives a thin embedding; 0.62 cosine rejected genuine users | Lower `THRESHOLD_CONFIRMED` → **0.40**, add a `THRESHOLD_POSSIBLE` 0.32 "wait for more frames" tier |
| Identity flicker / false positives | A momentary high score on a passer-by could log them in | **3-of-5 frame voting** on *confirmed* votes only, then a **3 s match TTL** so identity must be continuously re-proven |
| "Is this privacy-safe?" | Biometric data leaving the device is the line we would not cross | **Embeddings are computed and stored only in `faces.db` on the Pi; the daemon *pulls* photos, never *pushes* faces** |

Tuning constants are environment-aware (`PROXIMITY_BBOX_RATIO` 0.10 at desk distance vs 0.25 for
kiosk arm's-length), which is itself the resolution of the doubt *"will desk-tuned thresholds work
at a kiosk?"* — they are parameterised rather than hardcoded. See [`config.py`](../daemon/face/config.py).

### 3.2 Vendor terminal & load cell

| Challenge | Reasoning | Resolution |
|-----------|-----------|------------|
| Fair pricing for variable portions | Night-market food is sold by the scoop, not the unit | **Charge by the gram**: HX711 load cell + per-100g pricing computed by the backend |
| Which mass do you bill? | Absolute tray mass includes the bowl; vendors refill a shared tray | **Mass-deduction**: tap 1 tares to zero, tap 2 reads the grams *removed* (`delta = initial − final`) |
| Noisy cell → jumpy readings | A single `get_units()` read swings several grams | **Rolling window** of 8 samples @300 ms; "stable" = spread < 15 g held for 4 ticks (~1.2 s) |
| Drift over a long market night | Zero creeps as the cell warms / tray residue accumulates | **Per-session re-tare on `N`** — every customer starts from a fresh zero |
| Per-unit calibration without a laptop | Each cell's scale factor differs; reflashing on-site is impractical | **`F<number>` serial command** persists the factor to NVS; in-use value `63.22` (set in the `tap-weigh-test` sketch) |
| Same card can't tap twice | A halted PICC won't answer the next REQA used to detect "new card present" | **Cycle the RC522 antenna** (off→on) so the same card re-registers as new |

The two-tap state machine (`IDLE → ARMED → WEIGHING → IDLE`) with a 120 s timeout and a
"different card cancels & re-arms" fallback is the concrete embodiment of these decisions —
diagrammed in [technical-report.md](technical-report.md) §3.3.

### 3.3 NFC & UID reconciliation

The single most subtle correctness bug: **one physical card, three string formats.**

| Reader | Format | Example |
|--------|--------|---------|
| ESP32 terminal (`readUID()`) | no colons, uppercase | `831A5308` |
| Pi kiosk daemon (`_uid_int_to_string`) | colon-hex | `83:1A:53:08` |
| Phone Web NFC / stored card | colon-hex **+ BCC** byte | `83:1A:53:08:C2` |

Forcing one canonical format in firmware was rejected — the readers are heterogeneous and a phone's
Web NFC output is not under our control. Instead the **server reconciles**: try `uid`, then
`nfc_uid`, then insert colons every two characters and `ilike`-prefix-match to absorb the trailing
BCC byte ([`tap.ts`](../backend/src/routes/tap.ts) L50–64). The card's `uid` column is then the
stable internal key for all downstream writes.

### 3.4 BLE indoor positioning

| Challenge | Reasoning | Resolution |
|-----------|-----------|------------|
| Broadcast vs. scan | A phone that broadcasts can't be located by fixed infra without a backhaul | **Phone scans**; stalls broadcast a 31-byte packet (`VENUE_SERVICE_UUID` + 1-byte anchor minor) |
| RSSI → metres | Signal strength is noisy and non-linear | **Log-distance path-loss model** `d = 10^((rssi@1m − rssi)/(10n))`, calibrated `rssi@1m=−79`, `n=2.4` by least squares |
| Jumpy dot | Raw RSSI jitters frame-to-frame | **EMA smoothing (α=0.3)** per anchor before trilaterating |
| 3 circles rarely intersect cleanly | Measurement error makes the system over-determined | **Least-squares trilateration** (linearise, solve 2×2 normal equations), report RMS residual as the accuracy halo |
| Platform support | Web Bluetooth scanning is Android-Chrome-only + experimental flag; no iOS | **Feature-detect with graceful fallback**; an optional Capacitor **native BLE** path removes the flag requirement on Android |
| `YOU` pin in the wrong cell | The grid-to-screen coordinate formula was inverted | Fixed coordinate mapping (commit `5c5bf1f2`) and pinned the demo to a clean 10×10 m grid |

A deliberate honesty: the Capacitor native path is **present but not the production path**; the map
deep-dive flags it as a removal candidate rather than pretending it ships. See
[positioning-data-flow.md](positioning-data-flow.md).

### 3.5 Kiosk on Raspberry Pi

The Pi is the most resource-constrained surface, and several decisions exist only because of it:

- **No `backdrop-blur`.** Compositing a full-viewport blur on every overlay stalled first paint for
  *seconds* on the Pi GPU. All 17 usages were removed; plain translucent backgrounds look nearly
  identical and cost nothing.
- **App-level drag-scroll.** The `wch.cn` touch panel reports to Chromium as a plain pointer, so
  native swipe-scroll never fired; scrolling is implemented as press-and-drag in `dragScroll.ts`.
- **`pkill -x`, never `-f`.** Over SSH, `pkill -f chromium` matched the deploy command's own
  argv (which contains the word "chromium") and killed the session mid-script. The exact-match
  `-x` form (or `fuser -k` by port) is mandatory.
- **Deferred routes.** The map route is heavy; the kiosk defers it and routes straight to the
  dashboard to keep first interaction snappy (commit `21542c61`).

### 3.6 Backend & data consistency

| Challenge | Resolution | Honest caveat |
|-----------|------------|---------------|
| Render cold starts | Kiosk retries the stall fetch (`ee73eade`) | First request after idle still has visible latency |
| Repeat visits | Allow multiple taps per card per day (`9d9e55d1`) | A `DUPLICATE_TAP` 409 path still exists for the directory-rebate case |
| Which timestamp is authoritative? | **`server_timestamp` wins**; `device_timestamp` is informational | Device clocks (NTP, +08:00) can drift |
| Idempotency | Not yet implemented in firmware | A retried POST could double-log; flagged as open (§4) |

These are documented candidly rather than smoothed over — see
[backend-sync-dataflow.md](backend-sync-dataflow.md) §5.

### 3.7 Web UX & engagement

The portal went through an explicit *image-forward* redesign (`7910d677`) and grew an engagement
layer — a games hub (Flappy Burger, Block Hop, Stack Tower, Ingredient Slicer, Roti Road, Daily
Spin), a chick mascot assistant, and in-game music. The recurring challenge here was **"playful but
not heavy"**: the games are self-contained pages driven by a shared `useGameLoop` /
`useGameBackground` / `useGameMusic` set, and the mascot went through several iterations
(Sparkles → burger → frameless chick) to read clearly at small sizes. The mobile map's usability
complaint (§3.4 / row 19) is the one piece of this theme still **deferred**.

### 3.8 AI assistant

| Challenge | Resolution |
|-----------|------------|
| When should the model call a tool vs. answer from its own knowledge? | **Tools only for live, per-user/market data** (balance, calories, what's on sale tonight); general food knowledge answered directly |
| Never fabricate financial/health numbers | Hard rule: **always call a tool first**; never invent a balance, calorie count, or campaign progress |
| Write actions (join campaign, set goal) | Execute on clear intent and **confirm once in the same reply** — no double "are you sure?" |
| Leaking internal IDs | Never surface the card UID or internal IDs in a reply |
| Model cost | The assistant runs on **DeepSeek V4.0** (OpenAI-compatible API) — chosen to keep per-call cost low |

Encoded as the agent contract in [`backend/agent/warungtek-agent.md`](../backend/agent/warungtek-agent.md).

### 3.9 Dev workflow & tooling

- **`py -3.11`** is the pinned launcher for every Python command on this machine (the bare `python`
  resolved incorrectly).
- **Session separation by component** (vendor terminal vs. website) kept each working session
  focused and prevented cross-contaminating unrelated parts of the tree.
- **Figma-to-code** seeded the consumer UI (`design-export/`), then hand-refinement took over —
  the design tool was a starting point, not the system of record.

---

## 4. Open questions & deferred work

| Item | Status | Note |
|------|--------|------|
| Mobile map rework | **Deferred** | Full-screen map + draggable bottom sheet + pinch-zoom; queued behind confirming live BLE detection |
| Arducam CSI camera | **Parked** | Revisit only if a stable CSI driver/cable resolves the frontend timeout; laptop webcam is the working baseline |
| Firmware idempotency | **Open** | A retried `POST /api/tap` can double-log; needs a client-generated event id or server dedupe window |
| Capacitor native BLE path | **Candidate for removal** | Present but not the production path; keep or delete decisively |
| Render cold starts | **Accepted** | Retry mitigates; a warm host would remove the first-request latency entirely |

---

*Companion documents: [master.md](../master.md) · [technical-report.md](technical-report.md) ·
[backend-sync-dataflow.md](backend-sync-dataflow.md) · [daemon/face/README.md](../daemon/face/README.md)*
