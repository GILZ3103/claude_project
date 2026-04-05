import { useState, useEffect } from 'react'
import { useCard } from '../context/CardContext'
import { setCalorieLimit, getCardHistory } from '../lib/api'
import toast from 'react-hot-toast'

interface MacroTotals { protein: number; carbs: number; fat: number }

export default function Calories() {
  const { card, refreshCard } = useCard()

  // Weight & height stored in localStorage
  const [weight, setWeight] = useState(() => localStorage.getItem('user_weight') ?? '')
  const [height, setHeight] = useState(() => localStorage.getItem('user_height') ?? '')

  // Calorie limit editing
  const [newLimit, setNewLimit] = useState('')
  const [savingLimit, setSavingLimit] = useState(false)

  // Macro totals from today's food history
  const [macros, setMacros] = useState<MacroTotals>({ protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    if (!card) return
    loadMacros()
  }, [card?.uid])

  async function loadMacros() {
    if (!card) return
    try {
      const res = await getCardHistory(card.uid, 50, 0) as any
      const history: any[] = res.history ?? res ?? []
      const today = new Date().toDateString()
      const todayItems = history.filter((h: any) => new Date(h.created_at).toDateString() === today)
      const totals = todayItems.reduce((acc: MacroTotals, h: any) => ({
        protein: acc.protein + Number(h.protein_g ?? 0),
        carbs: acc.carbs + Number(h.carbs_g ?? 0),
        fat: acc.fat + Number(h.fat_g ?? 0),
      }), { protein: 0, carbs: 0, fat: 0 })
      setMacros(totals)
    } catch { /* no history yet */ }
  }

  function saveBodyData() {
    localStorage.setItem('user_weight', weight)
    localStorage.setItem('user_height', height)
    toast.success('Body data saved')
  }

  async function handleSaveLimit() {
    if (!card || !newLimit) return
    const val = parseInt(newLimit)
    if (isNaN(val) || val < 500 || val > 10000) {
      toast.error('Enter a valid limit between 500 and 10000 kcal')
      return
    }
    setSavingLimit(true)
    try {
      await setCalorieLimit(card.uid, val)
      await refreshCard()
      setNewLimit('')
      toast.success('Calorie limit updated')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update limit')
    } finally {
      setSavingLimit(false)
    }
  }

  // BMR calculation (Mifflin-St Jeor)
  function calcBMR() {
    const w = parseFloat(weight)
    const h = parseFloat(height)
    if (!w || !h) return null
    return Math.round(10 * w + 6.25 * h - 5 * 25 + 5) // age defaulted to 25
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const pct = Math.min(100, (card.calories_today / card.calorie_limit) * 100)
  const bmr = calcBMR()
  const totalMacroKcal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Calories</h1>

      {/* Today's progress */}
      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Today's Intake</span>
          <span className={pct >= 90 ? 'text-red-500 font-bold' : 'text-gray-500'}>
            {card.calories_today} / {card.calorie_limit} kcal
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 90 && <p className="text-red-500 text-xs">Approaching calorie limit!</p>}
      </div>

      {/* Macronutrient breakdown */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-3">Macronutrient Breakdown (Today)</p>
        {totalMacroKcal === 0
          ? <p className="text-sm text-gray-400">No macro data yet — vendors need to log macros per item.</p>
          : (
            <div className="space-y-2">
              {[
                { label: 'Protein', value: macros.protein, kcal: macros.protein * 4, color: 'bg-blue-400' },
                { label: 'Carbs', value: macros.carbs, kcal: macros.carbs * 4, color: 'bg-yellow-400' },
                { label: 'Fat', value: macros.fat, kcal: macros.fat * 9, color: 'bg-red-400' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{m.label}</span>
                    <span>{m.value.toFixed(1)}g · {m.kcal.toFixed(0)} kcal</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${m.color}`}
                      style={{ width: `${totalMacroKcal ? (m.kcal / totalMacroKcal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Adjust calorie limit */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm font-medium">Adjust Daily Limit</p>
        <p className="text-xs text-gray-400">Current limit: {card.calorie_limit} kcal</p>
        <div className="flex gap-2">
          <input
            type="number"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 2000"
            value={newLimit}
            onChange={e => setNewLimit(e.target.value)}
          />
          <button
            onClick={handleSaveLimit}
            disabled={savingLimit}
            className="bg-black text-white px-4 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {savingLimit ? 'Saving...' : 'Save'}
          </button>
        </div>
        {bmr && <p className="text-xs text-gray-400">Estimated BMR: ~{bmr} kcal/day based on your body data</p>}
      </div>

      {/* Weight + Height */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm font-medium">Body Data</p>
        <p className="text-xs text-gray-400">Stored locally on this device only.</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Weight (kg)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 65"
              value={weight}
              onChange={e => setWeight(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Height (cm)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 170"
              value={height}
              onChange={e => setHeight(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={saveBodyData}
          className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium"
        >
          Save Body Data
        </button>
      </div>
    </div>
  )
}
