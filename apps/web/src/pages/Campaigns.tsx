// Campaigns — Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { getCampaigns, enrolCampaign } from '../lib/api'
import toast from 'react-hot-toast'

export default function Campaigns() {
  const { card } = useCard()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [card])

  async function load() {
    setLoading(true)
    try {
      const res = await getCampaigns(card?.uid) as any
      setCampaigns(res.campaigns ?? res ?? [])
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
      <div className="p-6 max-w-lg mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Campaigns</h2>

      {campaigns.length === 0 && (
        <p className="text-sm text-gray-400">No campaigns available right now.</p>
      )}

      {campaigns.map((c: any) => {
        const progress = c.progress ?? null
        const pct = progress
          ? Math.min(100, (progress.progress_value / c.condition_threshold) * 100)
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
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
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
                  <span>{progress.progress_value} / {c.condition_threshold}</span>
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
            {!card && (
              <p className="text-xs text-gray-400">Link your card to enrol</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
