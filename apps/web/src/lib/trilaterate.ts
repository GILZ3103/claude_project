// Pure indoor-positioning math — no DOM, no Bluetooth. Unit-testable in isolation.
//
// Pipeline: beacon RSSI -> distance (log-distance path-loss model) -> trilateration
// in the venue grid space (same units as vendors/kiosks grid_x/grid_y).

export interface AnchorReading {
  /** Anchor position in grid units. */
  x: number
  y: number
  /** Estimated distance from the phone to this anchor, in grid units. */
  distance: number
}

export interface PositionEstimate {
  x: number
  y: number
  /** RMS residual between measured and predicted distances, in grid units.
   *  Used as the uncertainty radius for the map halo. */
  accuracy: number
}

/**
 * Convert a (smoothed) RSSI reading to a distance using the log-distance
 * path-loss model:  d = 10 ^ ((rssiAt1m - rssi) / (10 * n))
 */
export function rssiToDistance(rssi: number, rssiAt1m: number, pathLossN: number): number {
  if (!Number.isFinite(rssi) || pathLossN <= 0) return Infinity
  const d = Math.pow(10, (rssiAt1m - rssi) / (10 * pathLossN))
  return Math.max(0.01, d)
}

/**
 * Least-squares trilateration from >= 3 anchor distance readings.
 *
 * Linearises the circle equations by subtracting the last equation from each
 * of the others, then solves the 2x2 normal equations. Returns null when there
 * are fewer than 3 readings or the anchors are (near-)collinear (singular system).
 */
export function trilaterate(readings: AnchorReading[]): PositionEstimate | null {
  const pts = readings.filter(
    r => Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.distance)
  )
  if (pts.length < 3) return null

  const n = pts.length - 1
  const xn = pts[n].x
  const yn = pts[n].y
  const dn = pts[n].distance

  // A_i = [2(xn - xi), 2(yn - yi)]
  // b_i = di^2 - dn^2 - xi^2 - yi^2 + xn^2 + yn^2
  const A: Array<[number, number]> = []
  const b: number[] = []
  for (let i = 0; i < n; i++) {
    const { x: xi, y: yi, distance: di } = pts[i]
    A.push([2 * (xn - xi), 2 * (yn - yi)])
    b.push(di * di - dn * dn - xi * xi - yi * yi + xn * xn + yn * yn)
  }

  // Normal equations: (A^T A) v = A^T b, with A^T A a 2x2 matrix.
  let a11 = 0, a12 = 0, a22 = 0, bt1 = 0, bt2 = 0
  for (let i = 0; i < A.length; i++) {
    const [r1, r2] = A[i]
    a11 += r1 * r1
    a12 += r1 * r2
    a22 += r2 * r2
    bt1 += r1 * b[i]
    bt2 += r2 * b[i]
  }

  const det = a11 * a22 - a12 * a12
  if (Math.abs(det) < 1e-9) return null // collinear / degenerate anchors

  const x = (bt1 * a22 - bt2 * a12) / det
  const y = (a11 * bt2 - a12 * bt1) / det

  let sumSq = 0
  for (const p of pts) {
    const predicted = Math.hypot(x - p.x, y - p.y)
    const err = predicted - p.distance
    sumSq += err * err
  }
  const accuracy = Math.sqrt(sumSq / pts.length)

  return { x, y, accuracy }
}

/** Exponential moving average — smooths noisy per-anchor RSSI. */
export function ema(prev: number | undefined, next: number, alpha = 0.3): number {
  if (prev === undefined || !Number.isFinite(prev)) return next
  return alpha * next + (1 - alpha) * prev
}
