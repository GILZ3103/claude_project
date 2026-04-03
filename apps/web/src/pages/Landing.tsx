// Landing / Login page — Figma design to be applied via MCP
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCard } from '../context/CardContext'

export default function Landing() {
  const { card, loading, error, loginCard, unlinkCard } = useCard()
  const [uid, setUid] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!uid.trim() || !password) return
    await loginCard(uid.trim(), password)
    navigate('/dashboard')
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
          <div className="bg-white rounded-xl p-5 shadow text-center space-y-3">
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="font-bold text-lg">{card.owner_name}</p>
            <p className="text-sm text-gray-400">{card.uid}</p>
            <p className="mt-1 font-semibold text-green-600">RM {Number(card.points_balance).toFixed(2)} pts</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-black text-white rounded-lg py-2 text-sm font-medium"
              >
                Go to Dashboard
              </button>
              <button
                onClick={unlinkCard}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                className="w-full border rounded-lg px-4 py-3 text-sm"
                placeholder="Card UID (e.g. 04:A3:2F:B1)"
                value={uid}
                onChange={e => setUid(e.target.value)}
              />
              <input
                type="password"
                className="w-full border rounded-lg px-4 py-3 text-sm"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500">
              New to Night Market?{' '}
              <Link to="/register" className="text-black font-medium underline">
                Register your card
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
