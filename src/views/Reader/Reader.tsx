import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub, { type Rendition, type Book, type Contents } from 'epubjs'
import { ChapterChrome } from './ChapterChrome'
import { SelectionBubble } from './SelectionBubble'
import { NoteModal } from './NoteModal'
import { AnnotationsDrawer } from './AnnotationsDrawer'
import {
  getBook,
  updateBookLocation,
  addHighlight,
  deleteHighlight,
  updateHighlightNote,
  addBookmark,
  deleteBookmark,
  getCustomCharacters,
} from '../../store'
import { PRESET_CHARACTERS } from '../../characters/presets'
import { bookToMarkdown, downloadText, safeFilename } from '../../lib/exportMarkdown'
import type { Highlight, Bookmark, Character } from '../../types'
import './Reader.css'

interface NavItem {
  href: string
  label: string
  subitems?: NavItem[]
}

function flattenToc(items: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  for (const it of items) {
    out.push(it)
    if (it.subitems && it.subitems.length) out.push(...flattenToc(it.subitems))
  }
  return out
}

const HIGHLIGHT_FILL = 'rgba(255, 200, 100, 0.45)'

interface SelectionState {
  cfiRange: string
  text: string
  x: number
  y: number
}

type NoteModalState =
  | { mode: 'create'; cfiRange: string; text: string }
  | { mode: 'edit'; highlightId: string; cfiRange: string; text: string; initialNote: string }
  | null

