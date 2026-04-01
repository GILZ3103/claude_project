// Menu — manage food items
// Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { getVendorFood, addFoodItem } from '../lib/api'
import toast from 'react-hot-toast'

export default function Menu() {
  const { vendorId } = useVendor()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', calories: '', price_in_points: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (vendorId) load()
  }, [vendorId])

  async function load() {
    setLoading(true)
    try {
      const res = await getVendorFood(vendorId!) as any
      setItems(res.food ?? res ?? [])
    } catch {
      toast.error('Failed to load menu')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorId) return
    setSaving(true)
    try {
      await addFoodItem(vendorId, {
        name: form.name,
        calories: Number(form.calories),
        price_in_points: Number(form.price_in_points),
      })
      toast.success('Item added!')
      setForm({ name: '', calories: '', price_in_points: '' })
      setShowForm(false)
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Menu Items</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-black text-white text-sm px-4 py-2 rounded-lg"
        >
          + Add Item
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-medium text-sm">New Item</h3>
          <input
            required
            className="w-full border rounded-lg px-4 py-2 text-sm"
            placeholder="Item name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <div className="flex gap-3">
            <input
              required
              type="number"
              className="flex-1 border rounded-lg px-4 py-2 text-sm"
              placeholder="Calories (kcal)"
              value={form.calories}
              onChange={e => setForm(p => ({ ...p, calories: e.target.value }))}
            />
            <input
              required
              type="number"
              step="0.01"
              className="flex-1 border rounded-lg px-4 py-2 text-sm"
              placeholder="Price (RM)"
              value={form.price_in_points}
              onChange={e => setForm(p => ({ ...p, price_in_points: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-black text-white rounded-lg py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 border rounded-lg py-2 text-sm text-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-gray-400">No items yet. Add your first item above.</p>
      )}

      {!loading && items.map((item: any) => (
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
