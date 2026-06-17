import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { Celebration } from '../components/games/Celebration'

type Phase = 'ready' | 'playing' | 'over'

interface Pipe {
  x: number
  gapY: number
  passed: boolean
}

interface World {
  w: number
  h: number
  groundH: number
  birdX: number
  birdR: number
  birdY: number
  birdVy: number
  pipes: Pipe[]
  speed: number
}

export default function FlappyGame() {
  const { card } = useCard()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const scoreRef = useRef(0)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<GameScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load the mascot sprite once
  useEffect(() => {
    const img = new Image()
    img.src = '/burger-mascot.png'
    img.onload = () => { imgRef.current = img }
  }, [])

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const initWorld = useCallback((w: number, h: number): World => {
    const groundH = h * 0.08
    return {
      w, h, groundH,
      birdX: w * 0.28,
      birdR: Math.max(14, w * 0.05),
      birdY: h * 0.45,
      birdVy: 0,
      pipes: [],
      speed: w * 0.6,
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, groundH, birdX, birdY, birdR, birdVy, pipes } = world

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#FFE9C7')
    sky.addColorStop(1, '#FFD166')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Pipes — satay sticks (warm brown skewers)
    for (const p of pipes) {
      const pw = w * 0.16
      const gap = h * 0.30
      const topH = p.gapY - gap / 2
      const botY = p.gapY + gap / 2
      ctx.fillStyle = '#B5651D'
      roundRect(ctx, p.x, 0, pw, topH, 8)
      ctx.fill()
      roundRect(ctx, p.x, botY, pw, h - groundH - botY, 8)
      ctx.fill()
      // grill bands
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      for (let yy = 14; yy < topH; yy += 22) ctx.fillRect(p.x, yy, pw, 5)
      for (let yy = botY + 14; yy < h - groundH; yy += 22) ctx.fillRect(p.x, yy, pw, 5)
    }

    // Ground
    ctx.fillStyle = '#8B5A2B'
    ctx.fillRect(0, h - groundH, w, groundH)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(0, h - groundH, w, 4)

    // Bird (burger mascot)
    ctx.save()
    ctx.translate(birdX, birdY)
    ctx.rotate(Math.max(-0.5, Math.min(0.9, birdVy / 600)))
    const img = imgRef.current
    if (img) {
      ctx.drawImage(img, -birdR, -birdR, birdR * 2, birdR * 2)
    } else {
      ctx.fillStyle = '#FF8A00'
      ctx.beginPath()
      ctx.arc(0, 0, birdR, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }, [])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'FLAPPY', finalScore)
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
    const { w, h, groundH } = world
    const gap = h * 0.30
    const pw = w * 0.16
    const spacing = w * 0.62

    // Physics
    world.birdVy += h * 3.0 * dt
    world.birdY += world.birdVy * dt
    if (world.birdY < world.birdR) { world.birdY = world.birdR; world.birdVy = 0 }

    // Speed ramps gently with score
    world.speed = Math.min(w * 1.1, w * 0.6 + scoreRef.current * 3)

    // Move + spawn pipes
    for (const p of world.pipes) p.x -= world.speed * dt
    const last = world.pipes[world.pipes.length - 1]
    if (!last || last.x <= w - spacing) {
      const margin = gap / 2 + 24
      const gapY = margin + Math.random() * (h - groundH - margin * 2)
      world.pipes.push({ x: w, gapY, passed: false })
    }
    world.pipes = world.pipes.filter(p => p.x + pw > -4)

    // Score + collisions
    const bx = world.birdX, by = world.birdY, br = world.birdR
    for (const p of world.pipes) {
      if (!p.passed && p.x + pw < bx) { p.passed = true; scoreRef.current += 1; setScore(scoreRef.current) }
      const inX = bx + br > p.x && bx - br < p.x + pw
      if (inX) {
        const topH = p.gapY - gap / 2
        const botY = p.gapY + gap / 2
        if (by - br < topH || by + br > botY) { draw(); endGame(); return }
      }
    }

    // Ground hit
    if (by + br >= h - groundH) { world.birdY = h - groundH - br; draw(); endGame(); return }

    draw()
  }, [draw, endGame])

  useGameLoop(update, phase === 'playing')

  // Size the canvas to its wrapper (crisp via devicePixelRatio)
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

  const flap = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setResult(null)
      setPhaseBoth('playing')
    }
    if (phaseRef.current === 'playing') {
      world.birdVy = -world.h * 0.62
    }
  }, [])

  // Keyboard: Space / ArrowUp to flap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

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
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#1A1A1A]">
          <ArrowLeft size={18} /> Games
        </button>
        <h1 className="font-bold text-[#1A1A1A]">Flappy Burger</h1>
        <div className="w-16" />
      </div>

      {/* Game stage */}
      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerDown={flap}
          className="relative w-full max-w-[420px] aspect-[2/3] rounded-[1.75rem] overflow-hidden shadow-xl border border-orange-100 select-none touch-none cursor-pointer"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Score */}
          {phase !== 'over' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] tabular-nums pointer-events-none">
              {score}
            </div>
          )}

          {/* Ready overlay */}
          {phase === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15 text-center px-6 pointer-events-none">
              <div className="bg-white/95 rounded-3xl px-6 py-5 shadow-lg">
                <Play size={32} className="text-orange-500 mx-auto mb-2" />
                <p className="font-bold text-[#1A1A1A]">Tap, click, or press Space</p>
                <p className="text-sm text-[#6B7280] mt-1">Flap the burger through the satay sticks!</p>
              </div>
            </div>
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
