import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'motion/react'
import {
  MapPin, Search, Navigation, Flame, XCircle,
  Map as MapIcon, ShieldCheck, Maximize2, Minimize2, Bluetooth, Filter, X, Wrench
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getVendorFood, getAllFood } from '../lib/api'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { getVendorImage } from '../lib/foodImages'
import { useLivePosition, METERS_PER_GRID_CELL, type PositioningAnchor } from '../lib/useLivePosition'
import { trilaterate, type PositionEstimate } from '../lib/trilaterate'

type QuickFilter = 'all' | 'meals' | 'snacks' | 'drinks' | 'low-calorie'

const LOW_CAL_THRESHOLD = 400 // kcal — foods at or below this count as low-calorie

const CATEGORY_COLORS: Record<string, string> = {
  Meals: 'bg-orange-500',
  Snacks: 'bg-green-500',
  Drinks: 'bg-blue-500',
  Default: 'bg-purple-500',
}

const CATEGORY_BORDERS: Record<string, string> = {
  Meals: 'border-orange-500',
  Snacks: 'border-green-500',
  Drinks: 'border-blue-500',
  Default: 'border-purple-500',
}

// ── Simulated walking along walkway corridors ───────────────────────────────
type Pt = { left: number; top: number }

const WALK_SPEED = 6 // map-% per second — walking pace across the floor plan

// Hold a candidate "nearest beacon" this long before committing to it, so RSSI
// noise can't make the pin flap between stalls while the user is standing still.
const BEACON_SWITCH_DELAY = 1500 // ms

// The two dashed walkway lines drawn on the map SVG (0–100 coordinate space).
const CORRIDOR_X = 25
const CORRIDOR_Y = 30

const dist = (a: Pt, b: Pt) => Math.hypot(a.left - b.left, a.top - b.top)

const pathLength = (pts: Pt[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + Math.abs(p.left - pts[i].left) + Math.abs(p.top - pts[i].top), 0)

// Total arc-length of a polyline.
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0)

// Arc-length (from the start) of the closest point on the polyline to p. Used to
// turn "which beacon is nearest" into "how far along the route the user has got".
function projectArcLen(pts: Pt[], p: Pt): number {
  let best = Infinity, bestLen = 0, acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = dist(a, b)
    if (segLen === 0) continue
    const t = Math.max(0, Math.min(1,
      ((p.left - a.left) * (b.left - a.left) + (p.top - a.top) * (b.top - a.top)) / (segLen * segLen)))
    const proj = { left: a.left + t * (b.left - a.left), top: a.top + t * (b.top - a.top) }
    const d = dist(p, proj)
    if (d < best) { best = d; bestLen = acc + t * segLen }
    acc += segLen
  }
  return bestLen
}

// The point sitting `len` units along the polyline.
function pointAtLen(pts: Pt[], len: number): Pt {
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const segLen = dist(a, b)
    if (acc + segLen >= len) {
      const t = segLen === 0 ? 0 : (len - acc) / segLen
      return { left: a.left + t * (b.left - a.left), top: a.top + t * (b.top - a.top) }
    }
    acc += segLen
  }
  return pts[pts.length - 1]
}

// Waypoints to walk for one forward advance: the route vertices strictly between
// fromLen and toLen, then the exact point at toLen. Keeps corners on the path.
function subPath(pts: Pt[], fromLen: number, toLen: number): Pt[] {
  const out: Pt[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    acc += dist(pts[i - 1], pts[i])
    if (acc > fromLen && acc < toLen) out.push(pts[i])
  }
  out.push(pointAtLen(pts, toLen))
  return out
}

// Route from A to B along the corridors instead of cutting diagonally.
// Returns the waypoints to walk through (destination included, start excluded).
function routeViaWalkways(from: Pt, to: Pt): Pt[] {
  const viaH: Pt[] = [from, { left: from.left, top: CORRIDOR_Y }, { left: to.left, top: CORRIDOR_Y }, to]
  const viaV: Pt[] = [from, { left: CORRIDOR_X, top: from.top }, { left: CORRIDOR_X, top: to.top }, to]
  const route = pathLength(viaH) <= pathLength(viaV) ? viaH : viaV
  // Drop the start point and any zero-length hops so each segment really moves.
  return route.slice(1).filter((p, i, arr) => {
    const prev = i === 0 ? from : arr[i - 1]
    return Math.abs(p.left - prev.left) > 0.1 || Math.abs(p.top - prev.top) > 0.1
  })
}

