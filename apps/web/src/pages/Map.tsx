import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'motion/react'
import {
  MapPin, Search, Navigation, Flame, XCircle,
  Map as MapIcon, ShieldCheck, Maximize2, Minimize2, Bluetooth, Filter, X, Radio, Wrench
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getVendorFood, getAllFood } from '../lib/api'
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

export default function Map() {
  const [searchParams] = useSearchParams()
  const [vendors, setVendors] = useState<any[]>([])
  const [mapData, setMapData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [lowCalVendorIds, setLowCalVendorIds] = useState<Set<string>>(new Set())

  const initialFilter = (searchParams.get('filter') as QuickFilter) ?? 'all'
  const maxCalParam = searchParams.get('max_calories')

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
      <div className="flex items-center space-x-3 mb-5">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-orange-50 border border-orange-100">
          <MapIcon className="text-orange-500" size={20} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Vendor Map</h2>
      </div>

      {/* Map container */}
      <div
        id="map-view"
        className={`bg-orange-50/30 overflow-hidden relative ${isFullscreen
          ? 'fixed inset-0 z-[55] w-screen rounded-none border-0'
          : 'w-full rounded-[2rem] border border-gray-100 border-t-4 border-t-[#FF8A00] shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6'}`}
        style={{ height: isFullscreen ? '100dvh' : 420 }}
      >
        {/* Live-tracking status badge */}
        {(isNavigating || live.scanState === 'scanning') && (
          <div className="absolute top-3 left-3 z-20 max-w-[62%]">
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
            ) : live.support === 'unsupported' ? (
              <span className="inline-block bg-amber-50 text-amber-700 text-[11px] font-medium px-2.5 py-1 rounded-full shadow border border-amber-200">
                Live tracking unavailable here — showing directions
              </span>
            ) : null}
          </div>
        )}

        {/* Map controls — full-screen toggle replaces the old +/- zoom */}
        <div className="absolute top-3 right-3 z-30 flex flex-col space-y-2">
          <button
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className="bg-white p-2 rounded-xl shadow border border-gray-200 text-gray-600 hover:text-orange-500 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={() => setShowDebug(d => !d)} className={`p-2 rounded-xl shadow border transition-colors ${showDebug ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-gray-600 border-gray-200 hover:text-fuchsia-500'}`} title="Debug positioning">
            <Wrench size={18} />
          </button>
        </div>

        {/* 5×5 vendor grid — blocks build in order with staggered entrance */}
        <div className="w-full h-full overflow-auto p-3 [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-5 gap-2 auto-rows-fr" style={{ minHeight: '100%' }}>
            {Array.from({ length: Math.max(25, Math.ceil(filteredVendors.length / 5) * 5) }).map((_, idx) => {
              const v = filteredVendors[idx]

              if (!v) return (
                <motion.div
                  key={`slot-${idx}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03, duration: 0.25 }}
                  className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50"
                />
              )

              const isSelected = selectedVendorId === v.vendor_id
              const borderCls = CATEGORY_BORDERS[v.category] ?? CATEGORY_BORDERS.Default
              const bgCls = CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.Default

              return (
                <motion.div
                  key={v.vendor_id}
                  initial={{ opacity: 0, scale: 0.7, y: 14 }}
                  animate={{ opacity: 1, scale: isSelected ? 1.05 : 1, y: 0 }}
                  transition={{ delay: idx * 0.045, type: 'spring', stiffness: 300, damping: 22 }}
                  onClick={() => handleSelectVendor(v.vendor_id)}
                  className={`relative rounded-2xl border-[3px] cursor-pointer flex flex-col items-center justify-center overflow-hidden
                    ${isSelected
                      ? `${borderCls} shadow-xl ring-2 ring-orange-400/50 ring-offset-1`
                      : `${borderCls} opacity-85 hover:opacity-100 hover:shadow-md active:scale-95`
                    }`}
                >
                  {/* Category colour wash */}
                  <div className={`absolute inset-0 ${bgCls} ${isSelected ? 'opacity-20' : 'opacity-8'}`} />

                  {/* Scan-line shimmer on selected block */}
                  {isSelected && (
                    <motion.div
                      aria-hidden
                      initial={{ x: '-110%' }}
                      animate={{ x: '210%' }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
                      className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                    />
                  )}

                  <span className={`relative z-10 text-base font-black leading-none ${isSelected ? 'text-orange-500' : 'text-gray-700'}`}>
                    {(v.business_name ?? 'V')[0].toUpperCase()}
                  </span>
                  <span className="relative z-10 text-[8px] font-semibold text-center leading-tight px-1 text-gray-500 line-clamp-2 mt-1">
                    {v.business_name}
                  </span>

                  {isSelected && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: [1, 1.07, 1] }}
                      transition={{ duration: 1.1, repeat: Infinity }}
                      className="relative z-10 mt-1.5 text-[7px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full"
                    >
                      ▶ Navigating
                    </motion.span>
                  )}
                </motion.div>
              )
            })}
          </div>
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
              {/* Color header strip */}
              <div className={`h-2 ${colorCls}`} />
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
    </section>
  )
}
