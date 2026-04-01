// VendorCampaigns — view active campaigns for this vendor
// Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { getCampaigns } from '../lib/api'
import toast from 'react-hot-toast'

export default function VendorCampaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaigns()
      .then((res: any) => setCampaigns(res.campaigns ?? res ?? []))
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Active Campaigns</h2>

      {campaigns.length === 0 && (
        <p className="text-sm text-gray-400">No campaigns currently active.</p>
      )}

      {campaigns.map((c: any) => (
        <div key={c.campaign_id} className="bg-white rounded-xl shadow p-4 space-y-1">
          <div className="flex justify-between">
            <p className="font-semibold">{c.name}</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              RM {Number(c.reward_value).toFixed(2)} off
            </span>
          </div>
          <p className="text-xs text-gray-500">{c.description}</p>
          <p className="text-xs text-gray-400">
            {c.condition_type} · threshold {c.condition_threshold}
            {c.valid_until ? ` · ends ${new Date(c.valid_until).toLocaleDateString('en-MY')}` : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
