import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCard } from '../context/CardContext'
import { getCardHistory, topup } from '../lib/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { card, refreshCard } = useCard()
  const navigate = useNavigate()
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')
  const [showTopup, setShowTopup] = useState(false)
  const [topping, setTopping] = useState(false)

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

  async function handleTopup() {
    if (!card) return
    const amount = parseFloat(topupAmount)
    if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount')
    setTopping(true)
    try {
      await topup(card.uid, amount)
      await refreshCard()
      setTopupAmount('')
      setShowTopup(false)
      toast.success(`RM ${amount.toFixed(2)} added to your balance!`)
    } catch (e: any) {
      toast.error(e.message ?? 'Top up failed')
    } finally {
      setTopping(false)
    }
  }

  if (!card) {
    return <div className="p-6 text-center text-gray-400">Please sign in first.</div>
  }

  const pct = Math.min(100, (card.calories_today / card.calorie_limit) * 100)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">

      {/* Welcome */}
      <div>
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h1 className="text-2xl font-bold">{card.owner_name}</h1>
      </div>

      {/* NFC card status + points */}
      <div className="bg-black text-white rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-400">Points Balance</p>
            <p className="text-3xl font-bold">RM {Number(card.points_balance).toFixed(2)}</p>
          </div>
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-medium">NFC Linked</span>
        </div>
        <p className="text-xs text-gray-400 font-mono">{card.uid}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowTopup(v => !v)}
            className="flex-1 bg-white text-black rounded-lg py-2 text-sm font-medium"
          >
            + Top Up Points
          </button>
          <button
            onClick={() => navigate('/map')}
            className="flex-1 border border-white text-white rounded-lg py-2 text-sm font-medium"
          >
            Locate Market
          </button>
        </div>
      </div>

      {/* Top up form */}
      {showTopup && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm font-medium">Top Up Amount (RM)</p>
          <div className="flex gap-2">
            {[10, 20, 50].map(amt => (
              <button
                key={amt}
                onClick={() => setTopupAmount(String(amt))}
                className={`flex-1 border rounded-lg py-2 text-sm font-medium ${topupAmount === String(amt) ? 'bg-black text-white' : 'text-gray-600'}`}
              >
                RM {amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Or enter custom amount"
            value={topupAmount}
            onChange={e => setTopupAmount(e.target.value)}
          />
          <button
            onClick={handleTopup}
            disabled={topping}
            className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {topping ? 'Processing...' : 'Confirm Top Up'}
          </button>
        </div>
      )}

      {/* Calorie overview */}
      <div
        className="bg-white rounded-xl shadow p-4 cursor-pointer"
        onClick={() => navigate('/calories')}
      >
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
        <p className="text-xs text-gray-400 mt-2">Tap to see breakdown →</p>
      </div>

      {/* Active vouchers */}
      {(card.active_vouchers ?? []).length > 0 && (
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

      {/* Recent taps */}
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
