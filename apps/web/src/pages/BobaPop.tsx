import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Play } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { Celebration } from '../components/games/Celebration'

type Phase = 'ready' | 'playing' | 'over'

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#FFD166', '#A855F7']
const COLS = 8

interface Flying { x: number; y: number; vx: number; vy: number; color: number }

interface World {
  w: number
  h: number
  r: number
  rowH: number
  deadY: number
  maxRow: number
  grid: (number | null)[][]   // grid[row][col] = color index | null
  flying: Flying | null
  current: number
  next: number
  aim: number                 // radians, measured from +x; clamped to point upward
}

export default function BobaPop() {
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

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const rowLen = (row: number) => (row % 2 === 0 ? COLS : COLS - 1)

  const initWorld = useCallback((w: number, h: number): World => {
    const r = w / (2 * COLS)
    const rowH = r * 2 * 0.866
    const deadY = h - r * 4
    const maxRow = Math.floor((deadY - r) / rowH)
    const grid: (number | null)[][] = []
    const startRows = 5
    for (let row = 0; row < maxRow; row++) {
      const len = rowLen(row)
      grid[row] = new Array(len).fill(null)
      if (row < startRows) {
        for (let c = 0; c < len; c++) grid[row][c] = Math.floor(Math.random() * COLORS.length)
      }
    }
    return { w, h, r, rowH, deadY, maxRow, grid, flying: null, current: pickColor(grid), next: pickColor(grid), aim: -Math.PI / 2 }
  }, [])

  const center = (world: World, row: number, col: number) => ({
    x: world.r + col * 2 * world.r + (row % 2 === 1 ? world.r : 0),
    y: world.r + row * world.rowH,
  })

  const neighbors = (row: number, col: number): [number, number][] => {
    const odd = row % 2 === 1
    return odd
      ? [[row, col - 1], [row, col + 1], [row - 1, col], [row - 1, col + 1], [row + 1, col], [row + 1, col + 1]]
      : [[row, col - 1], [row, col + 1], [row - 1, col - 1], [row - 1, col], [row + 1, col - 1], [row + 1, col]]
  }

  const valid = (world: World, row: number, col: number) =>
    row >= 0 && row < world.maxRow && col >= 0 && col < rowLen(row)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, r, grid, flying, deadY } = world

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#1E293B')
    bg.addColorStop(1, '#334155')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Dead line
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'
    ctx.setLineDash([8, 6])
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, deadY); ctx.lineTo(w, deadY); ctx.stroke()
    ctx.setLineDash([])

    const drawBubble = (x: number, y: number, color: number) => {
      ctx.beginPath()
      ctx.arc(x, y, r - 1.5, 0, Math.PI * 2)
      ctx.fillStyle = COLORS[color]
      ctx.fill()
      // pearl highlight
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fill()
    }

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const c = grid[row][col]
        if (c == null) continue
        const p = center(world, row, col)
        drawBubble(p.x, p.y, c)
      }
    }

    // Launcher aim guide
    const lx = w / 2, ly = h - r * 1.6
    if (!flying && phaseRef.current === 'playing') {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 8])
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx + Math.cos(world.aim) * h, ly + Math.sin(world.aim) * h)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Flying bubble
    if (flying) drawBubble(flying.x, flying.y, flying.color)
    // Current + next in launcher
    drawBubble(lx, ly, world.current)
    ctx.globalAlpha = 0.7
    drawBubble(w - r * 1.4, h - r * 1.4, world.next)
    ctx.globalAlpha = 1
  }, [])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'BUBBLE', finalScore)
      setResult(res)
    } catch {
      setResult({ best: finalScore, isHighScore: false, newVouchers: [] })
    } finally {
      setSubmitting(false)
    }
  }, [card])

  const settle = useCallback((world: World, row: number, col: number) => {
    const color = world.grid[row][col]
    if (color == null) return

    // Same-color cluster via BFS
    const seen = new Set<string>()
    const stack: [number, number][] = [[row, col]]
    const cluster: [number, number][] = []
    while (stack.length) {
      const [r, c] = stack.pop()!
      const key = `${r},${c}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!valid(world, r, c) || world.grid[r][c] !== color) continue
      cluster.push([r, c])
      for (const [nr, nc] of neighbors(r, c)) stack.push([nr, nc])
    }

    if (cluster.length >= 3) {
      for (const [r, c] of cluster) world.grid[r][c] = null
      scoreRef.current += cluster.length
      // Drop now-floating bubbles (not connected to the top row)
      const connected = new Set<string>()
      const q: [number, number][] = []
      for (let c = 0; c < rowLen(0); c++) if (world.grid[0][c] != null) { q.push([0, c]); connected.add(`0,${c}`) }
      while (q.length) {
        const [r, c] = q.shift()!
        for (const [nr, nc] of neighbors(r, c)) {
          if (valid(world, nr, nc) && world.grid[nr][nc] != null && !connected.has(`${nr},${nc}`)) {
            connected.add(`${nr},${nc}`)
            q.push([nr, nc])
          }
        }
      }
      let dropped = 0
      for (let r = 0; r < world.grid.length; r++) {
        for (let c = 0; c < world.grid[r].length; c++) {
          if (world.grid[r][c] != null && !connected.has(`${r},${c}`)) { world.grid[r][c] = null; dropped++ }
        }
      }
      scoreRef.current += dropped * 2
      setScore(scoreRef.current)
    }

    // Loss check — any bubble at/below the dead line
    for (let r = 0; r < world.grid.length; r++) {
      for (let c = 0; c < world.grid[r].length; c++) {
        if (world.grid[r][c] != null && center(world, r, c).y + world.r >= world.deadY) { endGame(); return }
      }
    }

    // Next shot
    world.current = world.next
    world.next = pickColor(world.grid)
  }, [endGame])

  const snap = useCallback((world: World, fx: number, fy: number, color: number, hitRow: number, hitCol: number) => {
    // Candidate empty cells = neighbors of the collided cell (or row 0 if top hit)
    let candidates: [number, number][] = []
    if (hitRow < 0) {
      for (let c = 0; c < rowLen(0); c++) if (world.grid[0][c] == null) candidates.push([0, c])
    } else {
      for (const [nr, nc] of neighbors(hitRow, hitCol)) {
        if (valid(world, nr, nc) && world.grid[nr][nc] == null) candidates.push([nr, nc])
      }
    }
    if (candidates.length === 0) {
      // fallback: nearest empty supported cell anywhere
      for (let r = 0; r < world.grid.length; r++)
        for (let c = 0; c < world.grid[r].length; c++)
          if (world.grid[r][c] == null) candidates.push([r, c])
    }
    let best: [number, number] | null = null
    let bestD = Infinity
    for (const [r, c] of candidates) {
      const p = center(world, r, c)
      const d = Math.hypot(p.x - fx, p.y - fy)
      if (d < bestD) { bestD = d; best = [r, c] }
    }
    if (!best) { endGame(); return }
    world.grid[best[0]][best[1]] = color
    world.flying = null
    settle(world, best[0], best[1])
  }, [settle, endGame])

  const update = useCallback((dt: number) => {
    const world = worldRef.current
    if (!world || !world.flying) { draw(); return }
    const f = world.flying
    f.x += f.vx * dt
    f.y += f.vy * dt

    // Wall bounce
    if (f.x < world.r) { f.x = world.r; f.vx = Math.abs(f.vx) }
    if (f.x > world.w - world.r) { f.x = world.w - world.r; f.vx = -Math.abs(f.vx) }

    // Top hit
    if (f.y <= world.r) { snap(world, f.x, world.r, f.color, -1, -1); draw(); return }

    // Collision with any grid bubble
    for (let r = 0; r < world.grid.length; r++) {
      for (let c = 0; c < world.grid[r].length; c++) {
        if (world.grid[r][c] == null) continue
        const p = center(world, r, c)
        if (Math.hypot(p.x - f.x, p.y - f.y) <= world.r * 1.85) {
          snap(world, f.x, f.y, f.color, r, c)
          draw()
          return
        }
      }
    }
    draw()
  }, [draw, snap])

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

  const aimTo = useCallback((e: React.PointerEvent) => {
    const world = worldRef.current
    if (!world) return
    const rect = wrapRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const lx = world.w / 2, ly = world.h - world.r * 1.6
    let ang = Math.atan2(y - ly, x - lx)
    // Clamp to upward arc (between ~-160° and ~-20°)
    const min = -Math.PI * 0.92, max = -Math.PI * 0.08
    ang = Math.max(min, Math.min(max, ang))
    world.aim = ang
    if (phaseRef.current !== 'playing') draw()
  }, [draw])

  const fire = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setResult(null)
      setPhaseBoth('playing')
    }
    const world = worldRef.current
    if (!world || world.flying) { aimTo(e); return }
    aimTo(e)
    const speed = world.h * 1.5
    world.flying = {
      x: world.w / 2,
      y: world.h - world.r * 1.6,
      vx: Math.cos(world.aim) * speed,
      vy: Math.sin(world.aim) * speed,
      color: world.current,
    }
  }, [aimTo])

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
        <h1 className="font-bold text-[#1A1A1A]">Boba Pop</h1>
        <div className="w-16" />
      </div>

      {/* Game stage */}
      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerMove={aimTo}
          onPointerDown={fire}
          className="relative w-full max-w-[420px] aspect-[2/3] rounded-[1.75rem] overflow-hidden shadow-xl border border-slate-300 select-none touch-none cursor-pointer"
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
                <motion.div
                  className="text-5xl mb-3"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  🧋
                </motion.div>
                <p className="font-bold text-[#1A1A1A] text-lg leading-tight">Boba Pop</p>
                <p className="text-sm text-[#6B7280] mt-1.5 mb-4">Aim and tap to shoot. Match 3+ of a colour to pop them. Don't let them reach the line!</p>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md"
                >
                  <Play size={15} className="fill-white" />
                  Tap to Start
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

// Pick a color that still exists on the board (so shots stay useful); fallback random.
function pickColor(grid: (number | null)[][]): number {
  const present = new Set<number>()
  for (const row of grid) for (const c of row) if (c != null) present.add(c)
  const pool = present.size > 0 ? [...present] : COLORS.map((_, i) => i)
  return pool[Math.floor(Math.random() * pool.length)]
}
