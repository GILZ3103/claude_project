import { useKiosk } from '../context/KioskContext'

export default function TopUpPanel() {
  const { card, setPanel, toggleEmergency } = useKiosk()

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button onClick={() => setPanel(card ? 'card' : 'home')} className="text-gray-500 text-sm underline">← Back</button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Top Up Points</h2>
          <p className="text-gray-400 mt-2 text-sm">Scan the QR code with your phone to top up</p>
        </div>

        {/* QR placeholder */}
        <div className="bg-white rounded-3xl p-6 flex items-center justify-center w-56 h-56">
          <div className="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center">
            <div className="text-gray-400 text-center">
              <p className="text-4xl">📱</p>
              <p className="text-xs mt-2 text-gray-500">QR Code</p>
              <p className="text-xs text-gray-400">Coming soon</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-gray-400">Steps:</p>
          <p className="text-sm">1. Scan the QR code above</p>
          <p className="text-sm">2. Complete top-up on your phone</p>
          <p className="text-sm">3. Tap your card again to receive points</p>
        </div>

        <button
          onClick={() => setPanel(card ? 'card' : 'home')}
          className="text-xs text-gray-600 underline"
        >
          Done
        </button>
      </div>
    </div>
  )
}
