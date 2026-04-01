// Login — Figma design to be applied via MCP
import { useState } from 'react'
import { useVendor } from '../context/VendorContext'

export default function Login() {
  const { login, loading, error } = useVendor()
  const [uid, setUid] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (uid.trim()) login(uid.trim())
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Vendor Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Night Market Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border rounded-lg px-4 py-3 text-sm"
            placeholder="Vendor card UID (e.g. 04:A3:2F:B1)"
            value={uid}
            onChange={e => setUid(e.target.value)}
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
      </div>
    </div>
  )
}
