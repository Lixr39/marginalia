import { useState } from 'react'
import type { BookRating, Highlight } from '../../types'
import type { StoredBook } from '../../store'
import ReactMarkdown from 'react-markdown'
import './BookProfile.css'

interface Props {
  book: StoredBook
  onClose: () => void
  onRatingSaved: (rating: BookRating) => void
  onHighlightsSaved: (highlights: Highlight[]) => void
  theme?: 'dark' | 'light'
}

export default function BookProfile({ book, onClose, onRatingSaved, onHighlightsSaved, theme }: Props) {
  const state = book.bookState
  const [phase, setPhase] = useState<'overview' | 'done'>('overview')
  const [hoveredStar, setHoveredStar] = useState(0)

  // Notes drawer
  const [showNotes, setShowNotes] = useState(false)
  const [localHighlights, setLocalHighlights] = useState<Highlight[]>(state.highlights || [])

  const msgCount = state.messages?.length || 0
  const hlCount = state.highlights?.length || 0
  const cardCount = state.opinionCards?.length || 0
  const agreedCount = state.opinionCards?.filter(c => c.userStance === 'agree').length || 0
  const charName = (() => {
    if (!state.characterId) return '（未开始）'
    const sessions = state.sessions || []
    const last = sessions[sessions.length - 1]
    return last?.characterName || state.characterId
  })()

  const existingRating = state.rating
  const displayStars = hoveredStar || existingRating?.stars || 0

  function handleStarClick(e: React.MouseEvent<HTMLSpanElement>, starIdx: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const half = (e.clientX - rect.left) < rect.width / 2
    const value = half ? starIdx - 0.5 : starIdx
    const rating: BookRating = { stars: value, timestamp: Date.now() }
    onRatingSaved(rating)
    setPhase('done')
    setHoveredStar(0)
  }

  function handleMouseMoveStar(e: React.MouseEvent<HTMLSpanElement>, starIdx: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const half = (e.clientX - rect.left) < rect.width / 2
    setHoveredStar(half ? starIdx - 0.5 : starIdx)
  }

  function renderStars(interactive: boolean) {
    return (
      <div className="bp-stars">
        {[1, 2, 3, 4, 5].map(i => {
          const filled = displayStars >= i ? 'full' : displayStars >= i - 0.5 ? 'half' : 'empty'
          return (
            <span
              key={i}
              className={`bp-star ${filled}${interactive ? ' interactive' : ''}`}
              onMouseMove={interactive ? (e) => handleMouseMoveStar(e, i) : undefined}
              onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
              onClick={interactive ? (e) => handleStarClick(e, i) : undefined}
            >
              ★
            </span>
          )
        })}
        {displayStars > 0 && <span className="bp-star-value">{displayStars}</span>}
      </div>
    )
  }

  // Notes drawer handlers
  function handleNoteChange(id: string, note: string) {
    setLocalHighlights(prev => prev.map(h => h.id === id ? { ...h, note } : h))
  }

  function handleDeleteHighlight(id: string) {
    setLocalHighlights(prev => prev.filter(h => h.id !== id))
  }

  function handleAddNote() {
    const newNote: Highlight = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfiRange: '',
      text: '',
      note: '',
      color: 'rgba(240,160,184,0.3)',
      timestamp: Date.now(),
    }
    setLocalHighlights(prev => [...prev, newNote])
  }

  function handleExportMd() {
    const lines = [`# 《${book.title}》笔记\n`]
    localHighlights.forEach(h => {
      if (h.text) lines.push(`> ${h.text}\n`)
      if (h.note) lines.push(`${h.note}\n`)
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title}_笔记.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCloseNotes() {
    onHighlightsSaved(localHighlights)
    setShowNotes(false)
  }

  const themeClass = theme === 'light' ? ' light' : ''

  return (
    <div className={`book-profile-overlay${themeClass}`} onClick={onClose}>
      <div className={`book-profile-panel${themeClass}`} onClick={e => e.stopPropagation()}>
        <div className="bp-header">
          <div className="bp-cover">
            {book.cover
              ? <img src={book.cover} alt={book.title} />
              : <span className="bp-cover-placeholder">📖</span>}
          </div>
          <div className="bp-meta">
            <div className="bp-title">{book.title}</div>
            <div className="bp-author">{book.author || '未知作者'}</div>
            <div className="bp-char-tag">{charName}</div>
          </div>
          <button className="bp-close" onClick={onClose}>✕</button>
        </div>

        {/* Stats */}
        <div className="bp-stats">
          <div className="bp-stat">
            <div className="bp-stat-num">{msgCount}</div>
            <div className="bp-stat-label">条对话</div>
          </div>
          <div className="bp-stat">
            <div className="bp-stat-num">{cardCount}</div>
            <div className="bp-stat-label">个观点卡</div>
          </div>
          <div className="bp-stat">
            <div className="bp-stat-num">{agreedCount}</div>
            <div className="bp-stat-label">个认同</div>
          </div>
          <div className="bp-stat bp-stat-notes" onClick={() => setShowNotes(true)}>
            <div className="bp-stat-num">{hlCount}</div>
            <div className="bp-stat-label">条笔记 ›</div>
          </div>
        </div>

        {/* Summary if exists */}
        {state.summary && (
          <div className="bp-section">
            <div className="bp-section-title">阅读复盘</div>
            <div className="bp-summary-preview">
              <ReactMarkdown>{state.summary.slice(0, 400) + (state.summary.length > 400 ? '…' : '')}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Rating section */}
        <div className="bp-section">
          <div className="bp-section-title">书评</div>

          {phase === 'overview' && (
            <div className="bp-rating-entry">
              {existingRating?.stars ? (
                <>
                  <p className="bp-rating-hint">已打分，可重新评分</p>
                  {renderStars(true)}
                </>
              ) : (
                <>
                  <p className="bp-rating-hint">点击星星给这本书打分（支持半颗星）</p>
                  {renderStars(true)}
                </>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="bp-done">
              <div className="bp-done-icon">✓</div>
              <div>书评已保存 · {existingRating?.stars} 星</div>
            </div>
          )}
        </div>
      </div>

      {/* Notes Drawer */}
      {showNotes && (
        <div className={`bp-notes-drawer${themeClass}`} onClick={e => e.stopPropagation()}>
          <div className="bp-notes-header">
            <span className="bp-notes-title">笔记 & 高亮</span>
            <div className="bp-notes-header-btns">
              <button className="bp-notes-export-btn" onClick={handleExportMd}>导出 .md</button>
              <button className="bp-notes-close-btn" onClick={handleCloseNotes}>✕</button>
            </div>
          </div>
          <div className="bp-notes-list">
            {localHighlights.length === 0 && (
              <div className="bp-notes-empty">还没有笔记，点击下方「+ 添加笔记」开始记录</div>
            )}
            {localHighlights.map(h => (
              <div key={h.id} className="bp-note-item">
                <button
                  className="bp-note-delete-btn"
                  onClick={() => handleDeleteHighlight(h.id)}
                  title="删除"
                >✕</button>
                {h.text && (
                  <blockquote className="bp-note-quote">{h.text}</blockquote>
                )}
                <textarea
                  className="bp-note-textarea"
                  value={h.note}
                  onChange={e => handleNoteChange(h.id, e.target.value)}
                  placeholder={h.text ? '添加笔记…' : '写下你的想法…'}
                  rows={3}
                />
              </div>
            ))}
          </div>
          <button className="bp-notes-add-btn" onClick={handleAddNote}>+ 添加笔记</button>
        </div>
      )}
    </div>
  )
}
