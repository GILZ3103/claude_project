import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowLeft, Store, MapPin, Utensils } from 'lucide-react'
import toast from 'react-hot-toast'
import { getVendors, getVendorFood } from '../lib/api'
import { VendorCard } from '../components/VendorCard'
import { FoodCard } from '../components/FoodCard'
import { HeroHeader } from '../components/HeroHeader'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { getVendorImage } from '../lib/foodImages'

export default function Vendors() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [food, setFood] = useState<any[]>([])
  const [foodLoading, setFoodLoading] = useState(false)

  useEffect(() => {
    getVendors()
      .then((res: any) => {
        const list = res.vendors ?? res ?? []
        setVendors(list)
        setFiltered(list)
      })
      .catch(() => toast.error('Failed to load vendors'))
      .finally(() => setLoading(false))
  }, [])

  function handleSearch(val: string) {
    setSearch(val)
    const q = val.toLowerCase()
    setFiltered(vendors.filter(v =>
      v.business_name.toLowerCase().includes(q) ||
      (v.category ?? '').toLowerCase().includes(q)
    ))
  }

  async function openVendor(vendor: any) {
    setSelected(vendor)
    setFoodLoading(true)
    try {
      const res = await getVendorFood(vendor.vendor_id) as any
      setFood(res.food ?? res ?? [])
    } catch {
      toast.error('Failed to load menu')
    } finally {
      setFoodLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto pb-24">
        <div className="h-44 bg-gray-100 animate-pulse rounded-b-[2.5rem]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  // ── Vendor detail view ──
  if (selected) {
    return (
      <div className="max-w-3xl mx-auto pb-24 bg-[#FAFAFA] min-h-[100dvh]">
        <div className="relative h-52 w-full overflow-hidden rounded-b-[2.5rem] shadow-md">
          <ImageWithFallback
            src={getVendorImage(selected, food[0])}
            alt={selected.business_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <button
            onClick={() => { setSelected(null); setFood([]) }}
            className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-[#1A1A1A] text-sm font-semibold px-3 py-2 rounded-xl shadow-sm hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="absolute bottom-4 left-5 right-5 z-10">
            {selected.category && (
              <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg mb-2">
                <Utensils className="w-3 h-3" /> {selected.category}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-white leading-tight drop-shadow">{selected.business_name}</h1>
            {selected.grid_x != null && (
              <p className="inline-flex items-center gap-1 text-white/85 text-xs font-medium mt-1">
                <MapPin className="w-3.5 h-3.5" /> Stall ({selected.grid_x}, {selected.grid_y})
              </p>
            )}
          </div>
        </div>

        {selected.description && (
          <p className="text-sm text-[#6B7280] px-6 pt-4 leading-relaxed">{selected.description}</p>
        )}

        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          <Utensils className="w-4 h-4 text-orange-500" />
          <h2 className="text-base font-bold text-[#1A1A1A]">Menu</h2>
        </div>

        {foodLoading ? (
          <div className="grid grid-cols-2 gap-4 px-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : food.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Utensils className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm">No items listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 px-6">
            {food.map((item: any) => {
              const enriched = {
                ...item,
                vendor_id: item.vendor_id ?? selected?.vendor_id,
                vendor_name: item.vendor_name ?? selected?.business_name,
              }
              return (
                <FoodCard
                  key={item.food_id}
                  item={enriched}
                  onClick={() => navigate(`/food/${enriched.food_item_id ?? enriched.food_id}`, { state: { item: enriched } })}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Vendor list view ──
  return (
    <div className="max-w-3xl mx-auto pb-24 bg-[#FAFAFA] min-h-[100dvh]">
      <HeroHeader title="Discover Vendors" subtitle="Explore the night market" seed="vendors" height="h-44">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />
          <input
            type="search"
            className="w-full bg-white/20 backdrop-blur-sm text-white placeholder-white/70 pl-10 pr-4 py-3 rounded-2xl border border-white/30 focus:outline-none focus:bg-white/30 transition-all text-sm font-medium"
            placeholder="Search vendors or category…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </HeroHeader>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Store className="w-10 h-10 mb-3 text-gray-300" />
          <p className="text-sm">{search ? 'No vendors match your search.' : 'No vendors yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {filtered.map((v: any) => (
            <VendorCard key={v.vendor_id} vendor={v} onClick={() => openVendor(v)} />
          ))}
        </div>
      )}
    </div>
  )
}
