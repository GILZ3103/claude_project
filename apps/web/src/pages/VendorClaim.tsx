import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCard } from '../context/CardContext'
import { submitClaim, getVendorClaims, getVendorSummary, getComplianceRecords, addComplianceRecord, deleteComplianceRecord } from '../lib/api'
import toast from 'react-hot-toast'

function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function todayStr() { return new Date().toISOString().split('T')[0] }

const PORTALS = [
  { name: 'LHDN e-Filing', desc: 'Submit income tax return online', url: 'https://efiling.hasil.gov.my', color: 'bg-blue-50 border-blue-200' },
  { name: 'MyTax (LHDN)', desc: 'View tax account, payments, notices', url: 'https://mytax.hasil.gov.my', color: 'bg-blue-50 border-blue-200' },
  { name: 'MyTNB', desc: 'Pay electric bill, view usage', url: 'https://www.mytnb.com.my', color: 'bg-yellow-50 border-yellow-200' },
  { name: 'RMCD MySST', desc: 'Sales & Service Tax registration and filing', url: 'https://mysst.customs.gov.my', color: 'bg-green-50 border-green-200' },
]

const TYPE_LABELS: Record<string, string> = {
  INCOME_TAX: 'Income Tax',
  ELECTRIC_BILL: 'Electric Bill',
  BUSINESS_TAX: 'Business Tax',
  OTHER: 'Other',
}

const EMPTY_RECORD = { record_type: 'INCOME_TAX', period_label: '', submitted_at: todayStr(), amount_rm: '', reference_number: '', notes: '' }

