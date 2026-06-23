import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Play } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { submitGameScore, type GameScoreResult } from '../lib/api'
import { useGameLoop } from '../lib/useGameLoop'
import { Celebration } from '../components/games/Celebration'
import { MASCOT } from '../lib/mascot'

type Phase = 'ready' | 'playing' | 'over'

interface Block { x: number; top: number; w: number }
interface Hopper { x: number; y: number; vx: number; vy: number; jumping: boolean }

interface World {
  w: number
  h: number
  ground: number      // baseline y where block tops sit relative to (block.top is absolute)
  blockH: number
  blocks: Block[]     // blocks[0] = current stand block, blocks[1] = target, ...
  hopper: Hopper
  charge: number      // 0..1 accumulated power while holding
  charging: boolean
  scrollX: number     // world scroll so the current block sits at a fixed left anchor
  scrollTarget: number
}

// Tuning
const MAX_CHARGE = 1.2          // seconds to full power
const MIN_DIST = 0.10           // min edge gap as fraction of width
const MAX_DIST = 0.34           // max edge gap as fraction of width
const POWER_TO_DIST = 0.74      // full-charge horizontal reach (fraction of width); must exceed max centre-to-centre gap
const GRAVITY = 2.6             // *h per s^2
const CENTER_FRAC = 0.18        // landing within this fraction of block centre = bonus

