import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

interface Props {
  chapterTitle: string
  progressPct: number
  onAddBookmark: () => void
  onOpenDrawer: () => void
  onOpenToc: () => void
  onOpenDisplay: () => void
}

export function ChapterChrome({
  chapterTitle,
  progressPct,
  onAddBookmark,
  onOpenDrawer,
  onOpenToc,
  onOpenDisplay,
}: Props) {
  const nav = useNavigate()
  const [bmFlash, setBmFlash] = useState(false)

  return (
    <header className="reader__chrome">
      <button className="reader__back" onClick={() => nav('/')} aria-label="back to library">
        ← LIBRARY
      </button>
      <span className="reader__chrome-title">
        {chapterTitle ? `${chapterTitle} · ${progressPct}%` : `${progressPct}%`}
      </span>
      <span className="reader__chrome-actions">
        <button
          className="reader__icon-btn"
          onClick={onOpenToc}
          aria-label="table of contents"
        >
          ☰
        </button>
        <button
          className="reader__icon-btn"
          onClick={onOpenDisplay}
          aria-label="display settings"
          style={{ fontSize: 14 }}
        >
          Aa
        </button>
        <button
          className={'reader__icon-btn' + (bmFlash ? ' reader__icon-btn--toast' : '')}
          onClick={() => {
            onAddBookmark()
            setBmFlash(true)
            setTimeout(() => setBmFlash(false), 1000)
          }}
          aria-label="add bookmark"
        >
          ＋
        </button>
        <button
          className="reader__icon-btn"
          onClick={onOpenDrawer}
          aria-label="annotations"
          style={{ fontSize: 16 }}
        >
          ≡
        </button>
      </span>
    </header>
  )
}
