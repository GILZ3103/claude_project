import { useState } from 'react'
import { useCard } from '../context/CardContext'
import { askAi, getMealAdvice } from '../lib/api'

type Tab = 'ask' | 'meal'
type Message = { from: 'user' | 'ai'; text: string }

export default function AiChat() {
  const { card } = useCard()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('ask')

  // Ask tab
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)

  // Meal advisor tab
  const [mealPrompt, setMealPrompt] = useState('')
  const [mealBudget, setMealBudget] = useState('600')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loadingMeal, setLoadingMeal] = useState(false)

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loadingChat) return
    const msg = input.trim()
    setInput('')
    setMessages(m => [...m.slice(-4), { from: 'user', text: msg }])
    setLoadingChat(true)
    try {
      const res = await askAi(msg, card?.role) as any
      setMessages(m => [...m, { from: 'ai', text: res.reply ?? 'No response.' }])
    } catch {
      setMessages(m => [...m, { from: 'ai', text: 'Sorry, I could not process that.' }])
    } finally { setLoadingChat(false) }
  }

  async function handleMeal(e: React.FormEvent) {
    e.preventDefault()
    if (!mealPrompt.trim() || loadingMeal) return
    setLoadingMeal(true)
    setSuggestions([])
    try {
      const res = await getMealAdvice(mealPrompt, parseFloat(mealBudget) || 600) as any
      setSuggestions(res.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally { setLoadingMeal(false) }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 right-4 z-30 w-12 h-12 bg-black text-white rounded-full shadow-lg flex items-center justify-center text-lg"
        aria-label="AI Assistant"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-30 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col" style={{ maxHeight: '420px' }}>
          {/* Header + tabs */}
          <div className="px-4 pt-3 pb-0">
            <p className="text-sm font-semibold mb-2">AI Assistant</p>
            <div className="flex gap-1 border-b">
              <button onClick={() => setTab('ask')} className={`text-xs px-3 py-1.5 font-medium border-b-2 transition-colors ${tab === 'ask' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>Ask</button>
              <button onClick={() => setTab('meal')} className={`text-xs px-3 py-1.5 font-medium border-b-2 transition-colors ${tab === 'meal' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>Meal Advisor</button>
            </div>
          </div>

          {tab === 'ask' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ minHeight: '200px' }}>
                {messages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center pt-6">Ask anything about NightMarket</p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] text-xs px-3 py-2 rounded-xl leading-relaxed ${m.from === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loadingChat && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-400 text-xs px-3 py-2 rounded-xl">Thinking…</div>
                  </div>
                )}
              </div>
              {/* Input */}
              <form onSubmit={handleAsk} className="flex gap-2 p-3 border-t">
                <input
                  className="flex-1 text-xs border rounded-lg px-3 py-2 outline-none"
                  placeholder="Ask a question…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                />
                <button type="submit" disabled={loadingChat || !input.trim()} className="bg-black text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40">Send</button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <form onSubmit={handleMeal} className="space-y-2">
                <input
                  className="w-full text-xs border rounded-lg px-3 py-2 outline-none"
                  placeholder="What are you craving? (e.g. spicy, light)"
                  value={mealPrompt}
                  onChange={e => setMealPrompt(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 text-xs border rounded-lg px-3 py-2 outline-none"
                    placeholder="Calorie budget (kcal)"
                    value={mealBudget}
                    onChange={e => setMealBudget(e.target.value)}
                  />
                  <button type="submit" disabled={loadingMeal || !mealPrompt.trim()} className="bg-black text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40 shrink-0">Go</button>
                </div>
              </form>

              {loadingMeal && <p className="text-xs text-gray-400 text-center">Finding meals…</p>}

              {suggestions.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-0.5">
                  <p className="text-xs font-semibold">{s.food_name}</p>
                  <p className="text-xs text-gray-500">{s.vendor_name}</p>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{s.calories} kcal</span>
                    <span>RM {Number(s.price_in_points).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400 italic">{s.reason}</p>
                </div>
              ))}
              {!loadingMeal && suggestions.length === 0 && mealPrompt && (
                <p className="text-xs text-gray-400 text-center">No suggestions yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
