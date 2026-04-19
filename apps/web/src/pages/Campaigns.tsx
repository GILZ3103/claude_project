import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { getCampaigns, enrolCampaign, getCardVouchers } from '../lib/api'
import toast from 'react-hot-toast'

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
      <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const totalDeduction = vouchers.reduce((sum: number, v: any) => sum + Number(v.discount_value ?? 0), 0)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
      <h2 className="text-xl font-bold">Campaigns</h2>

      {/* Points deduction summary */}
      {card && (
        <div className="bg-black text-white rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400">Available Voucher Value</p>
            <p className="text-2xl font-bold">RM {totalDeduction.toFixed(2)}</p>
          </div>
          <span className="text-xs bg-white text-black px-2 py-1 rounded-full font-medium">
            {vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Vouchers collected */}
      {vouchers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium mb-2">Vouchers Collected</p>
          {vouchers.map((v: any) => (
            <div key={v.voucher_id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium text-green-600">RM {Number(v.discount_value).toFixed(2)} off</p>
                <p className="text-xs text-gray-400">{v.campaign_name ?? 'Campaign Reward'}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {v.status}
                </span>
                {v.expires_at && (
                  <p className="text-xs text-gray-400 mt-0.5">Exp: {new Date(v.expires_at).toLocaleDateString('en-MY')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign list */}
      <p className="text-sm font-medium text-gray-500">Available Programs</p>

      {campaigns.length === 0 && (
        <p className="text-sm text-gray-400">No campaigns available right now.</p>
      )}

      {campaigns.map((c: any) => {
        const progress = c.progress ?? null
        const pct = progress
          ? Math.min(100, (progress.current_value / c.condition_threshold) * 100)
          : 0
        const enrolled = !!progress
        const completed = progress?.completed_at != null

        return (
          <div key={c.campaign_id} className="bg-white rounded-xl shadow p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2">
                RM {Number(c.reward_value).toFixed(2)} off
              </span>
            </div>

            <p className="text-xs text-gray-400">
              {c.condition_type === 'VISIT_STALLS' && `Visit ${c.condition_threshold} stalls`}
              {c.condition_type === 'SPEND_POINTS' && `Spend RM ${Number(c.condition_threshold).toFixed(2)}`}
              {c.condition_type === 'DIRECTORY_REBATE' && `Tap kiosk ${c.condition_threshold}× for rebate`}
              {' · '}
              {c.valid_until ? `Ends ${new Date(c.valid_until).toLocaleDateString('en-MY')}` : 'No end date'}
            </p>

            {enrolled && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{completed ? 'Completed!' : 'Progress'}</span>
                  <span>{progress.current_value} / {c.condition_threshold}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {!enrolled && card && (
              <button
                onClick={() => handleEnrol(c.campaign_id)}
                className="w-full mt-1 bg-black text-white text-sm rounded-lg py-2 font-medium"
              >
                Enrol
              </button>
            )}
            {!card && <p className="text-xs text-gray-400">Link your card to enrol</p>}
          </div>
        )
      })}
    </div>
  )
}
