import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Play } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { Celebration } from '../components/games/Celebration'

type Phase = 'ready' | 'playing' | 'over'

const COLS = 9
const CAR_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#A855F7', '#F97316']

interface Car { x: number; w: number }
interface Lane { road: boolean; dir: 1 | -1; speed: number; cars: Car[] }

interface World {
  w: number
  h: number
  cell: number
  lanes: Map<number, Lane>
  col: number       // player column (int 0..COLS-1)
  lane: number      // player lane (int, increases forward/up)
  maxLane: number
  camera: number    // float lane mapped just below screen bottom
  scroll: number    // forced upward scroll speed (lanes/sec)
  hopT: number
}

export default function RotiRoad() {
  const { card } = useCard()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const scoreRef = useRef(0)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const downRef = useRef<{ x: number; y: number } | null>(null)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<GameScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.src = '/burger-mascot.png'
    img.onload = () => { imgRef.current = img }
  }, [])

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const makeLane = useCallback((world: World, idx: number): Lane => {
    // First 3 lanes are safe grass; then ~55% road.
    const road = idx > 3 && Math.random() < 0.55
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    const speed = world.w * (0.12 + Math.random() * 0.16)
    const cars: Car[] = []
    if (road) {
      const carW = world.cell * (1.2 + Math.random() * 0.8)
      const gap = world.cell * (2.4 + Math.random() * 2.0)
      for (let x = 0; x < world.w + carW; x += carW + gap) cars.push({ x, w: carW })
    }
    return { road, dir, speed, cars }
  }, [])

  const laneAt = useCallback((world: World, idx: number): Lane => {
    let l = world.lanes.get(idx)
    if (!l) { l = makeLane(world, idx); world.lanes.set(idx, l) }
    return l
  }, [makeLane])

  const initWorld = useCallback((w: number, h: number): World => {
    const cell = w / COLS
    const world: World = {
      w, h, cell,
      lanes: new Map(),
      col: Math.floor(COLS / 2),
      lane: 0,
      maxLane: 0,
      camera: -3,
      scroll: 0.35,
      hopT: 0,
    }
    // Pre-generate the opening lanes
    for (let i = -3; i < 16; i++) laneAt(world, i)
    return world
  }, [laneAt])

  // Screen Y for the bottom edge of a given lane row
  const laneScreenY = (world: World, idx: number) => world.h - (idx - world.camera + 1) * world.cell

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, cell } = world

    const topLane = Math.ceil(world.camera + h / cell) + 1
    const botLane = Math.floor(world.camera) - 1

    for (let idx = botLane; idx <= topLane; idx++) {
      const lane = laneAt(world, idx)
      const y = laneScreenY(world, idx) - cell  // top of the row
      // Lane background
      if (lane.road) {
        ctx.fillStyle = idx % 2 === 0 ? '#3F3F46' : '#52525B'
        ctx.fillRect(0, y, w, cell)
        // dashed center line
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.setLineDash([cell * 0.3, cell * 0.3])
        ctx.beginPath(); ctx.moveTo(0, y + cell / 2); ctx.lineTo(w, y + cell / 2); ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = idx % 2 === 0 ? '#34D399' : '#6EE7B7'
        ctx.fillRect(0, y, w, cell)
      }

      // Cars
      if (lane.road) {
        for (let ci = 0; ci < lane.cars.length; ci++) {
          const car = lane.cars[ci]
          const cx = car.x
          ctx.fillStyle = CAR_COLORS[(idx * 7 + ci) % CAR_COLORS.length]
          roundRect(ctx, cx, y + cell * 0.18, car.w, cell * 0.64, cell * 0.18)
          ctx.fill()
          // windshield
          ctx.fillStyle = 'rgba(255,255,255,0.6)'
          const ws = car.w * 0.22
          const wx = lane.dir > 0 ? cx + car.w - ws - cell * 0.12 : cx + cell * 0.12
          roundRect(ctx, wx, y + cell * 0.26, ws, cell * 0.46, cell * 0.08)
          ctx.fill()
        }
      }
    }

    // Player
    const px = (world.col + 0.5) * cell
    const py = laneScreenY(world, world.lane) - cell / 2
    const bounce = Math.sin(Math.min(1, world.hopT) * Math.PI) * cell * 0.18
    const r = cell * 0.42
    ctx.save()
    ctx.translate(px, py - bounce)
    const img = imgRef.current
    if (img) {
      ctx.drawImage(img, -r, -r, r * 2, r * 2)
    } else {
      ctx.font = `${r * 2}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🫓', 0, 0)
    }
    ctx.restore()
  }, [laneAt])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'ROAD', finalScore)
      setResult(res)
    } catch {
      setResult({ best: finalScore, isHighScore: false, newVouchers: [] })
    } finally {
      setSubmitting(false)
    }
  }, [card])

  const update = useCallback((dt: number) => {
    const world = worldRef.current
    if (!world) return
    const { w, cell } = world

    if (world.hopT > 0) world.hopT = Math.max(0, world.hopT - dt * 6)

    // Forced scroll ramps slowly with progress
    world.scroll = 0.35 + world.maxLane * 0.01
    const target = world.lane - 3
    // Camera eases toward target but never moves backward, and the forced scroll
    // pushes it up so idling is fatal.
    const eased = world.camera + (target - world.camera) * Math.min(1, dt * 4)
    world.camera = Math.max(eased, world.camera + world.scroll * dt)

    // Generate lanes ahead
    const topLane = Math.ceil(world.camera + world.h / cell) + 2
    for (let i = Math.floor(world.camera) - 1; i <= topLane; i++) laneAt(world, i)

    // Move cars + collision
    for (let idx = Math.floor(world.camera) - 1; idx <= topLane; idx++) {
      const lane = world.lanes.get(idx)
      if (!lane || !lane.road) continue
      for (const car of lane.cars) {
        car.x += lane.speed * lane.dir * dt
        if (lane.dir > 0 && car.x > w + car.w) car.x = -car.w
        if (lane.dir < 0 && car.x < -car.w) car.x = w + car.w
      }
    }

    // Collision on player's lane
    const playerLane = world.lanes.get(world.lane)
    if (playerLane?.road) {
      const px = (world.col + 0.5) * cell
      const pr = cell * 0.34
      for (const car of playerLane.cars) {
        if (px + pr > car.x && px - pr < car.x + car.w) { draw(); endGame(); return }
      }
    }

    // Fell below the scrolling view → caught
    if (world.lane < world.camera) { draw(); endGame(); return }

    draw()
  }, [draw, endGame, laneAt])

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

  const startIfReady = () => {
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setResult(null)
      setPhaseBoth('playing')
    }
  }

  const hopForward = useCallback(() => {
    const world = worldRef.current
    if (!world || phaseRef.current !== 'playing') return
    world.lane += 1
    world.hopT = 1
    if (world.lane > world.maxLane) {
      world.maxLane = world.lane
      scoreRef.current = world.maxLane
      setScore(scoreRef.current)
    }
  }, [])

  const moveSide = useCallback((d: number) => {
    const world = worldRef.current
    if (!world || phaseRef.current !== 'playing') return
    world.col = Math.max(0, Math.min(COLS - 1, world.col + d))
    world.hopT = 1
  }, [])

  const onDown = useCallback((e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onUp = useCallback((e: React.PointerEvent) => {
    const start = downRef.current
    downRef.current = null
    startIfReady()
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
      moveSide(dx > 0 ? 1 : -1)
    } else if (dy > 24) {
      // swipe down = step back (rarely useful, but allowed)
      const world = worldRef.current
      if (world) { world.lane -= 1; world.hopT = 1 }
    } else {
      hopForward()
    }
  }, [hopForward, moveSide])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); startIfReady(); hopForward() }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); moveSide(-1) }
      else if (e.code === 'ArrowRight') { e.preventDefault(); moveSide(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hopForward, moveSide])

  const restart = useCallback(() => {
    setResult(null)
    setScore(0); scoreRef.current = 0
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
        <h1 className="font-bold text-[#1A1A1A]">Roti Road</h1>
        <div className="w-16" />
      </div>

      {/* Game stage */}
      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerDown={onDown}
          onPointerUp={onUp}
          className="relative w-full max-w-[420px] aspect-[2/3] rounded-[1.75rem] overflow-hidden shadow-xl border border-emerald-200 select-none touch-none cursor-pointer"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Score */}
          {phase !== 'over' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] tabular-nums pointer-events-none">
              {score}
            </div>
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
                <motion.img
                  src="/burger-mascot.png"
                  alt=""
                  className="w-16 h-16 object-contain mb-3 drop-shadow-lg"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <p className="font-bold text-[#1A1A1A] text-lg leading-tight">Roti Road</p>
                <p className="text-sm text-[#6B7280] mt-1.5 mb-4">Tap to hop forward, swipe to dodge traffic. Don't get caught — keep moving!</p>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#22C55E] to-[#86EFAC] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md"
                >
                  <Play size={15} className="fill-white" />
                  Tap to Start
                </motion.div>
                <p className="text-[10px] text-gray-400 mt-3">Tap = hop · Swipe ← → = move</p>
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
