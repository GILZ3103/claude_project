// Onboarding — register a new vendor stall
// Figma design to be applied via MCP
import { useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { registerVendor } from '../lib/api'
import toast from 'react-hot-toast'

export default function Onboarding() {
  const { card, setVendorId } = useVendor()
  const [form, setForm] = useState({
    business_name: '',
    category: '',
    description: '',
    grid_x: '',
    grid_y: '',
  })
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!card) return
    setLoading(true)
    try {
      const res = await registerVendor({
        owner_card_uid: card.uid,
        business_name: form.business_name,
        category: form.category || undefined,
        description: form.description || undefined,
        grid_x: form.grid_x ? Number(form.grid_x) : undefined,
        grid_y: form.grid_y ? Number(form.grid_y) : undefined,
      }) as any
      setVendorId(res.vendor?.vendor_id ?? res.vendor_id)
      toast.success('Stall registered!')
    } catch (e: any) {
      toast.error(e.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div>
        <h2 className="text-xl font-bold">Register Your Stall</h2>
        <p className="text-sm text-gray-500 mt-1">Set up your night market stall profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          className="w-full border rounded-lg px-4 py-3 text-sm"
          placeholder="Business name *"
          value={form.business_name}
          onChange={e => set('business_name', e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-4 py-3 text-sm"
          placeholder="Category (e.g. Nasi Lemak, Satay)"
          value={form.category}
          onChange={e => set('category', e.target.value)}
        />
        <textarea
          className="w-full border rounded-lg px-4 py-3 text-sm"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
        <div className="flex gap-3">
          <input
            type="number"
            className="flex-1 border rounded-lg px-4 py-3 text-sm"
            placeholder="Grid X"
            value={form.grid_x}
            onChange={e => set('grid_x', e.target.value)}
          />
          <input
            type="number"
            className="flex-1 border rounded-lg px-4 py-3 text-sm"
            placeholder="Grid Y"
            value={form.grid_y}
            onChange={e => set('grid_y', e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Register Stall'}
        </button>
      </form>
    </div>
  )
}
