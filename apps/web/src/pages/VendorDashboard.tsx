import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Store, Plus, Edit2, Trash2, X, ShieldCheck, AlertTriangle, FileText,
  CheckCircle, MapPin, CheckSquare, Tag, DollarSign,
  TrendingUp, Star, ReceiptText, ArrowRight, Info, Upload, Loader
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import {
  getVendorSummary, getVendorFood, addFoodItem,
  getComplianceRecords, addComplianceRecord, deleteComplianceRecord,
  applyCampaign, getVendorCampaignApplications
} from '../lib/api'

type Tab = 'overview' | 'compliance' | 'operations' | 'menu' | 'campaigns' | 'reviews'

const TABS: Tab[] = ['overview', 'compliance', 'operations', 'menu', 'campaigns', 'reviews']

const SOP_ITEMS = [
  'Wearing apron, cap, and gloves',
  'Food is properly covered',
  'Utensils are clean and sanitised',
  'Vendor licence clearly displayed',
  'Trash bin provided and covered',
]

const inputCls = 'w-full bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-sm'
const labelCls = 'block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2'

export default function VendorDashboard() {
  const { card } = useCard()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // API data
  const [summary, setSummary] = useState<any>(null)
  const [foodItems, setFoodItems] = useState<any[]>([])
  const [complianceRecords, setComplianceRecords] = useState<any[]>([])
  const [campaignApplications, setCampaignApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Menu modal
  const [menuModalOpen, setMenuModalOpen] = useState(false)
  const [menuName, setMenuName] = useState('')
  const [menuCalories, setMenuCalories] = useState('')
  const [menuPrice, setMenuPrice] = useState('')
  const [menuProtein, setMenuProtein] = useState('')
  const [menuCarbs, setMenuCarbs] = useState('')
  const [menuFat, setMenuFat] = useState('')
  const [savingMenu, setSavingMenu] = useState(false)

  // Compliance add modal
  const [compModalOpen, setCompModalOpen] = useState(false)
  const [compType, setCompType] = useState('INCOME_TAX')
  const [compPeriod, setCompPeriod] = useState('')
  const [compDate, setCompDate] = useState('')
  const [compAmount, setCompAmount] = useState('')
  const [compRef, setCompRef] = useState('')
  const [savingComp, setSavingComp] = useState(false)

  // SOP checklist (session-level, not persisted)
  const [sopChecked, setSopChecked] = useState<boolean[]>(SOP_ITEMS.map(() => false))
  const [sopSubmitted, setSopSubmitted] = useState(() => localStorage.getItem('sop_date') === new Date().toDateString())
  const allSopChecked = sopChecked.every(Boolean)

  // Campaign application modal
  const [campModalOpen, setCampModalOpen] = useState(false)
  const [campName, setCampName] = useState('')
  const [campDesc, setCampDesc] = useState('')
  const [campStart, setCampStart] = useState('')
  const [campEnd, setCampEnd] = useState('')
  const [campCondType, setCampCondType] = useState('SPEND_POINTS')
  const [campThreshold, setCampThreshold] = useState('')
  const [campPointDeduction, setCampPointDeduction] = useState('')
  const [campRewardValue, setCampRewardValue] = useState('')
  const [submittingCamp, setSubmittingCamp] = useState(false)

  // Slot change modal
  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  useEffect(() => {
    if (!card?.vendor_id) return
    loadAll()
  }, [card?.vendor_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [sum, food, comp, apps] = await Promise.all([
        getVendorSummary(card!.vendor_id!, card!.uid) as Promise<any>,
        getVendorFood(card!.vendor_id!) as Promise<any[]>,
        getComplianceRecords(card!.vendor_id!, card!.uid) as Promise<any[]>,
        getVendorCampaignApplications(card!.vendor_id!, card!.uid) as Promise<any[]>,
      ])
      setSummary(sum)
      setFoodItems(food ?? [])
      setComplianceRecords(comp ?? [])
      setCampaignApplications(apps ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  async function handleAddFoodItem(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id || !menuName || !menuCalories || !menuPrice) return
    setSavingMenu(true)
    try {
      await addFoodItem(card.vendor_id, card.uid, {
        name: menuName,
        calories: parseInt(menuCalories),
        price_in_points: parseFloat(menuPrice),
        protein_g: menuProtein ? parseFloat(menuProtein) : undefined,
        carbs_g: menuCarbs ? parseFloat(menuCarbs) : undefined,
        fat_g: menuFat ? parseFloat(menuFat) : undefined,
      })
      toast.success('Menu item added')
      setMenuModalOpen(false)
      setMenuName(''); setMenuCalories(''); setMenuPrice('')
      setMenuProtein(''); setMenuCarbs(''); setMenuFat('')
      const food = await getVendorFood(card.vendor_id) as any[]
      setFoodItems(food ?? [])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add item')
    } finally { setSavingMenu(false) }
  }

  async function handleAddCompliance(e: React.FormEvent) {
    e.preventDefault()
    if (!card?.vendor_id || !compPeriod || !compDate) return
    setSavingComp(true)
    try {
      await addComplianceRecord(card.vendor_id, card.uid, {
        record_type: compType,
        period_label: compPeriod,
        submitted_at: compDate,
        amount_rm: compAmount ? parseFloat(compAmount) : undefined,
        reference_number: compRef || undefined,
      })
      toast.success('Record added')
      setCompModalOpen(false)
      setCompPeriod(''); setCompDate(''); setCompAmount(''); setCompRef('')
      const comp = await getComplianceRecords(card.vendor_id, card.uid) as any[]
      setComplianceRecords(comp ?? [])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add record')
    } finally { setSavingComp(false) }
  }

  async function handleDeleteCompliance(record_id: string) {
    if (!card?.vendor_id) return
    try {
      await deleteComplianceRecord(card.vendor_id, card.uid, record_id)
      setComplianceRecords(r => r.filter((x: any) => x.record_id !== record_id))
      toast.success('Record deleted')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete')
    }
  }

  async function handleApplyCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!card?.vendor_id || !campName || !campThreshold || !campRewardValue) return
    setSubmittingCamp(true)
    try {
      await applyCampaign({
        vendor_id: card.vendor_id,
        card_uid: card.uid,
        name: campName,
        description: campDesc || undefined,
        period_start: campStart || undefined,
        period_end: campEnd || undefined,
        condition_type: campCondType,
        condition_threshold: parseFloat(campThreshold),
        point_deduction: campPointDeduction ? parseFloat(campPointDeduction) : undefined,
        reward_value: parseFloat(campRewardValue),
      })
      toast.success('Application submitted — pending admin review')
      setCampModalOpen(false)
      setCampName(''); setCampDesc(''); setCampStart(''); setCampEnd('')
      setCampThreshold(''); setCampPointDeduction(''); setCampRewardValue('')
      const apps = await getVendorCampaignApplications(card.vendor_id, card.uid) as any[]
      setCampaignApplications(apps ?? [])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit application')
    } finally { setSubmittingCamp(false) }
  }

  function handleSopSubmit() {
    localStorage.setItem('sop_date', new Date().toDateString())
    setSopSubmitted(true)
    toast.success('Daily SOP submitted!')
  }

  if (!card) return null

  // ── APPLICATION STATUS GATES ──
  if (card.application_status === 'PENDING_REVIEW') {
    return (
      <section className="w-full flex flex-col px-4 pb-16 bg-[#FAFAFA] min-h-[100dvh] items-center justify-center pt-8">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-[2rem] p-10 text-center shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-gray-100">
          <div className="absolute top-4 right-4" />
          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200 uppercase tracking-wider">Pending Review</span>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mt-6 mb-6 border-4 border-green-100">
            <CheckCircle size={48} />
          </motion.div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-3">Application Submitted!</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-6">Your vendor application is currently under review by the WarungTek admin team. You'll be notified once approved.</p>
          <div className="bg-blue-50 text-blue-700 text-xs font-medium px-4 py-3 rounded-xl border border-blue-200 flex items-start text-left">
            <Info size={14} className="mr-2 mt-0.5 shrink-0" />
            Approval usually takes 1–2 business days. Contact support if you haven't heard back after 3 days.
          </div>
        </motion.div>
      </section>
    )
  }

  if (card.application_status === 'REJECTED') {
    return (
      <section className="w-full flex flex-col px-4 pb-16 bg-[#FAFAFA] min-h-[100dvh] items-center justify-center pt-8">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-[2rem] p-10 text-center shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-3">Application Rejected</h2>
          <p className="text-sm text-[#6B7280] mb-4">Your vendor application was not approved. Please review the reason below and contact support.</p>
          {card.rejection_reason && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100 text-left mb-6">
              <strong>Reason: </strong>{card.rejection_reason}
            </div>
          )}
          <button onClick={() => navigate('/settings')} className="w-full bg-[#1A1A1A] text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800">Contact Support</button>
        </motion.div>
      </section>
    )
  }

  // ── FULL DASHBOARD ──
  const subsidyTotal = summary?.grand_total_subsidy ?? 0

  return (
    <section className="w-full flex flex-col px-4 sm:px-6 pb-16 bg-[#FAFAFA] min-h-[100dvh]">
      {/* Header + tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-8 mb-8 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-100 shadow-sm">
            <Store className="text-blue-500" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">{card.business_name ?? card.owner_name}</h2>
            <p className="text-xs text-[#6B7280] font-medium">{card.ssm_registration_number ?? 'Vendor Dashboard'}</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto w-full sm:w-auto [&::-webkit-scrollbar]:hidden">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize tracking-wide transition-all shrink-0 ${activeTab === tab ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1A]'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-12"><Loader size={32} className="text-gray-300 animate-spin" /></div>
          ) : (
            <>
              {/* 4 KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                    <DollarSign size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Subsidy</span>
                  </div>
                  <p className="text-3xl font-bold text-[#1A1A1A]">RM {Number(subsidyTotal).toFixed(2)}</p>
                  <button onClick={() => navigate('/vendor/claim')} className="mt-3 text-xs font-semibold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all">
                    View claim <ArrowRight size={12} />
                  </button>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                    <TrendingUp size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Menu Items</span>
                  </div>
                  <p className="text-3xl font-bold text-[#1A1A1A]">{foodItems.length}</p>
                  <button onClick={() => setActiveTab('menu')} className="mt-3 text-xs font-semibold text-orange-600 flex items-center gap-1 hover:gap-2 transition-all">
                    Manage <ArrowRight size={12} />
                  </button>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                    <ReceiptText size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Compliance</span>
                  </div>
                  <p className="text-3xl font-bold text-[#1A1A1A]">{complianceRecords.length}</p>
                  <button onClick={() => setActiveTab('compliance')} className="mt-3 text-xs font-semibold text-green-600 flex items-center gap-1 hover:gap-2 transition-all">
                    Records <ArrowRight size={12} />
                  </button>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 border-t-4 border-t-green-500 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                    <ShieldCheck size={16} className="text-green-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Status</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">Approved</p>
                  <p className="mt-3 text-xs font-bold text-green-600 bg-green-50 self-start px-2 py-1 rounded-md border border-green-100">Verified Vendor</p>
                </div>
              </div>

              {/* Area chart — campaigns subsidy trend or placeholder */}
              <div className="w-full bg-white rounded-[2rem] p-8 border border-gray-100 border-t-4 border-t-[#3B82F6] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-base font-bold text-[#1A1A1A] mb-6">Subsidy by Campaign</h3>
                {summary?.campaigns?.length > 0 ? (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={summary.campaigns.map((c: any) => ({ name: c.campaign_name ?? 'Campaign', subsidy: Number(c.total_subsidy_owed ?? 0) }))}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSubsidy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                        <Area type="monotone" dataKey="subsidy" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSubsidy)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-[#6B7280]">
                    <TrendingUp size={32} className="mb-2 text-gray-200" />
                    <p className="text-sm">No campaign data yet. Join a subsidy campaign to see trends.</p>
                  </div>
                )}
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Manage Menu', sub: 'Add food items', tab: 'menu' as Tab, color: 'bg-orange-50 border-orange-100 text-orange-600' },
                  { label: 'Compliance Docs', sub: 'Track records', tab: 'compliance' as Tab, color: 'bg-green-50 border-green-100 text-green-600' },
                  { label: 'Operations', sub: 'SOP & location', tab: 'operations' as Tab, color: 'bg-blue-50 border-blue-100 text-blue-600' },
                  { label: 'Campaigns', sub: 'Subsidy programs', tab: 'campaigns' as Tab, color: 'bg-purple-50 border-purple-100 text-purple-600' },
                ].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`bg-white rounded-2xl border p-4 text-left hover:shadow-md transition-all ${item.color.split(' ')[1]}`}>
                    <p className={`font-bold text-sm ${item.color.split(' ')[2]}`}>{item.label}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{item.sub}</p>
                    <ArrowRight size={14} className={`mt-3 ${item.color.split(' ')[2]}`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ── COMPLIANCE TAB ── */}
      {activeTab === 'compliance' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-xl text-[#1A1A1A] mb-1">Compliance Records</h3>
                <p className="text-sm text-[#6B7280]">Log your government submissions — LHDN, TNB, SST</p>
              </div>
              <button onClick={() => setCompModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md hover:bg-blue-700 transition-colors">
                <Plus size={14} /> Add Record
              </button>
            </div>

            {complianceRecords.length === 0 ? (
              <div className="text-center py-10 text-[#6B7280]">
                <FileText size={36} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No records yet. Add your first compliance submission.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complianceRecords.map((r: any) => (
                  <div key={r.record_id} className="flex items-center justify-between p-4 bg-[#FAFAFA] rounded-2xl border border-gray-100 hover:bg-white hover:border-gray-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{r.record_type.replace('_', ' ')}</p>
                        <p className="text-xs text-[#6B7280]">{r.period_label} · {r.submitted_at}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.amount_rm && <p className="text-sm font-bold text-[#1A1A1A]">RM {Number(r.amount_rm).toFixed(2)}</p>}
                      <button onClick={() => handleDeleteCompliance(r.record_id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to full compliance page */}
          <button onClick={() => navigate('/vendor/claim')} className="w-full bg-white rounded-2xl border border-gray-200 p-4 text-sm font-semibold text-[#6B7280] hover:bg-gray-50 flex items-center justify-between transition-colors">
            <span>Subsidy Claims & Government Portal Links</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      )}

      {/* ── OPERATIONS TAB ── */}
      {activeTab === 'operations' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SOP Checklist */}
          <div className="bg-white rounded-[2rem] border border-gray-100 border-t-4 border-t-blue-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-xl text-[#1A1A1A] flex items-center gap-2">
                <CheckSquare size={20} className="text-blue-500" /> Daily SOP
              </h3>
              {!sopSubmitted && (
                <button onClick={() => setSopChecked(SOP_ITEMS.map(() => true))} className="text-xs font-semibold text-blue-600">Mark all</button>
              )}
            </div>
            <p className="text-sm text-[#6B7280] mb-6">Complete before opening your stall each day.</p>
            <div className="space-y-3 flex-1">
              {SOP_ITEMS.map((item, i) => (
                <label key={i} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${(sopSubmitted || sopChecked[i]) ? 'bg-blue-50/50 border-blue-100' : 'bg-[#FAFAFA] border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={sopSubmitted || sopChecked[i]}
                    disabled={sopSubmitted}
                    onChange={() => setSopChecked(c => c.map((v, j) => j === i ? !v : v))}
                    className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                  />
                  <span className={`text-sm font-medium ${sopSubmitted ? 'text-gray-500 line-through' : 'text-[#1A1A1A]'}`}>{item}</span>
                </label>
              ))}
            </div>
            {sopSubmitted ? (
              <div className="w-full mt-6 bg-green-50 border border-green-200 text-green-700 font-semibold py-4 rounded-xl flex items-center justify-center gap-2">
                <CheckCircle size={18} /> SOP Submitted for Today
              </div>
            ) : (
              <button
                disabled={!allSopChecked}
                onClick={handleSopSubmit}
                className={`w-full mt-6 py-4 rounded-xl font-semibold transition-colors ${allSopChecked ? 'bg-[#1A1A1A] hover:bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                Submit Daily SOP
              </button>
            )}
          </div>

          {/* Approved Location */}
          <div className="bg-white rounded-[2rem] border border-gray-100 border-t-4 border-t-orange-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex flex-col">
            <h3 className="font-bold text-xl text-[#1A1A1A] mb-2 flex items-center gap-2">
              <MapPin size={20} className="text-orange-500" /> Approved Location
            </h3>
            <p className="text-sm text-[#6B7280] mb-6">You are only permitted to operate at your approved slot.</p>

            {(card.grid_x != null && card.grid_y != null) ? (
              <div className="flex-1 bg-orange-50 rounded-2xl border border-orange-100 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden mb-6">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#fed7aa 2px, transparent 2px), linear-gradient(90deg, #fed7aa 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
                <div className="relative z-10 w-24 h-24 bg-white rounded-2xl shadow-md border-2 border-orange-400 flex flex-col items-center justify-center mb-4">
                  <span className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Grid</span>
                  <span className="text-2xl font-black text-[#1A1A1A]">{card.grid_x},{card.grid_y}</span>
                </div>
                <p className="relative z-10 text-sm font-bold text-orange-800 bg-white px-3 py-1 rounded-full shadow-sm border border-orange-200">{card.business_name}</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 mb-6 min-h-[160px]">
                <p className="text-sm text-[#6B7280] text-center px-4">No grid location assigned yet. Contact admin to assign your stall slot.</p>
              </div>
            )}

            <button onClick={() => setSlotModalOpen(true)} className="w-full bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-[#1A1A1A] font-semibold py-4 rounded-xl shadow-sm transition-colors">
              Request Slot Change
            </button>
          </div>
        </motion.div>
      )}

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#6B7280]">{foodItems.length} items on your menu</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/vendor/information')} className="text-xs font-semibold text-[#6B7280] border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50">Advanced Editor</button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setMenuModalOpen(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition-colors"
              >
                <Plus size={16} /> Add Item
              </motion.button>
            </div>
          </div>

          {foodItems.length === 0 ? (
            <div className="text-center py-16 text-[#6B7280] bg-white rounded-[2rem] border border-dashed border-gray-200">
              <Store size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No menu items yet</p>
              <p className="text-xs mt-1">Add your first item to start selling.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {foodItems.map((item: any) => (
                <div key={item.food_item_id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-orange-200 transition-all group">
                  <div className="h-28 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                    <Upload size={28} className="text-orange-200" />
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[#1A1A1A] text-base leading-tight">{item.name}</h4>
                      <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 shrink-0 ml-2">
                        {item.calories ?? (item.calories_per_100g ? `${item.calories_per_100g}/100g` : '—')} kcal
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-sm font-bold text-[#1A1A1A]">
                        {item.price_in_points ? `RM ${Number(item.price_in_points).toFixed(2)}` : item.price_per_100g ? `RM ${Number(item.price_per_100g).toFixed(2)}/100g` : '—'}
                      </p>
                      <button onClick={() => navigate('/vendor/information')} className="text-xs text-[#6B7280] hover:text-orange-500 flex items-center gap-1 transition-colors">
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-[#1A1A1A]">Campaign Applications</h3>
              <p className="text-sm text-[#6B7280] mt-0.5">Propose a campaign — when approved, consumers can join and earn vouchers at your stall.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setCampModalOpen(true)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition-colors"
            >
              <Plus size={16} /> Apply for Campaign
            </motion.button>
          </div>

          {/* Applications list */}
          {campaignApplications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200 text-[#6B7280]">
              <Tag size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-sm">No applications yet</p>
              <p className="text-xs mt-1">Submit a campaign proposal — the admin team will review and approve it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaignApplications.map((app: any) => {
                const statusStyle =
                  app.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                  app.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-yellow-50 text-yellow-700 border-yellow-200'
                const borderTop =
                  app.status === 'APPROVED' ? 'border-t-green-500' :
                  app.status === 'REJECTED' ? 'border-t-red-400' :
                  'border-t-yellow-400'
                return (
                  <div key={app.application_id} className={`bg-white rounded-[2rem] border border-gray-100 border-t-4 ${borderTop} p-6 shadow-sm`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-[#1A1A1A] text-base">{app.name}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusStyle}`}>
                            {app.status}
                          </span>
                        </div>
                        {app.description && <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">{app.description}</p>}
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#6B7280]">
                          {app.period_start && <span>Period: {app.period_start} → {app.period_end ?? '—'}</span>}
                          <span>Condition: {app.condition_type === 'SPEND_POINTS' ? `Spend RM ${app.condition_threshold}` : `Visit ${app.condition_threshold} stalls`}</span>
                          <span>Reward: RM {Number(app.reward_value).toFixed(2)} voucher</span>
                          {app.point_deduction && <span>Point deduction: RM {Number(app.point_deduction).toFixed(2)}</span>}
                        </div>
                        {app.status === 'REJECTED' && app.rejection_reason && (
                          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl mt-3 border border-red-100">
                            Reason: {app.rejection_reason}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] shrink-0">{new Date(app.created_at).toLocaleDateString('en-MY')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Subsidy claim link */}
          <button onClick={() => navigate('/vendor/claim')} className="w-full bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <ReceiptText size={20} className="text-blue-500" />
              <div className="text-left">
                <p className="font-semibold text-[#1A1A1A]">Subsidy Claims</p>
                <p className="text-xs text-[#6B7280]">Once a campaign is approved and consumers complete it, claim your reimbursements here.</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-gray-400" />
          </button>
        </motion.div>
      )}

      {/* ── REVIEWS TAB ── */}
      {activeTab === 'reviews' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-white border border-gray-100 border-t-4 border-t-yellow-400 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center border-4 border-yellow-100 mb-5">
              <Star size={36} />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Customer Reviews</h3>
            <p className="text-sm text-[#6B7280] max-w-xs">Consumer ratings and feedback will appear here once customers start tapping at your stall.</p>
            <div className="mt-6 grid grid-cols-3 gap-4 w-full max-w-xs opacity-40 pointer-events-none select-none">
              {['Cleanliness', 'Food Quality', 'Service'].map(label => (
                <div key={label} className="bg-gray-50 p-3 rounded-xl text-center">
                  <p className="text-lg font-bold text-gray-400">—</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ MODALS ═══ */}
      <AnimatePresence>

        {/* Add Menu Item Modal */}
        {menuModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuModalOpen(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl my-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#1A1A1A]">Add Menu Item</h3>
                <button onClick={() => setMenuModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddFoodItem} className="space-y-4">
                <div>
                  <label className={labelCls}>Food Name *</label>
                  <input type="text" required value={menuName} onChange={e => setMenuName(e.target.value)} className={inputCls} placeholder="e.g. Nasi Lemak Ayam" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Price (RM) *</label>
                    <input type="number" required min="0" step="0.01" value={menuPrice} onChange={e => setMenuPrice(e.target.value)} className={inputCls} placeholder="e.g. 8.50" />
                  </div>
                  <div>
                    <label className={labelCls}>Calories (kcal) *</label>
                    <input type="number" required min="0" value={menuCalories} onChange={e => setMenuCalories(e.target.value)} className={inputCls} placeholder="e.g. 650" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Macros (optional)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" min="0" step="0.1" value={menuProtein} onChange={e => setMenuProtein(e.target.value)} className={inputCls} placeholder="Protein g" />
                    <input type="number" min="0" step="0.1" value={menuCarbs} onChange={e => setMenuCarbs(e.target.value)} className={inputCls} placeholder="Carbs g" />
                    <input type="number" min="0" step="0.1" value={menuFat} onChange={e => setMenuFat(e.target.value)} className={inputCls} placeholder="Fat g" />
                  </div>
                </div>
                <button type="submit" disabled={savingMenu} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3.5 rounded-xl shadow-md disabled:opacity-50 transition-colors mt-2">
                  {savingMenu ? 'Adding…' : 'Add Menu Item'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Compliance Record Modal */}
        {compModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCompModalOpen(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#1A1A1A]">Add Compliance Record</h3>
                <button onClick={() => setCompModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddCompliance} className="space-y-4">
                <div>
                  <label className={labelCls}>Record Type</label>
                  <select value={compType} onChange={e => setCompType(e.target.value)} className={inputCls}>
                    <option value="INCOME_TAX">Income Tax (LHDN)</option>
                    <option value="ELECTRIC_BILL">Electric Bill (TNB)</option>
                    <option value="BUSINESS_TAX">Business Tax (SST)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Period *</label>
                    <input type="text" required value={compPeriod} onChange={e => setCompPeriod(e.target.value)} className={inputCls} placeholder="e.g. 2024" />
                  </div>
                  <div>
                    <label className={labelCls}>Submitted Date *</label>
                    <input type="date" required value={compDate} onChange={e => setCompDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Amount (RM)</label>
                    <input type="number" min="0" step="0.01" value={compAmount} onChange={e => setCompAmount(e.target.value)} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Reference No.</label>
                    <input type="text" value={compRef} onChange={e => setCompRef(e.target.value)} className={inputCls} placeholder="Optional" />
                  </div>
                </div>
                <button type="submit" disabled={savingComp} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-md disabled:opacity-50 transition-colors">
                  {savingComp ? 'Saving…' : 'Add Record'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Campaign Apply Modal */}
        {campModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCampModalOpen(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[2rem] p-8 shadow-2xl my-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A1A]">Apply for Campaign</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">Submitted for admin review. Approved campaigns go live for consumers to join.</p>
                </div>
                <button onClick={() => setCampModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleApplyCampaign} className="space-y-4">
                <div>
                  <label className={labelCls}>Campaign Name *</label>
                  <input type="text" required value={campName} onChange={e => setCampName(e.target.value)} className={inputCls} placeholder="e.g. Buka Puasa Special" />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea rows={2} value={campDesc} onChange={e => setCampDesc(e.target.value)} className={`${inputCls} resize-none`} placeholder="Describe what the campaign offers consumers…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Start Date</label>
                    <input type="date" value={campStart} onChange={e => setCampStart(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End Date</label>
                    <input type="date" value={campEnd} onChange={e => setCampEnd(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Condition Type *</label>
                  <select value={campCondType} onChange={e => setCampCondType(e.target.value)} className={inputCls}>
                    <option value="SPEND_POINTS">Consumer Spends RM (points)</option>
                    <option value="VISIT_STALLS">Consumer Visits Stalls</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{campCondType === 'SPEND_POINTS' ? 'Min. Spend (RM) *' : 'Stalls to Visit *'}</label>
                    <input type="number" required min="1" step={campCondType === 'SPEND_POINTS' ? '0.01' : '1'} value={campThreshold} onChange={e => setCampThreshold(e.target.value)} className={inputCls} placeholder={campCondType === 'SPEND_POINTS' ? 'e.g. 20' : 'e.g. 3'} />
                  </div>
                  <div>
                    <label className={labelCls}>Point Deduction (RM)</label>
                    <input type="number" min="0" step="0.01" value={campPointDeduction} onChange={e => setCampPointDeduction(e.target.value)} className={inputCls} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Reward Voucher Value (RM) *</label>
                  <input type="number" required min="0.01" step="0.01" value={campRewardValue} onChange={e => setCampRewardValue(e.target.value)} className={inputCls} placeholder="e.g. 5.00" />
                  <p className="text-[10px] text-[#6B7280] mt-1">This is the voucher amount consumers receive when they complete the campaign.</p>
                </div>
                {/* Live preview */}
                {campName && campRewardValue && (
                  <div className="p-4 border-2 border-dashed border-green-200 rounded-2xl bg-green-50 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-white px-2 py-0.5 rounded-full border border-green-200">Preview</span>
                    <h4 className="font-bold text-[#1A1A1A] mt-2">{campName}</h4>
                    <p className="text-green-600 font-bold">RM {Number(campRewardValue || 0).toFixed(2)} voucher</p>
                    <p className="text-xs text-[#6B7280] mt-1">{campCondType === 'SPEND_POINTS' ? `Spend RM ${campThreshold || '?'}` : `Visit ${campThreshold || '?'} stalls`} to earn</p>
                  </div>
                )}
                <button type="submit" disabled={submittingCamp} className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-xl shadow-md disabled:opacity-50 transition-colors">
                  {submittingCamp ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Slot Change Modal */}
        {slotModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSlotModalOpen(false)} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[2rem] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-[#1A1A1A]">Request Slot Change</h3>
                <button onClick={() => setSlotModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-full"><X size={20} /></button>
              </div>
              <p className="text-sm text-[#6B7280] mb-6">Select an available slot. Admins must approve all changes.</p>
              <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mb-6">
                {Array.from({ length: 15 }, (_, i) => i + 1).map(n => {
                  const isOccupied = [2, 5, 8, 11].includes(n)
                  const isSelected = selectedSlot === n
                  return (
                    <motion.button
                      key={n}
                      disabled={isOccupied}
                      onClick={() => setSelectedSlot(n)}
                      whileHover={!isOccupied ? { scale: 1.05 } : {}}
                      whileTap={!isOccupied ? { scale: 0.95 } : {}}
                      className={`h-16 rounded-xl border-2 text-xs font-bold flex flex-col items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : isOccupied ? 'border-red-100 bg-red-50 text-red-300 cursor-not-allowed opacity-60' : 'border-gray-200 bg-white text-[#1A1A1A] hover:border-blue-400'}`}
                    >
                      <span>{n}</span>
                      {isOccupied && <span className="text-[8px] mt-0.5 uppercase">Taken</span>}
                    </motion.button>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSlotModalOpen(false)} className="flex-1 py-3.5 bg-gray-100 text-[#1A1A1A] font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
                <button
                  disabled={!selectedSlot}
                  onClick={() => {
                    toast.success(`Slot ${selectedSlot} request submitted — awaiting admin approval`)
                    setSlotModalOpen(false)
                    setSelectedSlot(null)
                  }}
                  className={`flex-1 py-3.5 font-semibold rounded-xl shadow-md transition-colors ${selectedSlot ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Submit Request
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </section>
  )
}
