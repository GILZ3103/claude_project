// Onboarding — Step 2: Register stall details
// Figma design to be applied via MCP
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVendor } from '../context/VendorContext'
import { registerVendor } from '../lib/api'
import toast from 'react-hot-toast'

export default function Onboarding() {
  const { card, setVendorId } = useVendor()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    business_name: '',
    ssm_registration_number: '',
    phone_number: card?.phone_number ?? '',
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
        ssm_registration_number: form.ssm_registration_number,
        phone_number: form.phone_number,
        category: form.category || undefined,
        description: form.description || undefined,
        grid_x: form.grid_x ? Number(form.grid_x) : undefined,
        grid_y: form.grid_y ? Number(form.grid_y) : undefined,
      }) as any
      const vid = res.vendor_id ?? res.vendor?.vendor_id
      setVendorId(vid)
      toast.success('Stall registered! Welcome to Night Market.')
      navigate('/menu')
    } catch (e: any) {
      if (e.message === 'SSM_ALREADY_REGISTERED') {
        toast.error('This SSM number is already registered.')
      } else {
        toast.error(e.message ?? 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div>
        <p className="text-xs text-gray-400 font-medium">STEP 2 OF 2</p>
        <h2 className="text-xl font-bold mt-1">Business Information</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about your stall</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Business name */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Business Name *</label>
          <input
            required
            className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
            placeholder="e.g. Mak Cik Nasi Lemak"
            value={form.business_name}
            onChange={e => set('business_name', e.target.value)}
          />
        </div>

        {/* SSM */}
        <div>
          <label className="text-xs text-gray-500 font-medium">SSM Registration Number *</label>
          <input
            required
            className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
            placeholder="e.g. 001234567-X or SA0012345-T"
            value={form.ssm_registration_number}
            onChange={e => set('ssm_registration_number', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Malaysia SSM business registration number (ROB / ROC)
          </p>
        </div>

        {/* Business phone */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Business Phone *</label>
          <input
            required
            type="tel"
            className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
            placeholder="01X-XXXXXXX"
            value={form.phone_number}
            onChange={e => set('phone_number', e.target.value)}
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Category</label>
          <input
            className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
            placeholder="e.g. Nasi Lemak, Satay, Beverages"
            value={form.category}
            onChange={e => set('category', e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Description</label>
          <textarea
            className="w-full border rounded-lg px-4 py-2.5 text-sm mt-1"
            placeholder="Tell customers about your stall"
            rows={3}
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {/* Grid position */}
        <div>
          <label className="text-xs text-gray-500 font-medium">Stall Position (optional)</label>
          <div className="flex gap-3 mt-1">
            <input
              type="number"
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
              placeholder="Grid X"
              value={form.grid_x}
              onChange={e => set('grid_x', e.target.value)}
            />
            <input
              type="number"
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
              placeholder="Grid Y"
              value={form.grid_y}
              onChange={e => set('grid_y', e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Can be set later by market admin</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  )
}
