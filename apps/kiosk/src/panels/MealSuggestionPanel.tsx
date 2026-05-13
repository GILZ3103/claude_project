import { useKiosk } from '../context/KioskContext'

export default function MealSuggestionPanel() {
  const { suggestions, calorieInput, card, setPanel, handleSelectStall, toggleEmergency } = useKiosk()

  const totalCal = suggestions.reduce((sum: number, s: any) => sum + (s.calories ?? 0), 0)

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none overflow-y-auto">
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button onClick={() => setPanel('calorie-set')} className="text-gray-500 text-sm underline">← Back</button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="px-6 pb-8 space-y-4">
        <div className="text-center py-2">
          <h2 className="text-xl font-bold">Suggested Meal</h2>
          <p className="text-gray-400 text-sm mt-1">
            Based on your {calorieInput} kcal limit — Total: <span className="text-white font-semibold">{totalCal} kcal</span>
          </p>
        </div>

        {suggestions.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No suggestions available. Try adjusting your calorie limit.
          </div>
        )}

        {suggestions.map((s: any, i: number) => {
          const label = i === 0 ? '🍛 Main Dish' : `🥗 Side Dish ${i}`
          const vendorInfo = s.vendor_id
            ? { vendor_id: s.vendor_id, business_name: s.vendor_name, grid_x: s.grid_x ?? 0, grid_y: s.grid_y ?? 0 }
            : null

          return (
            <div key={i} className="bg-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-lg font-bold mt-0.5">{s.food_name}</p>
                  <p className="text-sm text-gray-400">{s.vendor_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">{s.calories} kcal</p>
                  {s.price_in_points && (
                    <p className="text-xs text-gray-500">RM {Number(s.price_in_points).toFixed(2)}</p>
                  )}
                </div>
              </div>

              {s.reason && (
                <p className="text-xs text-gray-400 italic">"{s.reason}"</p>
              )}

              <button
                onClick={() => vendorInfo
                  ? handleSelectStall(vendorInfo)
                  : setPanel('map')
                }
                className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 rounded-xl text-sm"
              >
                📍 Navigate to Stall →
              </button>
            </div>
          )
        })}

        <button
          onClick={() => setPanel('food-browser')}
          className="w-full text-gray-400 text-sm underline pt-2"
        >
          Browse all food instead
        </button>

        <button
          onClick={() => setPanel(card ? 'card' : 'home')}
          className="w-full text-gray-600 text-xs underline"
        >
          Done
        </button>
      </div>
    </div>
  )
}
