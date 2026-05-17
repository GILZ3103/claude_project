import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Flame, Target, ChefHat, Minus, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { setCalorieLimit, getCardHistory, getAllFood } from '../lib/api'

export default function Calories() {
  const { card, refreshCard } = useCard()

  // Calorie limit slider
  const [sliderValue, setSliderValue] = useState(2000)
  const [savingLimit, setSavingLimit] = useState(false)

  // Vendor breakdown from history
  const [vendorBreakdown, setVendorBreakdown] = useState<{ vendor: string; calories: number }[]>([])

  // Food recommendations
  const [foodRecs, setFoodRecs] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)

  useEffect(() => {
    if (!card) return
    setSliderValue(card.calorie_limit ?? 2000)
    loadBreakdown()
    loadRecommendations()
  }, [card?.uid])

  async function loadBreakdown() {
    if (!card) return
    try {
      const res = await getCardHistory(card.uid, 50, 0) as any
      const history: any[] = res.history ?? []
      const map = new Map<string, number>()
      history.forEach((h: any) => {
        if (h.calories && h.vendor_name) {
          map.set(h.vendor_name, (map.get(h.vendor_name) ?? 0) + Number(h.calories))
        }
      })
      const sorted = Array.from(map.entries())
        .map(([vendor, calories]) => ({ vendor, calories }))
        .sort((a, b) => b.calories - a.calories)
        .slice(0, 5)
      setVendorBreakdown(sorted)
    } catch { /* no history */ }
  }

  async function loadRecommendations() {
    if (!card) return
    setLoadingRecs(true)
    try {
      const items = await getAllFood() as any[]
      const remaining = Math.max(0, (card.calorie_limit ?? 2000) - (card.calories_today ?? 0))
      const filtered = items
        .filter((i: any) => i.calories != null && i.calories <= remaining && i.calories > 0)
        .slice(0, 6)
      setFoodRecs(filtered)
    } catch { /* ignore */ } finally {
      setLoadingRecs(false)
    }
  }

  async function handleSaveLimit() {
    if (!card) return
    if (sliderValue < 1200 || sliderValue > 4000) {
      toast.error('Limit must be between 1200 and 4000 kcal')
      return
    }
    setSavingLimit(true)
    try {
      await setCalorieLimit(card.uid, sliderValue)
      await refreshCard()
      toast.success('Calorie limit updated')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update limit')
    } finally {
      setSavingLimit(false)
    }
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const caloriesToday = card.calories_today ?? 0
  const calorieLimit = card.calorie_limit ?? 2000
  const ratio = calorieLimit > 0 ? caloriesToday / calorieLimit : 0
  const progress = Math.min(ratio, 1)
  const remaining = Math.max(0, calorieLimit - caloriesToday)

  // SVG ring
  const R = 70
  const circumference = 2 * Math.PI * R
  const strokeDash = circumference * (1 - progress)

  let ringColor = '#22C55E'
  let statusText = 'Healthy'
  let statusColor = 'text-green-500'
  if (ratio > 1) { ringColor = '#EF4444'; statusText = 'Over limit'; statusColor = 'text-red-500' }
  else if (ratio > 0.8) { ringColor = '#FF8A00'; statusText = 'Moderate'; statusColor = 'text-orange-500' }

  const maxBreakdownCal = vendorBreakdown[0]?.calories ?? 1

  return (
    <div className="px-4 pb-28 max-w-lg mx-auto space-y-5 pt-4">

      {/* SVG Progress Ring */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center space-x-2 mb-5">
          <Flame size={18} className="text-orange-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6B7280]">Calories Today</h2>
        </div>

        <div className="flex items-center justify-center gap-8">
          {/* Ring */}
          <div className="relative">
            <svg width="160" height="160" className="-rotate-90">
              {/* Track */}
              <circle cx="80" cy="80" r={R} fill="none" stroke="#F3F4F6" strokeWidth="12" />
              {/* Progress */}
              <motion.circle
                cx="80" cy="80" r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeDash }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#1A1A1A] leading-none">{caloriesToday}</span>
              <span className="text-xs text-[#6B7280] mt-1">kcal eaten</span>
            </div>
          </div>

          {/* Stats beside ring */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">Status</p>
              <p className={`text-lg font-bold ${statusColor}`}>{statusText}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">Remaining</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">{remaining}</p>
              <p className="text-xs text-[#6B7280]">kcal left</p>
            </div>
            <div>
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">Daily Goal</p>
              <p className="text-sm font-semibold text-[#1A1A1A]">{calorieLimit} kcal</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Calorie Limit Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center space-x-2 mb-4">
          <Target size={18} className="text-blue-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6B7280]">Daily Calorie Goal</h2>
        </div>

        <div className="flex items-baseline space-x-2 mb-5">
          <span className="text-4xl font-bold text-[#1A1A1A] tracking-tight">{sliderValue}</span>
          <span className="text-sm text-[#6B7280]">kcal / day</span>
        </div>

        {/* Slider */}
        <div className="relative mb-3">
          <input
            type="range"
            min={1200}
            max={4000}
            step={50}
            value={sliderValue}
            onChange={e => setSliderValue(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FF8A00]"
          />
          <div className="flex justify-between text-[10px] text-[#6B7280] mt-1.5">
            <span>1200</span>
            <span>2000</span>
            <span>3000</span>
            <span>4000</span>
          </div>
        </div>

        {/* Quick adjusters */}
        <div className="flex items-center gap-3 mb-5">
          {[1500, 1800, 2000, 2500].map(v => (
            <button
              key={v}
              onClick={() => setSliderValue(v)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${sliderValue === v ? 'bg-[#FF8A00] text-white border-[#FF8A00]' : 'bg-gray-50 text-[#6B7280] border-gray-200 hover:border-orange-300'}`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setSliderValue(v => Math.max(1200, v - 50))}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={handleSaveLimit}
            disabled={savingLimit || sliderValue === calorieLimit}
            className="flex-1 bg-[#1A1A1A] text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            {savingLimit ? 'Saving…' : sliderValue === calorieLimit ? 'Current goal' : 'Save Goal'}
          </button>
          <button
            onClick={() => setSliderValue(v => Math.min(4000, v + 50))}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200"
          >
            <Plus size={16} />
          </button>
        </div>
      </motion.div>

      {/* Vendor calorie breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center space-x-2 mb-5">
          <Flame size={18} className="text-orange-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6B7280]">Calorie Sources</h2>
        </div>

        {vendorBreakdown.length === 0 ? (
          <p className="text-sm text-[#6B7280] text-center py-4">No tap history yet. Visit a vendor to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {vendorBreakdown.map((row, i) => {
              const pct = (row.calories / maxBreakdownCal) * 100
              const colors = ['bg-[#FF8A00]', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
              return (
                <div key={row.vendor}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[#1A1A1A] truncate max-w-[65%]">{row.vendor}</span>
                    <span className="text-[#6B7280] font-medium">{row.calories} kcal</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className={`h-full rounded-full ${colors[i % colors.length]}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Food Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center space-x-2 mb-1">
          <ChefHat size={18} className="text-green-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6B7280]">Smart Recommendations</h2>
        </div>
        <p className="text-xs text-[#6B7280] mb-5">Foods that fit within your remaining {remaining} kcal budget.</p>

        {loadingRecs ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : foodRecs.length === 0 ? (
          <p className="text-sm text-[#6B7280] text-center py-4">
            {remaining <= 0 ? 'You have reached your calorie limit for today.' : 'No food data available yet — vendors need to add their menu items.'}
          </p>
        ) : (
          <div className="space-y-2">
            {foodRecs.map((f: any) => (
              <div key={f.food_item_id} className="flex items-center justify-between p-3.5 bg-[#FAFAFA] rounded-2xl border border-transparent hover:border-gray-100 hover:bg-white transition-all">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{f.name}</p>
                  <p className="text-xs text-[#6B7280]">{f.vendor_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{f.calories} kcal</p>
                  {f.price_in_points && (
                    <p className="text-xs text-[#6B7280]">RM {Number(f.price_in_points).toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
