import { useState, useEffect, useRef } from 'react'
import { useCard } from '../context/CardContext'
import { getCardHistory, getCampaigns } from '../lib/api'

const NFC_DAEMON = 'http://localhost:5001'
const POLL_MS = 2000

export default function NfcConnect() {
  const { card, refreshCard } = useCard()
  const [daemonOnline, setDaemonOnline] = useState(false)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const lastUidRef = useRef<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [promotions, setPromotions] = useState<any[]>([])

  useEffect(() => {
    if (!card) return
    loadHistory()
    loadPromotions()
  }, [card?.uid])

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
            setLastEvent(`Tap detected at ${new Date(json.timestamp * 1000).toLocaleTimeString('en-MY')}`)
            refreshCard()
            loadHistory()
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

  async function loadHistory() {
    if (!card) return
    try {
      const res = await getCardHistory(card.uid, 10, 0) as any
      setHistory(res.history ?? [])
    } catch { }
  }

  async function loadPromotions() {
    if (!card) return
    try {
      const res = await getCampaigns(card.uid) as any
      const all: any[] = res.campaigns ?? res ?? []
      // Show campaigns not yet enrolled or not yet completed
      setPromotions(all.filter((c: any) => !c.progress || !c.progress.completed_at).slice(0, 3))
    } catch { }
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <h1 className="text-xl font-bold">NFC Card</h1>

      {/* Card connected status + points */}
      <div className="bg-black text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-300">Card Connected</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${daemonOnline ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
            Reader {daemonOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-400">{card.owner_name}</p>
          <p className="text-xs text-gray-500 font-mono">{card.uid}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Points Balance</p>
          <p className="text-3xl font-bold">RM {Number(card.points_balance).toFixed(2)}</p>
        </div>
      </div>

      {/* Active promotions notification */}
      {promotions.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <p className="text-sm font-medium">Active Promotions</p>
            <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              {promotions.length} available
            </span>
          </div>
          {promotions.map((c: any) => (
            <div key={c.campaign_id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-gray-400">
                  {c.condition_type === 'VISIT_STALLS' && `Visit ${c.condition_threshold} stalls`}
                  {c.condition_type === 'SPEND_POINTS' && `Spend RM ${Number(c.condition_threshold).toFixed(2)}`}
                  {c.condition_type === 'DIRECTORY_REBATE' && `Tap kiosk ${c.condition_threshold}×`}
                </p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2">
                RM {Number(c.reward_value).toFixed(2)} off
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Last tap event */}
      {lastEvent && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold shrink-0">✓</div>
          <div>
            <p className="text-sm font-medium text-green-800">Tap Successful</p>
            <p className="text-xs text-green-600">{lastEvent}</p>
          </div>
        </div>
      )}

      {/* Previous taps */}
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-sm font-medium mb-3">Previous Taps</p>
        {history.length === 0
          ? <p className="text-sm text-gray-400">No tap history yet.</p>
          : history.map((h: any) => (
            <div key={h.event_id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{h.food_name ?? h.event_type}</p>
                <p className="text-xs text-gray-400">{h.vendor_name ?? '—'}</p>
              </div>
              <div className="text-right">
                {h.final_cost != null && (
                  <p className="text-sm font-medium text-red-500">-RM {Number(h.final_cost).toFixed(2)}</p>
                )}
                <p className="text-xs text-gray-400">
                  {h.server_timestamp ? new Date(h.server_timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          ))
        }
      </div>

      {!daemonOnline && (
        <p className="text-xs text-center text-gray-400">
          NFC reader is only active on a physical Raspberry Pi kiosk with PN532 hardware.
        </p>
      )}
    </div>
  )
}
