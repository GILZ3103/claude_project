// Summary — subsidy summary dashboard
// Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { getVendorSummary } from '../lib/api'
import toast from 'react-hot-toast'

export default function Summary() {
  const { vendorId } = useVendor()
  const [summary, setSummary] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (vendorId) load()
  }, [vendorId])

  async function load() {
    setLoading(true)
    try {
      const res = await getVendorSummary(vendorId!) as any
      setSummary(res.summary ?? res ?? null)
    } catch {
      toast.error('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Subsidy Summary</h2>

      {!summary || summary.length === 0 ? (
        <p className="text-sm text-gray-400">No redemptions recorded yet.</p>
      ) : (
        summary.map((row: any, i: number) => (
          <div key={i} className="bg-white rounded-xl shadow p-4">
            <p className="font-semibold">{row.campaign_name ?? 'Campaign'}</p>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">Redemptions</span>
              <span className="font-medium">{row.redemption_count}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Total Discount</span>
              <span className="font-medium text-green-600">RM {Number(row.total_discount ?? 0).toFixed(2)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
