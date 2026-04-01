// Panel 2 — Card summary after NFC tap
// Figma design to be applied via MCP
import { useKiosk } from '../context/KioskContext'

export default function CardPanel() {
  const { card, setPanel, handleKioskTap, tapping, reset } = useKiosk()
  if (!card) return null

  const pct = Math.min(100, (card.calories_today / card.calorie_limit) * 100)

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-8 space-y-6">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}

      {/* Greeting */}
      <div className="text-center">
        <p className="text-gray-400 text-sm">Welcome back</p>
        <h2 className="text-2xl font-bold mt-1">{card.owner_name}</h2>
        <p className="text-gray-500 text-xs mt-0.5">{card.uid}</p>
      </div>

      {/* Points */}
      <div className="bg-white/10 rounded-2xl p-6 w-full max-w-xs text-center">
        <p className="text-gray-400 text-sm">Points Balance</p>
        <p className="text-4xl font-bold mt-1">RM {Number(card.points_balance).toFixed(2)}</p>
      </div>

      {/* Calorie bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Calories Today</span>
          <span>{card.calories_today} / {card.calorie_limit} kcal</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-green-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* CTA buttons */}
      <button
        onClick={handleKioskTap}
        disabled={tapping}
        className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
      >
        {tapping ? 'Processing...' : 'Tap for Directory Rebate'}
      </button>

      <button
        onClick={() => setPanel('campaigns')}
        className="text-sm text-gray-400 underline"
      >
        View Campaigns
      </button>

      <button onClick={reset} className="text-xs text-gray-600 underline mt-4">
        Done
      </button>
    </div>
  )
}
