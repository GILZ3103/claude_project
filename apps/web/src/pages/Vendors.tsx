import { useEffect, useState } from 'react'
import { getVendors, getVendorFood } from '../lib/api'
import toast from 'react-hot-toast'

export default function Vendors() {
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
      <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (selected) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
        <button
          onClick={() => { setSelected(null); setFood([]) }}
          className="text-sm text-gray-500 flex items-center gap-1"
        >
          ← Back to Vendors
        </button>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="font-bold text-lg">{selected.business_name}</p>
          <p className="text-xs text-gray-400">{selected.category}</p>
          {selected.description && (
            <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
          )}
          {selected.grid_x != null && (
            <p className="text-xs text-gray-400 mt-1">Location: Grid ({selected.grid_x}, {selected.grid_y})</p>
          )}
        </div>

        <p className="text-sm font-medium">Menu</p>

        {foodLoading && <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />}

        {!foodLoading && food.length === 0 && (
          <p className="text-sm text-gray-400">No items listed.</p>
        )}

        {!foodLoading && food.map((item: any) => (
          <div key={item.food_id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                {item.photo_url && (
                  <img src={item.photo_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.calories} kcal</p>
                  {(item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      P: {item.protein_g}g · C: {item.carbs_g}g · F: {item.fat_g}g
                    </p>
                  )}
                </div>
              </div>
              <p className="font-semibold text-green-700 shrink-0">RM {Number(item.price_in_points).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
      <h2 className="text-xl font-bold">Vendors</h2>

      {/* Search bar */}
      <input
        type="search"
        className="w-full border rounded-xl px-4 py-3 text-sm bg-white shadow-sm"
        placeholder="Search vendors or category..."
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400">{search ? 'No vendors match your search.' : 'No vendors yet.'}</p>
      )}

      {filtered.map((v: any) => (
        <button
          key={v.vendor_id}
          onClick={() => openVendor(v)}
          className="w-full bg-white rounded-xl shadow p-4 text-left flex justify-between items-center"
        >
          <div>
            <p className="font-semibold">{v.business_name}</p>
            <p className="text-xs text-gray-400">{v.category}</p>
          </div>
          <span className="text-gray-300 text-lg">›</span>
        </button>
      ))}
    </div>
  )
}
