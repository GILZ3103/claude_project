import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVendor } from '../context/VendorContext'
import { getVendorSummary } from '../lib/api'

export default function Home() {
  const { card, vendorId } = useVendor()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!vendorId) return
    setLoading(true)
    getVendorSummary(vendorId)
      .then((res: any) => setSummary(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [vendorId])

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in.</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <div>
        <p className="text-sm text-gray-500">Vendor Dashboard</p>
        <h1 className="text-2xl font-bold">{card.business_name ?? card.owner_name}</h1>
      </div>

      {/* Business info */}
      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Business Info</p>
        {[
          { label: 'Owner', value: card.owner_name },
          { label: 'Email', value: card.owner_email },
          { label: 'Phone', value: card.phone_number ?? '—' },
          { label: 'Card UID', value: card.uid },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-1 border-b last:border-0">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-sm font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Subsidies */}
      <div className="bg-black text-white rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">Total Subsidies Available</p>
        {loading
          ? <div className="h-8 w-32 bg-gray-700 rounded animate-pulse" />
          : <p className="text-3xl font-bold">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
        }
        <button
          onClick={() => navigate('/claim')}
          className="mt-3 bg-white text-black rounded-lg px-4 py-2 text-sm font-medium"
        >
          Submit Claim →
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/information')}
          className="bg-white rounded-xl shadow p-4 text-left"
        >
          <p className="font-semibold text-sm">Stall Info</p>
          <p className="text-xs text-gray-400 mt-1">Location, menu & photos</p>
        </button>
        <button
          onClick={() => navigate('/campaigns')}
          className="bg-white rounded-xl shadow p-4 text-left"
        >
          <p className="font-semibold text-sm">Campaigns</p>
          <p className="text-xs text-gray-400 mt-1">View & join programs</p>
        </button>
        <button
          onClick={() => navigate('/summary')}
          className="bg-white rounded-xl shadow p-4 text-left"
        >
          <p className="font-semibold text-sm">Summary</p>
          <p className="text-xs text-gray-400 mt-1">Subsidy breakdown</p>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="bg-white rounded-xl shadow p-4 text-left"
        >
          <p className="font-semibold text-sm">Settings</p>
          <p className="text-xs text-gray-400 mt-1">Profile & account</p>
        </button>
      </div>
    </div>
  )
}
