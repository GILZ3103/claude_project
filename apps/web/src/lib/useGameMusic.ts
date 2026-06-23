import { useEffect, useRef, useState } from 'react'

/**
 * Background music for the arcade games — synthesized at runtime with the Web
 * Audio API, so it's royalty-free, ships no audio asset, and works offline on
 * the kiosk. A light square-wave melody over a triangle bass, looping in C major
 * pentatonic so it never sounds dissonant.
 *
 * Pass `active` (true while the player is in a round). Returns `{ muted,
 * toggleMuted }` for a mute button. Music is ON by default; muting silences it
 * but keeps the loop running so unmuting resumes in time.
 */
const MELODY = [
  523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880.0, 783.99,
  659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33, 523.25,
]
// One bass note per 4 melody steps: C – F – G – C (I–IV–V–I).
const BASS = [130.81, 174.61, 196.0, 130.81]
const STEP = 0.18 // seconds per step

export function useGameMusic(active: boolean) {
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  mutedRef.current = muted

  useEffect(() => {
    if (!active) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    const ctx = new Ctx()
    const master = ctx.createGain()
    master.gain.value = 0.06
    master.connect(ctx.destination)
    ctx.resume?.() // a tap started the round, so sticky activation lets this run

    let step = 0
    const note = (freq: number, dur: number, type: OscillatorType, when: number, vol: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, when)
      g.gain.linearRampToValueAtTime(vol, when + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      o.connect(g)
      g.connect(master)
      o.start(when)
      o.stop(when + dur + 0.02)
    }

    const tick = () => {
      const i = step
      step = (step + 1) % MELODY.length
      if (mutedRef.current) return
      const when = ctx.currentTime + 0.03
      note(MELODY[i], STEP * 0.9, 'square', when, 0.9)
      if (i % 4 === 0) note(BASS[(i / 4) % BASS.length], STEP * 3, 'triangle', when, 1.2)
    }

    const id = window.setInterval(tick, STEP * 1000)
    return () => {
      window.clearInterval(id)
      ctx.close().catch(() => {})
    }
  }, [active])

  return { muted, toggleMuted: () => setMuted(m => !m) }
}