export function Reader() {
  const { bookId } = useParams<{ bookId: string }>()
  const nav = useNavigate()
  const viewportRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)

  const [chapterTitle, setChapterTitle] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [tappedHl, setTappedHl] = useState<{ id: string; cfiRange: string; x: number; y: number } | null>(null)
  const [noteState, setNoteState] = useState<NoteModalState>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  const addHighlightAnnotation = (rend: Rendition, id: string, cfiRange: string) => {
    rend.annotations.add(
      'highlight',
      cfiRange,
      { id },
      ((e: Event) => {
        const me = e as MouseEvent
        const iframe = viewportRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        if (!iframeRect) return
        const target = me.target as Element | null
        const r = target && 'getBoundingClientRect' in target
          ? target.getBoundingClientRect()
          : null
        const cx = r ? r.left + r.width / 2 : me.clientX
        const cy = r ? r.top : me.clientY
        setTappedHl({
          id,
          cfiRange,
          x: iframeRect.left + cx,
          y: iframeRect.top + cy,
        })
      }) as never,
      'sel-hl-' + id,
      { fill: HIGHLIGHT_FILL, 'fill-opacity': '0.5' },
    )
  }

  useEffect(() => {
    if (!bookId || !viewportRef.current) return
    let cancelled = false
    let cleanup: (() => void) | null = null

    const init = async () => {
      const stored = await getBook(bookId)
      if (cancelled) return
      if (!stored) {
        nav('/')
        return
      }
      if (!viewportRef.current) return

      const book = ePub(stored.epubData.slice(0) as unknown as string)
      bookRef.current = book
      await book.ready

      const styles = getComputedStyle(document.documentElement)
      const cBg = styles.getPropertyValue('--c-bg').trim() || '#faf0ee'
      const cText = styles.getPropertyValue('--c-text').trim() || '#2d1620'
      const cSel = styles.getPropertyValue('--selection-bg').trim() || 'rgba(255,200,100,0.45)'

      const rendition = book.renderTo(viewportRef.current!, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        manager: 'default',
      })
      renditionRef.current = rendition

      rendition.themes.default({
        body: {
          'font-family': 'Georgia, "Source Han Serif SC", "Songti SC", serif',
          'font-size': '17px',
          'line-height': '1.7',
          'color': cText,
          'background': cBg,
          'padding': '0 4px',
        },
        'p': { 'margin': '0.8em 0' },
        '::selection': { 'background': cSel },
      })

      const startCfi = stored.bookState.currentLocation || undefined
      try {
        await rendition.display(startCfi)
      } catch {
        await rendition.display()
      }

      // restore existing highlights + bookmarks state
      const existingHls = stored.bookState.highlights ?? []
      const existingBms = stored.bookState.bookmarks ?? []
      setHighlights(existingHls)
      setBookmarks(existingBms)

      for (const h of existingHls) {
        try {
          addHighlightAnnotation(rendition, h.id, h.cfiRange)
        } catch {
          // bad cfi — skip
        }
      }

      // TOC for chapter title
      let tocFlat: NavItem[] = []
      try {
        const navObj = await book.loaded.navigation
        tocFlat = flattenToc((navObj as { toc: NavItem[] }).toc || [])
      } catch {
        tocFlat = []
      }

      rendition.on('relocated', (location: { start: { cfi: string; href: string; percentage?: number } }) => {
        const cfi = location.start.cfi
        const href = location.start.href
        const pct = Math.round((location.start.percentage ?? 0) * 100)
        setProgressPct(pct)

        const hrefBase = href.split('#')[0]
        const item = tocFlat.find(t => t.href.split('#')[0] === hrefBase)
        setChapterTitle(item ? item.label.trim() : '')

        if (cfi && bookId) {
          updateBookLocation(bookId, cfi).catch(() => {})
        }
        setSelection(null)
      })

      const onSelected = (cfiRange: string, contents: Contents) => {
        const win = (contents as unknown as { window: Window }).window
        const sel = win.getSelection()
        const text = sel?.toString().trim() ?? ''
        if (!text) {
          setSelection(null)
          return
        }
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null
        if (!range) {
          setSelection(null)
          return
        }
        const r = range.getBoundingClientRect()
        const iframe = viewportRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        if (!iframeRect) {
          setSelection(null)
          return
        }
        const x = iframeRect.left + r.left + r.width / 2
        const y = iframeRect.top + r.top
        setSelection({ cfiRange, text, x, y })
      }
      rendition.on('selected', onSelected)

      const vp = viewportRef.current!
      let touchStartX = 0
      let touchStartY = 0
      let touchStartTime = 0

      const onTouchStart = (e: TouchEvent) => {
        if (window.getSelection()?.toString()) return
        if (e.touches.length !== 1) return
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
        touchStartTime = Date.now()
      }
      const onTouchEnd = (e: TouchEvent) => {
        if (window.getSelection()?.toString()) return
        if (touchStartTime === 0) return
        const dx = e.changedTouches[0].clientX - touchStartX
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
        const dt = Date.now() - touchStartTime
        touchStartTime = 0
        if (dt > 600) return
        if (dy > 40) return
        if (dx < -40) rendition.next()
        else if (dx > 40) rendition.prev()
      }

      vp.addEventListener('touchstart', onTouchStart, { passive: true })
      vp.addEventListener('touchend', onTouchEnd, { passive: true })

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === ' ') rendition.next()
        else if (e.key === 'ArrowLeft') rendition.prev()
      }
      window.addEventListener('keydown', onKey)

      cleanup = () => {
        vp.removeEventListener('touchstart', onTouchStart)
        vp.removeEventListener('touchend', onTouchEnd)
        window.removeEventListener('keydown', onKey)
        try { rendition.off('selected', onSelected as never) } catch { /* */ }
      }

      setLoading(false)
    }

    init().catch(err => {
      console.error('reader init failed', err)
      if (!cancelled) {
        alert('打开失败：' + (err as Error).message)
        nav('/')
      }
    })

    return () => {
      cancelled = true
      if (cleanup) cleanup()
      try { renditionRef.current?.destroy() } catch { /* */ }
      try { bookRef.current?.destroy() } catch { /* */ }
      renditionRef.current = null
      bookRef.current = null
    }
  }, [bookId, nav])

  const onViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.getSelection()?.toString()) return
    if (selection) return
    if (!renditionRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const w = rect.width
    if (x < w * 0.25) renditionRef.current.prev()
    else if (x > w * 0.75) renditionRef.current.next()
  }

  const handleHighlight = async () => {
    if (!selection || !bookId || !renditionRef.current) return
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const h: Highlight = {
      id,
      cfiRange: selection.cfiRange,
      text: selection.text,
      note: '',
      color: 'yellow',
      timestamp: Date.now(),
    }
    try {
      await addHighlight(bookId, h)
      addHighlightAnnotation(renditionRef.current, id, h.cfiRange)
      setHighlights(prev => [...prev, h])
    } catch (err) {
      console.error('highlight failed', err)
    }
    try {
      const iframe = viewportRef.current?.querySelector('iframe')
      iframe?.contentWindow?.getSelection()?.removeAllRanges()
    } catch { /* */ }
    setSelection(null)
  }

  const handleNoteFromSelection = () => {
    if (!selection) return
    setNoteState({ mode: 'create', cfiRange: selection.cfiRange, text: selection.text })
    setSelection(null)
  }

  const handleAskAI = () => {
    alert('AI 召唤即将上线（M6）\n\n选中文字：「' + selection?.text.slice(0, 40) + '」')
    setSelection(null)
  }

  const handleRemoveHighlight = async () => {
    if (!tappedHl || !bookId || !renditionRef.current) return
    try {
      renditionRef.current.annotations.remove(tappedHl.cfiRange, 'highlight')
    } catch { /* */ }
    try {
      await deleteHighlight(bookId, tappedHl.id)
      setHighlights(prev => prev.filter(h => h.id !== tappedHl.id))
    } catch { /* */ }
    setTappedHl(null)
  }

  const handleEditHighlightNote = () => {
    if (!tappedHl) return
    const h = highlights.find(x => x.id === tappedHl.id)
    if (!h) return
    setNoteState({
      mode: 'edit',
      highlightId: h.id,
      cfiRange: h.cfiRange,
      text: h.text,
      initialNote: h.note,
    })
    setTappedHl(null)
  }

  const handleSaveNote = async (note: string) => {
    if (!noteState || !bookId) return
    if (noteState.mode === 'create') {
      // create new highlight with note attached
      if (!renditionRef.current) return
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const h: Highlight = {
        id,
        cfiRange: noteState.cfiRange,
        text: noteState.text,
        note: note.trim(),
        color: 'yellow',
        timestamp: Date.now(),
      }
      try {
        await addHighlight(bookId, h)
        addHighlightAnnotation(renditionRef.current, id, h.cfiRange)
        setHighlights(prev => [...prev, h])
      } catch (err) {
        console.error('save note failed', err)
      }
    } else {
      try {
        await updateHighlightNote(bookId, noteState.highlightId, note.trim())
        setHighlights(prev =>
          prev.map(h => h.id === noteState.highlightId ? { ...h, note: note.trim() } : h)
        )
      } catch (err) {
        console.error('update note failed', err)
      }
    }
    setNoteState(null)
  }

  const handleAddBookmark = async () => {
    if (!bookId || !renditionRef.current) return
    const loc = renditionRef.current.currentLocation()
    const cfi = (loc as unknown as { start?: { cfi?: string } }).start?.cfi
    if (!cfi) return
    const bm: Bookmark = {
      id: Date.now().toString(36),
      cfi,
      label: chapterTitle || `${progressPct}%`,
      chapterIndex: 0,
      timestamp: Date.now(),
    }
    try {
      await addBookmark(bookId, bm)
      setBookmarks(prev => [...prev, bm])
    } catch (err) {
      console.error('bookmark failed', err)
    }
  }

  const handleDeleteBookmark = async (id: string) => {
    if (!bookId) return
    try {
      await deleteBookmark(bookId, id)
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch { /* */ }
  }

  const handleExport = async () => {
    if (!bookId) return
    try {
      const fresh = await getBook(bookId)
      if (!fresh) return
      const allChars: Character[] = [
        ...PRESET_CHARACTERS,
        ...getCustomCharacters(),
      ]
      const charMap: Record<string, Character> = {}
      for (const c of allChars) charMap[c.id] = c
      const md = bookToMarkdown(fresh, charMap)
      downloadText(safeFilename(fresh.title), md)
    } catch (err) {
      console.error('export failed', err)
      alert('导出失败：' + (err as Error).message)
    }
  }

  return (
    <div className="reader">
      <ChapterChrome
        chapterTitle={chapterTitle}
        progressPct={progressPct}
        onAddBookmark={handleAddBookmark}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
      <div ref={viewportRef} className="reader__viewport" onClick={onViewportClick}>
        {loading && <div className="reader__loading">opening…</div>}
      </div>
      <div className="reader__progress">
        <div className="reader__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="reader__foot">
        <span>← TAP / SWIPE</span>
        <span>TURN</span>
        <span>SWIPE / TAP →</span>
      </div>

      {selection && (
        <SelectionBubble
          x={selection.x}
          y={selection.y}
          characterName="虚无主义者"
          onHighlight={handleHighlight}
          onNote={handleNoteFromSelection}
          onAskAI={handleAskAI}
        />
      )}

      {tappedHl && (
        <>
          <div className="hl-action-backdrop" onClick={() => setTappedHl(null)} />
          <div
            className={'sel-bubble' + (tappedHl.y > 60 ? '' : ' sel-bubble--below')}
            style={{
              left: Math.max(12, Math.min(window.innerWidth - 220, tappedHl.x - 100)),
              top: tappedHl.y > 60 ? tappedHl.y - 50 : tappedHl.y + 18,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button className="sel-bubble__btn" onClick={handleEditHighlightNote}>📝</button>
            <span className="sel-bubble__divider" />
            <button
              className="sel-bubble__btn sel-bubble__btn--primary"
              onClick={handleRemoveHighlight}
            >
              ✕ 取消高亮
            </button>
          </div>
        </>
      )}

      {noteState && (
        <NoteModal
          selectedText={noteState.text}
          initialNote={noteState.mode === 'edit' ? noteState.initialNote : ''}
          mode={noteState.mode}
          onSave={handleSaveNote}
          onCancel={() => setNoteState(null)}
          onDelete={
            noteState.mode === 'edit'
              ? async () => {
                  if (!bookId || !renditionRef.current) return
                  try {
                    renditionRef.current.annotations.remove(noteState.cfiRange, 'highlight')
                  } catch { /* */ }
                  await deleteHighlight(bookId, noteState.highlightId)
                  setHighlights(prev => prev.filter(h => h.id !== noteState.highlightId))
                  setNoteState(null)
                }
              : undefined
          }
        />
      )}

      {drawerOpen && (
        <AnnotationsDrawer
          highlights={highlights}
          bookmarks={bookmarks}
          onJumpHighlight={(cfiRange) => {
            const start = cfiRange.split(',')[0].replace(/^epubcfi\(/, '').replace(/\)$/, '')
            // epubcfi range looks like: epubcfi(/6/4!/4/2,...,/4/2/3:5)
            // extracting the start cfi for navigation
            const fullStart = `epubcfi(${start})`
            renditionRef.current?.display(fullStart).catch(() => {
              // fallback: try the full range
              renditionRef.current?.display(cfiRange).catch(() => {})
            })
          }}
          onJumpBookmark={(cfi) => {
            renditionRef.current?.display(cfi).catch(() => {})
          }}
          onDeleteBookmark={handleDeleteBookmark}
          onExport={handleExport}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}
