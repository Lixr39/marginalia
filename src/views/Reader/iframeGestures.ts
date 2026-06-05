/**
 * iframe gesture + selection handling using foliate-js's approach.
 *
 * Why this is so finicky on iOS Safari:
 * 1. `touch-action` must be set on the IFRAME ELEMENT in parent doc,
 *    NOT the iframe's body (gesture arbitration happens at iframe boundary)
 * 2. epubjs's themes inject into iframe body — useless for touch-action.
 *    Must reach in via the parent and set iframe.style.touchAction.
 * 3. velocity-based snap (vx = dx/dt) feels native; threshold-based feels broken.
 * 4. iOS native callout (Copy/Look Up) requires CSS injection inside iframe head
 *    AND can also be bypassed by programmatically building selections via
 *    caretRangeFromPoint (which is what foliate-js's annotator does).
 */

import type { Rendition } from 'epubjs'

interface SelectionPayload {
  text: string
  range: Range
  /** Position in PARENT viewport coordinates (already offset by iframe rect). */
  x: number
  y: number
}

interface SetupArgs {
  rendition: Rendition
  iframeContainer: HTMLElement
  fontSize: number
  cBg: string
  cText: string
  cAccent: string
  cSel: string
  onPrev: () => void
  onNext: () => void
  onSelection: (payload: SelectionPayload | null) => void
  /** Visual highlight overlay manager (epubjs annotations.add wrapper). */
  reapplyHighlights: () => void
}

const LONG_PRESS_MS = 450
const MOVE_TOL = 6
const SWIPE_VELOCITY = 0.3      // px / ms — anything above is a swipe
const SWIPE_MIN_DX = 30
const TAP_EDGE_PCT = 0.28
const VERTICAL_TOL = 40

/**
 * Inject the editorial styles + iOS-critical CSS into the iframe's <head>.
 * We bypass rendition.themes for properties that epubjs filters or that
 * iOS Safari needs at exact specificity.
 */
function injectStyles(doc: Document, args: Pick<SetupArgs, 'fontSize' | 'cBg' | 'cText' | 'cAccent' | 'cSel'>) {
  const { fontSize, cBg, cText, cAccent, cSel } = args
  let style = doc.getElementById('marginalia-style') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = 'marginalia-style'
    doc.head?.appendChild(style)
  }
  style.textContent = `
    html, body {
      -webkit-touch-callout: none !important;
    }
    body {
      font-family: Georgia, "Source Han Serif SC", "Songti SC", serif !important;
      font-size: ${fontSize}px !important;
      line-height: 1.75 !important;
      color: ${cText} !important;
      background: ${cBg} !important;
      padding: 0 6px !important;
      -webkit-user-select: text;
      user-select: text;
    }
    p { margin: 0.6em 0; text-indent: 2em; }
    h1, h2, h3, h4 {
      font-family: "Source Han Serif SC", "Songti SC", Georgia, serif;
      font-weight: 500;
      color: ${cText};
      text-indent: 0;
    }
    p:first-of-type::first-letter,
    h1 + p::first-letter, h2 + p::first-letter, h3 + p::first-letter {
      float: left;
      font-family: Georgia, "Source Han Serif SC", "Songti SC", serif;
      font-size: 3.4em;
      line-height: 0.9;
      margin: 0.05em 0.12em 0 0;
      color: ${cAccent};
    }
    ::selection { background: ${cSel}; }
  `
}

/** Get a Range at (x, y) in iframe-local coords. Falls back across browsers. */
function rangeAtPoint(doc: Document, x: number, y: number): Range | null {
  // webkit / safari
  const wk = doc as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null }
  if (typeof wk.caretRangeFromPoint === 'function') {
    return wk.caretRangeFromPoint(x, y)
  }
  // standard
  const std = doc as unknown as { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  if (typeof std.caretPositionFromPoint === 'function') {
    const c = std.caretPositionFromPoint(x, y)
    if (!c) return null
    const r = doc.createRange()
    r.setStart(c.offsetNode, c.offset)
    r.setEnd(c.offsetNode, c.offset)
    return r
  }
  return null
}

/** Expand a collapsed range to the surrounding word. */
function expandToWord(range: Range): Range {
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return range
  const text = (node as Text).data
  let start = range.startOffset
  let end = range.startOffset
  const isWordChar = (ch: string) =>
    /[\p{L}\p{N}一-鿿]/u.test(ch)  // letters, digits, CJK
  while (start > 0 && isWordChar(text[start - 1])) start--
  while (end < text.length && isWordChar(text[end])) end++
  const expanded = node.ownerDocument!.createRange()
  expanded.setStart(node, start)
  expanded.setEnd(node, end)
  return expanded
}

/**
 * Wire one iframe document for gestures + selection.
 * Returns cleanup fn.
 */
