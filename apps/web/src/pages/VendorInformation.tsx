import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { MapPin, Plus, X, UtensilsCrossed, Flame, Scale } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { getVendorFood, addFoodItem } from '../lib/api'
import toast from 'react-hot-toast'
import { HeroHeader } from '../components/HeroHeader'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { StatPill, IconBadge } from '../components/Badges'
import { getFoodImage } from '../lib/foodImages'

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

const inputCls = 'w-full bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all text-sm'

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
    <div className="px-4 pb-28 max-w-lg mx-auto pt-4">
      {/* Header */}
      <div className="-mx-4 -mt-4 mb-5">
        <HeroHeader
          title="Stall Information"
          subtitle={card.business_name ?? 'Manage your location & menu'}
          seed="vendor-information"
        />
      </div>

      {/* Approved location */}
      <div className="bg-white rounded-[1.5rem] border border-gray-100 border-t-4 border-t-[#FF8A00] shadow-sm p-6 mb-6">
        <h3 className="font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-[#FF8A00]" /> Your Location
        </h3>
        {gx != null && gy != null ? (
          <>
            <div className="overflow-auto">
              <div className="relative mx-auto rounded-2xl bg-orange-50/40 border border-orange-100" style={{ width: CELL * 8, height: CELL * 6 }}>
                {Array.from({ length: 8 }).map((_, col) =>
                  Array.from({ length: 6 }).map((_, row) => (
                    <div key={`${col}-${row}`} className="absolute border border-orange-100/60"
                      style={{ left: col * CELL, top: row * CELL, width: CELL, height: CELL }} />
                  ))
                )}
                <div className="absolute bg-[#FF8A00] rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-md"
                  style={{ left: gx * CELL + 4, top: gy * CELL + 4, width: CELL - 8, height: CELL - 8 }}>
                  YOU
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <IconBadge icon={MapPin} tone="orange">Grid ({gx}, {gy})</IconBadge>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center bg-[#FAFAFA] rounded-2xl border border-dashed border-gray-200 py-10 text-center px-4">
            <p className="text-sm text-[#6B7280]">No grid position set. Contact market admin.</p>
          </div>
        )}
      </div>

      {/* Food items header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={18} className="text-[#FF8A00]" />
          <p className="text-sm font-bold text-[#1A1A1A]">Food Items <span className="text-[#6B7280] font-normal">({items.length})</span></p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm bg-[#FF8A00] hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition-colors"
        >
          {showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Item</>}
        </motion.button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleAdd} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-5 space-y-3 mb-6 overflow-hidden">
          <p className="text-sm font-bold text-[#1A1A1A]">New Food Item</p>

          <input required className={inputCls} placeholder="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          {/* Pricing mode toggle */}
          <div>
            <p className="text-xs text-[#6B7280] mb-1.5 font-medium uppercase tracking-wider">Pricing mode</p>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              <button type="button"
                className={`flex-1 py-2 font-semibold transition-colors ${priceMode === 'fixed' ? 'bg-[#FF8A00] text-white' : 'text-[#6B7280] bg-white'}`}
                onClick={() => setPriceMode('fixed')}>
                Fixed price
              </button>
              <button type="button"
                className={`flex-1 py-2 font-semibold transition-colors flex items-center justify-center gap-1 ${priceMode === 'per_gram' ? 'bg-[#FF8A00] text-white' : 'text-[#6B7280] bg-white'}`}
                onClick={() => setPriceMode('per_gram')}>
                <Scale size={14} /> Per gram
              </button>
            </div>
          </div>

          {priceMode === 'fixed' ? (
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className={inputCls} placeholder="Calories (kcal)" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
              <input required type="number" step="0.01" className={inputCls} placeholder="Price (RM)" value={form.price_in_points} onChange={e => setForm(f => ({ ...f, price_in_points: e.target.value }))} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" step="0.1" className={inputCls} placeholder="kcal per 100g" value={form.calories_per_100g} onChange={e => setForm(f => ({ ...f, calories_per_100g: e.target.value }))} />
                <input required type="number" step="0.01" className={inputCls} placeholder="RM per 100g" value={form.price_per_100g} onChange={e => setForm(f => ({ ...f, price_per_100g: e.target.value }))} />
              </div>
              <p className="text-xs text-[#6B7280]">Load cell sends weight → price and calories scale automatically.</p>
            </>
          )}

          <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wider">Macros per serving (optional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" step="0.1" className={inputCls} placeholder="Protein (g)" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} />
            <input type="number" step="0.1" className={inputCls} placeholder="Carbs (g)" value={form.carbs_g} onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} />
            <input type="number" step="0.1" className={inputCls} placeholder="Fat (g)" value={form.fat_g} onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} />
          </div>
          <input type="url" className={inputCls} placeholder="Photo URL (optional)" value={form.photo_url} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} />
          <button type="submit" disabled={saving} className="w-full bg-[#FF8A00] hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors">
            {saving ? 'Adding...' : 'Add Item'}
          </button>
        </motion.form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-[1.5rem] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[1.5rem] border border-dashed border-gray-200 text-[#6B7280]">
          <UtensilsCrossed size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No items yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const perGram = !!item.price_per_100g
            return (
              <motion.div
                key={item.food_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-3 flex gap-4 hover:shadow-md hover:border-orange-200 transition-all"
              >
                <ImageWithFallback
                  src={getFoodImage(item)}
                  alt={item.name}
                  className="w-20 h-20 rounded-2xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-[#1A1A1A] truncate">{item.name}</p>
                    <IconBadge icon={perGram ? Scale : undefined} tone={perGram ? 'blue' : 'gray'} className="shrink-0">
                      {perGram ? 'Per gram' : 'Fixed'}
                    </IconBadge>
                  </div>
                  <p className="text-sm font-bold text-green-700 mt-1">
                    {perGram
                      ? `RM ${Number(item.price_per_100g).toFixed(2)} / 100g`
                      : `RM ${Number(item.price_in_points).toFixed(2)}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    {(item.calories_per_100g || item.calories) && (
                      <StatPill icon={Flame} tone="orange">
                        {item.calories_per_100g ? `${item.calories_per_100g} kcal/100g` : `${item.calories} kcal`}
                      </StatPill>
                    )}
                    {(item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0) && (
                      <div className="flex gap-1.5">
                        <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">P {item.protein_g}g</span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">C {item.carbs_g}g</span>
                        <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">F {item.fat_g}g</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
