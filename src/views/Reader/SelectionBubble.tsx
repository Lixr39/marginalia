interface Props {
  x: number
  y: number
  characterName: string
  onHighlight: () => void
  onNote: () => void
  onAskAI: () => void
}

export function SelectionBubble({ x, y, characterName, onHighlight, onNote, onAskAI }: Props) {
  // place above the touch point by default; if not enough room, below
  const bubbleH = 38
  const above = y > bubbleH + 24
  const top = above ? y - bubbleH - 10 : y + 18
  const left = Math.max(12, Math.min(window.innerWidth - 240, x - 100))

  return (
    <div
      className={'sel-bubble' + (above ? '' : ' sel-bubble--below')}
      style={{ left, top }}
      role="toolbar"
      onPointerDown={e => e.stopPropagation()}
    >
      <button className="sel-bubble__btn" aria-label="highlight" onClick={onHighlight}>
        🖍️
      </button>
      <span className="sel-bubble__divider" />
      <button className="sel-bubble__btn" aria-label="note" onClick={onNote}>
        📝
      </button>
      <span className="sel-bubble__divider" />
      <button className="sel-bubble__btn sel-bubble__btn--primary" onClick={onAskAI}>
        问 {characterName} →
      </button>
    </div>
  )
}
