import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Gift, QrCode, CreditCard, X } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { getCardVouchers } from '../lib/api'

type VoucherStatus = 'ACTIVE' | 'USED' | 'EXPIRED'

interface Voucher {
  voucher_id: string
  discount_value: number
  applicable_vendor_ids: string[] | null
  expires_at: string | null
  status: VoucherStatus
  issued_at: string
}

export default function Vouchers() {
  const { card } = useCard()
  const navigate = useNavigate()
  const [tab, setTab] = useState<VoucherStatus>('ACTIVE')
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(false)

  // Modal state
  const [selected, setSelected] = useState<Voucher | null>(null)
  const [showNoCard, setShowNoCard] = useState(false)

  useEffect(() => {
    if (!card) return
    loadVouchers()
  }, [card?.uid, tab])

  async function loadVouchers() {
    if (!card) return
    setLoading(true)
    try {
      const data = await getCardVouchers(card.uid, tab) as Voucher[]
      setVouchers(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  function handleUseVoucher(v: Voucher) {
    if (!card) return
    if (card.uid.startsWith('USER-')) {
      // No physical NFC card registered
      setShowNoCard(true)
    } else {
      setSelected(v)
    }
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const activeCount = vouchers.length

  return (
    <div className="px-4 pb-28 max-w-lg mx-auto pt-4">

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center space-x-2 mb-1">
          <Gift className="text-orange-500" size={22} />
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">My Vouchers</h1>
        </div>
        <p className="text-sm text-[#6B7280]">RM {Number(card.points_balance).toFixed(2)} wallet balance</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Active</p>
          <p className="text-3xl font-bold text-orange-500">{tab === 'ACTIVE' ? activeCount : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-1">Card Status</p>
          <p className={`text-sm font-bold ${card.uid.startsWith('USER-') ? 'text-amber-500' : 'text-green-500'}`}>
            {card.uid.startsWith('USER-') ? 'Not Linked' : 'Linked'}
          </p>
          <p className="text-[10px] text-[#6B7280] mt-0.5 font-mono truncate">{card.uid}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-5 gap-1">
        {(['ACTIVE', 'USED', 'EXPIRED'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#6B7280] hover:text-gray-700'}`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Voucher list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-40 bg-gray-100 rounded-[1.5rem] animate-pulse" />)}
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 text-[#6B7280]">
          <Gift size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-sm">No {tab.toLowerCase()} vouchers</p>
          {tab === 'ACTIVE' && (
            <p className="text-xs mt-1">Join a campaign to earn vouchers!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.map((v, i) => (
            <motion.div
              key={v.voucher_id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Ticket-style top */}
              <div className={`p-5 relative overflow-hidden ${i % 2 === 0 ? 'bg-gradient-to-r from-[#3B82F6] to-[#6366F1]' : 'bg-gradient-to-r from-[#FF8A00] to-[#FFD166]'}`}>
                <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <p className="text-white/70 text-[10px] uppercase tracking-wider mb-1">
                  {v.expires_at ? `Expires ${new Date(v.expires_at).toLocaleDateString('en-MY')}` : 'No expiry'}
                </p>
                <p className="text-white text-2xl font-bold">RM {Number(v.discount_value).toFixed(2)} Off</p>
                {v.applicable_vendor_ids?.length ? (
                  <p className="text-white/80 text-xs mt-1">Valid at {v.applicable_vendor_ids.length} vendor(s)</p>
                ) : (
                  <p className="text-white/80 text-xs mt-1">Valid at all vendors</p>
                )}
              </div>

              {/* Dashed perforation divider */}
              <div className="relative flex items-center px-4 my-0">
                <div className="absolute -left-3 w-6 h-6 rounded-full bg-gray-50 border border-gray-100" />
                <div className="flex-1 border-t border-dashed border-gray-200 mx-4" />
                <div className="absolute -right-3 w-6 h-6 rounded-full bg-gray-50 border border-gray-100" />
              </div>

              {/* Ticket bottom */}
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">Issued</p>
                  <p className="text-xs font-medium text-[#1A1A1A]">
                    {new Date(v.issued_at).toLocaleDateString('en-MY')}
                  </p>
                </div>
                {tab === 'ACTIVE' ? (
                  <button
                    onClick={() => handleUseVoucher(v)}
                    className="bg-[#1A1A1A] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                  >
                    Use Voucher
                  </button>
                ) : (
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${tab === 'USED' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {tab === 'USED' ? 'Redeemed' : 'Expired'}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* QR Modal — physical card confirmed */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl">
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Gift size={24} />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A]">RM {Number(selected.discount_value).toFixed(2)} Off</h3>
                <p className="text-sm text-[#6B7280] mt-1">Show this QR code to the vendor</p>
              </div>
              <div className="bg-[#FAFAFA] rounded-2xl p-6 flex flex-col items-center mb-6 border border-gray-100">
                <QrCode size={120} className="text-[#1A1A1A] mb-3" />
                <p className="font-mono text-xs text-[#6B7280] tracking-widest">{selected.voucher_id.slice(0, 18).toUpperCase()}</p>
              </div>
              {selected.expires_at && (
                <p className="text-xs text-center text-[#6B7280] mb-5">
                  Valid until {new Date(selected.expires_at).toLocaleDateString('en-MY')}
                </p>
              )}
              <button onClick={() => setSelected(null)} className="w-full py-3.5 bg-[#1A1A1A] text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors">Done</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* No NFC Card Modal */}
      <AnimatePresence>
        {showNoCard && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNoCard(false)} className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-amber-50 border-4 border-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <CreditCard size={28} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">NFC Card Required</h3>
              <p className="text-sm text-[#6B7280] mb-2">
                To use vouchers, you need to link your physical NFC card first.
              </p>
              <p className="text-xs text-[#6B7280] mb-8 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                Visit the WarungTek kiosk to collect your card, then link it in Settings.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowNoCard(false)} className="flex-1 py-3 bg-gray-100 text-[#1A1A1A] font-semibold rounded-xl hover:bg-gray-200 transition-colors">Close</button>
                <button
                  onClick={() => { setShowNoCard(false); navigate('/settings') }}
                  className="flex-1 py-3 bg-[#1A1A1A] text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Link Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
