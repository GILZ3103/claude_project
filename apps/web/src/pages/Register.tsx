import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerCard, registerVendor } from '../lib/api'
import { useCard } from '../context/CardContext'
import toast from 'react-hot-toast'

type Mode = 'consumer' | 'vendor'

export default function Register() {
  const { loginCard } = useCard()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('consumer')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    uid: '', owner_name: '', owner_email: '', phone_number: '',
    password: '', confirm_password: '',
    // Vendor-only
    business_name: '', ssm_registration_number: '', category: '', description: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    if (mode === 'vendor' && !form.business_name.trim()) return toast.error('Business name is required')
    if (mode === 'vendor' && !form.ssm_registration_number.trim()) return toast.error('SSM registration number is required')

    setLoading(true)
    try {
      // Step 1 — create card account (same for both)
      await registerCard({
        uid: form.uid.trim(),
        owner_name: form.owner_name.trim(),
        owner_email: form.owner_email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
      })

      // Step 2 — vendor: register stall (upgrades role to VENDOR)
      if (mode === 'vendor') {
        await registerVendor({
          owner_card_uid: form.uid.trim(),
          business_name: form.business_name.trim(),
          ssm_registration_number: form.ssm_registration_number.trim(),
          phone_number: form.phone_number.trim(),
          category: form.category.trim() || undefined,
          description: form.description.trim() || undefined,
        })
      }

      // Sign in
      const ok = await loginCard(form.owner_email.trim(), form.password)
      if (ok) {
        toast.success(mode === 'vendor' ? 'Vendor account created!' : 'Welcome to Night Market!')
        navigate('/dashboard')
      }
    } catch (e: any) {
      if (e.message === 'CARD_ALREADY_REGISTERED') {
        toast.error('This card UID is already registered.')
      } else if (e.message === 'SSM_ALREADY_REGISTERED') {
        toast.error('This SSM number is already registered.')
      } else {
        toast.error(e.message ?? 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md space-y-5">

        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register your NFC card to get started</p>
        </div>

        {/* Slide toggle */}
        <div className="bg-gray-200 rounded-full p-1 flex relative">
          <div
            className="absolute top-1 bottom-1 w-1/2 bg-black rounded-full transition-all duration-300"
            style={{ left: mode === 'consumer' ? '4px' : 'calc(50% - 4px)' }}
          />
          <button
            type="button"
            onClick={() => setMode('consumer')}
            className={`flex-1 z-10 py-2 text-sm font-semibold rounded-full transition-colors ${mode === 'consumer' ? 'text-white' : 'text-gray-500'}`}
          >
            Consumer
          </button>
          <button
            type="button"
            onClick={() => setMode('vendor')}
            className={`flex-1 z-10 py-2 text-sm font-semibold rounded-full transition-colors ${mode === 'vendor' ? 'text-white' : 'text-gray-500'}`}
          >
            Vendor
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-white p-6 rounded-xl shadow">

          {/* Common fields */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Card UID *</label>
            <input required className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="e.g. 04:A3:2F:B1" value={form.uid} onChange={e => set('uid', e.target.value)} />
            <p className="text-xs text-gray-400 mt-0.5">Found on the back of your NFC card</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Full Name *</label>
            <input required className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="As per IC" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Email Address *</label>
            <input required type="email" className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="you@example.com" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Phone Number *</label>
            <input required type="tel" className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="01X-XXXXXXX" value={form.phone_number} onChange={e => set('phone_number', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Password *</label>
            <input required type="password" className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="Minimum 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Confirm Password *</label>
            <input required type="password" className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="Repeat your password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
          </div>

          {/* Vendor-only fields */}
          {mode === 'vendor' && (
            <>
              <hr className="my-2" />
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Business Information</p>
              <div>
                <label className="text-xs text-gray-500 font-medium">Business Name *</label>
                <input required={mode === 'vendor'} className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="e.g. Nasi Lemak Siti" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">SSM Registration No. *</label>
                <input required={mode === 'vendor'} className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="e.g. 001234567-X or SA0012345-T" value={form.ssm_registration_number} onChange={e => set('ssm_registration_number', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Category</label>
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="e.g. Rice Dishes, Drinks" value={form.category} onChange={e => set('category', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Description</label>
                <input className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1" placeholder="Short description of your stall" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating account...' : mode === 'vendor' ? 'Register as Vendor' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/" className="text-black font-medium underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
