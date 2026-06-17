import { useEffect, useRef } from 'react'

/**
 * Shared requestAnimationFrame loop for the canvas mini-games.
 *
 * - Calls `callback(dt)` once per frame, where `dt` is seconds since the last
 *   frame (clamped) so movement is frame-rate independent.
 * - Auto-pauses when the tab is hidden (visibilitychange) and resumes on return.
 * - Cancels the rAF on unmount or when `running` flips false — no runaway loops.
 *
 * `callbackRef` indirection lets the game pass a fresh closure each render
 * without restarting the loop.
 */
export function useGameLoop(callback: (dt: number) => void, running: boolean) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!running) return

    let frameId = 0
    let last = performance.now()
    let paused = false

    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick)
      if (paused) {
        last = now
        return
      }
      // Clamp dt so a backgrounded tab or a long frame can't teleport entities.
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      callbackRef.current(dt)
    }

    const onVisibility = () => {
      paused = document.hidden
      if (!paused) last = performance.now()
    }

    document.addEventListener('visibilitychange', onVisibility)
    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [running])
}
