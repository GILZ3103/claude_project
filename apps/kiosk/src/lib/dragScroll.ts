// Press-and-drag scrolling for the kiosk touch panel.
//
// The USB touch panel reports to Chromium as a plain pointer, so the browser's
// native swipe/fling scrolling never engages — and with the scrollbars hidden
// there was no way left to scroll. This makes pressing anywhere and dragging
// scroll the nearest scrollable container. Pointer events are used so it works
// whether the input arrives as a mouse or as real touch.

const DRAG_THRESHOLD = 10 // px of movement before a press counts as a scroll (vs a tap)

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
  // Reset all per-gesture state up front so a previous drag can't leak into this
  // press. (Tapping a non-scrollable target — e.g. the Logout button — returns
  // early below; if `moved` were left set from the last scroll, onUp would wrongly
  // suppress this tap's click and the button would appear dead.)
  suppressClick = false
  moved = false
  dragging = false
  container = findScrollable(e.target as HTMLElement)
  if (!container) return
  dragging = true
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
  // Swallow the click the browser fires on release ONLY when the press actually
  // scrolled the container — not on raw pointer jitter (a cheap touch panel reports
  // several px on a stationary tap) and never on a tap with no scrollable target
  // (container is null), so buttons always stay tappable.
  if (container) {
    const scrolled = Math.abs(container.scrollTop - startTop) + Math.abs(container.scrollLeft - startLeft)
    if (scrolled > DRAG_THRESHOLD) suppressClick = true
  }
  dragging = false
  moved = false
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
