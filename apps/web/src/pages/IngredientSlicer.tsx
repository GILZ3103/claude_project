import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Play, Volume2, VolumeX } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { useGameMusic } from '../lib/useGameMusic'
import { Celebration } from '../components/games/Celebration'

type Phase = 'ready' | 'playing' | 'over'

const FOODS = ['🍅', '🥕', '🍆', '🌽', '🍌', '🍉', '🍓', '🥦', '🍤', '🍗', '🧅', '🥑']
const BOMB = '🌶️'

interface Item {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  rot: number
  vr: number
  emoji: string
  bomb: boolean
  sliced: boolean
}

interface Splash { x: number; y: number; t: number; color: string }
interface BladePt { x: number; y: number; t: number }

interface World {
  w: number
  h: number
  g: number
  items: Item[]
  splashes: Splash[]
  spawnT: number
  misses: number
  combo: number
  comboT: number
}

export default function IngredientSlicer() {
  const { card } = useCard()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const scoreRef = useRef(0)
  const bladeRef = useRef<BladePt[]>([])
  const slicingRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [result, setResult] = useState<GameScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { muted, toggleMuted } = useGameMusic(phase === 'playing')

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const initWorld = useCallback((w: number, h: number): World => ({
    w, h,
    g: h * 0.9,
    items: [],
    splashes: [],
    spawnT: 0,
    misses: 0,
    combo: 0,
    comboT: 0,
  }), [])

  const spawnWave = useCallback((world: World) => {
    const { w, h } = world
    const n = 1 + Math.floor(Math.random() * 3) // 1-3 items
    for (let i = 0; i < n; i++) {
      const bomb = Math.random() < 0.14
      const x = w * (0.15 + Math.random() * 0.7)
      const vx = (w * 0.5 - x) * (0.6 + Math.random() * 0.5) + (Math.random() * 2 - 1) * w * 0.15
      world.items.push({
        x,
        y: h + 30,
        vx,
        vy: -h * (1.05 + Math.random() * 0.25),
        r: Math.max(20, w * 0.075),
        rot: Math.random() * Math.PI,
        vr: (Math.random() * 2 - 1) * 4,
        emoji: bomb ? BOMB : FOODS[Math.floor(Math.random() * FOODS.length)],
        bomb,
        sliced: false,
      })
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, items, splashes } = world

    // Background — moody kitchen gradient with a soft spotlight
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#241D3A')
    bg.addColorStop(1, '#4C2A6B')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.75)
    glow.addColorStop(0, 'rgba(236,72,153,0.18)')
    glow.addColorStop(1, 'rgba(236,72,153,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // Splashes (juice bursts)
    for (const s of splashes) {
      const a = Math.max(0, s.t)
      ctx.globalAlpha = a * 0.7
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, (1 - a) * w * 0.12 + 6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Items
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const it of items) {
      ctx.save()
      ctx.translate(it.x, it.y)
      ctx.rotate(it.rot)
      ctx.font = `${it.r * 2}px serif`
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = it.r * 0.4
      ctx.shadowOffsetY = it.r * 0.18
      ctx.fillText(it.emoji, 0, 0)
      ctx.restore()
    }

    // Blade trail
    const blade = bladeRef.current
    if (blade.length > 1) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < blade.length; i++) {
        const t = i / blade.length
        ctx.strokeStyle = `rgba(255,255,255,${t * 0.9})`
        ctx.lineWidth = t * 9 + 1
        ctx.beginPath()
        ctx.moveTo(blade[i - 1].x, blade[i - 1].y)
        ctx.lineTo(blade[i].x, blade[i].y)
        ctx.stroke()
      }
    }
  }, [])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'SLICER', finalScore)
      setResult(res)
    } catch {
      setResult({ best: finalScore, isHighScore: false, newVouchers: [] })
    } finally {
      setSubmitting(false)
    }
  }, [card])

  // Distance from point P to segment AB
  const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    let t = ((px - ax) * dx + (py - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx, cy = ay + t * dy
    return Math.hypot(px - cx, py - cy)
  }

  const sliceAt = useCallback((ax: number, ay: number, bx: number, by: number) => {
    const world = worldRef.current
    if (!world || phaseRef.current !== 'playing') return
    for (const it of world.items) {
      if (it.sliced) continue
      if (segDist(it.x, it.y, ax, ay, bx, by) <= it.r * 0.85) {
        it.sliced = true
        if (it.bomb) {
          world.splashes.push({ x: it.x, y: it.y, t: 1, color: '#EF4444' })
          draw()
          endGame()
          return
        }
        // Combo: chained slices within 600ms multiply the reward
        world.combo = world.comboT > 0 ? world.combo + 1 : 1
        world.comboT = 0.6
        const gain = 1 + Math.floor(world.combo / 2)
        scoreRef.current += gain
        setScore(scoreRef.current)
        world.splashes.push({ x: it.x, y: it.y, t: 1, color: '#FFD166' })
      }
    }
    // Drop sliced food items (keep bombs handled above already)
    world.items = world.items.filter(it => !it.sliced)
  }, [draw, endGame])

  const update = useCallback((dt: number) => {
    const world = worldRef.current
    if (!world) return
    const { h } = world

    // Spawn waves, faster as score grows
    world.spawnT -= dt
    if (world.spawnT <= 0) {
      spawnWave(world)
      world.spawnT = Math.max(0.55, 1.3 - scoreRef.current * 0.01)
    }

    // Combo timer
    if (world.comboT > 0) world.comboT -= dt
    else world.combo = 0

    // Physics
    for (const it of world.items) {
      it.vy += world.g * dt
      it.x += it.vx * dt
      it.y += it.vy * dt
      it.rot += it.vr * dt
    }

    // Missed food (fell back below the bottom while moving down)
    const before = world.items.length
    world.items = world.items.filter(it => {
      const gone = it.y - it.r > h + 40 && it.vy > 0
      if (gone && !it.bomb) {
        world.misses += 1
      }
      return !gone
    })
    if (world.items.length !== before) setMisses(world.misses)
    if (world.misses >= 3) { draw(); endGame(); return }

    // Splash decay
    for (const s of world.splashes) s.t -= dt * 2.2
    world.splashes = world.splashes.filter(s => s.t > 0)

    // Trim blade trail to recent points
    const now = performance.now()
    bladeRef.current = bladeRef.current.filter(p => now - p.t < 110)

    draw()
  }, [draw, endGame, spawnWave])

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

  const localPoint = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setMisses(0); setResult(null)
      setPhaseBoth('playing')
    }
    slicingRef.current = true
    const p = localPoint(e)
    bladeRef.current = [{ x: p.x, y: p.y, t: performance.now() }]
  }, [])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!slicingRef.current) return
    const p = localPoint(e)
    const blade = bladeRef.current
    const prev = blade[blade.length - 1]
    blade.push({ x: p.x, y: p.y, t: performance.now() })
    if (prev) sliceAt(prev.x, prev.y, p.x, p.y)
  }, [sliceAt])

  const onUp = useCallback(() => {
    slicingRef.current = false
    bladeRef.current = []
  }, [])

  const restart = useCallback(() => {
    setResult(null)
    setScore(0); scoreRef.current = 0; setMisses(0)
    if (worldRef.current) worldRef.current = initWorld(worldRef.current.w, worldRef.current.h)
    draw()
    setPhaseBoth('ready')
  }, [initWorld, draw])

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#1A1A1A]">
          <ArrowLeft size={18} /> Games
        </button>
        <h1 className="font-bold text-[#1A1A1A]">Ingredient Slicer</h1>
        <button onClick={toggleMuted} aria-label={muted ? 'Unmute music' : 'Mute music'} className="w-16 flex justify-end text-[#6B7280] hover:text-[#1A1A1A]">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Game stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
          className="relative rounded-[1.75rem] overflow-hidden shadow-xl border border-purple-200 select-none touch-none cursor-crosshair"
          style={{ width: 'min(92vw, calc((100dvh - 12rem) * 0.6667), 453px)', aspectRatio: '2 / 3' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Score + lives */}
          {phase !== 'over' && (
            <>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] tabular-nums pointer-events-none">
                {score}
              </div>
              <div className="absolute top-5 right-4 flex gap-1 pointer-events-none">
                {[0, 1, 2].map(i => (
                  <span key={i} className={`text-lg ${i < 3 - misses ? '' : 'grayscale opacity-40'}`}>❤️</span>
                ))}
              </div>
            </>
          )}

          {/* Ready overlay */}
          {phase === 'ready' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/20 via-black/30 to-black/55 text-center px-6"
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                className="bg-white/95 backdrop-blur-sm rounded-[2rem] px-7 py-7 shadow-2xl border border-white/60 flex flex-col items-center max-w-[280px]"
              >
                <motion.div
                  className="text-5xl mb-3"
                  animate={{ rotate: [0, -12, 12, -8, 0], y: [0, -8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  🔪
                </motion.div>
                <p className="font-bold text-[#1A1A1A] text-lg leading-tight">Ingredient Slicer</p>
                <p className="text-sm text-[#6B7280] mt-1.5 mb-4">Swipe to slice the ingredients — but never the chili 🌶️! Miss 3 and you're out.</p>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md"
                >
                  <Play size={15} className="fill-white" />
                  Swipe to Start
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Celebration / game over */}
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
