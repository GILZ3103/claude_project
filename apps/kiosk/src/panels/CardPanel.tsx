import { useEffect } from 'react'
import { useKiosk } from '../context/KioskContext'

const AUTO_IDLE_MS = 60000

export default function CardPanel() {
  const { card, campaigns, setPanel, handleKioskTap, tapping, reset, toggleEmergency } = useKiosk()

  useEffect(() => {
    const t = setTimeout(reset, AUTO_IDLE_MS)
    return () => clearTimeout(t)
  }, [])

  if (!card) return null

  const pct = Math.min(100, (card.calories_today / card.calorie_limit) * 100)
  const enrolled = campaigns.filter((c: any) => c.progress)

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button onClick={reset} className="text-gray-500 text-sm underline">← Back</button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="px-6 space-y-4 pb-8">
        {/* Greeting */}
        <div className="text-center pt-2 pb-2">
          <p className="text-gray-400 text-sm">Welcome back</p>
          <h2 className="text-2xl font-bold mt-1">{card.owner_name}</h2>
          <p className="text-gray-600 text-xs mt-0.5">{card.uid}</p>
        </div>

        {/* Points balance */}
        <div className="bg-white/10 rounded-2xl p-5 text-center">
          <p className="text-gray-400 text-sm">Points Balance</p>
          <p className="text-4xl font-bold mt-1">RM {Number(card.points_balance).toFixed(2)}</p>
        </div>

        {/* Calorie bar */}
        <div className="bg-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Calories Today</span>
            <span>{card.calories_today} / {card.calorie_limit} kcal</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-green-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Active promotions */}
        {enrolled.length > 0 && (
          <div className="bg-white/10 rounded-2xl p-4 space-y-1">
            <p className="text-sm text-gray-400 mb-2">Active Promotions</p>
            {enrolled.map((c: any) => (
              <div key={c.campaign_id} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-green-400">{c.progress?.progress_value ?? 0}/{c.condition_threshold}</span>
              </div>
            ))}
          </div>
        )}

        {/* Directory rebate CTA */}
        <button
          onClick={handleKioskTap}
          disabled={tapping}
          className="w-full bg-white text-gray-900 font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
        >
          {tapping ? 'Processing...' : '✅ Tap for Directory Rebate'}
        </button>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPanel('campaigns')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-4 text-sm font-medium"
          >
            🎁 Enrol Program
          </button>
          <button
            onClick={() => setPanel('top-up')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-4 text-sm font-medium"
          >
            💳 Top Up
          </button>
          <button
            onClick={() => setPanel('calorie-set')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-4 text-sm font-medium"
          >
            🥗 Calorie Limit
          </button>
          <button
            onClick={() => setPanel('food-browser')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-4 text-sm font-medium"
          >
            🍛 Browse Food
          </button>
        </div>

        <button onClick={reset} className="w-full text-xs text-gray-600 underline pt-2">
          Done
        </button>
      </div>
    </div>
  )
}
