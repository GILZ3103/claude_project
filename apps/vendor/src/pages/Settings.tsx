import { useVendor } from '../context/VendorContext'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const { card, logout } = useVendor()
  const navigate = useNavigate()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL

  function handleLogout() {
    logout()
    navigate('/')
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in.</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Profile</p>
        {[
          { label: 'Name', value: card.owner_name },
          { label: 'Email', value: card.owner_email },
          { label: 'Phone', value: card.phone_number ?? '—' },
          { label: 'Card UID', value: card.uid },
          { label: 'Business', value: card.business_name ?? '—' },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-1 border-b last:border-0">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className="text-sm font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Switch portal */}
      {consumerUrl && (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium mb-2">Switch Portal</p>
          <a
            href={consumerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block text-center border border-black rounded-lg py-2 text-sm font-medium"
          >
            Switch to Consumer App →
          </a>
        </div>
      )}

      {/* Sign out */}
      <div className="bg-white rounded-xl shadow p-4">
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