export default function Map() {
  const [searchParams] = useSearchParams()
  const [vendors, setVendors] = useState<any[]>([])
  const [mapData, setMapData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [lowCalVendorIds, setLowCalVendorIds] = useState<Set<string>>(new Set())

  const initialFilter = (searchParams.get('filter') as QuickFilter) ?? 'all'
  const maxCalParam = searchParams.get('max_calories')
  const initialVendorId = searchParams.get('vendor')

  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialFilter)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [selectedVendorFood, setSelectedVendorFood] = useState<any[]>([])
  const [loadingFood, setLoadingFood] = useState(false)

  const [isNavigating, setIsNavigating] = useState(false)
  const [showBtPopup, setShowBtPopup] = useState(false)

  // Drag-to-dismiss for the navigation deck (handle-only, so the food list still scrolls)
  const deckDrag = useDragControls()
  // Live swipe position of the deck — drives the dismiss scrim + colour wash
  const deckY = useMotionValue(0)
  const scrimOpacity = useTransform(deckY, [0, 200], [0, 0.55])
  const swipeTint = useTransform(deckY, [0, 160], [0, 1])

  // Debug: manually entered distance (m) per beacon_minor → trilaterated test dot.
  const [showDebug, setShowDebug] = useState(false)
  const [debugDist, setDebugDist] = useState<Record<number, string>>({})

  useEffect(() => {
    const threshold = maxCalParam ? parseInt(maxCalParam) : LOW_CAL_THRESHOLD
    Promise.all([
      fetch(`${import.meta.env.VITE_API_URL}/api/vendors`).then(r => r.json()),
      fetch(`${import.meta.env.VITE_API_URL}/api/map`).then(r => r.json()),
      getAllFood() as Promise<any[]>,
    ]).then(([vRes, mRes, food]) => {
      setVendors(vRes.data ?? [])
      setMapData(mRes.data ?? null)
      // Build set of vendor IDs that have at least one food item under the threshold
      const ids = new Set<string>()
      ;(food ?? []).forEach((f: any) => {
        const cal = f.calories ?? (f.calories_per_100g ? f.calories_per_100g : null)
        if (cal != null && cal <= threshold && f.vendor_id) ids.add(f.vendor_id)
      })
      setLowCalVendorIds(ids)
      if (initialVendorId) {
        setSelectedVendorId(initialVendorId)
        setLoadingFood(true)
        getVendorFood(initialVendorId).then((food: any) => setSelectedVendorFood(food ?? []))
          .catch(() => setSelectedVendorFood([])).finally(() => setLoadingFood(false))
      }
    }).catch(() => toast.error('Failed to load map')).finally(() => setLoading(false))
  }, [])

  async function handleSelectVendor(vendorId: string) {
    setSelectedVendorId(vendorId)
    setIsNavigating(false)
    setLoadingFood(true)
    try {
      const food = await getVendorFood(vendorId) as any[]
      setSelectedVendorFood(food)
    } catch { setSelectedVendorFood([]) } finally { setLoadingFood(false) }
    document.getElementById('map-view')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function handleStartNavigation() {
    if (live.scanState === 'scanning') { setIsNavigating(true); return }
    // Offer to turn on live tracking if the device supports it; otherwise just
    // navigate with the static path (fallback for iPhone / unflagged browsers).
    if (live.support === 'supported') { setShowBtPopup(true) }
    else { setIsNavigating(true) }
  }

  // BLE positioning anchors (served by /api/map) → live position via Web Bluetooth.
  const anchors: PositioningAnchor[] = (mapData?.anchors ?? []).map((a: any) => ({
    anchor_id: a.anchor_id,
    label: a.label,
    beacon_minor: Number(a.beacon_minor),
    grid_x: Number(a.grid_x),
    grid_y: Number(a.grid_y),
    rssi_at_1m: Number(a.rssi_at_1m),
    path_loss_n: Number(a.path_loss_n),
    vendor_id: a.vendor_id ?? null,
    business_name: a.business_name ?? null,
  }))
  const live = useLivePosition(anchors)

  // Debug trilateration test dot — typed distances, no Bluetooth needed.
  const debugReadings = anchors
    .map(a => ({ x: a.grid_x, y: a.grid_y, distance: parseFloat(debugDist[a.beacon_minor] ?? '') }))
    .filter(r => Number.isFinite(r.distance) && r.distance > 0)
  const debugPosition: PositionEstimate | null =
    showDebug && debugReadings.length >= 3 ? trilaterate(debugReadings) : null

  const filteredVendors = vendors.filter(v => {
    const matchSearch = v.business_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const cat = (v.category ?? '').toLowerCase()
    const matchFilter =
      quickFilter === 'all' ? true :
      quickFilter === 'meals' ? cat === 'meals' :
      quickFilter === 'snacks' ? cat === 'snacks' :
      quickFilter === 'drinks' ? cat === 'drinks' :
      quickFilter === 'low-calorie' ? lowCalVendorIds.has(v.vendor_id) : true
    return matchSearch && matchFilter
  })

  const selectedVendor = vendors.find(v => v.vendor_id === selectedVendorId)

  const gridToPct = (gx: number, gy: number) => ({
    left: Math.min(88, Math.max(5, (gx / 10) * 83 + 5)),
    top:  Math.min(72, Math.max(5, (gy / 10) * 67 + 5)),
  })
  // Where the pin should stand to be "at" a stall — just in front of its pin.
  const stallPoint = (v: any): Pt => {
    const p = gridToPct(Number(v.grid_x), Number(v.grid_y))
    return { left: p.left, top: Math.min(78, p.top + 4) }
  }

  // ── Committed nearest beacon (debounced) ─────────────────────────────────
  // Raw RSSI flaps every second, so a stationary user would otherwise see the pin
  // shuffle between stalls. We only commit to a new strongest beacon once it has
  // held the lead for BEACON_SWITCH_DELAY — giving a stable target when still.
  const [committedMinor, setCommittedMinor] = useState<number | null>(null)
  useEffect(() => {
    const m = live.nearest?.beaconMinor ?? null
    if (m === committedMinor) return
    if (committedMinor === null && m !== null) { setCommittedMinor(m); return } // snap first lock
    const t = setTimeout(() => setCommittedMinor(m), BEACON_SWITCH_DELAY)
    return () => clearTimeout(t)
  }, [live.nearest?.beaconMinor, committedMinor])

  const committedAnchor = committedMinor != null
    ? anchors.find(a => a.beacon_minor === committedMinor) ?? null
    : null
  // The stall the committed beacon belongs to — drives the "nearest" readouts.
  const nearestVendor = committedAnchor?.vendor_id
    ? vendors.find(v => v.vendor_id === committedAnchor.vendor_id) ?? null
    : null

  // ── Walk-queue: animate the pin segment-by-segment along the corridors ────
  const [walkQueue, setWalkQueue] = useState<Pt[]>([])
  const posRef = useRef<Pt>({ left: 50, top: 85 })  // last settled position (on the route)

  // Active navigation: the chosen destination + how far along the route we've
  // committed to walking (monotonic — only advances toward the destination).
  const navTarget = isNavigating && selectedVendor ? stallPoint(selectedVendor) : null
  const routeRef = useRef<Pt[] | null>(null)
  const progressRef = useRef(0)

  // (Re)build the corridor route whenever navigation starts or the target changes.
  useEffect(() => {
    if (isNavigating && selectedVendor) {
      routeRef.current = [posRef.current, ...routeViaWalkways(posRef.current, stallPoint(selectedVendor))]
      progressRef.current = projectArcLen(routeRef.current, posRef.current)
    } else {
      routeRef.current = null
      progressRef.current = 0
    }
  }, [isNavigating, selectedVendorId])

  // Drive the pin. Navigation mode advances along the locked route toward the
  // chosen stall, using the committed beacon as a progress checkpoint. Free roam
  // walks to the committed nearest stall. Both react only to a committed-beacon
  // change, so a stationary user produces no movement.
  useEffect(() => {
    if (live.scanState !== 'scanning') return

    const route = routeRef.current
    if (route && navTarget) {
      const total = polyLen(route)
      const checkpoint = committedAnchor
        ? projectArcLen(route, gridToPct(committedAnchor.grid_x, committedAnchor.grid_y))
        : progressRef.current
      const next = Math.min(total, Math.max(progressRef.current, checkpoint))
      if (next - progressRef.current > 0.5) {
        const cur = projectArcLen(route, posRef.current)
        setWalkQueue(subPath(route, cur, next))
        progressRef.current = next
      }
      return
    }

    const target = nearestVendor?.grid_x != null
      ? stallPoint(nearestVendor)
      : live.position ? gridToPct(live.position.x, live.position.y) : null
    if (!target) return
    if (dist(posRef.current, target) < 1.5) return  // jitter guard
    setWalkQueue(routeViaWalkways(posRef.current, target))
  }, [committedMinor, isNavigating, selectedVendorId, live.scanState])

  const nextStop = walkQueue[0] ?? null
  const youDisplay = nextStop ?? posRef.current
  const segmentDuration = nextStop
    ? Math.max(0.4, pathLength([posRef.current, nextStop]) / WALK_SPEED)
    : 0.4

  const isWalking = walkQueue.length > 0
  const arrived = !!navTarget && walkQueue.length === 0 && dist(posRef.current, navTarget) < 2.5

  const navPath = navTarget ? { dest: navTarget, from: youDisplay } : null

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <div className="h-8 w-40 bg-gray-200 rounded-xl animate-pulse mb-5" />
        <div className="h-[400px] bg-gray-100 rounded-[2rem] animate-pulse" />
      </div>
    )
  }

  return (
    <section className="w-full px-4 pb-24 pt-4 bg-[#FAFAFA] min-h-[100dvh]">

      {/* Header */}
      {!isFullscreen && <div className="flex items-center space-x-3 mb-5">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-orange-50 border border-orange-100">
          <MapIcon className="text-orange-500" size={20} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Vendor Map</h2>
      </div>}

      {/* Map container */}
      <div
        id="map-view"
        className={`overflow-hidden relative ${isFullscreen
          ? 'fixed inset-0 z-[100] w-screen rounded-none border-0 bg-[#EEE9E0]'
          : 'w-full rounded-[2rem] border border-gray-100 border-t-4 border-t-[#FF8A00] shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 bg-[#EEE9E0]'}`}
        style={{ height: isFullscreen ? '100dvh' : 420 }}
      >
        {/* Live-tracking status badge — top-left */}
        <div className="absolute top-3 left-3 z-40 max-w-[62%] flex flex-col items-start gap-1.5">
          {live.scanState === 'scanning' && live.position ? (
            <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Live · {live.beaconCount} beacon{live.beaconCount === 1 ? '' : 's'} · ±{(live.position.accuracy * METERS_PER_GRID_CELL).toFixed(1)}m
            </span>
          ) : live.scanState === 'scanning' ? (
            <span className="inline-flex items-center gap-1.5 bg-white text-gray-600 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow border border-gray-200">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Searching for beacons…
            </span>
          ) : null}

          {/* Nearest-stall readout — strongest beacon → the vendor it's mounted at.
              Robust even with a single beacon in range (no trilateration needed). */}
          {live.scanState === 'scanning' && nearestVendor?.business_name && (
            <span className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow max-w-full">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">
                {navTarget && !arrived
                  ? `Heading to ${selectedVendor?.business_name} · near ${nearestVendor.business_name}`
                  : `You're at: ${nearestVendor.business_name}`}
              </span>
            </span>
          )}
        </div>

        {/* Map controls */}
        <div className="absolute top-3 right-3 z-40 flex flex-col items-end gap-2">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsFullscreen(f => !f)}
            className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 text-gray-700 hover:text-orange-500 hover:border-orange-200 transition-colors active:scale-95"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span className="text-xs font-bold">{isFullscreen ? 'Exit' : 'Full Map'}</span>
          </motion.button>
          {!isFullscreen && (
            <button onClick={() => setShowDebug(d => !d)} className={`p-2.5 rounded-xl shadow border transition-colors ${showDebug ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white/95 text-gray-600 border-gray-200 hover:text-fuchsia-500'}`} title="Debug positioning">
              <Wrench size={16} />
            </button>
          )}
        </div>

        {/* 20×20 wayfinding map — vendor stalls occupy only the top-left 5×5 zone */}
        <div className="absolute inset-0 overflow-hidden">

          {/* 20×20 grid + vendor zone highlight */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Fine grid lines — one per unit on a 20×20 canvas */}
            {Array.from({ length: 19 }).map((_, i) => (
              <g key={i}>
                <line x1={`${(i + 1) * 5}`} y1="0" x2={`${(i + 1) * 5}`} y2="100" stroke="#C9C5BE" strokeWidth="0.25" />
                <line x1="0" y1={`${(i + 1) * 5}`} x2="100" y2={`${(i + 1) * 5}`} stroke="#C9C5BE" strokeWidth="0.25" />
              </g>
            ))}
            {/* Bold quarter-lines at every 5 units (25%) */}
            {[25, 50, 75].map(p => (
              <g key={p}>
                <line x1={`${p}`} y1="0" x2={`${p}`} y2="100" stroke="#B5B0A8" strokeWidth="0.5" />
                <line x1="0" y1={`${p}`} x2="100" y2={`${p}`} stroke="#B5B0A8" strokeWidth="0.5" />
              </g>
            ))}
            {/* Main walkway — rendered as roads: solid bed + dashed centerline */}
            <g strokeLinecap="round">
              <line x1="25" y1="0" x2="25" y2="100" stroke="#A8A29B" strokeWidth="2.4" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#A8A29B" strokeWidth="2.4" />
              <line x1="25" y1="0" x2="25" y2="100" stroke="#FFFFFF" strokeWidth="0.4" strokeDasharray="3 2.2" opacity={0.8} />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#FFFFFF" strokeWidth="0.4" strokeDasharray="3 2.2" opacity={0.8} />
            </g>
          </svg>

          {/* Navigation path — L-shaped route from YOU to selected vendor */}
          {navPath && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={`${navPath.from.left},${navPath.from.top} ${navPath.dest.left},${navPath.from.top} ${navPath.dest.left},${navPath.dest.top}`}
                fill="none"
                stroke="#FF8A00"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                strokeLinecap="round"
                opacity={0.8}
              />
              <circle cx={navPath.dest.left} cy={navPath.dest.top} r="2.5" fill="#FF8A00" opacity={0.9} />
            </svg>
          )}

          {/* Vendor stalls — scattered across the full map canvas */}
          {filteredVendors.map((v, idx) => {
            const isSelected = selectedVendorId === v.vendor_id
            // The stall whose beacon the phone hears strongest (debounced) = where the user is.
            const isNearest  = live.scanState === 'scanning' && nearestVendor?.vendor_id === v.vendor_id
            const borderCls  = CATEGORY_BORDERS[v.category] ?? CATEGORY_BORDERS.Default
            const bgCls      = CATEGORY_COLORS[v.category]  ?? CATEGORY_COLORS.Default

            const col  = idx % 5
            const row  = Math.floor(idx / 5)
            const gx   = v.grid_x != null ? Number(v.grid_x) : col * 2
            const gy   = v.grid_y != null ? Number(v.grid_y) : row * 2.5
            const { left, top } = gridToPct(gx, gy)

            return (
              <div
                key={v.vendor_id}
                className="absolute"
                style={{ left: `${left}%`, top: `${top}%`, width: '8%', height: '10%', transform: 'translate(-50%,-50%)' }}
              >
                {/* "You are standing here" pulse — the stall whose beacon is strongest */}
                {isNearest && (
                  <motion.div
                    aria-hidden
                    animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-xl bg-orange-400/50 pointer-events-none"
                  />
                )}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: isSelected ? 1.15 : 1 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ delay: idx * 0.06, type: 'spring', stiffness: 300, damping: 22 }}
                  onClick={() => handleSelectVendor(v.vendor_id)}
                  className={`w-full h-full cursor-pointer border-[2.5px] rounded-xl flex flex-col items-center justify-center overflow-hidden relative
                    ${isSelected
                      ? `${borderCls} shadow-xl ring-2 ring-orange-400/70 ring-offset-1`
                      : `${borderCls} shadow-md`
                    }`}
                >
                  <div className={`absolute inset-0 ${bgCls} ${isSelected ? 'opacity-20' : 'opacity-10'}`} />
                  {isSelected && (
                    <motion.div
                      aria-hidden
                      initial={{ x: '-120%' }}
                      animate={{ x: '220%' }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
                      className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12"
                    />
                  )}
                  <span className={`relative z-10 text-[10px] font-black leading-none ${isSelected ? 'text-orange-500' : 'text-gray-700'}`}>
                    {(v.business_name ?? 'V')[0].toUpperCase()}
                  </span>
                  {isSelected && (
                    <motion.span
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 text-[6px] font-bold bg-orange-500 text-white px-1.5 py-[1px] rounded-full whitespace-nowrap shadow"
                    >
                      ▶ Here
                    </motion.span>
                  )}
                </motion.div>

                {/* Name label below the block */}
                <div className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                  <span className="text-[6px] font-semibold text-gray-600 bg-white/80 px-1 rounded whitespace-nowrap leading-tight block text-center max-w-[60px] truncate">
                    {v.business_name}
                  </span>
                </div>
              </div>
            )
          })}

          {/* "YOU are here" pin — walks along the corridor lines segment by segment */}
          <motion.div
            animate={{ opacity: 1, left: `${youDisplay.left}%`, top: `${youDisplay.top}%` }}
            initial={{ opacity: 0, left: '50%', top: '85%' }}
            transition={{
              left: { type: 'tween', duration: segmentDuration, ease: 'linear' },
              top: { type: 'tween', duration: segmentDuration, ease: 'linear' },
              opacity: { duration: 0.6 },
            }}
            onAnimationComplete={() => {
              if (walkQueue.length > 0) {
                posRef.current = walkQueue[0]
                setWalkQueue(q => q.slice(1))
              }
            }}
            className="absolute z-50 pointer-events-none flex flex-col items-center"
            style={{ transform: 'translate(-50%, -100%)' }}
          >
            {/* Expanding ping only while actually moving; a calm dot when idle */}
            {isWalking && (
              <motion.div
                animate={{ scale: [1, 1.7, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute top-0 w-12 h-12 rounded-full bg-orange-400/40"
              />
            )}
            <div className={`relative w-12 h-12 rounded-full border-[3px] border-white shadow-2xl flex flex-col items-center justify-center ${live.scanState === 'scanning' ? 'bg-orange-500' : 'bg-gray-400'}`}>
              <span className="text-white text-[10px] font-black leading-none">YOU</span>
              <span className="text-white text-[7px] font-semibold leading-tight">are here</span>
            </div>
            <div className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent -mt-px ${live.scanState === 'scanning' ? 'border-t-orange-500' : 'border-t-gray-400'}`} />
            {live.scanState === 'scanning' && (navTarget
              ? (
                <span className="mt-1 text-[7px] font-bold text-orange-700 bg-white/85 px-1.5 py-0.5 rounded-full shadow whitespace-nowrap">
                  {arrived
                    ? `Arrived at ${selectedVendor?.business_name}`
                    : `→ ${selectedVendor?.business_name}${nearestVendor?.business_name ? ` · near ${nearestVendor.business_name}` : ''}`}
                </span>
              )
              : nearestVendor?.business_name && (
                <span className="mt-1 text-[7px] font-bold text-orange-700 bg-white/85 px-1.5 py-0.5 rounded-full shadow whitespace-nowrap">
                  Near {nearestVendor.business_name}
                </span>
              ))}
          </motion.div>

          {/* Persistent tracking button — tapping starts BLE scan or re-triggers the BT popup */}
          <AnimatePresence>
            {live.scanState !== 'scanning' && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22 }}
                onClick={handleStartNavigation}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1A1A1A]/90 backdrop-blur text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl border border-white/10 active:scale-95 transition-transform whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                {live.scanState === 'error' ? 'Retry live tracking' : 'Enable live tracking'}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Beacon search progress when scanning but no fix yet */}
          {live.scanState === 'scanning' && !live.position && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/90 backdrop-blur text-gray-600 text-xs font-semibold px-3 py-2 rounded-2xl shadow border border-gray-200 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Searching for beacons… ({live.beaconCount}/3)
            </div>
          )}

        </div>

        {/* Selected vendor — futuristic navigation deck (swipe the handle down to dismiss) */}
        <AnimatePresence>
          {selectedVendor && (
            <>
              {/* Swipe scrim — the map darkens the further you pull the deck down */}
              <motion.div
                aria-hidden
                style={{ opacity: scrimOpacity }}
                className="pointer-events-none absolute inset-0 z-20 bg-[#1A1A1A]"
              />

            <motion.div
              key="nav-deck"
              initial={{ opacity: 0, y: 130 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 130 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[22rem] z-30"
            >
              {/* Ambient glow that breathes — the "alive" futuristic cue */}
              <motion.div
                aria-hidden
                animate={{ opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-orange-400/40 via-fuchsia-400/20 to-blue-400/30 blur-2xl"
              />

              {/* Draggable layer — its live Y position drives the swipe scrim + colour wash */}
              <motion.div
                drag="y"
                dragListener={false}
                dragControls={deckDrag}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.55 }}
                style={{ y: deckY }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 110 || info.velocity.y > 700) {
                    setSelectedVendorId(null); setIsNavigating(false)
                  }
                }}
                className="relative"
              >
              {/* Glass deck with a gradient hairline border */}
              <div className="relative rounded-t-[1.75rem] sm:rounded-[1.75rem] p-[1.5px] bg-gradient-to-b from-white/80 via-white/30 to-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.14)] sm:shadow-2xl">
                <div className="relative rounded-t-[1.65rem] sm:rounded-[1.65rem] bg-white/75 backdrop-blur-2xl overflow-hidden">

                  {/* Swipe colour wash — an orange tint rises from the bottom as you pull down */}
                  <motion.div
                    aria-hidden
                    style={{ opacity: swipeTint }}
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-orange-500/45 via-orange-400/15 to-transparent"
                  />

                  {/* Scan-line sheen sweeping across the top edge */}
                  <motion.div
                    aria-hidden
                    initial={{ x: '-120%' }}
                    animate={{ x: '220%' }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
                    className="pointer-events-none absolute top-0 left-0 h-[2px] w-1/2 bg-gradient-to-r from-transparent via-orange-400 to-transparent"
                  />

                  {/* Drag handle (mobile) — grab here to pull the deck down */}
                  <div
                    onPointerDown={(e) => deckDrag.start(e)}
                    className="sm:hidden flex justify-center pt-3 pb-1.5 cursor-grab active:cursor-grabbing touch-none relative z-10"
                  >
                    <div className="h-1.5 w-11 rounded-full bg-gray-300/90" />
                  </div>

                  <div className="relative z-10 px-5 pb-5 pt-3 sm:pt-5">
                    <button
                      onClick={() => { setSelectedVendorId(null); setIsNavigating(false) }}
                      className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-700 transition-colors p-1 z-10"
                    >
                      <XCircle size={20} />
                    </button>

                    <div className="flex items-start gap-3.5 pr-8">
                      <div className={`w-14 h-14 rounded-2xl ${CATEGORY_COLORS[selectedVendor.category] ?? CATEGORY_COLORS.Default} flex items-center justify-center shadow-lg shrink-0 ring-1 ring-white/60`}>
                        <span className="text-white text-xl font-black">{(selectedVendor.business_name ?? 'V')[0]}</span>
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="font-bold text-[#1A1A1A] text-lg leading-tight truncate">{selectedVendor.business_name}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] uppercase font-bold bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-md">
                            {selectedVendor.category ?? 'Vendor'}
                          </span>
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <ShieldCheck size={9} /> Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Food items */}
                    {loadingFood ? (
                      <div className="mt-4 h-14 bg-gray-100 rounded-xl animate-pulse" />
                    ) : selectedVendorFood.length > 0 ? (
                      <div className="mt-4 space-y-2 max-h-32 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {selectedVendorFood.slice(0, 5).map((f: any) => (
                          <div key={f.food_item_id} className="flex justify-between items-center text-xs bg-[#FAFAFA] px-3.5 py-2 rounded-xl">
                            <span className="font-medium text-[#1A1A1A] truncate max-w-[62%]">{f.name}</span>
                            <span className="text-[#6B7280] tabular-nums">{f.calories ?? '—'} kcal</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-[#6B7280] bg-gray-50 px-3.5 py-2.5 rounded-xl">No menu items listed yet.</p>
                    )}

                    <motion.button
                      onClick={handleStartNavigation}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className={`relative w-full mt-4 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm overflow-hidden transition-colors ${isNavigating ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30' : 'bg-[#1A1A1A] text-white hover:bg-gray-800 shadow-md'}`}
                    >
                      {isNavigating && (
                        <motion.span
                          aria-hidden
                          initial={{ x: '-120%' }}
                          animate={{ x: '220%' }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/20 blur-md skew-x-12"
                        />
                      )}
                      {isNavigating ? (
                        <motion.span
                          animate={{ scale: [1, 1.25, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-white"
                        />
                      ) : (
                        <Navigation size={15} />
                      )}
                      <span className="relative">{isNavigating ? 'Navigating…' : 'Navigate Here'}</span>
                    </motion.button>
                  </div>
                </div>
              </div>
              </motion.div>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Everything below is hidden in fullscreen */}
      {!isFullscreen && <>

      {/* Debug positioning panel */}
      {showDebug && (
        <div className="mb-6 bg-white rounded-2xl border border-fuchsia-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={15} className="text-fuchsia-600" />
            <h3 className="font-bold text-sm text-[#1A1A1A]">Debug positioning (10×10 m grid, 1 cell = 1 m)</h3>
          </div>

          <p className="text-[11px] text-[#6B7280] mb-2">
            Type the distance (m) from the phone to each beacon. With 3 values the purple test dot is trilaterated — no Bluetooth needed. Phone at centre (5,5) ⇒ B1≈3, B2≈4.2, B3≈4.2.
          </p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {anchors.map(a => (
              <label key={a.anchor_id} className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-indigo-700">
                  B{a.beacon_minor}{a.beacon_minor === 1 ? ' (ref)' : ''} ({a.grid_x},{a.grid_y})
                </span>
                <input
                  type="number" inputMode="decimal" min="0" step="0.1" placeholder="m"
                  value={debugDist[a.beacon_minor] ?? ''}
                  onChange={e => setDebugDist(d => ({ ...d, [a.beacon_minor]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-fuchsia-400"
                />
              </label>
            ))}
          </div>

          {debugPosition ? (
            <p className="text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 px-3 py-1.5 rounded-lg">
              Test dot → ({debugPosition.x.toFixed(2)}, {debugPosition.y.toFixed(2)}) · residual ±{debugPosition.accuracy.toFixed(2)} m
            </p>
          ) : (
            <p className="text-xs text-[#6B7280] bg-gray-50 px-3 py-1.5 rounded-lg">Enter all 3 distances to place the test dot.</p>
          )}

          {/* Live BLE readout — what the phone actually senses */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#1A1A1A]">Live BLE</span>
              <span className="text-[10px] text-[#6B7280]">{live.support} · {live.scanState} · {live.beaconCount} beacon(s)</span>
            </div>
            {live.scanState !== 'scanning' ? (
              <button onClick={() => live.start()} className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg">Start live scan</button>
            ) : (
              <button onClick={() => live.stop()} className="text-xs font-semibold bg-gray-200 text-[#1A1A1A] px-3 py-1.5 rounded-lg">Stop scan</button>
            )}
            {live.nearest && (
              <p className="text-xs text-orange-700 mt-2">
                Nearest stall → {live.nearest.businessName ?? `beacon ${live.nearest.beaconMinor}`} · RSSI {live.nearest.rssi.toFixed(0)} dBm
              </p>
            )}
            {live.position && (
              <p className="text-xs text-blue-700 mt-2">
                Live dot → ({live.position.x.toFixed(2)}, {live.position.y.toFixed(2)}) · ±{(live.position.accuracy * METERS_PER_GRID_CELL).toFixed(1)} m
              </p>
            )}
            {live.error && <p className="text-xs text-red-500 mt-1">{live.error}</p>}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'Default').map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            {cat}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-3 h-3 rounded-full bg-indigo-500" />Beacon
        </span>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280] group-focus-within:text-orange-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search stalls…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all shadow-sm placeholder:text-[#6B7280]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto gap-2 pb-1 [&::-webkit-scrollbar]:hidden">
          {([
            { key: 'all', label: 'All', icon: <Filter size={12} /> },
            { key: 'meals', label: 'Meals', icon: <Flame size={12} /> },
            { key: 'snacks', label: 'Snacks', icon: null },
            { key: 'drinks', label: 'Drinks', icon: null },
            { key: 'low-calorie', label: `≤${maxCalParam ?? LOW_CAL_THRESHOLD} kcal`, icon: null },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${quickFilter === f.key ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md' : 'bg-white text-[#6B7280] border-gray-200 hover:border-gray-300'}`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setQuickFilter('all')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${quickFilter === 'all' ? '' : 'bg-white text-green-600 border-green-200 hover:border-green-300'}`}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Vendor directory grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#6B7280] bg-white rounded-2xl border border-dashed border-gray-200">
            <MapPin size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No stalls match your search</p>
          </div>
        ) : filteredVendors.map(v => {
          const isSelected = selectedVendorId === v.vendor_id
          const colorCls = CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.Default
          return (
            <motion.div
              key={v.vendor_id}
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleSelectVendor(v.vendor_id)}
              className={`bg-white rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 shadow-sm ${isSelected ? 'border-orange-400 ring-2 ring-orange-100 shadow-orange-100 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
            >
              {/* Vendor photo header */}
              <div className="relative h-24 overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={getVendorImage(v)}
                  alt={v.business_name}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${colorCls}`} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className={`font-bold text-[#1A1A1A] text-sm truncate ${isSelected ? 'text-orange-500' : ''}`}>{v.business_name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-md">{v.category ?? 'Vendor'}</span>
                      <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                        <ShieldCheck size={9} />Verified
                      </span>
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${colorCls} flex items-center justify-center shadow-sm shrink-0`}>
                    <span className="text-white text-sm font-black">{(v.business_name ?? 'V')[0]}</span>
                  </div>
                </div>
                {v.description && (
                  <p className="text-xs text-[#6B7280] mt-2 line-clamp-2">{v.description}</p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-[10px] text-[#6B7280]">
                    {v.food_item_count > 0 ? `${v.food_item_count} items on menu` : 'Menu coming soon'}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-green-400" title="Open" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Bluetooth popup */}
      <AnimatePresence>
        {showBtPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBtPopup(false)} className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center z-50">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-blue-100">
                <Bluetooth size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Enable Live Tracking</h3>
              <p className="text-sm text-[#6B7280] mb-2">Allow Bluetooth so your phone can sense the stall beacons and show your live position on the map.</p>
              {live.error && <p className="text-xs text-red-500 mb-2">{live.error}</p>}
              <p className="text-[11px] text-gray-400 mb-6">Works on Android Chrome. Keep this page open while you walk.</p>
              <div className="flex space-x-3">
                <button onClick={() => { setShowBtPopup(false); setIsNavigating(true) }} className="flex-1 py-3.5 bg-gray-100 text-[#1A1A1A] font-semibold rounded-xl">Later</button>
                <button onClick={async () => { setShowBtPopup(false); setIsNavigating(true); await live.start() }} className="flex-1 py-3.5 bg-blue-600 text-white font-semibold rounded-xl shadow-md">Allow</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </>}  {/* end !isFullscreen */}
    </section>
  )
}
