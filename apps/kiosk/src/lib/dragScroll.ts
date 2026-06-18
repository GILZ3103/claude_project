// Press-and-drag scrolling for the kiosk touch panel.
//
// The USB touch panel reports to Chromium as a plain pointer, so the browser's
// native swipe/fling scrolling never engages — and with the scrollbars hidden
// there was no way left to scroll. This makes pressing anywhere and dragging
// scroll the nearest scrollable container. Pointer events are used so it works
// whether the input arrives as a mouse or as real touch.

const DRAG_THRESHOLD = 6 // px of movement before a press counts as a scroll (vs a tap)

let dragging = false
let moved = false
let startX = 0
let startY = 0
let startLeft = 0
let startTop = 0
let container: HTMLElement | null = null
let suppressClick = false

function findScrollable(el: HTMLElement | null): HTMLElement | null {
  while (el && el !== document.body && el !== document.documentElement) {
    const s = getComputedStyle(el)
    const canY = (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight
    const canX = (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth
    if (canY || canX) return el
    el = el.parentElement
  }
  return null
}

function onDown(e: PointerEvent) {
  if (e.button && e.button !== 0) return
  suppressClick = false
  container = findScrollable(e.target as HTMLElement)
  if (!container) return
  dragging = true
  moved = false
  startX = e.clientX
  startY = e.clientY
  startLeft = container.scrollLeft
  startTop = container.scrollTop
}

function onMove(e: PointerEvent) {
  if (!dragging || !container) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true
  if (moved) {
    container.scrollTop = startTop - dy
    container.scrollLeft = startLeft - dx
  }
}

function onUp() {
  // If the press turned into a drag, swallow the click the browser fires on
  // release so dragging across a button doesn't activate it.
  if (moved) suppressClick = true
  dragging = false
  container = null
}

// Always-on capture listener; only acts when a drag just happened.
window.addEventListener(
  'click',
  (e) => {
    if (suppressClick) {
      e.stopPropagation()
      e.preventDefault()
      suppressClick = false
    }
  },
  true,
)

window.addEventListener('pointerdown', onDown, { passive: true })
window.addEventListener('pointermove', onMove, { passive: true })
window.addEventListener('pointerup', onUp, { passive: true })
window.addEventListener('pointercancel', onUp, { passive: true })

export {}
