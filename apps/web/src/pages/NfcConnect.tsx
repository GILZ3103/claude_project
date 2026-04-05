import { useState, useEffect, useRef } from 'react'
import { useCard } from '../context/CardContext'

const NFC_DAEMON = 'http://localhost:5001'
const POLL_MS = 2000

export default function NfcConnect() {
  const { card } = useCard()
  const [daemonOnline, setDaemonOnline] = useState(false)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [lastUid, setLastUid] = useState<string | null>(null)
  const lastUidRef = useRef<string | null>(null)

  // Poll NFC daemon
  useEffect(() => {
    let active = true
    async function poll() {
      while (active) {
        try {
          const res = await fetch(`${NFC_DAEMON}/nfc`, { signal: AbortSignal.timeout(1500) })
          const json = await res.json()
          setDaemonOnline(true)
          if (json.uid && json.uid !== lastUidRef.current) {
            lastUidRef.current = json.uid
            setLastUid(json.uid)
            setLastEvent(`Card detected: ${json.uid} at ${new Date(json.timestamp * 1000).toLocaleTimeString('en-MY')}`)
          }
        } catch {
          setDaemonOnline(false)
        }
        await new Promise(r => setTimeout(r, POLL_MS))
      }
    }
    poll()
    return () => { active = false }
  }, [])

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">NFC Connect</h1>

      {/* Card status */}
      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-sm font-medium">Linked Card</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-lg">&#9654;</span>
          </div>
          <div>
            <p className="font-bold text-sm">{card.owner_name}</p>
            <p className="text-xs text-gray-400 font-mono">{card.uid}</p>
          </div>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Linked</span>
        </div>
      </div>

      {/* Daemon status */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">NFC Reader</p>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${daemonOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {daemonOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        {!daemonOnline && (
          <p className="text-xs text-gray-400 mt-2">
            NFC daemon not detected. This is only available when running on a Raspberry Pi kiosk with a PN532 reader.
          </p>
        )}
      </div>

      {/* Last event notification */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-2">Last Event</p>
        {lastEvent
          ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">{lastEvent}</p>
              {lastUid && <p className="text-xs text-gray-400 font-mono mt-1">UID: {lastUid}</p>}
            </div>
          )
          : <p className="text-sm text-gray-400">No recent tap detected.</p>
        }
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800 mb-1">How NFC works</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Tap your NFC card at a vendor terminal to deduct points</li>
          <li>Tap at a kiosk to check in and earn campaign progress</li>
          <li>Points and calories update automatically after each tap</li>
        </ul>
      </div>
    </div>
  )
}
