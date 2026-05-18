import { useNavigate } from 'react-router-dom'
import { useRef } from 'react'

export interface BookEntryData {
  id: string
  title: string
  author: string
  cover?: string
  letter: string
  coverVariant: 1 | 2 | 3 | 4
  metaParts: string[]
  progressPct: number
  marginalia?: string
}

interface Props {
  data: BookEntryData
  onLongPress?: (id: string) => void
}

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 8

export function BookEntry({ data, onLongPress }: Props) {
  const { id, title, author, cover, letter, coverVariant, metaParts, progressPct, marginalia } = data
  const nav = useNavigate()

  const timerRef = useRef<number | null>(null)
  const startXY = useRef<{ x: number; y: number } | null>(null)
  const longFiredRef = useRef(false)

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    longFiredRef.current = false
    startXY.current = { x: e.clientX, y: e.clientY }
    timerRef.current = window.setTimeout(() => {
      longFiredRef.current = true
      onLongPress?.(id)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!startXY.current || timerRef.current === null) return
    const dx = e.clientX - startXY.current.x
    const dy = e.clientY - startXY.current.y
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancelTimer()
  }

  const onPointerUp = () => {
    cancelTimer()
  }

  const onClick = (e: React.MouseEvent) => {
    if (longFiredRef.current) {
      e.preventDefault()
      e.stopPropagation()
      longFiredRef.current = false
      return
    }
    nav(`/read/${id}`)
  }

  return (
    <article
      className="book-entry"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="book-entry__row">
        {cover ? (
          <img src={cover} alt={title} className="book-entry__cover-img" />
        ) : (
          <div className={`book-entry__cover book-entry__cover--c${coverVariant}`}>
            {letter}
          </div>
        )}
        <div className="book-entry__body">
          <h3 className="book-entry__title">{title}</h3>
          <div className="book-entry__author">{author}</div>
          {metaParts.length > 0 && (
            <div className="book-entry__meta">
              {metaParts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="book-entry__meta-em">—</span>}
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="book-entry__folio">
          <div className="book-entry__folio-num">{progressPct}</div>
          <div className="book-entry__folio-mark" />
          <div className="book-entry__folio-lbl">PCT</div>
        </div>
      </div>
      {marginalia && (
        <div className="book-entry__quote">{marginalia}</div>
      )}
    </article>
  )
}
