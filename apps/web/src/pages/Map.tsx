import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  MapPin, Search, Navigation, Flame, XCircle,
  Map as MapIcon, ShieldCheck, ZoomIn, ZoomOut, Bluetooth, Filter, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getVendorFood, getAllFood } from '../lib/api'

type QuickFilter = 'all' | 'meals' | 'snacks' | 'drinks' | 'low-calorie'

const LOW_CAL_THRESHOLD = 400 // kcal — foods at or below this count as low-calorie

const CATEGORY_COLORS: Record<string, string> = {
  Meals: 'bg-orange-500',
  Snacks: 'bg-green-500',
  Drinks: 'bg-blue-500',
  Default: 'bg-purple-500',
}

const BASE_W = 900
const BASE_H = 600

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
  const [mapScale, setMapScale] = useState(1)

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [selectedVendorFood, setSelectedVendorFood] = useState<any[]>([])
  const [loadingFood, setLoadingFood] = useState(false)

  const [isNavigating, setIsNavigating] = useState(false)
  const [showBtPopup, setShowBtPopup] = useState(false)
  const [btAllowed, setBtAllowed] = useState(false)

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
    if (!btAllowed) { setShowBtPopup(true) }
    else { setIsNavigating(true) }
  }

  const cols = mapData?.grid_size?.cols ?? 10
  const rows = mapData?.grid_size?.rows ?? 10
  const kiosks: any[] = mapData?.kiosks ?? []

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

  // Normalize grid position to % within map, clamp 4-94%
  function toX(gx: number | null) {
    return gx != null ? Math.min(94, Math.max(4, (gx / cols) * 100)) : 50
  }
  function toY(gy: number | null) {
    return gy != null ? Math.min(94, Math.max(4, (gy / rows) * 100)) : 50
  }

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
        className="w-full bg-orange-50/30 rounded-[2rem] border border-gray-100 border-t-4 border-t-[#FF8A00] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative mb-6"
        style={{ height: 420 }}
      >
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col space-y-2">
          <button onClick={() => setMapScale(s => Math.min(s + 0.25, 2.5))} className="bg-white p-2 rounded-xl shadow border border-gray-200 text-gray-600 hover:text-orange-500 transition-colors">
            <ZoomIn size={18} />
          </button>
          <button onClick={() => setMapScale(s => Math.max(s - 0.25, 0.5))} className="bg-white p-2 rounded-xl shadow border border-gray-200 text-gray-600 hover:text-orange-500 transition-colors">
            <ZoomOut size={18} />
          </button>
        </div>

        {/* Scrollable map canvas */}
        <div className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden">
          <div
            className="relative"
            style={{
              width: BASE_W * mapScale,
              height: BASE_H * mapScale,
              transition: 'width 0.3s, height 0.3s'
            }}
          >
            {/* Grid background */}
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: 'linear-gradient(#fed7aa 1px, transparent 1px), linear-gradient(90deg, #fed7aa 1px, transparent 1px)',
              backgroundSize: '45px 45px'
            }} />

            {/* Zone labels */}
            <div className="absolute top-[22%] left-0 right-0 h-10 bg-gray-200/40 border-y border-dashed border-gray-300/50 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-60">Zone A — Food Court</span>
            </div>
            <div className="absolute top-[58%] left-0 right-0 h-10 bg-gray-200/40 border-y border-dashed border-gray-300/50 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-60">Zone B — Beverages</span>
            </div>

            {/* Navigation path */}
            {isNavigating && selectedVendor && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                  d={`M 10,90 L 10,${toY(selectedVendor.grid_y)} L ${toX(selectedVendor.grid_x)},${toY(selectedVendor.grid_y)}`}
                  fill="none" stroke="#3B82F6" strokeWidth="0.5" strokeDasharray="1.5 1"
                />
              </svg>
            )}

            {/* Bluetooth user dot */}
            {btAllowed && (
              <div className="absolute z-20 pointer-events-none" style={{ left: '10%', top: '88%' }}>
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md relative">
                  <motion.div
                    animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-blue-400 rounded-full"
                  />
                </div>
              </div>
            )}

            {/* Kiosk markers */}
            {kiosks.map((k: any) => (
              <div
                key={k.kiosk_id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${toX(k.grid_x)}%`, top: `${toY(k.grid_y)}%` }}
              >
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md border-2 border-white">
                  <span className="text-white text-xs font-black">K</span>
                </div>
                <span className="text-[9px] text-blue-600 font-bold mt-0.5 bg-white px-1 rounded shadow-sm">{k.label ?? 'Kiosk'}</span>
              </div>
            ))}

            {/* Vendor markers */}
            {filteredVendors.map(v => {
              const isSelected = selectedVendorId === v.vendor_id
              const colorCls = CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.Default
              return (
                <motion.div
                  key={v.vendor_id}
                  animate={{ scale: isSelected ? 1.35 : 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  onClick={() => handleSelectVendor(v.vendor_id)}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
                  style={{ left: `${toX(v.grid_x)}%`, top: `${toY(v.grid_y)}%` }}
                >
                  <motion.div
                    animate={isSelected ? { y: [0, -5, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={`w-10 h-10 rounded-full ${colorCls} border-[3px] border-white shadow-md flex items-center justify-center ${isSelected ? 'shadow-orange-300 shadow-lg' : ''}`}
                  >
                    <span className="text-white text-xs font-black">{(v.business_name ?? 'V')[0]}</span>
                  </motion.div>
                  {isSelected && (
                    <span className="text-[9px] font-bold mt-0.5 bg-white text-[#1A1A1A] px-1.5 py-0.5 rounded-full shadow-md max-w-[80px] truncate text-center">
                      {v.business_name}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Selected vendor overlay card */}
        <AnimatePresence>
          {selectedVendor && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', bounce: 0.25 }}
              className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 bg-white/95 backdrop-blur-md rounded-[1.5rem] shadow-2xl border border-white p-4 z-30"
            >
              <button
                onClick={() => { setSelectedVendorId(null); setIsNavigating(false) }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle size={18} />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <div className={`w-12 h-12 rounded-2xl ${CATEGORY_COLORS[selectedVendor.category] ?? CATEGORY_COLORS.Default} flex items-center justify-center shadow-md shrink-0`}>
                  <span className="text-white text-lg font-black">{(selectedVendor.business_name ?? 'V')[0]}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#1A1A1A] text-base leading-tight truncate">{selectedVendor.business_name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                <div className="mt-3 h-12 bg-gray-100 rounded-xl animate-pulse" />
              ) : selectedVendorFood.length > 0 ? (
                <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {selectedVendorFood.slice(0, 4).map((f: any) => (
                    <div key={f.food_item_id} className="flex justify-between text-xs bg-[#FAFAFA] px-3 py-1.5 rounded-lg">
                      <span className="font-medium text-[#1A1A1A] truncate max-w-[60%]">{f.name}</span>
                      <span className="text-[#6B7280]">{f.calories ?? '—'} kcal</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#6B7280] bg-gray-50 px-3 py-2 rounded-xl">No menu items listed yet.</p>
              )}

              <motion.button
                onClick={handleStartNavigation}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`w-full mt-3 py-2.5 rounded-xl font-semibold flex items-center justify-center space-x-2 text-sm shadow-md transition-colors ${isNavigating ? 'bg-blue-600 text-white' : 'bg-[#1A1A1A] text-white hover:bg-gray-800'}`}
              >
                <Navigation size={14} />
                <span>{isNavigating ? 'Navigating…' : 'Navigate Here'}</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'Default').map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            {cat}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-3 h-3 rounded bg-blue-600" />Kiosk
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
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Bluetooth Required</h3>
              <p className="text-sm text-[#6B7280] mb-8">Allow Bluetooth access for accurate indoor navigation and stall tracking.</p>
              <div className="flex space-x-3">
                <button onClick={() => setShowBtPopup(false)} className="flex-1 py-3.5 bg-gray-100 text-[#1A1A1A] font-semibold rounded-xl">Later</button>
                <button onClick={() => { setBtAllowed(true); setShowBtPopup(false); setIsNavigating(true) }} className="flex-1 py-3.5 bg-blue-600 text-white font-semibold rounded-xl shadow-md">Allow</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
