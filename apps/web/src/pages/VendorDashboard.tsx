import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCard } from '../context/CardContext'
import { getVendorSummary } from '../lib/api'

export default function VendorDashboard() {
  const { card } = useCard()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!card?.vendor_id) return
    setLoading(true)
    getVendorSummary(card.vendor_id, card.uid)
      .then((res: any) => setSummary(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [card?.vendor_id])

  if (!card) return null

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <div>
        <p className="text-sm text-gray-500">Vendor Dashboard</p>
        <h1 className="text-2xl font-bold">{card.business_name ?? card.owner_name}</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Business Info</p>
        {[
          { label: 'Owner', value: card.owner_name },
          { label: 'SSM No.', value: card.ssm_registration_number ?? '—' },
          { label: 'Phone', value: card.phone_number ?? '—' },
          { label: 'Card UID', value: card.uid },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-1 border-b last:border-0">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-sm font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-black text-white rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">Total Subsidies Available</p>
        {loading
          ? <div className="h-8 w-32 bg-gray-700 rounded animate-pulse" />
          : <p className="text-3xl font-bold">RM {Number(summary?.grand_total_subsidy ?? 0).toFixed(2)}</p>
        }
        <button
          onClick={() => navigate('/vendor/claim')}
          className="mt-3 bg-white text-black rounded-lg px-4 py-2 text-sm font-medium"
        >
          Submit Claim →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Stall Info', sub: 'Menu & location', path: '/vendor/information' },
          { label: 'Campaigns', sub: 'Join programs', path: '/vendor/campaigns' },
          { label: 'Summary', sub: 'Subsidy breakdown', path: '/vendor/summary' },
          { label: 'Claim', sub: 'Submit claim', path: '/vendor/claim' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className="bg-white rounded-xl shadow p-4 text-left">
            <p className="font-semibold text-sm">{item.label}</p>
            <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
