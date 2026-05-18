import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X, Send } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { askAgent } from '../lib/api'

type Message = { from: 'user' | 'ai'; text: string }

export default function AiChat() {
  const { card, refreshCard } = useCard()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  if (!card) return null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading || !card) return
    const msg = input.trim()
    setInput('')
    setError('')
    setMessages(m => [...m.slice(-9), { from: 'user', text: msg }])
    setLoading(true)
    try {
      const res = await askAgent(msg, card.uid) as any
      setMessages(m => [...m, { from: 'ai', text: res.reply ?? 'No response.' }])
      // If the agent might have made a write (calorie limit, campaign join), refresh card silently
      const lowered = msg.toLowerCase()
      if (lowered.includes('calorie') || lowered.includes('goal') || lowered.includes('join') || lowered.includes('sign me up')) {
        refreshCard()
      }
    } catch (err: any) {
      setError(err?.message ?? 'Request failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-[#FF8A00] to-[#FFD166] text-white rounded-full shadow-xl flex items-center justify-center"
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={22} />
            </motion.div>
          ) : (
            <motion.div key="spark" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Sparkles size={22} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.25 }}
            className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] bg-white rounded-[1.75rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
            style={{ height: 520, maxHeight: 'calc(100vh - 8rem)' }}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#FF8A00] to-[#FFD166] text-white flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="font-bold text-sm">WarungTek Assistant</p>
                <p className="text-[10px] opacity-90">Ask about your balance, calories, food, or campaigns</p>
              </div>
            </div>

            {/* Message list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FAFAFA]">
              {messages.length === 0 && (
                <div className="text-center pt-6 space-y-3">
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Try asking</p>
                  <div className="space-y-2">
                    {[
                      'How many points do I have?',
                      'What did I eat yesterday?',
                      'Find me spicy food under 500 cal',
                      'Am I close to any rewards?',
                    ].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => setInput(prompt)}
                        className="block w-full text-xs text-left px-4 py-2 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-colors text-[#1A1A1A]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] text-xs px-3.5 py-2.5 rounded-2xl leading-relaxed shadow-sm ${
                      m.from === 'user'
                        ? 'bg-[#1A1A1A] text-white rounded-br-sm'
                        : 'bg-white text-[#1A1A1A] border border-gray-100 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white border border-gray-100 text-[#6B7280] text-xs px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  </div>
                </motion.div>
              )}
            </div>

            {error && <p className="text-xs text-red-500 px-5 pt-1">{error}</p>}

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-gray-100 bg-white">
              <input
                className="flex-1 text-xs bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#FF8A00] focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="Ask anything…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-br from-[#FF8A00] to-[#FFD166] text-white w-10 h-10 rounded-xl shadow-md disabled:opacity-40 flex items-center justify-center"
              >
                <Send size={15} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
