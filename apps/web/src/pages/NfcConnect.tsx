import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CreditCard, Wifi, CheckCircle, AlertCircle, Keyboard, Loader, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { getCardHistory, linkNfcCard } from '../lib/api'

const NFC_DAEMON = 'http://localhost:5001'
const POLL_MS = 2000

type ScanState = 'idle' | 'scanning' | 'detected' | 'linking' | 'success'

function formatUid(raw: string): string {
  // Web NFC returns "04:1a:2b:3c" — strip colons, uppercase
  return raw.replace(/:/g, '').toUpperCase()
}

export default function NfcConnect() {
  const { card, refreshCard } = useCard()
  const [history, setHistory] = useState<any[]>([])
  const [daemonOnline, setDaemonOnline] = useState(false)
  const [lastTapEvent, setLastTapEvent] = useState<string | null>(null)
  const lastUidRef = useRef<string | null>(null)

  // NFC link flow
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [detectedUid, setDetectedUid] = useState<string>('')
  const [manualUid, setManualUid] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [webNfcSupported, setWebNfcSupported] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const hasPhysicalCard = card && !card.uid.startsWith('USER-')

  useEffect(() => {
    setWebNfcSupported('NDEFReader' in window)
  }, [])

  useEffect(() => {
    if (!card) return
    loadHistory()
  }, [card?.uid])

  // Poll NFC daemon (kiosk terminal taps)
  useEffect(() => {
    if (!hasPhysicalCard) return
    let active = true
    async function poll() {
      while (active) {
        try {
          const res = await fetch(`${NFC_DAEMON}/nfc`, { signal: AbortSignal.timeout(1500) })
          const json = await res.json()
          setDaemonOnline(true)
          if (json.uid && json.uid !== lastUidRef.current) {
            lastUidRef.current = json.uid
            setLastTapEvent(`Tap detected at ${new Date(json.timestamp * 1000).toLocaleTimeString('en-MY')}`)
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
  }, [hasPhysicalCard])

  async function loadHistory() {
    if (!card) return
    try {
      const res = await getCardHistory(card.uid, 10, 0) as any
      setHistory(res.history ?? [])
    } catch { /* ignore */ }
  }

  async function startWebNfcScan() {
    setScanState('scanning')
    setShowManual(false)
    try {
      const reader = new (window as any).NDEFReader()
      abortRef.current = new AbortController()
      await reader.scan({ signal: abortRef.current.signal })
      reader.addEventListener('reading', (event: any) => {
        const uid = formatUid(event.serialNumber ?? '')
        if (!uid) return
        setDetectedUid(uid)
        setScanState('detected')
        abortRef.current?.abort()
      })
      reader.addEventListener('readingerror', () => {
        toast.error('Could not read NFC tag. Try again.')
        setScanState('idle')
      })
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      toast.error('NFC scan failed. Make sure NFC is enabled.')
      setScanState('idle')
    }
  }

  function cancelScan() {
    abortRef.current?.abort()
    setScanState('idle')
    setDetectedUid('')
  }

  async function confirmLink(uid: string) {
    if (!card || !uid) return
    setScanState('linking')
    try {
      await linkNfcCard(card.uid, uid)
      setScanState('success')
      setTimeout(() => window.location.reload(), 1800)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to link card')
      setScanState('idle')
      setDetectedUid('')
    }
  }

  async function handleManualSubmit() {
    const uid = manualUid.trim().toUpperCase()
    if (!uid || uid.length < 4) {
      toast.error('Enter a valid card UID (at least 4 characters)')
      return
    }
    setDetectedUid(uid)
    setScanState('detected')
    setShowManual(false)
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  return (
    <div className="px-4 pb-16 max-w-2xl mx-auto pt-4 space-y-5">

      {/* ── LINK NFC CARD section (only if no physical card) ── */}
      {!hasPhysicalCard && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Header strip */}
          <div className="bg-gradient-to-r from-[#FF8A00] to-[#FFD166] px-6 py-5">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Step required</p>
            <h2 className="text-xl font-bold text-white">Link Your NFC Card</h2>
            <p className="text-white/80 text-sm mt-1">Collect your physical card at the WarungTek kiosk, then tap it here to link it to your account.</p>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">

              {/* IDLE */}
              {scanState === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                  {webNfcSupported ? (
                    <motion.button
                      onClick={startWebNfcScan}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 shadow-md hover:bg-gray-800 transition-colors"
                    >
                      <Wifi size={20} />
                      Tap NFC Card to Phone
                    </motion.button>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-xs text-amber-700">
                      <strong>Web NFC not supported</strong> on this browser. Use Android Chrome, or enter your card UID manually below.
                    </div>
                  )}

                  <button
                    onClick={() => setShowManual(v => !v)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-[#6B7280] hover:bg-gray-50 transition-colors"
                  >
                    <Keyboard size={16} />
                    Enter UID manually
                  </button>

                  <AnimatePresence>
                    {showManual && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="e.g. 04A1B2C3"
                            value={manualUid}
                            onChange={e => setManualUid(e.target.value.toUpperCase())}
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-[#FF8A00] focus:ring-4 focus:ring-orange-100 outline-none"
                          />
                          <button
                            onClick={handleManualSubmit}
                            disabled={!manualUid.trim()}
                            className="bg-[#FF8A00] text-white px-5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-orange-600 transition-colors"
                          >
                            Link
                          </button>
                        </div>
                        <p className="text-[10px] text-[#6B7280] mt-2 px-1">
                          The UID is printed on the back of your NFC card, or shown on the kiosk screen when you tap.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* SCANNING */}
              {scanState === 'scanning' && (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 space-y-5">
                  {/* Animated pulse rings */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    {[1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="absolute rounded-full border-2 border-[#FF8A00]/40"
                        initial={{ width: 48, height: 48, opacity: 0.8 }}
                        animate={{ width: 112, height: 112, opacity: 0 }}
                        transition={{ duration: 1.8, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
                      />
                    ))}
                    <div className="w-14 h-14 bg-orange-50 border-2 border-[#FF8A00] rounded-full flex items-center justify-center">
                      <Wifi size={24} className="text-[#FF8A00]" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-[#1A1A1A]">Hold your NFC card to the back of your phone</p>
                    <p className="text-xs text-[#6B7280] mt-1">Keep the card still until detected</p>
                  </div>
                  <button onClick={cancelScan} className="text-sm text-[#6B7280] hover:text-gray-800 flex items-center gap-1">
                    Cancel
                  </button>
                </motion.div>
              )}

              {/* DETECTED — confirm */}
              {scanState === 'detected' && (
                <motion.div key="detected" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                    <CheckCircle size={20} className="text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Card detected!</p>
                      <p className="text-xs text-green-600 font-mono mt-0.5">{detectedUid}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B7280] px-1">Link this NFC card to your account? This replaces your temporary ID.</p>
                  <div className="flex gap-3">
                    <button onClick={cancelScan} className="flex-1 py-3 bg-gray-100 text-[#1A1A1A] font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                      Try Again
                    </button>
                    <button onClick={() => confirmLink(detectedUid)} className="flex-1 py-3 bg-[#1A1A1A] text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-md">
                      Confirm Link
                    </button>
                  </div>
                </motion.div>
              )}

              {/* LINKING */}
              {scanState === 'linking' && (
                <motion.div key="linking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 gap-3">
                  <Loader size={32} className="text-[#FF8A00] animate-spin" />
                  <p className="text-sm font-medium text-[#6B7280]">Linking card to your account…</p>
                </motion.div>
              )}

              {/* SUCCESS */}
              {scanState === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 gap-3 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                    <CheckCircle size={48} className="text-green-500" />
                  </motion.div>
                  <p className="font-bold text-[#1A1A1A]">Card linked successfully!</p>
                  <p className="text-xs text-[#6B7280]">Reloading your session…</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ── CARD STATUS (always shown) ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="bg-[#1A1A1A] text-white rounded-[2rem] p-6 space-y-4 shadow-lg relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-xl" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-gray-300" />
              <span className="text-sm font-semibold text-gray-300">WarungTek Card</span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${hasPhysicalCard ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${hasPhysicalCard ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
              {hasPhysicalCard ? 'Physical Card' : 'Temp ID'}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-sm">{card.owner_name}</p>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{card.uid}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Wallet Balance</p>
            <p className="text-3xl font-bold tracking-tight">RM {Number(card.points_balance).toFixed(2)}</p>
          </div>
          {hasPhysicalCard && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl self-start w-fit ${daemonOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${daemonOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              Reader {daemonOnline ? 'Online' : 'Offline'}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── LAST TAP ── */}
      <AnimatePresence>
        {lastTapEvent && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Tap Successful</p>
              <p className="text-xs text-green-600">{lastTapEvent}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP HISTORY ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#1A1A1A]">Recent Taps</h2>
          <button onClick={loadHistory} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280]">
            <AlertCircle size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No tap history yet.</p>
            {!hasPhysicalCard && <p className="text-xs mt-1">Link your NFC card to start tapping.</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((h: any) => (
              <div key={h.event_id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{h.food_name ?? h.event_type}</p>
                  <p className="text-xs text-[#6B7280]">{h.vendor_name ?? '—'}</p>
                </div>
                <div className="text-right">
                  {h.final_cost != null && (
                    <p className="text-sm font-semibold text-red-500">-RM {Number(h.final_cost).toFixed(2)}</p>
                  )}
                  <p className="text-xs text-[#6B7280]">
                    {h.server_timestamp ? new Date(h.server_timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {!daemonOnline && hasPhysicalCard && (
        <p className="text-xs text-center text-[#6B7280] pb-4">
          NFC reader polling is only active on a physical Raspberry Pi kiosk with PN532 hardware.
        </p>
      )}
    </div>
  )
}