export default function VendorClaim() {
  const { card } = useCard()
  const navigate = useNavigate()

  // Compliance state
  const [records, setRecords] = useState<any[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingRecord, setAddingRecord] = useState(false)
  const [newRecord, setNewRecord] = useState(EMPTY_RECORD)

  // Subsidy claim state
  const [subsidyOpen, setSubsidyOpen] = useState(true)
  const [claims, setClaims] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loadingClaims, setLoadingClaims] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(todayStr())

  useEffect(() => {
    if (!card?.vendor_id) return
    loadRecords()
    loadSubsidy()
  }, [card?.vendor_id])

  async function loadRecords() {
    if (!card?.vendor_id) return
    setLoadingRecords(true)
    try {
      const res = await getComplianceRecords(card.vendor_id, card.uid) as any
      setRecords(res ?? [])
    } catch { toast.error('Failed to load records') }
    finally { setLoadingRecords(false) }
  }

  async function loadSubsidy() {
    if (!card?.vendor_id) return
    setLoadingClaims(true)
    try {
      const [claimsRes, summaryRes] = await Promise.all([
        getVendorClaims(card.vendor_id, card.uid) as any,
        getVendorSummary(card.vendor_id, card.uid) as any,
      ])
      setClaims(claimsRes.claims ?? claimsRes ?? [])
      setSummary(summaryRes)
    } catch { } finally { setLoadingClaims(false) }
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id) return
    setAddingRecord(true)
    try {
      await addComplianceRecord(card.vendor_id, card.uid, {
        record_type: newRecord.record_type,
        period_label: newRecord.period_label,
        submitted_at: newRecord.submitted_at,
        amount_rm: newRecord.amount_rm ? parseFloat(newRecord.amount_rm) : undefined,
        reference_number: newRecord.reference_number || undefined,
        notes: newRecord.notes || undefined,
      })
      toast.success('Record added')
      setNewRecord(EMPTY_RECORD)
      setShowAddForm(false)
      loadRecords()
    } catch (e: any) { toast.error(e.message ?? 'Failed') }
    finally { setAddingRecord(false) }
  }

  async function handleDelete(record_id: string) {
    if (!card?.vendor_id) return
    try {
      await deleteComplianceRecord(card.vendor_id, card.uid, record_id)
      setRecords(r => r.filter(x => x.record_id !== record_id))
      toast.success('Record deleted')
    } catch (e: any) { toast.error(e.message ?? 'Failed') }
  }

  async function handleSubmitClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id) return
    setSubmitting(true)
    try {
      await submitClaim(card.vendor_id, card.uid, start, end)
      toast.success('Claim submitted!')
      loadSubsidy()
    } catch (e: any) { toast.error(e.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const statusColor = (s: string) =>
    s === 'APPROVED' ? 'bg-green-100 text-green-700' : s === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'

  const grouped = records.reduce((acc, r) => {
    ;(acc[r.record_type] = acc[r.record_type] ?? []).push(r)
    return acc
  }, {} as Record<string, any[]>)

  if (!card) return null

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <button
        onClick={() => navigate('/vendor/dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition-colors mb-2"
      >
        ← Back to Dashboard
      </button>
      <h1 className="text-xl font-bold">Compliance & Submissions</h1>

      {/* Government portal links */}
      <div>
        <p className="text-sm font-medium mb-2">Government Portals</p>
        <div className="grid grid-cols-2 gap-2">
          {PORTALS.map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`border rounded-xl p-3 flex flex-col gap-1 ${p.color} hover:opacity-80 transition-opacity`}>
              <p className="text-xs font-semibold text-gray-800">{p.name}</p>
              <p className="text-xs text-gray-500 leading-tight">{p.desc}</p>
              <p className="text-xs text-blue-600 mt-1">Open →</p>
            </a>
          ))}
        </div>
      </div>

      {/* My records */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">My Submission Records</p>
        <button onClick={() => setShowAddForm(v => !v)} className="text-sm bg-black text-white px-3 py-1.5 rounded-lg font-medium">
          {showAddForm ? 'Cancel' : '+ Add Record'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddRecord} className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-sm font-medium">New Record</p>
          <select required className="w-full border rounded-lg px-3 py-2 text-sm"
            value={newRecord.record_type} onChange={e => setNewRecord(r => ({ ...r, record_type: e.target.value }))}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input required className="border rounded-lg px-3 py-2 text-sm" placeholder="Period (e.g. 2024, Mar 2025)" value={newRecord.period_label} onChange={e => setNewRecord(r => ({ ...r, period_label: e.target.value }))} />
            <input required type="date" className="border rounded-lg px-3 py-2 text-sm" value={newRecord.submitted_at} onChange={e => setNewRecord(r => ({ ...r, submitted_at: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Amount (RM)" value={newRecord.amount_rm} onChange={e => setNewRecord(r => ({ ...r, amount_rm: e.target.value }))} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Reference no." value={newRecord.reference_number} onChange={e => setNewRecord(r => ({ ...r, reference_number: e.target.value }))} />
          </div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notes (optional)" value={newRecord.notes} onChange={e => setNewRecord(r => ({ ...r, notes: e.target.value }))} />
          <button type="submit" disabled={addingRecord} className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {addingRecord ? 'Saving...' : 'Save Record'}
          </button>
        </form>
      )}

      {loadingRecords
        ? [1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        : Object.keys(grouped).length === 0
          ? <p className="text-sm text-gray-400">No records yet. Add your first submission above.</p>
          : Object.entries(grouped).map(([type, recs]) => (
              <div key={type}>
                <p className="text-xs text-gray-500 font-medium mb-1.5">{TYPE_LABELS[type] ?? type}</p>
                <div className="space-y-2">
                  {(recs as any[]).map((r: any) => (
                    <div key={r.record_id} className="bg-white rounded-xl shadow p-3 flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.period_label}</p>
                        <p className="text-xs text-gray-400">{new Date(r.submitted_at).toLocaleDateString('en-MY')}{r.reference_number ? ` · Ref: ${r.reference_number}` : ''}</p>
                        {r.amount_rm && <p className="text-xs font-semibold text-gray-700 mt-0.5">RM {Number(r.amount_rm).toFixed(2)}</p>}
                        {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                      </div>
                      <button onClick={() => handleDelete(r.record_id)} className="text-red-400 text-xs shrink-0 hover:text-red-600">Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            ))
      }

      {/* Subsidy claim — collapsible */}
      <div className="border-t pt-4">
        <button onClick={() => setSubsidyOpen(v => !v)} className="flex justify-between items-center w-full text-left">
          <p className="text-sm font-medium">Subsidy Claim</p>
          <span className="text-gray-400 text-sm">{subsidyOpen ? '▲' : '▼'}</span>
        </button>

        {subsidyOpen && (
          <div className="mt-3 space-y-3">
            <div className="bg-black text-white rounded-xl p-4">
              <p className="text-xs text-gray-400">Available to Claim</p>
              <p className="text-2xl font-bold">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
            </div>

            <form onSubmit={handleSubmitClaim} className="bg-white rounded-xl shadow p-4 space-y-3">
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
            {loadingClaims ? [1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />) :
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
        )}
      </div>
    </div>
  )
}
