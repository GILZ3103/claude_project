import { useEffect, useState } from 'react'
import { useCard } from '../context/CardContext'
import { getVendorSummary } from '../lib/api'

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

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Subsidy Summary</h1>

      <div className="bg-black text-white rounded-xl p-4">
        <p className="text-xs text-gray-400">Total Subsidy Available</p>
        {loading
          ? <div className="h-8 w-32 bg-gray-700 rounded animate-pulse mt-1" />
          : <p className="text-3xl font-bold">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
        }
      </div>

      <p className="text-sm font-medium">Breakdown by Campaign</p>

      {loading
        ? [1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        : (summary?.campaigns ?? []).length === 0
          ? <p className="text-sm text-gray-400">No subsidy data yet.</p>
          : (summary?.campaigns ?? []).map((c: any) => (
              <div key={c.campaign_id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{c.campaign_name}</p>
                  <p className="text-xs text-gray-400">{c.redemption_count} redemptions</p>
                </div>
                <p className="font-bold text-green-700">RM {Number(c.total_subsidy_owed ?? 0).toFixed(2)}</p>
              </div>
            ))
      }
    </div>
  )
}
