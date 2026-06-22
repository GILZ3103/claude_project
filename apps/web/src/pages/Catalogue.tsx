import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Store, Utensils } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAllFood } from '../lib/api'
import { FoodCard } from '../components/FoodCard'
import { HeroHeader } from '../components/HeroHeader'

// The all-food endpoint has no category field, so we derive quick filters from
// the food name. Keep these buckets aligned with lib/foodImages keyword groups.
const CATEGORIES: { label: string; test: RegExp }[] = [
  { label: 'Satay & Grill', test: /satay|skewer|kebab|grill|bbq/i },
  { label: 'Rice & Noodles', test: /noodle|mee|kway|kuey|nasi|rice|fried|laksa/i },
  { label: 'Seafood', test: /fish|prawn|squid|crab|seafood|sotong|ikan/i },
  { label: 'Snacks', test: /takoyaki|ball|nugget|snack|popiah|keropok|fries|burger/i },
  { label: 'Drinks', test: /tea|coffee|kopi|juice|milo|soda|water|drink|smoothie|latte|teh/i },
  { label: 'Desserts', test: /dessert|cake|ice|bingsu|cendol|sweet|mango|cream|kuih/i },
]

export default function Catalogue() {
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)

  useEffect(() => {
    getAllFood()
      .then((res: any) => setItems((res ?? []) as any[]))
      .catch(() => toast.error('Failed to load food catalogue'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const cat = CATEGORIES.find(c => c.label === activeCat)
    return items.filter(f => {
      const matchQ = !q || f.name?.toLowerCase().includes(q) || f.vendor_name?.toLowerCase().includes(q)
      const matchCat = !cat || cat.test.test(f.name ?? '')
      return matchQ && matchCat
    })
  }, [items, query, activeCat])

  return (
    <div className="max-w-3xl mx-auto pb-24 bg-[#FAFAFA] min-h-[100dvh]">
      <HeroHeader title="Food Catalogue" subtitle="Browse everything available tonight" seed="catalogue" height="h-44">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search food or vendor…"
            className="w-full bg-white/20 backdrop-blur-sm text-white placeholder-white/70 pl-10 pr-4 py-3 rounded-2xl border border-white/30 focus:outline-none focus:bg-white/30 transition-all text-sm font-medium"
          />
        </div>
      </HeroHeader>

      {/* Category quick filters */}
      <div className="flex gap-2 overflow-x-auto px-6 pt-5 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          onClick={() => setActiveCat(null)}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${activeCat === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.label}
            onClick={() => setActiveCat(c.label)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${activeCat === c.label ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Browse by vendor */}
      <div className="px-6 pt-3">
        <button
          onClick={() => navigate('/vendors')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-[#1A1A1A] hover:border-orange-300 transition-colors"
        >
          <Store className="w-4 h-4 text-orange-500" /> Browse by vendor
        </button>
      </div>

      {/* Food grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 p-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Utensils className="w-10 h-10 mb-3 text-gray-300" />
          <p className="text-sm">{query || activeCat ? 'No food matches your filters.' : 'No food available yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-6">
          {filtered.map((f: any) => (
            <FoodCard key={f.food_item_id} item={f} onClick={() => navigate(`/food/${f.food_item_id ?? f.food_id}`, { state: { item: f } })} />
          ))}
        </div>
      )}
    </div>
  )
}
