import { useEffect, useState } from 'react'
import { CheckCircle, CreditCard, Loader2 } from 'lucide-react'

interface LoginAnimationProps {
  loginSource: 'face' | 'nfc'
  ownerName?: string
  confidence?: number
  isLoading?: boolean   // true while card data is being fetched from backend
}

type Phase = 'scan' | 'loading' | 'confirm'

export function LoginAnimation({ loginSource, ownerName, confidence, isLoading = false }: LoginAnimationProps) {
  const [phase, setPhase] = useState<Phase>('scan')

  // After scan duration ends, move to loading or confirm depending on isLoading
  useEffect(() => {
    const scanDuration = loginSource === 'face' ? 2500 : 500
    const t = setTimeout(() => setPhase(isLoading ? 'loading' : 'confirm'), scanDuration)
    return () => clearTimeout(t)
  }, [loginSource])

  // When card data arrives while in loading phase, advance to confirm
  useEffect(() => {
    if (!isLoading && phase === 'loading') setPhase('confirm')
  }, [isLoading, phase])

  if (loginSource === 'nfc') {
    return (
      <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-blue-400/60 animate-ping absolute inset-0" />
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.6)] relative z-10">
              <CreditCard className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 mt-2">
            <h2 className="text-2xl font-bold text-white tracking-widest uppercase">NFC Detected</h2>
            {ownerName && (
              <p className="text-white/70 text-base">Welcome, <span className="text-white font-semibold">{ownerName}</span></p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black/88 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">

        {/* Viewfinder */}
        <div className="relative w-52 h-52">
          <Corner pos="tl" active={phase !== 'scan'} />
          <Corner pos="tr" active={phase !== 'scan'} />
          <Corner pos="bl" active={phase !== 'scan'} />
          <Corner pos="br" active={phase !== 'scan'} />

          {phase === 'scan' && (
            <div className="absolute inset-4 rounded-full border border-green-400/20 animate-pulse" />
          )}

          {/* Sweep line — loops while scanning */}
          {phase === 'scan' && (
            <div
              className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
              style={{
                boxShadow: '0 0 10px 2px rgba(74,222,128,0.6)',
                animation: 'faceScanLine 1.4s ease-in-out infinite',
              }}
            />
          )}

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === 'confirm' && (
              <div style={{ animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <CheckCircle className="w-20 h-20 text-green-400" style={{ filter: 'drop-shadow(0 0 16px rgba(74,222,128,0.8))' }} />
              </div>
            )}
            {phase === 'loading' && (
              <Loader2 className="w-16 h-16 text-orange-400 animate-spin" />
            )}
            {phase === 'scan' && (
              <div className="w-16 h-16 rounded-full border border-white/20 animate-pulse" />
            )}
          </div>
        </div>

        {/* Text area */}
        <div className="flex flex-col items-center gap-3 min-h-[90px]">
          <h2
            className="text-2xl font-bold tracking-widest uppercase transition-colors duration-500"
            style={{
              color: phase === 'confirm' ? '#4ade80' : phase === 'loading' ? '#fb923c' : 'white',
            }}
          >
            {phase === 'confirm' ? 'Face Recognised' : phase === 'loading' ? 'Loading Profile…' : 'Scanning…'}
          </h2>

          {phase === 'loading' && (
            <p className="text-white/50 text-sm" style={{ animation: 'fadeUp 0.3s ease-out forwards' }}>
              Waking up backend, please wait
            </p>
          )}

          {phase === 'confirm' && ownerName && (
            <p className="text-white/80 text-lg" style={{ animation: 'fadeUp 0.3s ease-out forwards' }}>
              Welcome, <span className="font-semibold text-white">{ownerName}</span>
            </p>
          )}

          {phase === 'confirm' && confidence !== undefined && (
            <div
              className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-full px-4 py-1.5"
              style={{ animation: 'fadeUp 0.4s 0.1s ease-out both' }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 text-sm font-medium">{Math.round(confidence * 100)}% match</span>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes faceScanLine {
          0%   { top: 12px;  opacity: 0; }
          10%  { opacity: 1; }
          50%  { top: calc(100% - 12px); opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 12px;  opacity: 0; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}

function Corner({ pos, active }: { pos: 'tl' | 'tr' | 'bl' | 'br'; active: boolean }) {
  const color = active ? 'border-green-400' : 'border-white/80'
  const posClass = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    tr: 'top-0 right-0 border-t-2 border-r-2',
    bl: 'bottom-0 left-0 border-b-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  }[pos]
  const translate = {
    tl: active ? 'translate(4px, 4px)'   : 'translate(0,0)',
    tr: active ? 'translate(-4px, 4px)'  : 'translate(0,0)',
    bl: active ? 'translate(4px, -4px)'  : 'translate(0,0)',
    br: active ? 'translate(-4px, -4px)' : 'translate(0,0)',
  }[pos]
  return (
    <div
      className={`absolute w-9 h-9 ${posClass} ${color}`}
      style={{ transform: translate, transition: 'transform 0.4s ease, border-color 0.4s ease' }}
    />
  )
}
