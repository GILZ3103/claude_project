import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Hand, Volume2, VolumeX } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { useGameMusic } from '../lib/useGameMusic'
import { Celebration } from '../components/games/Celebration'

type Phase = 'ready' | 'playing' | 'over'

interface Block { x: number; width: number }
interface Falling { x: number; y: number; w: number; h: number; vy: number; vx: number; rot: number; vr: number; color: string }

interface World {
  w: number
  h: number
  blockH: number
  topScreen: number
  blocks: Block[]
  moving: { x: number; width: number; vx: number }
  shift: number
  falling: Falling[]
}

const colorForLevel = (i: number) => `hsl(${(20 + i * 14) % 360}, 68%, 58%)`

export default function StackGame() {
  const { card } = useCard()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const scoreRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<GameScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { muted, toggleMuted } = useGameMusic(phase === 'playing')

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const initWorld = useCallback((w: number, h: number): World => {
    const blockH = h * 0.07
    const baseWidth = w * 0.6
    const base: Block = { x: (w - baseWidth) / 2, width: baseWidth }
    return {
      w, h, blockH,
      topScreen: h * 0.26,
      blocks: [base],
      moving: { x: 0, width: baseWidth, vx: w * 0.55 },
      shift: 0,
      falling: [],
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, blockH, topScreen, blocks, moving, shift, falling } = world

    // Background — deep slate so colourful blocks pop
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#2D2A3E')
    bg.addColorStop(1, '#141422')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    // soft top glow + faint stars
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, w * 0.7)
    glow.addColorStop(0, 'rgba(34,211,238,0.14)')
    glow.addColorStop(1, 'rgba(34,211,238,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 14; i++) {
      const sx = (((i * 71) % 100) / 100) * w
      const sy = (((i * 137) % 100) / 100) * h * 0.7
      ctx.fillStyle = `rgba(255,255,255,${0.06 + (i % 3) * 0.03})`
      ctx.fillRect(sx, sy, 2, 2)
    }

    const n = blocks.length

    // Placed blocks — colour + top gloss + bottom shade for depth
    for (let i = 0; i < n; i++) {
      const b = blocks[i]
      const y = topScreen + (n - i) * blockH - shift
      ctx.fillStyle = colorForLevel(i)
      roundRect(ctx, b.x, y, b.width, blockH - 2, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(b.x + 4, y + 3, b.width - 8, 3)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(b.x + 4, y + blockH - 6, b.width - 8, 3)
    }

    // Moving block (steady at topScreen)
    if (phaseRef.current === 'playing') {
      ctx.fillStyle = colorForLevel(n)
      roundRect(ctx, moving.x, topScreen, moving.width, blockH - 2, 6)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      roundRect(ctx, moving.x, topScreen, moving.width, blockH - 2, 6)
      ctx.stroke()
    }

    // Falling overhang slivers
    for (const f of falling) {
      ctx.save()
      ctx.translate(f.x + f.w / 2, f.y + f.h / 2)
      ctx.rotate(f.rot)
      ctx.fillStyle = f.color
      roundRect(ctx, -f.w / 2, -f.h / 2, f.w, f.h, 4)
      ctx.fill()
      ctx.restore()
    }
  }, [])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'STACK', finalScore)
      setResult(res)
    } catch {
      setResult({ best: finalScore, isHighScore: false, newVouchers: [] })
    } finally {
      setSubmitting(false)
    }
  }, [card])

  const drop = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const n = world.blocks.length
    const top = world.blocks[n - 1]
    const m = world.moving

    const overlapLeft = Math.max(m.x, top.x)
    const overlapRight = Math.min(m.x + m.width, top.x + top.width)
    const overlap = overlapRight - overlapLeft

    if (overlap <= 0) {
      // Total miss — whole block tumbles, game over
      world.falling.push({
        x: m.x, y: world.topScreen, w: m.width, h: world.blockH - 2,
        vy: -world.h * 0.1, vx: (m.x < world.w / 2 ? -1 : 1) * world.w * 0.2,
        rot: 0, vr: 4, color: colorForLevel(n),
      })
      draw()
      endGame()
      return
    }

    // Slice overhang into falling pieces (juice)
    if (m.x < overlapLeft) {
      const sw = overlapLeft - m.x
      world.falling.push({ x: m.x, y: world.topScreen, w: sw, h: world.blockH - 2, vy: 0, vx: -world.w * 0.18, rot: 0, vr: -5, color: colorForLevel(n) })
    }
    if (m.x + m.width > overlapRight) {
      const sw = m.x + m.width - overlapRight
      world.falling.push({ x: overlapRight, y: world.topScreen, w: sw, h: world.blockH - 2, vy: 0, vx: world.w * 0.18, rot: 0, vr: 5, color: colorForLevel(n) })
    }

    world.blocks.push({ x: overlapLeft, width: overlap })
    scoreRef.current = world.blocks.length - 1
    setScore(scoreRef.current)

    // New moving block: same width, enters from the alternating side, faster
    const fromLeft = world.blocks.length % 2 === 0
    const speed = Math.min(world.w * 1.15, world.w * 0.55 + scoreRef.current * 6)
    world.moving = { x: fromLeft ? 0 : world.w - overlap, width: overlap, vx: fromLeft ? speed : -speed }
    world.shift = world.blockH
    draw()
  }, [draw, endGame])

  const update = useCallback((dt: number) => {
    const world = worldRef.current
    if (!world) return
    const m = world.moving

    // Move + bounce
    m.x += m.vx * dt
    if (m.x < 0) { m.x = 0; m.vx = Math.abs(m.vx) }
    if (m.x + m.width > world.w) { m.x = world.w - m.width; m.vx = -Math.abs(m.vx) }

    // Ease camera shift toward 0
    world.shift += (0 - world.shift) * Math.min(1, dt * 12)
    if (Math.abs(world.shift) < 0.3) world.shift = 0

    // Falling pieces physics
    for (const f of world.falling) {
      f.vy += world.h * 2.6 * dt
      f.y += f.vy * dt
      f.x += f.vx * dt
      f.rot += f.vr * dt
    }
    world.falling = world.falling.filter(f => f.y < world.h + 80)

    draw()
  }, [draw])

  useGameLoop(update, phase === 'playing')

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const cssW = wrap.clientWidth
    const cssH = wrap.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    worldRef.current = initWorld(cssW, cssH)
    scoreRef.current = 0
    draw()
  }, [initWorld, draw])

  useEffect(() => {
    setupCanvas()
    const onResize = () => { if (phaseRef.current !== 'playing') setupCanvas() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setupCanvas])

  const tap = useCallback(() => {
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setResult(null)
      setPhaseBoth('playing')
      return
    }
    if (phaseRef.current === 'playing') drop()
  }, [drop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tap])

  const restart = useCallback(() => {
    setResult(null)
    setScore(0)
    scoreRef.current = 0
    if (worldRef.current) worldRef.current = initWorld(worldRef.current.w, worldRef.current.h)
    draw()
    setPhaseBoth('ready')
  }, [initWorld, draw])

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#1A1A1A]">
          <ArrowLeft size={18} /> Games
        </button>
        <h1 className="font-bold text-[#1A1A1A]">Stack Tower</h1>
        <button onClick={toggleMuted} aria-label={muted ? 'Unmute music' : 'Mute music'} className="w-16 flex justify-end text-[#6B7280] hover:text-[#1A1A1A]">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerDown={tap}
          className="relative rounded-[1.75rem] overflow-hidden shadow-xl border border-gray-200 select-none touch-none cursor-pointer"
          style={{ width: 'min(92vw, calc((100dvh - 12rem) * 0.6667), 453px)', aspectRatio: '2 / 3' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {phase !== 'over' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] tabular-nums pointer-events-none">
              {score}
            </div>
          )}

          {phase === 'ready' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/10 via-black/25 to-black/50 text-center px-6 pointer-events-none"
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                className="bg-white/95 backdrop-blur-sm rounded-[2rem] px-7 py-7 shadow-2xl border border-white/60 flex flex-col items-center max-w-[260px]"
              >
                <motion.div
                  className="flex flex-col items-center gap-1 mb-4"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="w-9 h-3.5 rounded bg-gradient-to-r from-[#3B82F6] to-[#6366F1] shadow-sm" />
                  <div className="w-12 h-3.5 rounded bg-gradient-to-r from-[#FF8A00] to-[#FFD166] shadow-sm" />
                  <div className="w-16 h-3.5 rounded bg-gradient-to-r from-[#22C55E] to-[#86EFAC] shadow-sm" />
                </motion.div>
                <p className="font-bold text-[#1A1A1A] text-lg leading-tight">Stack Tower</p>
                <p className="text-sm text-[#6B7280] mt-1.5 mb-4">Tap to drop blocks — line them up to stack higher!</p>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md"
                >
                  <Hand size={15} />
                  Tap to Drop
                </motion.div>
                <p className="text-[10px] text-gray-400 mt-3">or press Space / Enter</p>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {phase === 'over' && result && !submitting && (
        <Celebration
          score={score}
          best={result.best}
          isHighScore={result.isHighScore}
          vouchers={result.newVouchers}
          onPlayAgain={restart}
          onExit={() => navigate('/games')}
        />
      )}
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
