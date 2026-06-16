import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowLeft, Plus, X, Trash2, ExternalLink, Wallet, ChevronDown, ChevronUp,
  Landmark, Zap, Receipt, FileText, CheckCircle, Clock, XCircle, type LucideIcon
} from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitClaim, getVendorClaims, getVendorSummary, getComplianceRecords, addComplianceRecord, deleteComplianceRecord } from '../lib/api'
import toast from 'react-hot-toast'
import { HeroHeader } from '../components/HeroHeader'
import { IconBadge } from '../components/Badges'

function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function todayStr() { return new Date().toISOString().split('T')[0] }

const PORTALS: { name: string; desc: string; url: string; icon: LucideIcon; tone: string }[] = [
  { name: 'LHDN e-Filing', desc: 'Submit income tax return online', url: 'https://efiling.hasil.gov.my', icon: Landmark, tone: 'bg-blue-50 border-blue-200 text-blue-600' },
  { name: 'MyTax (LHDN)', desc: 'View tax account, payments, notices', url: 'https://mytax.hasil.gov.my', icon: FileText, tone: 'bg-blue-50 border-blue-200 text-blue-600' },
  { name: 'MyTNB', desc: 'Pay electric bill, view usage', url: 'https://www.mytnb.com.my', icon: Zap, tone: 'bg-yellow-50 border-yellow-200 text-yellow-600' },
  { name: 'RMCD MySST', desc: 'Sales & Service Tax registration and filing', url: 'https://mysst.customs.gov.my', icon: Receipt, tone: 'bg-green-50 border-green-200 text-green-600' },
]

const TYPE_LABELS: Record<string, string> = {
  INCOME_TAX: 'Income Tax',
  ELECTRIC_BILL: 'Electric Bill',
  BUSINESS_TAX: 'Business Tax',
  OTHER: 'Other',
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  INCOME_TAX: Landmark,
  ELECTRIC_BILL: Zap,
  BUSINESS_TAX: Receipt,
  OTHER: FileText,
}

const EMPTY_RECORD = { record_type: 'INCOME_TAX', period_label: '', submitted_at: todayStr(), amount_rm: '', reference_number: '', notes: '' }

