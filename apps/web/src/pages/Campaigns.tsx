import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Gift, Trophy, MapPin, Wallet, Zap, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { getCampaigns, enrolCampaign, getCardVouchers } from '../lib/api'
import { HeroHeader } from '../components/HeroHeader'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { getFoodImage } from '../lib/foodImages'

const CONDITION_META: Record<string, { icon: typeof MapPin; label: (n: number) => string }> = {
  VISIT_STALLS: { icon: MapPin, label: n => `Visit ${n} stalls` },
  SPEND_POINTS: { icon: Wallet, label: n => `Spend RM ${Number(n).toFixed(2)}` },
  DIRECTORY_REBATE: { icon: Zap, label: n => `Tap kiosk ${n}× for rebate` },
}

export default function Campaigns() {
  const { card } = useCard()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [card])

  async function load() {
    setLoading(true)
    try {
      const res = await getCampaigns(card?.uid) as any
      setCampaigns(res.campaigns ?? res ?? [])
      if (card) {
        const vRes = await getCardVouchers(card.uid) as any
        setVouchers(vRes.vouchers ?? vRes ?? [])
      }
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnrol(campaign_id: string) {
    if (!card) return toast.error('Link your card first')
    try {
      await enrolCampaign(campaign_id, card.uid)
      toast.success('Enrolled!')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Enrol failed')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto pb-24">
        <div className="h-40 bg-gray-100 animate-pulse rounded-b-[2.5rem]" />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-44 bg-gray-100 rounded-[1.5rem] animate-pulse" />)}
        </div>
      </div>
    )
  }

  const totalDeduction = vouchers.reduce((sum: number, v: any) => sum + Number(v.discount_value ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto pb-24 bg-[#FAFAFA] min-h-[100dvh]">
      <HeroHeader title="Campaigns" subtitle="Complete challenges, earn vouchers" seed="campaigns" height="h-40" />

      <div className="p-6 space-y-4">
        {/* Voucher value summary */}
        {card && (
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#3a3a3a] text-white rounded-[1.5rem] p-5 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
                <Gift className="text-orange-400" size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-300">Available Voucher Value</p>
                <p className="text-2xl font-bold">RM {totalDeduction.toFixed(2)}</p>
              </div>
            </div>
            <span className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-bold">
              {vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Trophy className="text-orange-500" size={18} />
          <h2 className="text-base font-bold text-[#1A1A1A]">Available Programs</h2>
        </div>

        {campaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Trophy className="w-10 h-10 mb-3 text-gray-300" />
            <p className="text-sm">No campaigns available right now.</p>
          </div>
        )}

        {campaigns.map((c: any, idx: number) => {
          const progress = c.progress ?? null
          const pct = progress ? Math.min(100, (progress.current_value / c.condition_threshold) * 100) : 0
          const enrolled = !!progress
          const completed = progress?.completed_at != null
          const meta = CONDITION_META[c.condition_type]
          const CondIcon = meta?.icon ?? Trophy

          return (
            <motion.div
              key={c.campaign_id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Photo header */}
              <div className="relative h-28 overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={getFoodImage({ name: c.name, category: c.category })}
                  alt={c.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute top-2 right-2 bg-green-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow">
                  RM {Number(c.reward_value).toFixed(2)} off
                </span>
                <h3 className="absolute bottom-2 left-3 right-3 text-white font-bold text-base leading-tight drop-shadow line-clamp-1">{c.name}</h3>
              </div>

              <div className="p-4 space-y-3">
                {c.description && <p className="text-xs text-[#6B7280] line-clamp-2">{c.description}</p>}

                <div className="flex items-center gap-3 text-xs text-[#6B7280] flex-wrap">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#1A1A1A]">
                    <CondIcon size={13} className="text-orange-500" />
                    {meta ? meta.label(c.condition_threshold) : 'Challenge'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {c.valid_until ? `Ends ${new Date(c.valid_until).toLocaleDateString('en-MY')}` : 'No end date'}
                  </span>
                </div>

                {enrolled && (
                  <div>
                    <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                      <span className="inline-flex items-center gap-1">
                        {completed ? <><CheckCircle2 size={12} className="text-green-500" /> Completed!</> : 'Progress'}
                      </span>
                      <span className="font-semibold">{progress.current_value} / {c.condition_threshold}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-2.5 rounded-full ${completed ? 'bg-green-500' : 'bg-gradient-to-r from-[#FF8A00] to-[#FFD166]'}`}
                      />
                    </div>
                  </div>
                )}

                {!enrolled && card && (
                  <button
                    onClick={() => handleEnrol(c.campaign_id)}
                    className="w-full bg-[#1A1A1A] text-white text-sm rounded-xl py-2.5 font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Zap size={14} /> Enrol Now
                  </button>
                )}
                {!card && <p className="text-xs text-gray-400">Link your card to enrol</p>}
              </div>
            </motion.div>
          )
        })}

        {/* Vouchers collected */}
        {vouchers.length > 0 && (
          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-5 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="text-orange-500" size={16} />
              <p className="text-sm font-bold text-[#1A1A1A]">Vouchers Collected</p>
            </div>
            {vouchers.map((v: any) => (
              <div key={v.voucher_id} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-green-600">RM {Number(v.discount_value).toFixed(2)} off</p>
                  <p className="text-xs text-gray-400">{v.campaign_name ?? 'Campaign Reward'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${v.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.status}
                  </span>
                  {v.expires_at && (
                    <p className="text-[10px] text-gray-400 mt-0.5">Exp: {new Date(v.expires_at).toLocaleDateString('en-MY')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
