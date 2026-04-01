// Vendors — Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { getVendors, getVendorFood } from '../lib/api'
import toast from 'react-hot-toast'

export default function Vendors() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [food, setFood] = useState<any[]>([])
  const [foodLoading, setFoodLoading] = useState(false)

  useEffect(() => {
    getVendors()
      .then((res: any) => setVendors(res.vendors ?? res ?? []))
      .catch(() => toast.error('Failed to load vendors'))
      .finally(() => setLoading(false))
  }, [])

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
      <div className="p-6 max-w-lg mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (selected) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-gray-500 flex items-center gap-1"
        >
          ← Back
        </button>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="font-bold text-lg">{selected.business_name}</p>
          <p className="text-xs text-gray-400">{selected.category}</p>
          {selected.description && (
            <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
          )}
        </div>

        <p className="text-sm font-medium">Menu</p>

        {foodLoading && (
          <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        )}

        {!foodLoading && food.length === 0 && (
          <p className="text-sm text-gray-400">No items listed.</p>
        )}

        {!foodLoading && food.map((item: any) => (
          <div key={item.food_id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-gray-400">{item.calories} kcal</p>
            </div>
            <p className="font-semibold text-green-700">RM {Number(item.price_in_points).toFixed(2)}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Vendors</h2>

      {vendors.length === 0 && (
        <p className="text-sm text-gray-400">No vendors yet.</p>
      )}

      {vendors.map((v: any) => (
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
