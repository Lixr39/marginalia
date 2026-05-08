import { useNavigate } from 'react-router-dom'

interface Props {
  chapterTitle: string
  progressPct: number
}

export function ChapterChrome({ chapterTitle, progressPct }: Props) {
  const nav = useNavigate()
  return (
    <header className="reader__chrome">
      <button className="reader__back" onClick={() => nav('/')} aria-label="back to library">
        ← LIBRARY
      </button>
      <span className="reader__chrome-title">{chapterTitle || '—'}</span>
      <span className="reader__chrome-pct">{progressPct}%</span>
    </header>
  )
}
