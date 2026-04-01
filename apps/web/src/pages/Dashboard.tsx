// Dashboard — Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { getCardHistory } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { card, refreshCard } = useCard()
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!card) return
    refreshCard()
    loadHistory()
  }, [])

  async function loadHistory() {
    if (!card) return
    setLoadingHistory(true)
    try {
      const res = await getCardHistory(card.uid) as any
      setHistory(res.history ?? [])
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!card) {
    return <div className="p-6 text-center text-gray-400">Link your card on the home page first.</div>
  }

  // Build calorie chart data from today's checkpoints
  const calorieData = card.checkpoints_today.map((vid, i) => ({
    name: `Stall ${i + 1}`,
    calories: 0, // filled from history
  }))

  const pct = Math.min(100, (card.calories_today / card.calorie_limit) * 100)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}

      {/* Points balance */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm text-gray-500">Points Balance</p>
        <p className="text-3xl font-bold">RM {Number(card.points_balance).toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">{card.uid}</p>
      </div>

      {/* Calorie progress */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Calories Today</span>
          <span className={pct >= 90 ? 'text-red-500 font-bold' : 'text-gray-500'}>
            {card.calories_today} / {card.calorie_limit} kcal
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 90 && <p className="text-red-500 text-xs mt-1">Approaching calorie limit!</p>}
      </div>

      {/* Checkpoints */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-3">Checkpoints Today</p>
        <div className="flex gap-2 flex-wrap">
          {card.checkpoints_today.length === 0
            ? <p className="text-sm text-gray-400">No stalls visited yet today.</p>
            : card.checkpoints_today.map((vid, i) => (
                <span key={vid} className="w-8 h-8 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
              ))
          }
        </div>
      </div>

      {/* Active vouchers */}
      {card.active_vouchers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium mb-2">Active Vouchers</p>
          {card.active_vouchers.map((v: any) => (
            <div key={v.voucher_id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span className="text-green-600 font-medium">RM {Number(v.discount_value).toFixed(2)} off</span>
              <span className="text-gray-400">{v.expires_at ? new Date(v.expires_at).toLocaleDateString('en-MY') : 'No expiry'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tap history */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-2">Recent Taps</p>
        {loadingHistory
          ? <div className="h-16 bg-gray-100 rounded animate-pulse" />
          : history.length === 0
            ? <p className="text-sm text-gray-400">No tap history yet.</p>
            : history.slice(0, 5).map((h: any) => (
                <div key={h.event_id} className="flex justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{h.food_name ?? h.event_type}</p>
                    <p className="text-gray-400 text-xs">{h.vendor_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-500">-RM {Number(h.final_cost ?? 0).toFixed(2)}</p>
                    <p className="text-gray-400 text-xs">{h.calories ? `${h.calories} kcal` : ''}</p>
                  </div>
                </div>
              ))
        }
      </div>
    </div>
  )
}
