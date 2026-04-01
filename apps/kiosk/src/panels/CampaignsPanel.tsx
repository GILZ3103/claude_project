// Panel 3 — Campaigns
// Figma design to be applied via MCP
import { useKiosk } from '../context/KioskContext'
import { enrolCampaign } from '../lib/api'
import toast from 'react-hot-toast'

export default function CampaignsPanel() {
  const { card, campaigns, setPanel, reset } = useKiosk()

  async function handleEnrol(campaign_id: string) {
    if (!card) return
    try {
      await enrolCampaign(campaign_id, card.uid)
      toast.success('Enrolled!')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to enrol')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white p-8 overflow-y-auto">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Campaigns</h2>
        <button onClick={() => setPanel('card')} className="text-sm text-gray-400 underline">
          ← Back
        </button>
      </div>

      {campaigns.length === 0 && (
        <p className="text-gray-500 text-sm">No campaigns available.</p>
      )}

      <div className="space-y-4 flex-1">
        {campaigns.map((c: any) => {
          const progress = c.progress ?? null
          const enrolled = !!progress
          const completed = progress?.completed_at != null
          const pct = progress
            ? Math.min(100, (progress.progress_value / c.condition_threshold) * 100)
            : 0

          return (
            <div key={c.campaign_id} className="bg-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <p className="font-semibold">{c.name}</p>
                <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">
                  RM {Number(c.reward_value).toFixed(2)} off
                </span>
              </div>
              <p className="text-xs text-gray-400">{c.description}</p>

              {enrolled && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{completed ? '✓ Completed' : 'Progress'}</span>
                    <span>{progress.progress_value} / {c.condition_threshold}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${completed ? 'bg-green-400' : 'bg-blue-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {!enrolled && (
                <button
                  onClick={() => handleEnrol(c.campaign_id)}
                  className="w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 rounded-xl font-medium"
                >
                  Enrol
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={reset} className="mt-8 text-xs text-gray-600 underline self-center">
        Done — return to idle
      </button>
    </div>
  )
}
