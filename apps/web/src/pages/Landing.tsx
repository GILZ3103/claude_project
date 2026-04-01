// Landing page — Figma design to be applied via MCP
// API integration complete. Placeholder layout until Figma handoff.
import { useState } from 'react'
import { useCard } from '../context/CardContext'
import { registerCard } from '../lib/api'
import toast from 'react-hot-toast'

export default function Landing() {
  const { card, loading, error, linkCard } = useCard()
  const [uid, setUid] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [regForm, setRegForm] = useState({ uid: '', owner_name: '', owner_email: '' })
  const [regLoading, setRegLoading] = useState(false)

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    if (!uid.trim()) return
    await linkCard(uid.trim())
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegLoading(true)
    try {
      await registerCard(regForm.uid, regForm.owner_name, regForm.owner_email)
      toast.success('Card registered! You can now link it.')
      setShowRegister(false)
      setUid(regForm.uid)
    } catch (e: any) {
      toast.error(e.message ?? 'Registration failed')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Night Market</h1>
          <p className="text-gray-500 mt-1">Tap. Eat. Earn.</p>
        </div>

        {card ? (
          <div className="bg-white rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">Linked as</p>
            <p className="font-bold text-lg">{card.owner_name}</p>
            <p className="text-sm text-gray-400">{card.uid}</p>
            <p className="mt-2 font-semibold text-green-600">RM {Number(card.points_balance).toFixed(2)} pts</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleLink} className="space-y-3">
              <input
                className="w-full border rounded-lg px-4 py-3 text-sm"
                placeholder="Enter card UID (e.g. 04:A3:2F:B1)"
                value={uid}
                onChange={e => setUid(e.target.value)}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
              >
                {loading ? 'Linking...' : 'Link Card'}
              </button>
            </form>

            <button
              onClick={() => setShowRegister(!showRegister)}
              className="w-full text-sm text-gray-500 underline"
            >
              New card? Register here
            </button>

            {showRegister && (
              <form onSubmit={handleRegister} className="space-y-3 bg-white p-4 rounded-xl shadow">
                <h2 className="font-semibold">Register New Card</h2>
                <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Card UID" value={regForm.uid} onChange={e => setRegForm(p => ({ ...p, uid: e.target.value }))} />
                <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Your name" value={regForm.owner_name} onChange={e => setRegForm(p => ({ ...p, owner_name: e.target.value }))} />
                <input className="w-full border rounded-lg px-4 py-2 text-sm" placeholder="Email" type="email" value={regForm.owner_email} onChange={e => setRegForm(p => ({ ...p, owner_email: e.target.value }))} />
                <button type="submit" disabled={regLoading} className="w-full bg-black text-white rounded-lg py-2 text-sm disabled:opacity-50">
                  {regLoading ? 'Registering...' : 'Register'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
