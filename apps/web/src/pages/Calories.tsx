import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Heart, Flame, Search, Settings as SettingsIcon, AlertTriangle, ChefHat } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { setCalorieLimit, getCardHistory, getAllFood } from '../lib/api'

// Animated counter that counts up from 0
function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const duration = 1800
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <span ref={ref} className="text-6xl font-bold tracking-tight">{display}</span>
}

const DIET_OPTIONS = ['Vegetarian', 'Vegan', 'Halal-friendly', 'Gluten-Free', 'Nut-free', 'Low Sugar']

export default function HealthTracking() {
  const { card, refreshCard } = useCard()
  const navigate = useNavigate()

  const [breakdown, setBreakdown] = useState<{ vendor: string; calories: number }[]>([])
  const [foodRecs, setFoodRecs] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [tempLimit, setTempLimit] = useState(2000)
  const [selectedDiets, setSelectedDiets] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dietary_prefs') ?? '[]') } catch { return [] }
  })
  const [savingLimit, setSavingLimit] = useState(false)

  useEffect(() => {
    if (!card) return
    setTempLimit(card.calorie_limit ?? 2000)
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
      setBreakdown(sorted)
    } catch { /* no history */ }
  }

  async function loadRecommendations() {
    if (!card) return
    setLoadingRecs(true)
    try {
      const items = await getAllFood() as any[]
      const remaining = Math.max(0, (card.calorie_limit ?? 2000) - (card.calories_today ?? 0))
      setFoodRecs(
        items.filter((i: any) => i.calories != null && i.calories <= remaining && i.calories > 0).slice(0, 5)
      )
    } catch { /* ignore */ } finally { setLoadingRecs(false) }
  }

  async function handleSaveSettings() {
    if (!card) return
    setSavingLimit(true)
    try {
      await setCalorieLimit(card.uid, tempLimit)
      localStorage.setItem('dietary_prefs', JSON.stringify(selectedDiets))
      await refreshCard()
      setShowConfirm(false)
      setIsSettingsOpen(false)
      toast.success('Health preferences saved')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save')
    } finally { setSavingLimit(false) }
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const caloriesToday = card.calories_today ?? 0
  const calorieLimit = card.calorie_limit ?? 2000
  const ratio = calorieLimit > 0 ? caloriesToday / calorieLimit : 0
  const progress = Math.min(ratio * 100, 100)
  const remaining = Math.max(0, calorieLimit - caloriesToday)

  // Status theming
  let color = '#10B981'
  let gradId = 'greenGrad'
  let statusText = 'Healthy Intake'
  let statusBg = 'bg-green-50 border-green-100'
  let statusTextColor = 'text-green-600'
  let borderTop = 'border-t-[#22C55E]'
  let message = 'You are doing great today! Keep it up.'

  if (ratio > 1) {
    color = '#EF4444'; gradId = 'redGrad'
    statusText = 'High Intake'; statusBg = 'bg-red-50 border-red-100'
    statusTextColor = 'text-red-600'; borderTop = 'border-t-red-400'
    message = 'You have exceeded your daily limit. Try opting for lower calorie items.'
  } else if (ratio > 0.8) {
    color = '#F59E0B'; gradId = 'orangeGrad'
    statusText = 'Moderate Intake'; statusBg = 'bg-orange-50 border-orange-100'
    statusTextColor = 'text-orange-600'; borderTop = 'border-t-[#FF8A00]'
    message = 'You are nearing your daily limit. Watch your next snacks!'
  }

  // SVG ring
  const R = 90
  const circ = 2 * Math.PI * R
  const dash = circ * (1 - progress / 100)

  return (
    <section className="w-full flex flex-col px-4 sm:px-6 pb-16 bg-[#FAFAFA] min-h-[100dvh]">
      {/* Header */}
      <div className="mt-8 mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${statusBg}`}>
            <Heart className={statusTextColor} size={24} fill="currentColor" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Health Tracking</h2>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-white hover:bg-gray-50 text-gray-600 p-2.5 rounded-xl border border-gray-200 shadow-sm transition-colors"
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">

        {/* Left — Progress Ring card */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.3 }}
          className={`relative w-full lg:w-[340px] shrink-0 bg-white rounded-[2rem] p-8 flex flex-col items-center justify-center border border-gray-100 border-t-4 ${borderTop} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)]`}
        >
          <div className={`absolute top-4 left-4 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none ${statusBg}`} />

          {/* Ring */}
          <div className="relative w-56 h-56 flex items-center justify-center mb-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
              <defs>
                <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22C55E" /><stop offset="100%" stopColor="#86EFAC" />
                </linearGradient>
                <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#FDBA74" />
                </linearGradient>
                <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EF4444" /><stop offset="100%" stopColor="#FCA5A5" />
                </linearGradient>
              </defs>
              <circle cx="112" cy="112" r={R} stroke="#F3F4F6" strokeWidth="18" fill="none" />
              <motion.circle
                cx="112" cy="112" r={R}
                stroke={`url(#${gradId})`}
                strokeWidth="18" fill="none"
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: dash }}
                transition={{ duration: 2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <Flame style={{ color }} size={26} className="mb-1 opacity-80" />
              <div className="text-[#1A1A1A] leading-none">
                <Counter value={caloriesToday} />
              </div>
              <span className="text-xs font-medium text-[#6B7280] mt-2 tracking-wider">/ {calorieLimit} KCAL</span>
            </div>
          </div>

          {/* Status badge */}
          <div className={`px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide border shadow-sm ${statusBg} ${statusTextColor}`}>
            {statusText}
          </div>
          <p className="text-center text-sm text-[#6B7280] mt-4 font-medium px-2 leading-relaxed">{message}</p>

          {/* Find low-cal vendors */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/map?filter=low-calorie&max_calories=${remaining > 0 ? remaining : 400}`)}
            className="w-full mt-6 py-3.5 rounded-2xl font-medium flex items-center justify-center space-x-2 shadow-sm transition-all bg-white border border-gray-200 hover:border-green-300 hover:shadow-md text-[#1A1A1A]"
          >
            <Search size={16} className="text-green-500" />
            <span>Find low-calorie vendors</span>
          </motion.button>

          {/* Remaining stat */}
          <div className="w-full mt-4 p-3 bg-[#FAFAFA] rounded-2xl border border-gray-100 flex justify-between items-center">
            <span className="text-xs text-[#6B7280]">Remaining today</span>
            <span className={`text-sm font-bold ${remaining === 0 ? 'text-red-500' : 'text-[#1A1A1A]'}`}>
              {remaining} kcal
            </span>
          </div>
        </motion.div>

        {/* Right — Bar chart + food recs stacked */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Top calorie sources bar chart */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className={`w-full bg-white rounded-[2rem] p-8 border border-gray-100 border-t-4 ${borderTop} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] relative overflow-hidden`}
            style={{ minHeight: 300 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-100 to-transparent opacity-30 rounded-bl-full pointer-events-none" />
            <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-6">Top Calorie Sources</h3>

            {breakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[#6B7280]">
                <Flame size={32} className="mb-2 text-gray-200" />
                <p className="text-sm">No tap history yet — visit a vendor to start tracking.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={breakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={1} />
                      <stop offset="100%" stopColor="#86EFAC" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="vendor" tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 500, color: '#1A1A1A' }}
                  />
                  <Bar dataKey="calories" radius={[8, 8, 8, 8]}>
                    {breakdown.map((_, i) => <Cell key={i} fill="url(#barGreen)" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Food recommendations */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className={`w-full bg-white rounded-[2rem] p-8 border border-gray-100 border-t-4 ${borderTop} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)]`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <ChefHat size={16} className="text-green-500" />
              <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Smart Recommendations</h3>
            </div>
            <p className="text-xs text-[#6B7280] mb-5">Foods within your remaining {remaining} kcal budget.</p>

            {loadingRecs ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : foodRecs.length === 0 ? (
              <p className="text-sm text-[#6B7280] text-center py-4">
                {remaining <= 0
                  ? 'You have reached your calorie limit for today.'
                  : 'No food data available yet — vendors need to add their menu items.'}
              </p>
            ) : (
              <div className="space-y-2">
                {foodRecs.map((f: any) => (
                  <div key={f.food_item_id} className="flex items-center justify-between p-3.5 bg-[#FAFAFA] rounded-2xl hover:bg-white border border-transparent hover:border-gray-100 transition-all">
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{f.name}</p>
                      <p className="text-xs text-[#6B7280]">{f.vendor_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{f.calories} kcal</p>
                      {f.price_in_points && <p className="text-xs text-[#6B7280]">RM {Number(f.price_in_points).toFixed(2)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && !showConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-6">Health Preferences</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Daily Calorie Target</label>
                  <div className="space-y-2">
                    <div className="flex items-baseline space-x-2 mb-2">
                      <span className="text-4xl font-bold text-[#1A1A1A]">{tempLimit}</span>
                      <span className="text-sm text-[#6B7280]">kcal / day</span>
                    </div>
                    <input
                      type="range" min={1200} max={4000} step={50}
                      value={tempLimit}
                      onChange={e => setTempLimit(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[10px] text-[#6B7280]">
                      <span>1200</span><span>2000</span><span>3000</span><span>4000</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Dietary Preferences</label>
                  <div className="flex flex-wrap gap-2">
                    {DIET_OPTIONS.map(diet => (
                      <button
                        key={diet}
                        onClick={() => setSelectedDiets(d => d.includes(diet) ? d.filter(x => x !== diet) : [...d, diet])}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${selectedDiets.includes(diet) ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:bg-gray-50'}`}
                      >
                        {diet}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-2">Used to filter food recommendations to your preferences.</p>
                </div>
              </div>

              <div className="flex space-x-3 mt-8">
                <button onClick={() => setIsSettingsOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] font-semibold py-3.5 rounded-xl transition-colors">Cancel</button>
                <button onClick={() => setShowConfirm(true)} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-xl shadow-md transition-colors">Save Settings</button>
              </div>
            </motion.div>
          </div>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirm(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Save health preferences?</h3>
              <p className="text-sm text-[#6B7280] mb-8 font-medium">This will update your calorie goal and food recommendations.</p>
              <div className="flex space-x-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] font-semibold py-3.5 rounded-xl">Cancel</button>
                <button onClick={handleSaveSettings} disabled={savingLimit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-md disabled:opacity-50">
                  {savingLimit ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