export function setupIframeGestures(
  doc: Document,
  win: Window,
  args: SetupArgs,
): () => void {
  const { iframeContainer, onPrev, onNext, onSelection } = args

  injectStyles(doc, args)

  // 1) touch-action on the iframe ELEMENT in parent — this is the critical
  // bit that lets iOS pass horizontal swipes to us instead of doing
  // edge-back gestures.
  const iframeEl = iframeContainer.querySelector('iframe') as HTMLIFrameElement | null
  if (iframeEl) {
    iframeEl.style.touchAction = 'pan-y'
  }

  // 2) Touch handlers with velocity-based swipe + manual long-press
  let startX = 0, startY = 0, startT = 0
  let lastX = 0, lastT = 0
  let moved = false
  let pressTimer: number | null = null

  const clearPress = () => {
    if (pressTimer !== null) {
      win.clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const computePayload = (range: Range): SelectionPayload | null => {
    const text = range.toString().trim()
    if (!text) return null
    const r = range.getBoundingClientRect()
    const ifrRect = iframeEl?.getBoundingClientRect()
    if (!ifrRect) return null
    return {
      text,
      range,
      x: ifrRect.left + r.left + r.width / 2,
      y: ifrRect.top + r.top,
    }
  }

  const triggerLongPress = (x: number, y: number) => {
    const range = rangeAtPoint(doc, x, y)
    if (!range) return
    const expanded = expandToWord(range)
    const sel = win.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(expanded)
    const payload = computePayload(expanded)
    if (payload) onSelection(payload)
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    startX = lastX = t.clientX
    startY = t.clientY
    startT = lastT = Date.now()
    moved = false
    clearPress()
    pressTimer = win.setTimeout(() => {
      if (!moved) triggerLongPress(startX, startY)
    }, LONG_PRESS_MS)
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - startX)
    const dy = Math.abs(t.clientY - startY)
    if (dx > MOVE_TOL || dy > MOVE_TOL) {
      moved = true
      clearPress()
    }
    lastX = t.clientX
    lastT = Date.now()
  }

  const onTouchEnd = (e: TouchEvent) => {
    clearPress()
    // If user has a selection going (either ours or theirs), don't navigate
    const selText = win.getSelection()?.toString().trim() ?? ''
    if (selText) {
      // Report selection to parent so we can show our bubble
      const sel = win.getSelection()
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null
      if (range) onSelection(computePayload(range))
      return
    }
    const t = e.changedTouches[0]
    const dx = t.clientX - startX
    const dy = Math.abs(t.clientY - startY)
    const dt = Date.now() - startT
    if (dt === 0) return

    // Velocity-based swipe (px / ms). Foliate-js's approach.
    // Use the recent velocity (last move → end) to avoid stalled-swipe false positives.
    const recentDx = t.clientX - lastX
    const recentDt = Math.max(1, Date.now() - lastT)
    const recentVx = recentDx / recentDt
    const overallVx = dx / dt

    if (moved && dy < VERTICAL_TOL && Math.abs(dx) >= SWIPE_MIN_DX) {
      // Prefer recent velocity, fall back to overall
      const vx = Math.abs(recentVx) > SWIPE_VELOCITY ? recentVx : overallVx
      if (vx < -SWIPE_VELOCITY) { onNext(); return }
      if (vx > SWIPE_VELOCITY) { onPrev(); return }
      // No clear velocity — fall back to distance threshold
      if (dx < -SWIPE_MIN_DX) { onNext(); return }
      if (dx > SWIPE_MIN_DX) { onPrev(); return }
    }

    // Short tap in left/right edge
    if (!moved && dt < 400) {
      const rect = doc.documentElement.getBoundingClientRect()
      const x = t.clientX - rect.left
      const w = rect.width
      if (x < w * TAP_EDGE_PCT) onPrev()
      else if (x > w * (1 - TAP_EDGE_PCT)) onNext()
    }
  }

  const onTouchCancel = () => {
    clearPress()
  }

  doc.addEventListener('touchstart', onTouchStart, { passive: true })
  doc.addEventListener('touchmove', onTouchMove, { passive: true })
  doc.addEventListener('touchend', onTouchEnd, { passive: true })
  doc.addEventListener('touchcancel', onTouchCancel, { passive: true })

  // 3) Watch selection changes (e.g., user dragging a selection handle)
  const onSelectionChange = () => {
    const sel = win.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!text) {
      onSelection(null)
      return
    }
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null
    if (range) onSelection(computePayload(range))
  }
  doc.addEventListener('selectionchange', onSelectionChange)

  return () => {
    clearPress()
    doc.removeEventListener('touchstart', onTouchStart)
    doc.removeEventListener('touchmove', onTouchMove)
    doc.removeEventListener('touchend', onTouchEnd)
    doc.removeEventListener('touchcancel', onTouchCancel)
    doc.removeEventListener('selectionchange', onSelectionChange)
  }
}
