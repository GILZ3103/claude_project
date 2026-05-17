import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Shield, CheckCircle, XCircle, AlertTriangle,
  Search, MapPin, Tag, Store, Loader, ChevronDown, ChevronRight, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import {
  getVendors, getAdminPendingVendors, reviewVendor,
  getAdminCampaignApplications, reviewCampaignApplication
} from '../lib/api'

type AdminTab = 'vendors' | 'applications' | 'compliance' | 'slots'

const OCCUPIED_SLOTS = [2, 5, 8, 12]
const REQUESTED_SLOTS = [7]

export default function AdminDashboard() {
  const { card } = useCard()
  const [activeTab, setActiveTab] = useState<AdminTab>('vendors')
  const [search, setSearch] = useState('')

  // Data
  const [vendors, setVendors] = useState<any[]>([])
  const [pendingVendors, setPendingVendors] = useState<any[]>([])
  const [campaignApps, setCampaignApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ type: 'vendor' | 'campaign'; id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    if (!card) return
    loadAll()
  }, [card?.uid])

  async function loadAll() {
    setLoading(true)
    try {
      const [v, pv, ca] = await Promise.all([
        getVendors() as Promise<any[]>,
        getAdminPendingVendors(card!.uid) as Promise<any[]>,
        getAdminCampaignApplications(card!.uid) as Promise<any[]>,
      ])
      setVendors(v ?? [])
      setPendingVendors(pv ?? [])
      setCampaignApps(ca ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  async function handleVendorReview(vendor_id: string, action: 'APPROVE' | 'REJECT') {
    if (!card) return
    setReviewing(true)
    try {
      await reviewVendor(vendor_id, card.uid, action, action === 'REJECT' ? rejectReason : undefined)
      toast.success(action === 'APPROVE' ? 'Vendor approved — they can now access the dashboard.' : 'Vendor rejected.')
      setRejectModal(null)
      setRejectReason('')
      const pv = await getAdminPendingVendors(card.uid) as any[]
      setPendingVendors(pv ?? [])
      if (action === 'APPROVE') {
        const v = await getVendors() as any[]
        setVendors(v ?? [])
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Review failed')
    } finally { setReviewing(false) }
  }

  async function handleCampaignReview(app_id: string, action: 'APPROVE' | 'REJECT') {
    if (!card) return
    setReviewing(true)
    try {
      await reviewCampaignApplication(app_id, card.uid, action, action === 'REJECT' ? rejectReason : undefined)
      toast.success(action === 'APPROVE' ? 'Campaign approved — it is now live for consumers.' : 'Campaign application rejected.')
      setRejectModal(null)
      setRejectReason('')
      const ca = await getAdminCampaignApplications(card.uid) as any[]
      setCampaignApps(ca ?? [])
    } catch (e: any) {
      toast.error(e.message ?? 'Review failed')
    } finally { setReviewing(false) }
  }

  const filteredVendors = vendors.filter(v =>
    v.business_name?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingCampaignApps = campaignApps.filter((a: any) => a.status === 'PENDING')
  const totalApplications = pendingVendors.length + pendingCampaignApps.length

  if (!card || card.role !== 'ADMIN') return null

  return (
    <section className="w-full flex flex-col px-4 sm:px-6 pb-16 bg-[#FAFAFA] min-h-[100dvh]">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-8 mb-8 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-900 shadow-sm border border-gray-800">
            <Shield className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Admin Console</h2>
            <p className="text-xs text-[#6B7280]">{card.owner_name} · {card.department}</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto w-full md:w-auto [&::-webkit-scrollbar]:hidden">
          {(['vendors', 'applications', 'compliance', 'slots'] as AdminTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 rounded-lg text-xs font-semibold capitalize tracking-wide transition-all shrink-0 ${activeTab === tab ? 'bg-gray-900 text-white shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-gray-50'}`}
            >
              {tab}
              {tab === 'applications' && totalApplications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {totalApplications}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader size={32} className="text-gray-300 animate-spin" /></div>
      ) : (
        <>
          {/* ── VENDORS TAB ── */}
          {activeTab === 'vendors' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-xl text-[#1A1A1A]">Active Vendors <span className="text-sm font-normal text-[#6B7280]">({filteredVendors.length})</span></h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" size={15} />
                  <input
                    type="text"
                    placeholder="Search vendors…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-gray-900 shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-gray-100 text-[10px] uppercase tracking-wider text-[#6B7280]">
                        <th className="p-4 font-bold">Stall / Category</th>
                        <th className="p-4 font-bold">Description</th>
                        <th className="p-4 font-bold">Grid</th>
                        <th className="p-4 font-bold">Menu</th>
                        <th className="p-4 font-bold text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredVendors.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-sm text-[#6B7280]">No active vendors found.</td></tr>
                      ) : filteredVendors.map(v => (
                        <>
                          <tr key={v.vendor_id} className={`hover:bg-gray-50 transition-colors ${expandedId === v.vendor_id ? 'bg-blue-50/20' : ''}`}>
                            <td className="p-4">
                              <p className="font-bold text-[#1A1A1A]">{v.business_name}</p>
                              <p className="text-xs text-[#6B7280]">{v.category ?? '—'}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-[#6B7280] max-w-xs truncate">{v.description ?? '—'}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-sm font-medium text-[#1A1A1A]">
                                {v.grid_x != null ? `(${v.grid_x}, ${v.grid_y})` : '—'}
                              </p>
                            </td>
                            <td className="p-4">
                              <span className="text-xs bg-gray-100 text-[#6B7280] px-2 py-1 rounded-lg font-medium">{v.food_item_count} items</span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setExpandedId(expandedId === v.vendor_id ? null : v.vendor_id)}
                                className="flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg ml-auto transition-colors"
                              >
                                {expandedId === v.vendor_id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                {expandedId === v.vendor_id ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          </tr>
                          {expandedId === v.vendor_id && (
                            <tr key={`${v.vendor_id}-expanded`} className="bg-[#FAFAFA] border-b border-gray-100">
                              <td colSpan={5} className="p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">Stall</p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between"><span className="text-[#6B7280]">Name</span><span className="font-semibold">{v.business_name}</span></div>
                                      <div className="flex justify-between"><span className="text-[#6B7280]">Category</span><span className="font-medium">{v.category ?? '—'}</span></div>
                                      <div className="flex justify-between"><span className="text-[#6B7280]">Grid</span><span className="font-medium">{v.grid_x != null ? `X${v.grid_x} Y${v.grid_y}` : '—'}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">Status</p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between"><span className="text-[#6B7280]">Active</span><span className="font-medium text-green-600">Yes</span></div>
                                      <div className="flex justify-between"><span className="text-[#6B7280]">Menu items</span><span className="font-medium">{v.food_item_count}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">SSM</p>
                                    <p className="text-sm font-mono text-[#1A1A1A]">{v.ssm_registration_number ?? '—'}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── APPLICATIONS TAB ── */}
          {activeTab === 'applications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

              {/* Vendor registrations */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Store size={18} className="text-gray-700" />
                  <h3 className="font-bold text-xl text-[#1A1A1A]">Vendor Registrations</h3>
                  {pendingVendors.length > 0 && (
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">{pendingVendors.length} pending</span>
                  )}
                </div>

                {pendingVendors.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-[#6B7280]">
                    <CheckCircle size={28} className="mx-auto mb-2 text-green-300" />
                    No pending vendor applications.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingVendors.map((v: any) => (
                      <div key={v.vendor_id} className="bg-white rounded-[2rem] border border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden">
                        <div className="p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-lg text-[#1A1A1A]">{v.business_name}</h4>
                              <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200">Pending Review</span>
                            </div>
                            <p className="text-sm text-[#6B7280]">SSM: {v.ssm_registration_number} · {v.category ?? 'Vendor'}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setRejectModal({ type: 'vendor', id: v.vendor_id, name: v.business_name })}
                              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-xl text-sm border border-red-100 transition-colors"
                            >Reject</button>
                            <button
                              onClick={() => handleVendorReview(v.vendor_id, 'APPROVE')}
                              disabled={reviewing}
                              className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 font-semibold rounded-xl text-sm shadow-sm disabled:opacity-50 transition-colors"
                            >Approve</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campaign applications */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Tag size={18} className="text-green-600" />
                  <h3 className="font-bold text-xl text-[#1A1A1A]">Campaign Applications</h3>
                  {pendingCampaignApps.length > 0 && (
                    <span className="text-xs font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{pendingCampaignApps.length} pending</span>
                  )}
                </div>

                {campaignApps.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-[#6B7280]">
                    <Tag size={28} className="mx-auto mb-2 text-gray-200" />
                    No campaign applications submitted yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaignApps.map((app: any) => {
                      const isPending = app.status === 'PENDING'
                      const statusStyle = app.status === 'APPROVED'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : app.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      return (
                        <div key={app.application_id} className="bg-white rounded-[2rem] border border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-bold text-lg text-[#1A1A1A]">{app.name}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>{app.status}</span>
                              </div>
                              <p className="text-sm text-[#6B7280] mb-2">{app.vendors?.business_name} · {new Date(app.created_at).toLocaleDateString('en-MY')}</p>
                              {app.description && <p className="text-sm text-[#1A1A1A] mb-3 line-clamp-2">{app.description}</p>}
                              <div className="flex flex-wrap gap-3 text-xs text-[#6B7280]">
                                <span className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                  Condition: {app.condition_type === 'SPEND_POINTS' ? `Spend RM ${app.condition_threshold}` : `Visit ${app.condition_threshold} stalls`}
                                </span>
                                <span className="bg-green-50 px-2 py-1 rounded-lg border border-green-100 text-green-700 font-semibold">
                                  Reward: RM {Number(app.reward_value).toFixed(2)} voucher
                                </span>
                                {app.period_start && <span className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{app.period_start} → {app.period_end ?? '?'}</span>}
                              </div>
                            </div>
                            {isPending && (
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => setRejectModal({ type: 'campaign', id: app.application_id, name: app.name })}
                                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-xl text-sm border border-red-100 transition-colors"
                                >Reject</button>
                                <button
                                  onClick={() => handleCampaignReview(app.application_id, 'APPROVE')}
                                  disabled={reviewing}
                                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-semibold rounded-xl text-sm shadow-sm disabled:opacity-50 transition-colors"
                                >Approve</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── COMPLIANCE TAB ── */}
          {activeTab === 'compliance' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  { label: 'Active Vendors', value: vendors.length, color: 'text-green-500', bg: 'hover:bg-green-50 hover:border-green-300', desc: 'Fully approved & operating', tab: 'vendors' as AdminTab },
                  { label: 'Pending Applications', value: pendingVendors.length, color: 'text-yellow-500', bg: 'hover:bg-yellow-50 hover:border-yellow-300', desc: 'Click to review', tab: 'applications' as AdminTab },
                  { label: 'Pending Campaigns', value: pendingCampaignApps.length, color: 'text-red-500', bg: 'hover:bg-red-50 hover:border-red-300', desc: 'Click to review', tab: 'applications' as AdminTab },
                ].map(stat => (
                  <div
                    key={stat.label}
                    onClick={() => setActiveTab(stat.tab)}
                    className={`bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center text-center cursor-pointer transition-colors ${stat.bg}`}
                  >
                    <p className={`text-4xl font-bold mb-1 ${stat.color}`}>{stat.value}</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{stat.label}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{stat.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
                <h3 className="font-bold text-xl text-[#1A1A1A] mb-6">Active Vendor Overview</h3>
                {vendors.length === 0 ? (
                  <p className="text-sm text-[#6B7280] text-center py-6">No active vendors yet.</p>
                ) : (
                  <div className="space-y-3">
                    {vendors.slice(0, 6).map((v: any) => (
                      <div key={v.vendor_id} className="flex items-center justify-between p-4 bg-[#FAFAFA] rounded-2xl border border-gray-100 hover:bg-white transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-green-100 text-green-600 rounded-xl flex items-center justify-center font-black">
                            {(v.business_name ?? 'V')[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1A1A1A] text-sm">{v.business_name}</p>
                            <p className="text-xs text-[#6B7280]">{v.category ?? '—'} · {v.food_item_count} menu items</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded-lg flex items-center gap-1">
                          <CheckCircle size={11} /> Active
                        </span>
                      </div>
                    ))}
                    {vendors.length > 6 && (
                      <p className="text-xs text-center text-[#6B7280] pt-2">+{vendors.length - 6} more vendors</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SLOTS TAB ── */}
          {activeTab === 'slots' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-[2rem] border border-gray-200 p-8 shadow-sm flex flex-col xl:flex-row gap-8">
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-[#1A1A1A] mb-1">Stall Allocation Grid</h3>
                  <p className="text-sm text-[#6B7280] mb-5">Click a slot to view details and manage requests.</p>

                  <div className="flex gap-4 mb-4 text-xs font-medium text-[#6B7280]">
                    {[
                      { color: 'bg-green-100 border-green-400', label: 'Occupied' },
                      { color: 'bg-white border-gray-200', label: 'Available' },
                      { color: 'bg-yellow-100 border-yellow-400', label: 'Requested' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 border rounded-sm ${l.color}`} />
                        <span>{l.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-3 p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(n => {
                      const isOccupied = OCCUPIED_SLOTS.includes(n)
                      const isRequested = REQUESTED_SLOTS.includes(n)
                      const isSelected = selectedSlot === n
                      const vendorOnSlot = vendors.find(v => v.grid_x === n || v.grid_y === n)
                      return (
                        <button
                          key={n}
                          onClick={() => setSelectedSlot(selectedSlot === n ? null : n)}
                          className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${isSelected ? 'ring-4 ring-blue-100 border-blue-500' : ''} ${
                            isOccupied ? 'border-green-400 bg-green-50 hover:bg-green-100' :
                            isRequested ? 'border-yellow-400 bg-yellow-50 hover:bg-yellow-100' :
                            'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                          }`}
                        >
                          <span className={`font-bold text-sm ${isOccupied ? 'text-green-700' : isRequested ? 'text-yellow-700' : 'text-gray-400'}`}>
                            Slot {n}
                          </span>
                          {vendorOnSlot && <span className="text-[9px] text-green-600 font-semibold mt-0.5 max-w-[60px] truncate">{vendorOnSlot.business_name}</span>}
                          {isRequested && <span className="text-[9px] text-yellow-600 font-semibold mt-0.5 animate-pulse">Action Req.</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Side panel */}
                <div className="w-full xl:w-72">
                  {selectedSlot ? (
                    <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-gray-200 h-full flex flex-col">
                      <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                        <div>
                          <h4 className="font-bold text-[#1A1A1A] text-lg">Slot {selectedSlot}</h4>
                          <p className="text-xs text-[#6B7280] mt-0.5">WarungTek Market</p>
                        </div>
                        <button onClick={() => setSelectedSlot(null)} className="text-gray-400 hover:text-gray-600">
                          <X size={16} />
                        </button>
                      </div>
                      {REQUESTED_SLOTS.includes(selectedSlot) ? (
                        <div className="flex flex-col flex-1">
                          <span className="text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 px-3 py-1.5 rounded-lg mb-4 self-start flex items-center gap-1">
                            <AlertTriangle size={12} /> Slot Change Request
                          </span>
                          <div className="space-y-3 text-sm flex-1">
                            <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">Vendor</p><p className="font-medium">Satay Station</p></div>
                            <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">Current Slot</p><p className="font-medium">Slot 12</p></div>
                            <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">Requested</p><p className="font-medium">2 hours ago</p></div>
                          </div>
                          <div className="flex flex-col gap-2 mt-4">
                            <button onClick={() => { toast.success('Slot change approved'); setSelectedSlot(null) }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Approve</button>
                            <button onClick={() => { toast.success('Request rejected'); setSelectedSlot(null) }} className="w-full bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 font-semibold py-2.5 rounded-xl text-sm transition-colors">Reject</button>
                          </div>
                        </div>
                      ) : OCCUPIED_SLOTS.includes(selectedSlot) ? (
                        <div className="flex flex-col flex-1">
                          <span className="text-xs font-bold bg-green-100 text-green-800 border border-green-200 px-3 py-1.5 rounded-lg mb-4 self-start flex items-center gap-1">
                            <CheckCircle size={12} /> Occupied
                          </span>
                          {(() => {
                            const v = vendors.find(v => v.grid_x === selectedSlot || v.grid_y === selectedSlot)
                            return v ? (
                              <div className="space-y-3 text-sm flex-1">
                                <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">Vendor</p><p className="font-medium">{v.business_name}</p></div>
                                <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">Category</p><p className="font-medium">{v.category ?? '—'}</p></div>
                                <div><p className="text-xs text-[#6B7280] uppercase font-bold mb-0.5">SSM</p><p className="font-medium text-xs">{v.ssm_registration_number}</p></div>
                              </div>
                            ) : (
                              <p className="text-sm text-[#6B7280]">Slot data not available.</p>
                            )
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
                          <MapPin size={28} className="text-gray-300 mb-3" />
                          <p className="font-semibold text-[#1A1A1A] text-sm">Available</p>
                          <p className="text-xs text-[#6B7280] mt-1">This slot is unoccupied.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#FAFAFA] rounded-2xl border border-dashed border-gray-200 h-full flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
                      <MapPin size={28} className="text-gray-300 mb-3" />
                      <p className="text-sm text-[#6B7280]">Select a slot to view details.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Reject modal */}
      <AnimatePresence>
        {rejectModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectModal(null)} className="absolute inset-0 bg-[#1A1A1A]/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"><XCircle size={20} /></div>
                <div>
                  <h3 className="font-bold text-[#1A1A1A]">Reject {rejectModal.type === 'vendor' ? 'Application' : 'Campaign'}</h3>
                  <p className="text-xs text-[#6B7280]">{rejectModal.name}</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Rejection Reason (optional)</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Explain why this is being rejected…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRejectModal(null); setRejectReason('') }} className="flex-1 bg-gray-100 text-[#1A1A1A] font-semibold py-3 rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
                <button
                  onClick={() => rejectModal.type === 'vendor'
                    ? handleVendorReview(rejectModal.id, 'REJECT')
                    : handleCampaignReview(rejectModal.id, 'REJECT')
                  }
                  disabled={reviewing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-md disabled:opacity-50 text-sm transition-colors"
                >
                  {reviewing ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
