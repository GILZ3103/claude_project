import { useKiosk } from '../context/KioskContext'

export default function EmergencyModal() {
  const { toggleEmergency } = useKiosk()

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8 select-none">
      <div className="bg-gray-900 border-2 border-red-600 rounded-3xl p-8 w-full max-w-sm space-y-6 text-white text-center">
        <div>
          <p className="text-5xl mb-3">🚨</p>
          <h2 className="text-2xl font-bold">Emergency Assistance</h2>
          <p className="text-gray-400 text-sm mt-2">Contact the Night Market Manager for help</p>
        </div>

        <div className="bg-white/10 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Night Market Manager</p>
          <p className="text-3xl font-bold mt-2 tracking-wide">018-5736759</p>
        </div>

        <a
          href="tel:0185736759"
          className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-lg"
        >
          📞 Call Now
        </a>

        <button
          onClick={toggleEmergency}
          className="text-gray-500 text-sm underline"
        >
          Close
        </button>
      </div>
    </div>
  )
}