const inputCls = 'w-full bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all text-sm'

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

  const claimStatus = (s: string): { tone: 'green' | 'red' | 'orange'; icon: LucideIcon } =>
    s === 'APPROVED' ? { tone: 'green', icon: CheckCircle }
      : s === 'REJECTED' ? { tone: 'red', icon: XCircle }
        : { tone: 'orange', icon: Clock }

  const grouped = records.reduce((acc, r) => {
    ;(acc[r.record_type] = acc[r.record_type] ?? []).push(r)
    return acc
  }, {} as Record<string, any[]>)

  if (!card) return null

  return (
    <div className="px-4 pb-28 max-w-lg mx-auto pt-4">
      {/* Header */}
      <div className="-mx-4 -mt-4 mb-5">
        <HeroHeader
          title="Compliance & Submissions"
          subtitle={card.business_name ?? 'Taxes, bills & subsidy claims'}
          seed="vendor-claim"
        />
      </div>

      <button
        onClick={() => navigate('/vendor/dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition-colors mb-5"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Government portal links */}
      <p className="text-sm font-bold text-[#1A1A1A] mb-3">Government Portals</p>
      <div className="grid grid-cols-2 gap-3 mb-7">
        {PORTALS.map(p => {
          const Icon = p.icon
          return (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`border rounded-[1.25rem] p-4 flex flex-col gap-2 ${p.tone} hover:shadow-md hover:-translate-y-0.5 transition-all`}>
              <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A] leading-tight">{p.name}</p>
                <p className="text-xs text-[#6B7280] leading-tight mt-0.5">{p.desc}</p>
              </div>
              <span className="text-xs font-semibold inline-flex items-center gap-1 mt-auto">Open <ExternalLink size={11} /></span>
            </a>
          )
        })}
      </div>

      {/* My records */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm font-bold text-[#1A1A1A]">My Submission Records</p>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 text-sm bg-[#FF8A00] hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition-colors"
        >
          {showAddForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Record</>}
        </motion.button>
      </div>

      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleAddRecord} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-5 space-y-3 mb-6 overflow-hidden">
          <p className="text-sm font-bold text-[#1A1A1A]">New Record</p>
          <select required className={inputCls}
            value={newRecord.record_type} onChange={e => setNewRecord(r => ({ ...r, record_type: e.target.value }))}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input required className={inputCls} placeholder="Period (e.g. 2024, Mar 2025)" value={newRecord.period_label} onChange={e => setNewRecord(r => ({ ...r, period_label: e.target.value }))} />
            <input required type="date" className={inputCls} value={newRecord.submitted_at} onChange={e => setNewRecord(r => ({ ...r, submitted_at: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" className={inputCls} placeholder="Amount (RM)" value={newRecord.amount_rm} onChange={e => setNewRecord(r => ({ ...r, amount_rm: e.target.value }))} />
            <input className={inputCls} placeholder="Reference no." value={newRecord.reference_number} onChange={e => setNewRecord(r => ({ ...r, reference_number: e.target.value }))} />
          </div>
          <input className={inputCls} placeholder="Notes (optional)" value={newRecord.notes} onChange={e => setNewRecord(r => ({ ...r, notes: e.target.value }))} />
          <button type="submit" disabled={addingRecord} className="w-full bg-[#FF8A00] hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors">
            {addingRecord ? 'Saving...' : 'Save Record'}
          </button>
        </motion.form>
      )}

      {loadingRecords ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-10 bg-white rounded-[1.5rem] border border-dashed border-gray-200 text-[#6B7280]">
          <FileText size={30} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No records yet. Add your first submission above.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, recs]) => {
            const Icon = TYPE_ICONS[type] ?? FileText
            return (
              <div key={type}>
                <p className="text-xs text-[#6B7280] font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Icon size={13} className="text-[#FF8A00]" /> {TYPE_LABELS[type] ?? type}
                </p>
                <div className="space-y-2">
                  {(recs as any[]).map((r: any) => (
                    <div key={r.record_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex justify-between items-start gap-2 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#FF8A00] flex items-center justify-center shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#1A1A1A]">{r.period_label}</p>
                          <p className="text-xs text-[#6B7280]">{new Date(r.submitted_at).toLocaleDateString('en-MY')}{r.reference_number ? ` · Ref: ${r.reference_number}` : ''}</p>
                          {r.amount_rm && <p className="text-xs font-bold text-green-700 mt-0.5">RM {Number(r.amount_rm).toFixed(2)}</p>}
                          {r.notes && <p className="text-xs text-[#6B7280] mt-0.5 truncate">{r.notes}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(r.record_id)} className="text-gray-300 hover:text-red-500 shrink-0 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Subsidy claim — collapsible */}
      <div className="border-t border-gray-100 mt-7 pt-6">
        <button onClick={() => setSubsidyOpen(v => !v)} className="flex justify-between items-center w-full text-left">
          <p className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2"><Wallet size={16} className="text-[#FF8A00]" /> Subsidy Claim</p>
          {subsidyOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {subsidyOpen && (
          <div className="mt-4 space-y-4">
            <div className="relative overflow-hidden rounded-[1.5rem] p-6 bg-gradient-to-br from-[#FF8A00] to-[#FFD166] text-white shadow-md">
              <div className="flex items-center gap-2 text-white/90 mb-1">
                <Wallet size={15} />
                <p className="text-xs font-semibold uppercase tracking-wider">Available to Claim</p>
              </div>
              <p className="text-3xl font-bold drop-shadow-sm">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
              <Wallet className="absolute -right-3 -bottom-3 text-white/15" size={96} />
            </div>

            <form onSubmit={handleSubmitClaim} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-sm font-bold text-[#1A1A1A]">New Claim</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[#6B7280] font-medium">From</label>
                  <input type="date" className={`${inputCls} mt-1`} value={start} onChange={e => setStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] font-medium">To</label>
                  <input type="date" className={`${inputCls} mt-1`} value={end} onChange={e => setEnd(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-[#1A1A1A] hover:bg-gray-800 text-white rounded-xl py-3 text-sm font-semibold shadow-md disabled:opacity-50 transition-colors">
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </button>
            </form>

            <p className="text-sm font-bold text-[#1A1A1A]">Claim History</p>
            {loadingClaims ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : claims.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No claims submitted yet.</p>
            ) : (
              claims.map((c: any) => {
                const st = claimStatus(c.status)
                return (
                  <div key={c.claim_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1A1A1A]">{c.claim_period_start} → {c.claim_period_end}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">Submitted: {new Date(c.generated_at).toLocaleDateString('en-MY')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-green-700">RM {Number(c.total_amount).toFixed(2)}</p>
                        <IconBadge icon={st.icon} tone={st.tone} className="mt-1">{c.status}</IconBadge>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
