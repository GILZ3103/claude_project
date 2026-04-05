import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { getVendorFood, addFoodItem } from '../lib/api'
import toast from 'react-hot-toast'

const CELL = 48

export default function Information() {
  const { card, vendorId } = useVendor()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', calories: '', price_in_points: '',
    photo_url: '', protein_g: '', carbs_g: '', fat_g: ''
  })

  useEffect(() => {
    if (!vendorId) return
    loadFood()
  }, [vendorId])

  async function loadFood() {
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
        calories: parseInt(form.calories),
        price_in_points: parseFloat(form.price_in_points),
        photo_url: form.photo_url || undefined,
        protein_g: form.protein_g ? parseFloat(form.protein_g) : undefined,
        carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : undefined,
        fat_g: form.fat_g ? parseFloat(form.fat_g) : undefined,
      } as any)
      toast.success('Item added!')
      setForm({ name: '', calories: '', price_in_points: '', photo_url: '', protein_g: '', carbs_g: '', fat_g: '' })
      setShowForm(false)
      loadFood()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in.</div>

  const gx = (card as any).grid_x
  const gy = (card as any).grid_y

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Stall Information</h1>

      {/* Location map */}
      {gx != null && gy != null ? (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium mb-3">Stall Location</p>
          <div className="overflow-auto">
            <div
              className="relative border border-gray-200 rounded"
              style={{ width: CELL * 8, height: CELL * 6 }}
            >
              {/* Grid lines */}
              {Array.from({ length: 8 }).map((_, col) =>
                Array.from({ length: 6 }).map((_, row) => (
                  <div
                    key={`${col}-${row}`}
                    className="absolute border border-gray-100"
                    style={{ left: col * CELL, top: row * CELL, width: CELL, height: CELL }}
                  />
                ))
              )}
              {/* This stall */}
              <div
                className="absolute bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold"
                style={{ left: gx * CELL + 4, top: gy * CELL + 4, width: CELL - 8, height: CELL - 8 }}
              >
                YOU
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Grid position: ({gx}, {gy})</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-400">No grid location set. Contact market admin to assign your stall position.</p>
        </div>
      )}

      {/* Food items */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">Food Items</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm bg-black text-white px-3 py-1.5 rounded-lg font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm font-medium">New Food Item</p>
          <input required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input required type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="Calories (kcal)" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
            <input required type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Price (RM)" value={form.price_in_points} onChange={e => setForm(f => ({ ...f, price_in_points: e.target.value }))} />
          </div>
          <p className="text-xs text-gray-500 font-medium">Macros (optional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" step="0.1" className="border rounded-lg px-3 py-2 text-sm" placeholder="Protein (g)" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} />
            <input type="number" step="0.1" className="border rounded-lg px-3 py-2 text-sm" placeholder="Carbs (g)" value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} />
            <input type="number" step="0.1" className="border rounded-lg px-3 py-2 text-sm" placeholder="Fat (g)" value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} />
          </div>
          <input type="url" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Photo URL (optional)" value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
          <button type="submit" disabled={saving} className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      {/* Item list */}
      {loading
        ? [1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        : items.length === 0
          ? <p className="text-sm text-gray-400">No items yet. Add your first food item above.</p>
          : items.map((item: any) => (
              <div key={item.food_id} className="bg-white rounded-xl shadow p-4 flex gap-3">
                {item.photo_url && (
                  <img src={item.photo_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="font-semibold text-green-700 shrink-0 ml-2">RM {Number(item.price_in_points).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-400">{item.calories} kcal</p>
                  {(item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0) && (
                    <p className="text-xs text-gray-400">P: {item.protein_g}g · C: {item.carbs_g}g · F: {item.fat_g}g</p>
                  )}
                </div>
              </div>
            ))
      }
    </div>
  )
}
