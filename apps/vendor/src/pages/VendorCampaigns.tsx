import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { getCampaigns, enrolCampaign } from '../lib/api'
import toast from 'react-hot-toast'

export default function VendorCampaigns() {
  const { card } = useVendor()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await getCampaigns() as any
      setCampaigns(res.campaigns ?? res ?? [])
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnrol(campaign_id: string) {
    if (!card) return
    try {
      await enrolCampaign(campaign_id, card.uid)
      toast.success('Enrolled in campaign!')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Enrol failed')
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
        {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pb-24">
      <h2 className="text-xl font-bold">Campaigns</h2>
      <p className="text-xs text-gray-400">Enrol your stall to participate in subsidy programs.</p>

      {campaigns.length === 0 && (
        <p className="text-sm text-gray-400">No campaigns currently active.</p>
      )}

      {campaigns.map((c: any) => (
        <div key={c.campaign_id} className="bg-white rounded-xl shadow p-4 space-y-2">
          <div className="flex justify-between items-start">
            <p className="font-semibold">{c.name}</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0 ml-2">
              RM {Number(c.reward_value).toFixed(2)} off
            </span>
          </div>
          <p className="text-xs text-gray-500">{c.description}</p>
          <p className="text-xs text-gray-400">
            {c.condition_type === 'VISIT_STALLS' && `Require ${c.condition_threshold} stall visits`}
            {c.condition_type === 'SPEND_POINTS' && `Require RM ${Number(c.condition_threshold).toFixed(2)} spend`}
            {c.condition_type === 'DIRECTORY_REBATE' && `${c.condition_threshold}× kiosk taps`}
            {c.valid_until ? ` · Ends ${new Date(c.valid_until).toLocaleDateString('en-MY')}` : ''}
          </p>
          {card && (
            <button
              onClick={() => handleEnrol(c.campaign_id)}
              className="w-full mt-1 bg-black text-white text-sm rounded-lg py-2 font-medium"
            >
              Enrol Stall
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
