// Consumer Registration — Figma design to be applied via MCP
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerCard } from '../lib/api'
import { useCard } from '../context/CardContext'
import toast from 'react-hot-toast'

export default function Register() {
  const { loginCard } = useCard()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    uid: '',
    owner_name: '',
    owner_email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await registerCard({
        uid: form.uid.trim(),
        owner_name: form.owner_name.trim(),
        owner_email: form.owner_email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
      })
      // Auto sign in after registration
      await loginCard(form.uid.trim(), form.password)
      toast.success('Welcome to Night Market!')
      navigate('/dashboard')
    } catch (e: any) {
      if (e.message === 'CARD_ALREADY_REGISTERED') {
        toast.error('This card UID is already registered. Try signing in instead.')
      } else {
        toast.error(e.message ?? 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register your NFC card to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white p-6 rounded-xl shadow">
          {/* Card UID */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Card UID *</label>
            <input
              required
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="e.g. 04:A3:2F:B1"
              value={form.uid}
              onChange={e => set('uid', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-0.5">Found on the back of your NFC card</p>
          </div>

          {/* Full name */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Full Name *</label>
            <input
              required
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="As per IC"
              value={form.owner_name}
              onChange={e => set('owner_name', e.target.value)}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Email Address *</label>
            <input
              required
              type="email"
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="you@example.com"
              value={form.owner_email}
              onChange={e => set('owner_email', e.target.value)}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Phone Number *</label>
            <input
              required
              type="tel"
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="01X-XXXXXXX"
              value={form.phone_number}
              onChange={e => set('phone_number', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-0.5">Malaysian mobile number</p>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Password *</label>
            <input
              required
              type="password"
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={e => set('password', e.target.value)}
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Confirm Password *</label>
            <input
              required
              type="password"
              className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
              placeholder="Repeat your password"
              value={form.confirm_password}
              onChange={e => set('confirm_password', e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/" className="text-black font-medium underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
