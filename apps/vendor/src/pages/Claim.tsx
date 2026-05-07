// Claim — submit subsidy claims and view history
// Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { submitClaim, getVendorClaims } from '../lib/api'
import toast from 'react-hot-toast'

function toDateInput(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function Claim() {
  const { vendorId } = useVendor()
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Default: current month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [start, setStart] = useState(toDateInput(firstOfMonth))
  const [end, setEnd] = useState(toDateInput(now))

  useEffect(() => {
    if (vendorId) loadClaims()
  }, [vendorId])

  async function loadClaims() {
    setLoading(true)
    try {
      const res = await getVendorClaims(vendorId!) as any
      setClaims(res.claims ?? res ?? [])
    } catch {
      toast.error('Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorId) return
    setSubmitting(true)
    try {
      await submitClaim(vendorId, start, end)
      toast.success('Claim submitted!')
      loadClaims()
    } catch (e: any) {
      toast.error(e.message ?? 'Claim failed')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = (s: string) => {
    if (s === 'APPROVED') return 'text-green-600'
    if (s === 'REJECTED') return 'text-red-500'
    return 'text-yellow-600'
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Subsidy Claim</h2>

      {/* New claim form */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-3">Submit New Claim</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={start}
                onChange={e => setStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                value={end}
                onChange={e => setEnd(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </form>
      </div>

      {/* Claims history */}
      <div>
        <p className="text-sm font-medium mb-3">Claim History</p>

        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && claims.length === 0 && (
          <p className="text-sm text-gray-400">No claims submitted yet.</p>
        )}

        {!loading && claims.map((c: any) => (
          <div key={c.claim_id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center mb-3">
            <div>
              <p className="text-sm font-medium">
                {new Date(c.claim_period_start).toLocaleDateString('en-MY')}
                {' – '}
                {new Date(c.claim_period_end).toLocaleDateString('en-MY')}
              </p>
              <p className="text-xs text-gray-400">
                Submitted {new Date(c.submitted_at).toLocaleDateString('en-MY')}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">RM {Number(c.total_claimed ?? 0).toFixed(2)}</p>
              <p className={`text-xs font-medium ${statusColor(c.status)}`}>{c.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
