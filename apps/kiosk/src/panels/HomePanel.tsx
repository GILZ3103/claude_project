import { useEffect, useRef } from 'react'
import { pollNFC } from '../lib/api'
import { useKiosk } from '../context/KioskContext'

const POLL_MS = 1500

export default function HomePanel() {
  const { handleNfcTap, setPanel, toggleEmergency } = useKiosk()
  const lastUid = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    async function poll() {
      if (!active) return
      try {
        const res = await pollNFC()
        if (res.uid && res.uid !== lastUid.current) {
          lastUid.current = res.uid
          await handleNfcTap(res.uid)
        }
      } catch {
        // NFC daemon offline — keep polling silently
      }
      if (active) setTimeout(poll, POLL_MS)
    }

    poll()
    return () => { active = false }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none">
      {/* Header */}
      <div className="flex flex-col items-center pt-10 pb-6">
        <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center mb-4 animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-white/40 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/60" />
          </div>
        </div>
        <h1 className="text-3xl font-bold">Night Market</h1>
        <p className="text-gray-400 mt-1">What would you like to do?</p>
      </div>

      {/* Main actions */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <button
          onClick={() => {}}
          className="w-full max-w-sm bg-white text-gray-900 font-bold py-5 rounded-2xl text-lg"
        >
          Tap Your Card to Begin
        </button>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <button
            onClick={() => setPanel('food-browser')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-5 px-4 flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🍛</span>
            <span className="text-sm font-medium">Browse Food</span>
          </button>

          <button
            onClick={() => setPanel('calorie-set')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-5 px-4 flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🥗</span>
            <span className="text-sm font-medium">Calorie Limit</span>
          </button>

          <button
            onClick={() => setPanel('map')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-5 px-4 flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🗺️</span>
            <span className="text-sm font-medium">Stall Map</span>
          </button>

          <button
            onClick={() => setPanel('campaigns')}
            className="bg-white/10 hover:bg-white/20 rounded-2xl py-5 px-4 flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🎁</span>
            <span className="text-sm font-medium">Campaigns</span>
          </button>
        </div>
      </div>

      {/* Emergency button — fixed bottom */}
      <div className="p-6">
        <button
          onClick={toggleEmergency}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
        >
          <span>🚨</span> Emergency Assistance
        </button>
      </div>
    </div>
  )
}
