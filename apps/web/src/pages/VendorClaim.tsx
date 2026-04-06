import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { submitClaim, getVendorClaims, getVendorSummary } from '../lib/api'
import toast from 'react-hot-toast'

function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function today() { return new Date().toISOString().split('T')[0] }

export default function VendorClaim() {
  const { card } = useCard()
  const [claims, setClaims] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(today())

  useEffect(() => {
    if (!card?.vendor_id) return
    load()
  }, [card?.vendor_id])

  async function load() {
    if (!card?.vendor_id) return
    setLoading(true)
    try {
      const [claimsRes, summaryRes] = await Promise.all([
        getVendorClaims(card.vendor_id, card.uid) as any,
        getVendorSummary(card.vendor_id, card.uid) as any,
      ])
      setClaims(claimsRes.claims ?? claimsRes ?? [])
      setSummary(summaryRes)
    } catch { } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id) return
    setSubmitting(true)
    try {
      await submitClaim(card.vendor_id, card.uid, start, end)
      toast.success('Claim submitted!')
      load()
    } catch (e: any) { toast.error(e.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const statusColor = (s: string) =>
    s === 'APPROVED' ? 'bg-green-100 text-green-700' : s === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'

  if (!card) return null

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Subsidy Claim</h1>

      <div className="bg-black text-white rounded-xl p-4">
        <p className="text-xs text-gray-400">Available to Claim</p>
        <p className="text-2xl font-bold">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm font-medium">New Claim</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>

      <p className="text-sm font-medium">Claim History</p>
      {loading ? [1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />) :
        claims.length === 0 ? <p className="text-sm text-gray-400">No claims submitted yet.</p> :
        claims.map((c: any) => (
          <div key={c.claim_id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">{c.claim_period_start} → {c.claim_period_end}</p>
                <p className="text-xs text-gray-400 mt-0.5">Submitted: {new Date(c.generated_at).toLocaleDateString('en-MY')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-700">RM {Number(c.total_amount).toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}
