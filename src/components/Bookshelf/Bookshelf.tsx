import { useState, useEffect, useRef } from 'react'
import type { BookRating, Highlight, BookTag, CharacterReview } from '../../types'
import type { StoredBook } from '../../store'
import { getAllBooks, deleteBook as deleteBookFromDB, updateBookState } from '../../store'
import BookProfile from '../BookProfile/BookProfile'
import CharacterReviewPanel from '../CharacterReview/CharacterReview'
import './Bookshelf.css'

interface Props {
  onSelectBook: (book: StoredBook) => void
  onRereadBook: (book: StoredBook) => void
  onAddBook: () => void
  onOpenSettings: () => void
  onBack?: () => void
  theme?: 'dark' | 'light'
  onDropFile?: (file: File) => void
  onToggleTheme?: () => void
}

export default function Bookshelf({ onSelectBook, onRereadBook, onAddBook, onOpenSettings, onBack, theme, onDropFile, onToggleTheme }: Props) {
  const [books, setBooks] = useState<StoredBook[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<StoredBook | null>(null)
  const [profileBook, setProfileBook] = useState<StoredBook | null>(null)
  const [charReviewBook, setCharReviewBook] = useState<StoredBook | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [notesBook, setNotesBook] = useState<StoredBook | null>(null)
  const [notesHighlights, setNotesHighlights] = useState<Highlight[]>([])
  const [freeNote, setFreeNote] = useState('')
  const [noteFont, setNoteFont] = useState('inherit')
  const [noteFontSize, setNoteFontSize] = useState('14px')
  const [tagFilter, setTagFilter] = useState<BookTag | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadBooks()
  }, [])

  async function loadBooks() {
    setLoading(true)
    try {
      const all = await getAllBooks()
      setBooks(all)
    } catch (err) {
      console.error('Failed to load books:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteBookFromDB(deleteTarget.id)
      setBooks(prev => prev.filter(b => b.id !== deleteTarget.id))
    } catch (err) {
      console.error('Failed to delete book:', err)
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleTagChange(book: StoredBook, tag: BookTag | undefined) {
    const updated = { ...book, bookState: { ...book.bookState, tag } }
    await updateBookState(book.id, updated.bookState)
    setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
  }

  async function handleRatingSaved(book: StoredBook, rating: BookRating) {
    const updated = { ...book, bookState: { ...book.bookState, rating } }
    await updateBookState(book.id, updated.bookState)
    setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
    if (profileBook?.id === book.id) setProfileBook(updated)
  }

  async function handleCharReviewSaved(book: StoredBook, review: CharacterReview) {
    const existing = book.bookState.characterReviews || {}
    const updated = { ...book, bookState: { ...book.bookState, characterReviews: { ...existing, [review.characterId]: review } } }
    await updateBookState(book.id, updated.bookState)
    setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
    if (charReviewBook?.id === book.id) setCharReviewBook(updated)
  }

  async function handleHighlightsSaved(book: StoredBook, highlights: Highlight[]) {
    const updated = { ...book, bookState: { ...book.bookState, highlights } }
    await updateBookState(book.id, updated.bookState)
    setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
    if (profileBook?.id === book.id) setProfileBook(updated)
    if (notesBook?.id === book.id) setNotesBook(updated)
  }

  function formatDate(ts: number): string {
    const d = new Date(ts)
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}/${day}`
  }

  function renderStarDisplay(stars: number) {
    const full = Math.floor(stars)
    const half = stars % 1 >= 0.5
    return (
      <span className="book-card-stars">
        {[1,2,3,4,5].map(i => (
          <span key={i} className={`bcs ${i <= full ? 'full' : (half && i === full + 1) ? 'half' : 'empty'}`}>★</span>
        ))}
        <span className="bcs-val">{stars}</span>
      </span>
    )
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (onDropFile) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!onDropFile) return
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.epub')) {
      onDropFile(file)
    }
  }

  function openNotesDrawer(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation()
    setNotesBook(book)
    setNotesHighlights(book.bookState.highlights || [])
    setFreeNote(book.bookState.freeNote || '')
  }

  async function closeNotesDrawer() {
    if (!notesBook) return
    const updated = { ...notesBook.bookState, highlights: notesHighlights, freeNote }
    await updateBookState(notesBook.id, updated)
    setBooks(prev => prev.map(b => b.id === notesBook.id ? { ...b, bookState: updated } : b))
    setNotesBook(null)
  }

  function handleDeleteNote(id: string) {
    setNotesHighlights(prev => prev.filter(h => h.id !== id))
  }

  function handleExportMd() {
    if (!notesBook) return
    const lines = [`# 《${notesBook.title}》笔记\n`]
    if (notesHighlights.length > 0) {
      lines.push('## 高亮摘录\n')
      notesHighlights.forEach(h => {
        if (h.text) lines.push(`> ${h.text}\n`)
        if (h.note) lines.push(`${h.note}\n`)
        lines.push('')
      })
    }
    if (freeNote.trim()) {
      lines.push('## 自由笔记\n')
      lines.push(freeNote)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${notesBook.title}_笔记.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const themeClass = theme === 'light' ? ' light' : ''

  return (
    <div className={`bookshelf${themeClass}`}>
      <div className="bookshelf-header">
        {onBack && (
          <button className="bookshelf-back-btn" onClick={onBack}>← 返回首页</button>
        )}
        {onToggleTheme && (
          <button className="bookshelf-theme-btn" onClick={onToggleTheme} title={theme === 'light' ? '切换深色' : '切换浅色'}>
            {theme === 'light' ? '☾' : '☀'}
          </button>
        )}
        <h1 className="bookshelf-title">书架</h1>
        <p className="bookshelf-subtitle">选择一本书开始阅读</p>
      </div>

      <div className="bookshelf-toolbar">
        <button className="bookshelf-add-btn" onClick={onAddBook}>
          + 添加新书
        </button>
        <button className="bookshelf-settings-btn" onClick={onOpenSettings}>
          API 设置
        </button>
        <div className="bookshelf-tag-filters">
          {(['all', 'reading', 'finished', 'wishlist'] as const).map(t => (
            <button
              key={t}
              className={`tag-filter-btn${tagFilter === t ? ' active' : ''}`}
              onClick={() => setTagFilter(t)}
            >
              {t === 'all' ? '全部' : t === 'reading' ? '在读' : t === 'finished' ? '已读' : '想读'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bookshelf-loading">加载书架中...</div>
      ) : (
        <div
          className={`bookshelf-grid${isDragOver ? ' drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {books.length === 0 && (
            <div className="bookshelf-empty">
              还没有书，点击上方「添加新书」或拖入 epub 文件开始阅读
            </div>
          )}
          {books.filter(b => tagFilter === 'all' || b.bookState.tag === tagFilter).map(book => (
            <div
              key={book.id}
              className="book-card"
              onClick={() => onSelectBook(book)}
            >
              <button
                className="book-delete-btn"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(book) }}
                title="删除"
              >
                x
              </button>
              <div className="book-cover">
                {book.cover ? (
                  <img src={book.cover} alt={book.title} />
                ) : (
                  <span className="book-cover-placeholder">&#128214;</span>
                )}
              </div>
              <div className="book-info">
                <div className="book-card-title" title={book.title}>{book.title}</div>
                <div className="book-card-author">{book.author || '未知作者'}</div>
                <div className="book-card-meta">{formatDate(book.lastOpened)}</div>
                <div className="book-tag-row" onClick={e => e.stopPropagation()}>
                  {(['reading', 'finished', 'wishlist'] as const).map(t => (
                    <button
                      key={t}
                      className={`book-tag-btn${book.bookState.tag === t ? ' active' : ''}`}
                      onClick={() => handleTagChange(book, book.bookState.tag === t ? undefined : t)}
                    >
                      {t === 'reading' ? '在读' : t === 'finished' ? '已读' : '想读'}
                    </button>
                  ))}
                </div>
                <div className="book-card-btns">
                  {book.bookState.characterId && (
                    <button
                      className="book-reread-btn"
                      onClick={(e) => { e.stopPropagation(); onRereadBook(book) }}
                    >
                      换角色再读
                    </button>
                  )}
                  <button
                    className="book-notes-btn"
                    onClick={(e) => openNotesDrawer(e, book)}
                  >
                    笔记{(book.bookState.highlights?.length || 0) > 0 ? ` (${book.bookState.highlights!.length})` : ''}
                  </button>
                  <button
                    className="book-profile-btn"
                    onClick={(e) => { e.stopPropagation(); setProfileBook(book) }}
                  >
                    书评
                  </button>
                  <button
                    className="book-char-review-btn"
                    onClick={(e) => { e.stopPropagation(); setCharReviewBook(book) }}
                  >
                    角色书评
                  </button>
                </div>
                {book.bookState.rating?.stars
                  ? renderStarDisplay(book.bookState.rating.stars)
                  : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".epub" style={{ display: 'none' }} />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>删除书籍</h3>
            <p>确定要删除「{deleteTarget.title}」吗？所有阅读记录和对话都将丢失。</p>
            <div className="delete-confirm-actions">
              <button className="delete-cancel-btn" onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="delete-confirm-btn" onClick={handleDelete}>删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Book profile modal */}
      {profileBook && (
        <BookProfile
          book={profileBook}
          onClose={() => setProfileBook(null)}
          onRatingSaved={(rating) => handleRatingSaved(profileBook, rating)}
          onHighlightsSaved={(highlights) => handleHighlightsSaved(profileBook, highlights)}
          theme={theme}
        />
      )}

      {/* Character review panel */}
      {charReviewBook && (
        <CharacterReviewPanel
          bookTitle={charReviewBook.title}
          bookAuthor={charReviewBook.author || ''}
          bookSummary={charReviewBook.bookState.bookSummary}
          existingReviews={charReviewBook.bookState.characterReviews || {}}
          onReviewSaved={(review) => handleCharReviewSaved(charReviewBook, review)}
          onClose={() => setCharReviewBook(null)}
          theme={theme}
        />
      )}

      {/* Notes drawer — slides in from right */}
      {notesBook && (
        <>
          <div className="notes-drawer-backdrop" onClick={closeNotesDrawer} />
          <div className={`notes-drawer${themeClass}`}>
            <div className="notes-drawer-header">
              <div className="notes-drawer-title">
                <span>笔记</span>
                <span className="notes-drawer-book-name">《{notesBook.title}》</span>
              </div>
              <div className="notes-drawer-header-btns">
                <button className="notes-drawer-export-btn" onClick={handleExportMd}>导出 .md</button>
                <button className="notes-drawer-close-btn" onClick={closeNotesDrawer}>✕</button>
              </div>
            </div>
            <div className="notes-drawer-body">
              {/* 高亮摘录列表 */}
              {notesHighlights.length > 0 && (
                <div className="notes-drawer-highlights">
                  <div className="notes-drawer-section-title">高亮摘录</div>
                  {notesHighlights.map(h => (
                    <div key={h.id} className="notes-drawer-item">
                      <button className="notes-drawer-del-btn" onClick={() => handleDeleteNote(h.id)} title="删除">✕</button>
                      {h.text && <blockquote className="notes-drawer-quote">{h.text}</blockquote>}
                      {h.note && <div className="notes-drawer-note-text">{h.note}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* 自由笔记编辑器 */}
              <div className="notes-drawer-free">
                <div className="notes-drawer-section-title">自由笔记</div>
                <div className="notes-free-toolbar">
                  <select
                    className="notes-free-select"
                    value={noteFont}
                    onChange={e => setNoteFont(e.target.value)}
                    title="字体"
                  >
                    <option value="inherit">默认字体</option>
                    <option value="'Noto Serif SC', serif">宋体</option>
                    <option value="HuiwenMincho">汇文明朝</option>
                    <option value="ChillHuoFangSong">寒假火方宋</option>
                    <option value="RunzhiKangxi">润智康熙</option>
                    <option value="-apple-system, sans-serif">无衬线</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>
                  <select
                    className="notes-free-select"
                    value={noteFontSize}
                    onChange={e => setNoteFontSize(e.target.value)}
                    title="字号"
                  >
                    {['12px','13px','14px','15px','16px','17px','18px','20px'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button className="notes-free-tool-btn" onClick={() => {
                    const ta = document.getElementById('free-note-ta') as HTMLTextAreaElement
                    if (!ta) return
                    const s = ta.selectionStart, e2 = ta.selectionEnd
                    const sel = freeNote.slice(s, e2)
                    if (!sel) return
                    const newVal = freeNote.slice(0, s) + `**${sel}**` + freeNote.slice(e2)
                    setFreeNote(newVal)
                  }} title="加粗"><b>B</b></button>
                  <button className="notes-free-tool-btn" onClick={() => {
                    const ta = document.getElementById('free-note-ta') as HTMLTextAreaElement
                    if (!ta) return
                    const s = ta.selectionStart, e2 = ta.selectionEnd
                    const sel = freeNote.slice(s, e2)
                    if (!sel) return
                    const newVal = freeNote.slice(0, s) + `*${sel}*` + freeNote.slice(e2)
                    setFreeNote(newVal)
                  }} title="斜体"><i>I</i></button>
                  <button className="notes-free-tool-btn" onClick={() => {
                    const ta = document.getElementById('free-note-ta') as HTMLTextAreaElement
                    if (!ta) return
                    const pos = ta.selectionStart
                    const lineStart = freeNote.lastIndexOf('\n', pos - 1) + 1
                    const newVal = freeNote.slice(0, lineStart) + '> ' + freeNote.slice(lineStart)
                    setFreeNote(newVal)
                  }} title="引用">❝</button>
                </div>
                <textarea
                  id="free-note-ta"
                  className="notes-free-textarea"
                  value={freeNote}
                  onChange={e => setFreeNote(e.target.value)}
                  placeholder="在这里写你的读书笔记，支持 Markdown 语法…"
                  style={{ fontFamily: noteFont, fontSize: noteFontSize }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
