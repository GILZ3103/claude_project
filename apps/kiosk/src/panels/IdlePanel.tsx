// Panel 1 — Idle / NFC polling
// Figma design to be applied via MCP
import { useEffect, useRef } from 'react'
import { pollNFC } from '../lib/api'
import { useKiosk } from '../context/KioskContext'

const POLL_MS = 1500

export default function IdlePanel() {
  const { handleNfcTap, setPanel } = useKiosk()
  const lastUid = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      if (active) {
        timerRef.current = setTimeout(poll, POLL_MS)
      }
    }

    poll()
    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white select-none">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center mb-8 animate-pulse">
        <div className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/60" />
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-2">Night Market</h1>
      <p className="text-gray-400 text-lg">Tap your card to get started</p>

      <button
        onClick={() => setPanel('map')}
        className="mt-12 text-sm text-gray-500 underline"
      >
        View Stall Map
      </button>
    </div>
  )
}
