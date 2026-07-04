import { useCallback, useEffect, useRef } from 'react'
import nightMarket from '../assets/night-market.png'

/**
 * Loads a shared Malaysia night-market (pasar malam) backdrop and returns a
 * stable `drawBackground` helper. The helper paints the image cover-fit and
 * lays a dark gradient over it (darker near the top) so gameplay elements and
 * the score stay readable. Returns `false` until the image has loaded so the
 * caller can fall back to its own gradient.
 */
export function useGameBackground(src: string = nightMarket) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => { loadedRef.current = true }
    img.src = src
    imgRef.current = img
    loadedRef.current = img.complete && img.naturalWidth > 0
    return () => { imgRef.current = null; loadedRef.current = false }
  }, [src])

  return useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, dim = 0.42) => {
    const img = imgRef.current
    if (!img || !loadedRef.current) return false

    // Cover-fit the image into the w×h stage.
    const ir = img.naturalWidth / img.naturalHeight
    const cr = w / h
    let dw: number, dh: number, dx: number, dy: number
    if (cr > ir) { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2 }
    else { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0 }
    ctx.drawImage(img, dx, dy, dw, dh)

    // Readability overlay — deep indigo, heavier at the top where UI sits.
    const ov = ctx.createLinearGradient(0, 0, 0, h)
    ov.addColorStop(0, `rgba(8,5,26,${Math.min(0.85, dim + 0.2)})`)
    ov.addColorStop(0.5, `rgba(10,6,30,${dim})`)
    ov.addColorStop(1, `rgba(10,6,30,${dim + 0.08})`)
    ctx.fillStyle = ov
    ctx.fillRect(0, 0, w, h)
    return true
  }, [])
}
