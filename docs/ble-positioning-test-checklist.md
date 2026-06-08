# BLE Positioning — Visual Verification Test Checklist

**Feature:** Clean 10×10 m map showing 3 beacons, 3 vendors (each on a beacon), and a user dot, to verify positioning visually on the live consumer website.

**Status:** Awaiting deployment. Run this checklist once Vercel deploy is live.

**Source of truth:**
- `apps/web/src/pages/Map.tsx`
- `apps/web/src/lib/useLivePosition.ts`

**Minimum bar for "feature complete":** all of **A**, **B**, and **C** pass. **D** needs physical hardware; **E** is the deploy gate.

---

## A. Data / backend (Supabase + Render API)
- [ ] **A1** `/api/map` returns exactly **3 anchors** with `beacon_minor` 1, 2, 3
- [ ] **A2** Anchor coords are B1 (8,5), B2 (2,2), B3 (2,8); B1 is the reference (`beacon_minor === 1`)
- [ ] **A3** `/api/vendors` returns exactly **3 vendors**, each with `grid_x`/`grid_y` matching a beacon's coords
- [ ] **A4** Each beacon-vendor's `grid_x`/`grid_y` is within 0–10 (so it falls on the 10×10 grid)

## B. Map rendering (visual)
- [ ] **B1** Map shows **3 beacon markers** (indigo circles with radio icon) labeled `B1 (ref)`, `B2`, `B3`
- [ ] **B2** B1 has the yellow ring/highlight (reference styling)
- [ ] **B3** Map shows **only 3 vendor markers** — no stray vendors (pending filter edit)
- [ ] **B4** Each vendor marker sits **on top of** its beacon (same screen position)
- [ ] **B5** Vendor directory list below the map also shows only the 3 vendors
- [ ] **B6** Search + category filters don't surface vendors beyond the 3

## C. Debug panel (no Bluetooth needed — the key visual test)
- [ ] **C1** Wrench button (top-right) toggles the debug panel open/closed
- [ ] **C2** Panel shows 3 distance inputs labeled `B1 (ref) (8,5)`, `B2 (2,2)`, `B3 (2,8)`
- [ ] **C3** Entering **B1≈3, B2≈4.2, B3≈4.2** places the purple test dot at **~(5,5)** — center
- [ ] **C4** Indigo range rings appear around each beacon with radius = typed distance
- [ ] **C5** With fewer than 3 distances, no test dot; message prompts for all 3
- [ ] **C6** Moving one distance value visibly shifts the purple dot in the expected direction

## D. Live BLE (only if a real beacon is powered on)
- [ ] **D1** On Android Chrome (experimental flag on): `support` reads `supported`
- [ ] **D2** On iPhone/Safari: shows "Live tracking unavailable" fallback, no crash
- [ ] **D3** "Start live scan" → `scanState` becomes `scanning`, beacon count climbs as beacons are sensed
- [ ] **D4** With ≥3 beacons sensed, a blue live dot appears with an accuracy halo
- [ ] **D5** Walking toward one beacon moves the blue dot toward it

## E. Deploy / regression
- [ ] **E1** `tsc` / build passes
- [ ] **E2** Vercel deploy succeeds on the pushed commit
- [ ] **E3** Live site loads the map with no console errors
- [ ] **E4** Navigation path still draws when a vendor is selected (no regression)
