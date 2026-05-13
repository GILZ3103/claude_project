import { useEffect, useState } from 'react'
import { getAllFoods } from '../lib/api'
import { useKiosk } from '../context/KioskContext'

export default function FoodBrowserPanel() {
  const { card, setPanel, handleSelectStall, toggleEmergency } = useKiosk()
  const [foods, setFoods] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllFoods()
      .then((data: any) => setFoods(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = foods.filter((f: any) =>
    f.name.toLowerCase().includes(query.toLowerCase()) ||
    (f.vendors?.business_name ?? '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <button onClick={() => setPanel(card ? 'card' : 'home')} className="text-gray-500 text-sm underline">← Back</button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="px-6 pb-2">
        <h2 className="text-xl font-bold mb-3">Browse Food</h2>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search food or vendor..."
          className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 mt-3">
        {loading && (
          <div className="text-center text-gray-500 py-12">Loading food items...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">No food found.</div>
        )}

        {filtered.map((f: any) => {
          const vendor = f.vendors
          const stall = vendor ? {
            vendor_id: vendor.vendor_id,
            business_name: vendor.business_name,
            grid_x: vendor.grid_x ?? 0,
            grid_y: vendor.grid_y ?? 0,
          } : null

          return (
            <button
              key={f.food_id}
              onClick={() => stall ? handleSelectStall(stall) : setPanel('map')}
              className="w-full bg-white/10 hover:bg-white/20 rounded-2xl p-4 text-left flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">{f.name}</p>
                <p className="text-sm text-gray-400">{vendor?.business_name ?? 'Unknown vendor'}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-green-400 text-sm font-medium">{f.calories} kcal</p>
                {f.price_in_points && (
                  <p className="text-xs text-gray-500">RM {Number(f.price_in_points).toFixed(2)}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">📍 Navigate</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
