import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { getVendorFood, addFoodItem } from '../lib/api'
import toast from 'react-hot-toast'

const CELL = 48
type PriceMode = 'fixed' | 'per_gram'

const EMPTY_FORM = {
  name: '', photo_url: '',
  protein_g: '', carbs_g: '', fat_g: '',
  // fixed mode
  calories: '', price_in_points: '',
  // per-gram mode
  calories_per_100g: '', price_per_100g: ''
}

export default function VendorInformation() {
  const { card } = useCard()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [priceMode, setPriceMode] = useState<PriceMode>('fixed')
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!card?.vendor_id) return
    loadFood()
  }, [card?.vendor_id])

  async function loadFood() {
    if (!card?.vendor_id) return
    setLoading(true)
    try {
      const res = await getVendorFood(card.vendor_id) as any
      setItems(res.food ?? res ?? [])
    } catch { toast.error('Failed to load menu') }
    finally { setLoading(false) }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        name: form.name,
        photo_url: form.photo_url || undefined,
        protein_g: form.protein_g ? parseFloat(form.protein_g) : undefined,
        carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : undefined,
        fat_g: form.fat_g ? parseFloat(form.fat_g) : undefined,
      }
      if (priceMode === 'fixed') {
        body.price_in_points = parseFloat(form.price_in_points)
        if (form.calories) body.calories = parseInt(form.calories)
      } else {
        body.price_per_100g = parseFloat(form.price_per_100g)
        if (form.calories_per_100g) body.calories_per_100g = parseFloat(form.calories_per_100g)
      }
      await addFoodItem(card.vendor_id, card.uid, body)
      toast.success('Item added!')
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadFood()
    } catch (e: any) { toast.error(e.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  if (!card) return null

  const gx = card.grid_x
  const gy = card.grid_y

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Stall Information</h1>

      {gx != null && gy != null ? (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium mb-3">Your Location</p>
          <div className="overflow-auto">
            <div className="relative border border-gray-200 rounded" style={{ width: CELL * 8, height: CELL * 6 }}>
              {Array.from({ length: 8 }).map((_, col) =>
                Array.from({ length: 6 }).map((_, row) => (
                  <div key={`${col}-${row}`} className="absolute border border-gray-100"
                    style={{ left: col * CELL, top: row * CELL, width: CELL, height: CELL }} />
                ))
              )}
              <div className="absolute bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold"
                style={{ left: gx * CELL + 4, top: gy * CELL + 4, width: CELL - 8, height: CELL - 8 }}>
                YOU
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Grid ({gx}, {gy})</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-400">No grid position set. Contact market admin.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">Food Items</p>
        <button onClick={() => setShowForm(v => !v)} className="text-sm bg-black text-white px-3 py-1.5 rounded-lg font-medium">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm font-medium">New Food Item</p>

          <input required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          {/* Pricing mode toggle */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">Pricing mode</p>
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button type="button"
                className={`flex-1 py-2 font-medium transition-colors ${priceMode === 'fixed' ? 'bg-black text-white' : 'text-gray-500 bg-white'}`}
                onClick={() => setPriceMode('fixed')}>
                Fixed price
              </button>
              <button type="button"
                className={`flex-1 py-2 font-medium transition-colors ${priceMode === 'per_gram' ? 'bg-black text-white' : 'text-gray-500 bg-white'}`}
                onClick={() => setPriceMode('per_gram')}>
                ⚖️ Per gram
              </button>
            </div>
          </div>

          {priceMode === 'fixed' ? (
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="Calories (kcal)" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
              <input required type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Price (RM)" value={form.price_in_points} onChange={e => setForm(f => ({ ...f, price_in_points: e.target.value }))} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" step="0.1" className="border rounded-lg px-3 py-2 text-sm" placeholder="kcal per 100g" value={form.calories_per_100g} onChange={e => setForm(f => ({ ...f, calories_per_100g: e.target.value }))} />
                <input required type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="RM per 100g" value={form.price_per_100g} onChange={e => setForm(f => ({ ...f, price_per_100g: e.target.value }))} />
              </div>
              <p className="text-xs text-gray-400">Load cell sends weight → price and calories scale automatically.</p>
            </>
          )}

          <p className="text-xs text-gray-500 font-medium">Macros per serving (optional)</p>
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

      {loading
        ? [1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        : items.length === 0
          ? <p className="text-sm text-gray-400">No items yet.</p>
          : items.map((item: any) => (
              <div key={item.food_id} className="bg-white rounded-xl shadow p-4 flex gap-3">
                {item.photo_url && <img src={item.photo_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium truncate">{item.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${item.price_per_100g ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.price_per_100g ? '⚖️ Per gram' : 'Fixed'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-green-700 mt-0.5">
                    {item.price_per_100g
                      ? `RM ${Number(item.price_per_100g).toFixed(2)} / 100g`
                      : `RM ${Number(item.price_in_points).toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.calories_per_100g
                      ? `${item.calories_per_100g} kcal / 100g`
                      : item.calories ? `${item.calories} kcal` : ''}
                  </p>
                  {(item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0) && (
                    <p className="text-xs text-gray-400">P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</p>
                  )}
                </div>
              </div>
            ))
      }
    </div>
  )
}
