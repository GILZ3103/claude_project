import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Trophy, RotateCcw, Gift } from 'lucide-react'

interface NewVoucher {
  milestone: number
  discount_value: number
}

interface CelebrationProps {
  score: number
  best: number
  isHighScore: boolean
  vouchers: NewVoucher[]
  onPlayAgain: () => void
  onExit: () => void
}

/**
 * Shared "win moment" overlay for all skill games.
 *
 * The burger mascot does a Pigeon-Pop-style victory dance (bounce / wiggle /
 * squash-stretch / spin) when the run is a new high score, with a capped
 * confetti burst and an animated score count-up. On a non-high-score run it
 * shows a gentle "try again" state. Newly earned milestone vouchers are listed.
 *
 * Pure transform/particle animation via motion/react — no canvas, no lag.
 */
export function Celebration({ score, best, isHighScore, vouchers, onPlayAgain, onExit }: CelebrationProps) {
  const win = isHighScore || vouchers.length > 0

  // Animated score count-up
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const dur = 700
    const step = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])

  // Confetti — generated once, capped count for performance
  const confetti = useMemo(
    () =>
      Array.from({ length: win ? 56 : 0 }, (_, i) => ({
        id: i,
        x: (Math.random() * 2 - 1) * 160,
        rot: Math.random() * 360,
        delay: Math.random() * 0.25,
        dur: 1.1 + Math.random() * 0.9,
        color: ['#FF8A00', '#FFD166', '#3B82F6', '#22C55E', '#EF4444', '#A855F7'][i % 6],
        size: 7 + Math.random() * 7,
      })),
    [win]
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-[#1A1A1A]/55 backdrop-blur-sm"
        onClick={onExit}
      />

      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
        {confetti.map(c => (
          <motion.div
            key={c.id}
            initial={{ y: -40, x: c.x, opacity: 1, rotate: 0 }}
            animate={{ y: '105vh', rotate: c.rot + 540, opacity: [1, 1, 0.9, 0] }}
            transition={{ duration: c.dur, delay: c.delay, ease: 'easeIn' }}
            style={{ position: 'absolute', top: '18%', width: c.size, height: c.size * 0.6, background: c.color, borderRadius: 2 }}
          />
        ))}
      </div>

      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.35 }}
        className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center"
      >
        {/* Dancing burger mascot */}
        <motion.div
          className="w-28 h-28 mb-2"
          animate={
            win
              ? {
                  y: [0, -18, 0, -10, 0],
                  rotate: [0, -12, 12, -8, 8, 0],
                  scaleX: [1, 1.12, 0.9, 1.06, 1],
                  scaleY: [1, 0.9, 1.12, 0.96, 1],
                }
              : { rotate: [0, -6, 6, 0], y: [0, -4, 0] }
          }
          transition={{ duration: win ? 0.9 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src="/burger-mascot.png" alt="" className="w-full h-full object-contain drop-shadow-lg" />
        </motion.div>

        {win ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={20} className="text-orange-500" />
              <h2 className="text-2xl font-bold text-[#1A1A1A]">
                {isHighScore ? 'New High Score!' : 'Nice run!'}
              </h2>
            </div>
            <p className="text-[#6B7280] text-sm">You scored</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw size={18} className="text-gray-400" />
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Good try!</h2>
            </div>
            <p className="text-[#6B7280] text-sm">You scored</p>
          </>
        )}

        <div className="text-6xl font-bold tracking-tight text-[#1A1A1A] my-1 tabular-nums">{shown}</div>
        <p className="text-xs text-[#6B7280] mb-5">Best: {Math.max(best, score)}</p>

        {/* New voucher rewards */}
        {vouchers.length > 0 && (
          <div className="w-full space-y-2 mb-5">
            {vouchers.map(v => (
              <motion.div
                key={v.milestone}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.4, delay: 0.2 }}
                className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-orange-500" />
                  <span className="text-sm font-semibold text-[#1A1A1A]">Reached {v.milestone}!</span>
                </div>
                <span className="text-sm font-bold text-orange-600">+RM {v.discount_value.toFixed(2)} voucher</span>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button
            onClick={onExit}
            className="flex-1 py-3.5 rounded-2xl font-semibold bg-gray-100 text-[#1A1A1A] hover:bg-gray-200 transition-colors"
          >
            Exit
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-[#FF8A00] to-[#FFD166] shadow-md hover:shadow-lg transition-shadow"
          >
            Play Again
          </button>
        </div>
      </motion.div>
    </div>
  )
}