export default function BlockHop() {
  const { card } = useCard()
  const navigate = useNavigate()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<World | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const scoreRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [charge, setCharge] = useState(0)
  const [result, setResult] = useState<GameScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const anchorX = (w: number) => w * 0.26   // x where the current block is parked

  const makeBlock = useCallback((world: World, prevX: number, prevW: number): Block => {
    const { w } = world
    const gap = w * (MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST))
    const bw = w * (0.16 + Math.random() * 0.12)
    return { x: prevX + prevW / 2 + gap + bw / 2, top: world.ground, w: bw }
  }, [])

  const initWorld = useCallback((w: number, h: number): World => {
    const ground = h * 0.72
    const blockH = h * 0.22
    const firstW = w * 0.22
    const first: Block = { x: anchorX(w), top: ground, w: firstW }
    const world: World = {
      w, h, ground, blockH,
      blocks: [first],
      hopper: { x: first.x, y: ground, vx: 0, vy: 0, jumping: false },
      charge: 0,
      charging: false,
      scrollX: 0,
      scrollTarget: 0,
    }
    world.blocks.push(makeBlock(world, first.x, first.w))
    world.blocks.push(makeBlock(world, world.blocks[1].x, world.blocks[1].w))
    return world
  }, [makeBlock])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const world = worldRef.current
    if (!canvas || !world) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, blockH, scrollX } = world

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#5B21B6')
    sky.addColorStop(0.6, '#7C3AED')
    sky.addColorStop(1, '#C4B5FD')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Blocks
    for (let i = 0; i < world.blocks.length; i++) {
      const b = world.blocks[i]
      const bx = b.x - scrollX - b.w / 2
      // body
      ctx.fillStyle = i === 0 ? '#FCD34D' : '#F472B6'
      roundRect(ctx, bx, b.top, b.w, blockH, 10)
      ctx.fill()
      // top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      roundRect(ctx, bx, b.top, b.w, blockH * 0.18, 8)
      ctx.fill()
      // centre dot (aim helper) on target block
      if (i === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.beginPath()
        ctx.arc(bx + b.w / 2, b.top + blockH * 0.45, Math.max(3, b.w * 0.04), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Hopper (chick) — squashes while charging
    const hx = world.hopper.x - scrollX
    const hy = world.hopper.y
    const squash = world.charging ? 1 - Math.min(1, world.charge / MAX_CHARGE) * 0.32 : 1
    const size = h * 0.1
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(hx, world.ground + 2, size * 0.5, size * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.translate(hx, hy)
    ctx.scale(1 / squash, squash) // keep area-ish: wider when shorter
    ctx.font = `${size}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(MASCOT, 0, size * 0.1)
    ctx.restore()
  }, [])

  const endGame = useCallback(async () => {
    if (phaseRef.current === 'over') return
    setPhaseBoth('over')
    const finalScore = scoreRef.current
    if (!card) { setResult({ best: finalScore, isHighScore: false, newVouchers: [] }); return }
    setSubmitting(true)
    try {
      const res = await submitGameScore(card.uid, 'JUMP', finalScore)
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
    const { w, h } = world

    // Charging
    if (world.charging) {
      world.charge = Math.min(MAX_CHARGE, world.charge + dt)
      setCharge(world.charge / MAX_CHARGE)
    }

    // Camera ease toward target so the current block stays at the anchor
    world.scrollX += (world.scrollTarget - world.scrollX) * Math.min(1, dt * 8)

    // Hopper physics while jumping
    const hop = world.hopper
    if (hop.jumping) {
      hop.vy += GRAVITY * h * dt
      hop.x += hop.vx * dt
      hop.y += hop.vy * dt

      // Landing check once falling and at/under block top level
      if (hop.vy > 0 && hop.y >= world.ground) {
        const target = world.blocks[1]
        const half = target.w / 2
        if (Math.abs(hop.x - target.x) <= half) {
          // Landed
          hop.y = world.ground
          hop.jumping = false
          hop.vx = 0; hop.vy = 0

          const centred = Math.abs(hop.x - target.x) <= target.w * CENTER_FRAC
          scoreRef.current += centred ? 2 : 1
          setScore(scoreRef.current)

          // Advance: drop current, target becomes current, spawn a new far block
          world.blocks.shift()
          const last = world.blocks[world.blocks.length - 1]
          world.blocks.push(makeBlock(world, last.x, last.w))
          world.scrollTarget = world.blocks[0].x - anchorX(w)
        } else {
          // Missed — fall past the block then game over
          if (hop.y > h + h * 0.15) { draw(); endGame(); return }
        }
      } else if (hop.y > h + h * 0.15) {
        draw(); endGame(); return
      }
    }

    draw()
  }, [draw, endGame, makeBlock])

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

  const startCharge = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    if (phaseRef.current === 'ready') {
      setScore(0); scoreRef.current = 0; setResult(null)
      setPhaseBoth('playing')
    }
    if (phaseRef.current !== 'playing') return
    if (world.hopper.jumping) return
    world.charging = true
    world.charge = 0
    setCharge(0)
  }, [])

  const releaseJump = useCallback(() => {
    const world = worldRef.current
    if (!world || !world.charging) return
    world.charging = false
    const power = world.charge / MAX_CHARGE
    setCharge(0)
    const hop = world.hopper
    if (hop.jumping) return
    hop.jumping = true
    // Horizontal reach scales with charge; pick a flight time and derive vx/vy
    // so the arc apex looks good and reach = vx * t (symmetric parabola).
    const reach = world.w * POWER_TO_DIST * Math.max(0.12, power)
    const t = 0.62 + power * 0.25
    hop.vx = reach / t
    hop.vy = -0.5 * GRAVITY * world.h * t
  }, [])

  // Keyboard: hold Space to charge, release to jump
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) startCharge() }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); releaseJump() }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [startCharge, releaseJump])

  const restart = useCallback(() => {
    setResult(null)
    setScore(0); scoreRef.current = 0; setCharge(0)
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
        <h1 className="font-bold text-[#1A1A1A]">Block Hop</h1>
        <div className="w-16" />
      </div>

      {/* Game stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6">
        <div
          ref={wrapRef}
          onPointerDown={startCharge}
          onPointerUp={releaseJump}
          onPointerLeave={releaseJump}
          className="relative rounded-[1.75rem] overflow-hidden shadow-xl border border-violet-200 select-none touch-none cursor-pointer"
          style={{ width: 'min(92vw, calc((100dvh - 12rem) * 0.6667), 453px)', aspectRatio: '2 / 3' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Score */}
          {phase !== 'over' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] tabular-nums pointer-events-none">
              {score}
            </div>
          )}

          {/* Charge meter */}
          {phase === 'playing' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-2.5 rounded-full bg-white/30 overflow-hidden pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-[#FCD34D] to-[#F472B6] transition-[width] duration-75"
                style={{ width: `${Math.round(charge * 100)}%` }}
              />
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
                <motion.span
                  className="text-6xl mb-3 drop-shadow-lg select-none"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {MASCOT}
                </motion.span>
                <p className="font-bold text-[#1A1A1A] text-lg leading-tight">Block Hop</p>
                <p className="text-sm text-[#6B7280] mt-1.5 mb-4">Hold to charge, release to leap onto the next block. Land in the centre for bonus points!</p>
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#7C3AED] to-[#C4B5FD] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md"
                >
                  <Play size={15} className="fill-white" />
                  Hold to Start
                </motion.div>
                <p className="text-[10px] text-gray-400 mt-3">Hold = charge · Release = jump (or Space)</p>
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
