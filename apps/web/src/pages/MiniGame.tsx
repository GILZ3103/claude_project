import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Dices, Trophy, RotateCcw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { spinWheel } from '../lib/api'
import { MASCOT } from '../lib/mascot'

const PRIZES = [
  { index: 0, label: 'Try Again', points: 0,   color: '#94A3B8' },
  { index: 1, label: '+5 pts',    points: 5,   color: '#FED7AA' },
  { index: 2, label: '+10 pts',   points: 10,  color: '#FCA5A5' },
  { index: 3, label: '+20 pts',   points: 20,  color: '#6EE7B7' },
  { index: 4, label: '+30 pts',   points: 30,  color: '#93C5FD' },
  { index: 5, label: '+50 pts',   points: 50,  color: '#C4B5FD' },
  { index: 6, label: '+100 pts',  points: 100, color: '#FCD34D' },
  { index: 7, label: '+200 pts!', points: 200, color: '#FB923C' },
]

const N = PRIZES.length
const SEG = 360 / N // 45°

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function segmentPath(cx: number, cy: number, r: number, i: number) {
  const start = polarToXY(cx, cy, r, i * SEG)
  const end = polarToXY(cx, cy, r, (i + 1) * SEG)
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`
}

function SpinWheelSVG() {
  const cx = 150, cy = 150, r = 138, innerR = 32

  return (
    <svg viewBox="0 0 300 300" className="w-full h-full" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))' }}>
      <circle cx={cx} cy={cy} r={r + 6} fill="white" opacity={0.15} />

      {PRIZES.map((prize, i) => {
        const midAngle = i * SEG + SEG / 2
        const textPos = polarToXY(cx, cy, r * 0.65, midAngle)
        return (
          <g key={i}>
            <path d={segmentPath(cx, cy, r, i)} fill={prize.color} stroke="white" strokeWidth={2.5} />
            <g transform={`translate(${textPos.x.toFixed(2)}, ${textPos.y.toFixed(2)}) rotate(${midAngle})`}>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={prize.label.length > 7 ? '10' : '11'}
                fontWeight="800"
                fill="#1A1A1A"
                fontFamily="system-ui, sans-serif"
              >
                {prize.label}
              </text>
            </g>
          </g>
        )
      })}

      <circle cx={cx} cy={cy} r={innerR} fill="white" />
      <circle cx={cx} cy={cy} r={innerR - 2} fill="url(#centerGrad)" />
      <defs>
        <radialGradient id="centerGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FFD166" />
          <stop offset="100%" stopColor="#FF8A00" />
        </radialGradient>
      </defs>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={30}>{MASCOT}</text>
    </svg>
  )
}

function todayKey() {
  return new Date().toLocaleDateString('en-MY')
}

export default function MiniGame() {
  const { card, refreshCard } = useCard()
  const [rotationDeg, setRotationDeg] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'spinning' | 'result'>('idle')
  const [prize, setPrize] = useState<{ prizeIndex: number; label: string; points: number } | null>(null)

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const spinKey = `spin_${card.uid}`
  const canSpin = localStorage.getItem(spinKey) !== todayKey()
  const isSpinning = phase === 'loading' || phase === 'spinning'

  async function handleSpin() {
    if (isSpinning || !canSpin) return

    setPhase('loading')
    setPrize(null)

    try {
      const result = await spinWheel(card!.uid)

      // Spin at least 4 full turns, then land on the prize segment's center
      const landingOffset = 360 - (result.prizeIndex * SEG + SEG / 2)
      const currentMod = rotationDeg % 360
      let diff = landingOffset - currentMod
      if (diff < 0) diff += 360
      diff += 4 * 360

      setRotationDeg(rotationDeg + diff)
      setPrize(result)
      setPhase('spinning')

      setTimeout(() => {
        setPhase('result')
        if (result.points > 0) refreshCard()
      }, 3600)
    } catch {
      setPhase('idle')
      toast.error('Spin failed — try again')
    }
  }

  function handleDismiss() {
    if (prize) localStorage.setItem(spinKey, todayKey())
    setPrize(null)
    setPhase('idle')
  }

  const points = Math.round((card.points_balance ?? 0) * 100)

  return (
    <section className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FF8A00] to-[#FFD166] px-6 pt-8 pb-16">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#FAFAFA] rounded-t-[2rem]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Dices size={22} className="text-white" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Daily Spin</h1>
          </div>
          <p className="text-white/80 text-sm">1 free spin every day — win points for your wallet!</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30">
            <Trophy size={14} className="text-white" />
            <span className="text-white font-bold text-sm">{points} pts</span>
            <span className="text-white/70 text-xs">current balance</span>
          </div>
        </div>
      </div>

      {/* Wheel area */}
      <div className="flex flex-col items-center px-6 -mt-2">
        {/* Pointer triangle */}
        <div className="relative z-10 mb-0">
          <div
            className="w-0 h-0 mx-auto"
            style={{
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '28px solid #FF8A00',
              filter: 'drop-shadow(0 4px 8px rgba(255,138,0,0.5))',
            }}
          />
        </div>

        {/* Wheel */}
        <div className="relative w-72 h-72 md:w-80 md:h-80">
          <motion.div
            className="w-full h-full"
            animate={{ rotate: rotationDeg }}
            transition={
              phase === 'spinning'
                ? { duration: 3.5, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0 }
            }
          >
            <SpinWheelSVG />
          </motion.div>

          {phase === 'loading' && (
            <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
          )}
        </div>

        {/* Spin button */}
        <motion.button
          onClick={handleSpin}
          disabled={isSpinning || !canSpin}
          whileHover={!isSpinning && canSpin ? { scale: 1.04 } : {}}
          whileTap={!isSpinning && canSpin ? { scale: 0.96 } : {}}
          className={`mt-6 px-10 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all ${
            !canSpin
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : isSpinning
              ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFD166] text-white opacity-70 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#FF8A00] to-[#FFD166] text-white cursor-pointer'
          }`}
        >
          {phase === 'loading'
            ? 'Picking your prize…'
            : phase === 'spinning'
            ? 'Spinning…'
            : canSpin
            ? 'Spin Now!'
            : 'Come back tomorrow'}
        </motion.button>

        {!canSpin && (
          <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
            <RotateCcw size={12} />
            Resets at midnight
          </p>
        )}
      </div>

      {/* Prize table */}
      <div className="mx-6 mt-8 bg-white rounded-[1.75rem] p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-orange-500" />
          <h2 className="font-bold text-sm text-[#1A1A1A]">Prize Table</h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PRIZES.map(p => (
            <div
              key={p.index}
              className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-100"
              style={{ background: p.color + '40' }}
            >
              <span className="text-[11px] font-bold text-[#1A1A1A] text-center">{p.label}</span>
              <span className="text-[10px] text-gray-400">
                {p.points === 0 ? 'No win' : `RM ${(p.points / 100).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Prize result modal */}
      <AnimatePresence>
        {phase === 'result' && prize && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDismiss}
              className="absolute inset-0 bg-[#1A1A1A]/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-white rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center"
            >
              {prize.points > 0 ? (
                <>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                    className="w-20 h-20 bg-gradient-to-br from-[#FF8A00] to-[#FFD166] rounded-full flex items-center justify-center mb-5 shadow-lg"
                  >
                    <Trophy size={36} className="text-white" />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-[#1A1A1A] mb-1">{prize.label}</h2>
                  <p className="text-[#6B7280] text-sm mb-2">added to your wallet!</p>
                  <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl mb-6">
                    <span className="text-orange-600 font-bold text-sm">
                      +RM {(prize.points / 100).toFixed(2)} balance
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.4, delay: 0.1 }}
                    className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5"
                  >
                    <RotateCcw size={32} className="text-gray-400" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1">Better luck next time!</h2>
                  <p className="text-[#6B7280] text-sm mb-6">Come back tomorrow for another spin.</p>
                </>
              )}
              <button
                onClick={handleDismiss}
                className="w-full py-3.5 bg-[#1A1A1A] text-white font-bold rounded-2xl shadow-md hover:bg-gray-800 transition-colors"
              >
                {prize.points > 0 ? 'Awesome!' : 'OK'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
