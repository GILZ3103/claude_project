import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Plus, Flame, CreditCard, Navigation, History, Gift,
  CheckCircle, ShieldCheck, Zap, QrCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { getCardHistory, topup } from '../lib/api'

export default function Dashboard() {
  const { card, refreshCard } = useCard()
  const navigate = useNavigate()
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Top-up modal state
  const [isTopUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null)
  const [topUpStep, setTopUpStep] = useState(1)
  const [topping, setTopping] = useState(false)

  // Voucher modal state
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null)

  useEffect(() => {
    if (!card) return
    refreshCard()
    loadHistory()
  }, [])

  async function loadHistory() {
    if (!card) return
    setLoadingHistory(true)
    try {
      const res = await getCardHistory(card.uid) as any
      setHistory(res.history ?? [])
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleConfirmTopUp() {
    if (!card || !topUpAmount) return
    setTopping(true)
    try {
      await topup(card.uid, topUpAmount)
      await refreshCard()
      setTopUpStep(3)
    } catch (e: any) {
      toast.error(e.message ?? 'Top up failed')
      closeTopUp()
    } finally {
      setTopping(false)
    }
  }

  function closeTopUp() {
    setTopUpOpen(false)
    setTopUpStep(1)
    setTopUpAmount(null)
  }

  if (!card) {
    return <div className="p-6 text-center text-gray-400">Please sign in first.</div>
  }

  const balance = Number(card.points_balance).toFixed(2)
  const caloriesToday = card.calories_today ?? 0
  const calorieLimit = card.calorie_limit ?? 2000
  const ratio = calorieLimit > 0 ? caloriesToday / calorieLimit : 0
  const progress = Math.min(ratio * 100, 100)
  const remaining = Math.max(0, calorieLimit - caloriesToday)

  let calColor = 'from-[#22C55E] to-[#86EFAC]'
  let calStatus = 'Healthy Intake'
  if (ratio > 1) { calColor = 'from-red-500 to-red-400'; calStatus = 'High Intake' }
  else if (ratio > 0.8) { calColor = 'from-[#FF8A00] to-[#FFD166]'; calStatus = 'Moderate Intake' }

  const vouchers = card.active_vouchers ?? []

  return (
    <section className="w-full flex flex-col pt-6 px-4 pb-24 relative min-h-[100dvh] bg-[#FAFAFA]">
      {/* Orange gradient header bg */}
      <div className="absolute top-0 left-0 w-full h-[380px] bg-gradient-to-br from-[#FF8A00] to-[#FFD166] rounded-b-[3rem] z-0 shadow-md" />

      {/* Header */}
      <div className="mb-5 z-10 pt-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}>
          <p className="text-white/80 text-sm font-medium mb-1">Welcome back,</p>
          <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
            {card.owner_name}
          </h1>
        </motion.div>
      </div>

      {/* Main card: Wallet + Calorie */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white z-10 flex flex-col sm:flex-row gap-6 mb-6"
      >
        {/* Left: Wallet */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-[#6B7280] mb-2">
            <CreditCard size={18} className="text-blue-500" />
            <span className="text-xs uppercase tracking-wider font-medium">Wallet Balance</span>
          </div>
          <div className="flex items-baseline space-x-1 mt-1 mb-4">
            <span className="text-xl font-semibold text-[#6B7280]">RM</span>
            <span className="text-5xl font-bold text-[#1A1A1A] tracking-tight">{balance}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono mb-4">{card.uid}</p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => setTopUpOpen(true)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white py-3 rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-md text-sm"
            >
              <Plus size={16} />
              <span>Top Up</span>
            </motion.button>
            <motion.button
              onClick={() => navigate('/map')}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="bg-orange-50 text-orange-600 border border-orange-100 py-3 rounded-2xl font-semibold flex items-center justify-center space-x-2 text-sm"
            >
              <Navigation size={16} />
              <span>Explore</span>
            </motion.button>
          </div>
        </div>

        {/* Right: Calorie summary */}
        <div
          className="w-full sm:w-[180px] bg-[#FAFAFA] rounded-[1.5rem] p-5 border border-gray-100 flex flex-col justify-center cursor-pointer hover:bg-white transition-colors group relative overflow-hidden"
          onClick={() => navigate('/calories')}
        >
          <div className="absolute -right-8 -top-8 w-28 h-28 bg-orange-100 rounded-full blur-2xl opacity-50 pointer-events-none" />
          <div className="flex items-center space-x-2 text-[#6B7280] mb-3">
            <Flame size={16} className="text-orange-500" />
            <span className="text-xs uppercase tracking-wider font-medium">Calories</span>
          </div>
          <div className="flex items-baseline space-x-1 mb-1">
            <span className="text-3xl font-bold text-[#1A1A1A] tracking-tight">{remaining}</span>
          </div>
          <p className="text-xs text-[#6B7280] mb-3">kcal remaining</p>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full bg-gradient-to-r ${calColor} rounded-full`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#6B7280]">
            <span>{calStatus}</span>
            <span>{caloriesToday}/{calorieLimit}</span>
          </div>
        </div>
      </motion.div>

      {/* Voucher Panel */}
      <div className="mb-6 z-10 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Gift className="text-orange-500" size={20} />
            <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A]">Voucher Panel</h2>
          </div>
          <button onClick={() => navigate('/vouchers')} className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
            View All
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Loyalty balance card */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-orange-50 rounded-full blur-2xl opacity-50 pointer-events-none" />
            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-2 z-10">Loyalty Balance</p>
            {/* Balance + Earned/Redeemed inline */}
            <div className="flex items-baseline justify-between mb-1 z-10">
              <div className="flex items-baseline space-x-1">
                <span className="text-4xl font-bold text-[#1A1A1A] tracking-tight">
                  {Math.round(card.points_balance * 100)}
                </span>
                <span className="text-sm font-medium text-orange-500">pts</span>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[10px] text-[#6B7280]">Earned: —</p>
                <p className="text-[10px] text-[#6B7280]">Redeemed: —</p>
              </div>
            </div>
            <p className="text-[10px] text-[#6B7280] mb-4 z-10">RM {Number(card.points_balance).toFixed(2)} wallet balance</p>
            {/* Vouchers Available — in place of where Earned/Redeemed used to be */}
            <div className="border-t border-gray-100 pt-4 mt-auto z-10">
              <p className="text-[10px] text-[#6B7280] mb-1">Vouchers Available</p>
              <p className="text-3xl font-bold text-orange-500">{vouchers.length}</p>
            </div>
          </div>

          {/* Voucher cards horizontal scroll */}
          <div className="sm:col-span-2 flex overflow-x-auto pb-3 space-x-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center">
            {vouchers.length === 0 ? (
              <div className="w-full flex items-center justify-center h-[140px] bg-white rounded-[1.5rem] border border-dashed border-gray-200 text-sm text-gray-400">
                No active vouchers — join a campaign to earn one!
              </div>
            ) : vouchers.map((v: any, i: number) => (
              <motion.div
                key={v.voucher_id}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                onClick={() => setSelectedVoucher(v)}
                className={`shrink-0 w-[240px] h-[140px] rounded-[1.5rem] p-5 relative flex flex-col justify-between overflow-hidden shadow-md cursor-pointer border border-white/20
                  ${i % 2 === 0 ? 'bg-gradient-to-br from-[#3B82F6] to-[#6366F1]' : 'bg-gradient-to-br from-[#FF8A00] to-[#FFD166]'}
                `}
              >
                <div className="absolute top-2.5 right-2.5 bg-white/90 px-2 py-0.5 rounded-lg text-[10px] font-bold text-blue-600 z-10">Active</div>
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <div>
                  <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-1">
                    {v.expires_at ? `Expires ${new Date(v.expires_at).toLocaleDateString('en-MY')}` : 'No expiry'}
                  </p>
                  <h3 className="font-bold text-white text-lg leading-tight">RM {Number(v.discount_value).toFixed(2)} Off</h3>
                </div>
                <p className="text-white/80 text-xs">Tap to view</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="z-10 bg-white rounded-[2rem] p-6 border border-gray-100 border-t-4 border-t-[#3B82F6] shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <History className="text-blue-500" size={20} />
            <h2 className="text-base font-bold tracking-tight text-[#1A1A1A]">Recent Transactions</h2>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full">
            <ShieldCheck size={12} />
            <span>Secure</span>
          </div>
        </div>

        {loadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No tap history yet — visit a vendor to get started.</p>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {history.map((h: any) => {
              const isTopup = h.event_type === 'TOPUP'
              return (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  key={h.event_id}
                  className="flex items-center justify-between p-4 bg-[#FAFAFA] rounded-2xl hover:bg-white border border-transparent hover:border-gray-100 transition-all cursor-default"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isTopup ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                      {isTopup ? <Plus size={18} /> : <Zap size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1A1A] text-sm">{h.food_name ?? h.event_type}</p>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <p className="text-xs text-[#6B7280]">{h.vendor_name ?? '—'}</p>
                        {h.calories ? (
                          <>
                            <span className="text-gray-300 text-xs">•</span>
                            <span className="text-xs text-[#6B7280]">{h.calories} kcal</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isTopup ? 'text-blue-600' : 'text-[#1A1A1A]'}`}>
                      {isTopup ? '+' : '-'}RM {Number(h.final_cost ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[#6B7280]">
                      {new Date(h.server_timestamp).toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Voucher detail modal */}
      <AnimatePresence>
        {selectedVoucher && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedVoucher(null)} className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl flex flex-col items-center">
              <div className="w-14 h-14 bg-orange-50 border border-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4">
                <Gift size={28} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#1A1A1A] mb-1 text-center">RM {Number(selectedVoucher.discount_value).toFixed(2)} Off</h3>
              <p className="text-[#6B7280] text-sm text-center mb-6">
                {selectedVoucher.expires_at ? `Valid until ${new Date(selectedVoucher.expires_at).toLocaleDateString('en-MY')}` : 'No expiry date'}
              </p>
              <div className="bg-[#FAFAFA] p-6 rounded-2xl w-full flex flex-col items-center mb-6 border border-gray-200">
                <QrCode size={100} className="text-[#1A1A1A] mb-3" />
                <p className="font-mono text-xs text-[#6B7280] tracking-widest">{selectedVoucher.voucher_id.slice(0, 16).toUpperCase()}</p>
              </div>
              {selectedVoucher.applicable_vendor_ids?.length > 0 && (
                <p className="text-xs text-[#6B7280] mb-4 text-center">Valid at {selectedVoucher.applicable_vendor_ids.length} specific vendor(s)</p>
              )}
              <button onClick={() => setSelectedVoucher(null)} className="w-full py-3.5 bg-[#1A1A1A] text-white font-semibold rounded-xl shadow-md hover:bg-gray-800 transition-colors">Done</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top-up modal */}
      <AnimatePresence>
        {isTopUpOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTopUp} className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl">

              {topUpStep === 1 && (
                <>
                  <h3 className="text-xl font-bold text-[#1A1A1A] mb-1">Top Up Wallet</h3>
                  <p className="text-[#6B7280] text-sm mb-6">Select an amount to reload your balance.</p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[10, 20, 50, 100].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setTopUpAmount(amt)}
                        className={`py-4 rounded-xl font-bold border transition-colors ${topUpAmount === amt ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-100' : 'border-gray-200 bg-[#FAFAFA] text-[#1A1A1A] hover:border-blue-400'}`}
                      >
                        RM {amt}
                      </button>
                    ))}
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={closeTopUp} className="flex-1 py-3.5 rounded-xl font-semibold bg-gray-100 text-[#1A1A1A] hover:bg-gray-200">Cancel</button>
                    <button
                      disabled={!topUpAmount}
                      onClick={() => setTopUpStep(2)}
                      className={`flex-1 py-3.5 rounded-xl font-semibold text-white shadow-md ${topUpAmount ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {topUpStep === 2 && (
                <>
                  <h3 className="text-xl font-bold text-[#1A1A1A] mb-1">Confirm Top-Up</h3>
                  <p className="text-[#6B7280] text-sm mb-6">Review your top-up details.</p>
                  <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-gray-200 mb-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#6B7280]">Current Balance</span>
                      <span className="text-sm font-bold text-[#1A1A1A]">RM {balance}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-[#6B7280]">Top-Up Amount</span>
                      <span className="text-sm font-bold text-blue-600">+ RM {topUpAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#1A1A1A]">Estimated Balance</span>
                      <span className="text-lg font-bold text-[#1A1A1A]">RM {(parseFloat(balance) + (topUpAmount ?? 0)).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={() => setTopUpStep(1)} className="flex-1 py-3.5 rounded-xl font-semibold bg-gray-100 text-[#1A1A1A] hover:bg-gray-200">Back</button>
                    <button
                      onClick={handleConfirmTopUp}
                      disabled={topping}
                      className="flex-1 py-3.5 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md disabled:opacity-50"
                    >
                      {topping ? 'Processing…' : 'Confirm'}
                    </button>
                  </div>
                </>
              )}

              {topUpStep === 3 && (
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-green-100"
                  >
                    <CheckCircle size={36} />
                  </motion.div>
                  <h3 className="text-xl font-bold text-[#1A1A1A] mb-1">Top-Up Successful</h3>
                  <p className="text-[#6B7280] text-sm mb-6">Your wallet has been credited.</p>
                  <div className="bg-[#FAFAFA] w-full p-5 rounded-2xl border border-gray-200 mb-6 space-y-3">
                    <div className="flex justify-between text-sm pb-3 border-b border-gray-200">
                      <span className="text-[#6B7280]">Amount Added</span>
                      <span className="font-bold text-[#1A1A1A]">RM {topUpAmount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">New Balance</span>
                      <span className="font-bold text-blue-600">RM {Number(card.points_balance).toFixed(2)}</span>
                    </div>
                  </div>
                  <button onClick={closeTopUp} className="w-full py-3.5 bg-[#1A1A1A] text-white font-semibold rounded-xl shadow-md hover:bg-gray-800">Done</button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
