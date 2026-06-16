import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Wallet, Tag, Repeat, TrendingUp } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { getVendorSummary } from '../lib/api'
import { HeroHeader } from '../components/HeroHeader'
import { ImageWithFallback } from '../components/ImageWithFallback'
import { StatPill } from '../components/Badges'
import { getFoodImage } from '../lib/foodImages'

export default function VendorSummary() {
  const { card } = useCard()
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!card?.vendor_id) return
    getVendorSummary(card.vendor_id, card.uid)
      .then((res: any) => setSummary(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [card?.vendor_id])

  if (!card) return null

  const campaigns = summary?.campaigns ?? []
  const total = Number(summary?.grand_total_subsidy ?? 0)

  return (
    <div className="px-4 pb-28 max-w-lg mx-auto pt-4">
      {/* Header */}
      <div className="-mx-4 -mt-4 mb-5">
        <HeroHeader
          title="Subsidy Summary"
          subtitle={card.business_name ?? 'Your earnings at a glance'}
          seed="vendor-summary"
        />
      </div>

      {/* Total subsidy stat card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[1.5rem] p-6 bg-gradient-to-br from-[#FF8A00] to-[#FFD166] text-white shadow-md mb-6"
      >
        <div className="flex items-center gap-2 text-white/90 mb-1">
          <Wallet size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Total Subsidy Available</span>
        </div>
        {loading
          ? <div className="h-9 w-36 bg-white/30 rounded-lg animate-pulse mt-1" />
          : <p className="text-4xl font-bold drop-shadow-sm">RM {total.toFixed(2)}</p>
        }
        <Wallet className="absolute -right-3 -bottom-3 text-white/15" size={104} />
      </motion.div>

      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-[#FF8A00]" />
        <p className="text-sm font-bold text-[#1A1A1A]">Breakdown by Campaign</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-[1.5rem] animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[1.5rem] border border-dashed border-gray-200 text-[#6B7280]">
          <Tag size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No subsidy data yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any, i: number) => (
            <motion.div
              key={c.campaign_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden flex items-center gap-4 p-3 hover:shadow-md hover:border-orange-200 transition-all"
            >
              <ImageWithFallback
                src={getFoodImage({ name: c.campaign_name, food_id: c.campaign_id })}
                alt={c.campaign_name ?? 'Campaign'}
                className="w-16 h-16 rounded-2xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#1A1A1A] truncate">{c.campaign_name}</p>
                <div className="mt-1">
                  <StatPill icon={Repeat} tone="blue">{c.redemption_count} redemptions</StatPill>
                </div>
              </div>
              <p className="shrink-0 font-bold text-green-700 text-base">RM {Number(c.total_subsidy_owed ?? 0).toFixed(2)}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
