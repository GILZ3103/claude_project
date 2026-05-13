import { useState } from 'react'
import { useKiosk } from '../context/KioskContext'

export default function CalorieSetPanel() {
  const { card, calorieInput, setCalorieInput, setPanel, handleGetSuggestions, handleSaveCalorieLimit, toggleEmergency } = useKiosk()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

  function adjust(delta: number) {
    setCalorieInput(Math.max(500, Math.min(5000, calorieInput + delta)))
  }

  async function handleConfirm() {
    if (card) {
      setShowSavePrompt(true)
    } else {
      await getSuggestions()
    }
  }

  async function handleSaveAndSuggest() {
    setSaving(true)
    await handleSaveCalorieLimit(calorieInput)
    setSaving(false)
    setShowSavePrompt(false)
    await getSuggestions()
  }

  async function getSuggestions() {
    setLoading(true)
    await handleGetSuggestions(calorieInput)
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button onClick={() => setPanel(card ? 'card' : 'home')} className="text-gray-500 text-sm underline">← Back</button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Set Calorie Limit</h2>
          <p className="text-gray-400 mt-2 text-sm">We'll suggest a meal that fits your budget</p>
        </div>

        {/* Calorie input */}
        <div className="bg-white/10 rounded-3xl p-8 w-full max-w-xs flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-6xl font-bold">{calorieInput}</p>
            <p className="text-gray-400 text-sm mt-1">kcal per day</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => adjust(-100)}
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-bold flex items-center justify-center"
            >
              −
            </button>
            <button
              onClick={() => adjust(100)}
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-bold flex items-center justify-center"
            >
              +
            </button>
          </div>

          <div className="flex gap-2 flex-wrap justify-center">
            {[1200, 1500, 1800, 2000, 2500].map(v => (
              <button
                key={v}
                onClick={() => setCalorieInput(v)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${calorieInput === v ? 'bg-white text-gray-900 border-white' : 'border-white/20 text-gray-400'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full max-w-xs bg-white text-gray-900 font-bold py-4 rounded-2xl text-lg disabled:opacity-50"
        >
          {loading ? 'Getting suggestions...' : 'Get Meal Suggestions →'}
        </button>
      </div>

      {/* Save to card prompt */}
      {showSavePrompt && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-8">
          <div className="bg-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-center">Save to your card?</h3>
            <p className="text-gray-400 text-sm text-center">
              Save {calorieInput} kcal as your daily limit on your NightMarket card?
            </p>
            <button
              onClick={handleSaveAndSuggest}
              disabled={saving}
              className="w-full bg-white text-gray-900 font-bold py-3 rounded-2xl disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Yes, save it'}
            </button>
            <button
              onClick={() => { setShowSavePrompt(false); getSuggestions() }}
              className="w-full text-gray-400 text-sm underline"
            >
              No, just show suggestions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
