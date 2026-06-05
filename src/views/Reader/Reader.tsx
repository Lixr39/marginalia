import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub, { type Rendition, type Book, type Contents } from 'epubjs'
import { ChapterChrome } from './ChapterChrome'
import { NoteModal } from './NoteModal'
import { AnnotationsDrawer } from './AnnotationsDrawer'
import { AIPanel } from './AIPanel'
import { CharacterPicker } from './CharacterPicker'
import { FreeNoteEditor } from './FreeNoteEditor'
import { TocDrawer, type TocEntry } from './TocDrawer'
import { DisplaySheet } from './DisplaySheet'
import type { ReadingMode } from '../../types'
import {
  getBook,
  saveBook,
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
import type { Highlight, Bookmark, Character, Message } from '../../types'
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
  const [allCharacters, setAllCharacters] = useState<Character[]>(PRESET_CHARACTERS)
  const [activeCharId, setActiveCharId] = useState<string>(PRESET_CHARACTERS[0].id)
  const [roundtableIds, setRoundtableIds] = useState<string[]>([])
  const [storedMessages, setStoredMessages] = useState<Message[]>([])
  const [storedRoundtableMessages, setStoredRoundtableMessages] = useState<Message[]>([])
  const [aiPanelKey, setAiPanelKey] = useState(0)
  const [aiPanelOpen, setAiPanelOpen] = useState<{
    selectedText: string
    cite: string
    charactersForSession: Character[]
  } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [freeNoteOpen, setFreeNoteOpen] = useState(false)
  const [freeNoteText, setFreeNoteText] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
  const [displayOpen, setDisplayOpen] = useState(false)
  const [tocFlat, setTocFlat] = useState<TocEntry[]>([])
  const [currentHref, setCurrentHref] = useState('')
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = parseInt(localStorage.getItem('marginalia-font-size') ?? '17', 10)
    return isNaN(stored) ? 17 : stored
  })
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => {
    return (localStorage.getItem('marginalia-reading-mode') as ReadingMode | null) ?? 'thinking'
  })

  // Apply font size changes live to the rendition (without reload)
  useEffect(() => {
    const rend = renditionRef.current
    if (!rend) return
    try {
      rend.themes.fontSize(`${fontSize}px`)
      localStorage.setItem('marginalia-font-size', String(fontSize))
    } catch { /* */ }
  }, [fontSize])

  // Persist reading mode
  useEffect(() => {
    localStorage.setItem('marginalia-reading-mode', readingMode)
  }, [readingMode])

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
      const cBg = styles.getPropertyValue('--c-bg').trim() || '#ffffff'
      const cText = styles.getPropertyValue('--c-text').trim() || '#2a1c26'
      const cSel = styles.getPropertyValue('--selection-bg').trim() || 'rgba(255,200,100,0.45)'

      const rendition = book.renderTo(viewportRef.current!, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'scrolled-doc',   // ← was 'paginated'; iOS Safari + iframe paged-mode is a death trap
        manager: 'continuous',
      })
      renditionRef.current = rendition

      // Editorial theme — minimal, focused on readability in scroll mode
      rendition.themes.default({
        body: {
          'font-family': 'Georgia, "Source Han Serif SC", "Songti SC", serif',
          'font-size': `${fontSize}px`,
          'line-height': '1.75',
          'color': cText,
          'background': cBg,
          'padding': '8px 6px',
        },
        'p': { 'margin': '0.7em 0', 'text-indent': '2em' },
        'h1, h2, h3, h4': {
          'font-family': '"Source Han Serif SC", "Songti SC", Georgia, serif',
          'font-weight': '500',
          'color': cText,
          'text-indent': '0',
          'margin-top': '1.4em',
        },
        '::selection': { 'background': cSel },
      })

      // ===== Selection watcher — runs in every chapter iframe =====
      // In scroll mode we let iOS handle native selection (no fighting it).
      // We just observe: when selection is non-empty, surface a floating
      // "Ask AI" pill in the parent UI. User taps it to summon the AI panel
      // with whatever they currently have selected.
      const iframeCleanups: Array<() => void> = []
      const attachedDocs = new WeakSet<Document>()

      const wireSelection = (doc: Document, win: Window) => {
        if (attachedDocs.has(doc)) return
        attachedDocs.add(doc)

        const onSelectionChange = () => {
          const sel = win.getSelection()
          const text = sel?.toString().trim() ?? ''
          if (!text) {
            setSelection(null)
            return
          }
          const range = sel?.rangeCount ? sel.getRangeAt(0) : null
          if (!range) return
          // Derive cfi via epubjs Contents (best-effort)
          let cfiRange = ''
          try {
            const contentsList = (rendition as unknown as { getContents?: () => Array<{ cfiFromRange?: (r: Range) => string }> }).getContents?.()
            const cnt = contentsList?.find(c => c?.cfiFromRange)
            if (cnt?.cfiFromRange) cfiRange = cnt.cfiFromRange(range)
          } catch { /* */ }
          // (x, y) only used for legacy bubble; in scroll mode we use a floating pill instead
          setSelection({ cfiRange, text, x: 0, y: 0 })
        }
        doc.addEventListener('selectionchange', onSelectionChange)
        iframeCleanups.push(() => {
          doc.removeEventListener('selectionchange', onSelectionChange)
        })
      }

      rendition.hooks.content.register((contents: Contents) => {
        const c = contents as unknown as { document?: Document; window?: Window }
        if (c.document && c.window) wireSelection(c.document, c.window)
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
      setStoredMessages(stored.bookState.messages ?? [])
      setStoredRoundtableMessages(stored.bookState.roundtableMessages ?? [])
      setFreeNoteText(stored.bookState.freeNote ?? '')
      setBookTitle(stored.title)

      // load characters (preset + custom)
      const customs = getCustomCharacters()
      setAllCharacters([...PRESET_CHARACTERS, ...customs])

      // restore active character + roundtable choice from BookState
      if (stored.bookState.characterId) setActiveCharId(stored.bookState.characterId)
      if (stored.bookState.roundtableCharacterIds) setRoundtableIds(stored.bookState.roundtableCharacterIds)

      for (const h of existingHls) {
        try {
          addHighlightAnnotation(rendition, h.id, h.cfiRange)
        } catch {
          // bad cfi — skip
        }
      }

      // TOC for chapter title (flat list) + tree-flat (for TOC drawer with depth)
      let tocLocal: NavItem[] = []
      const tocTreeFlat: TocEntry[] = []
      try {
        const navObj = await book.loaded.navigation
        const tree = (navObj as { toc: NavItem[] }).toc || []
        tocLocal = flattenToc(tree)
        const walk = (items: NavItem[], depth: number) => {
          for (const it of items) {
            tocTreeFlat.push({ href: it.href, label: it.label || '', depth })
            if (it.subitems && it.subitems.length) walk(it.subitems, depth + 1)
          }
        }
        walk(tree, 0)
      } catch {
        tocLocal = []
      }
      setTocFlat(tocTreeFlat)

      rendition.on('relocated', (location: { start: { cfi: string; href: string; percentage?: number } }) => {
        const cfi = location.start.cfi
        const href = location.start.href
        const pct = Math.round((location.start.percentage ?? 0) * 100)
        setProgressPct(pct)
        setCurrentHref(href)

        const hrefBase = href.split('#')[0]
        const item = tocLocal.find(t => t.href.split('#')[0] === hrefBase)
        setChapterTitle(item ? item.label.trim() : '')

        if (cfi && bookId) {
          updateBookLocation(bookId, cfi).catch(() => {})
        }
        setSelection(null)
      })

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === ' ') rendition.next()
        else if (e.key === 'ArrowLeft') rendition.prev()
      }
      window.addEventListener('keydown', onKey)

      cleanup = () => {
        for (const fn of iframeCleanups) fn()
        window.removeEventListener('keydown', onKey)
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

  const activeChar = allCharacters.find(c => c.id === activeCharId) ?? allCharacters[0]
  const roundtableChars = roundtableIds
    .map(id => allCharacters.find(c => c.id === id))
    .filter(Boolean) as Character[]
  const isRoundtable = roundtableChars.length > 1
  const sessionChars = isRoundtable ? roundtableChars : (activeChar ? [activeChar] : [])
  const characterMap: Record<string, Character> = {}
  for (const c of allCharacters) characterMap[c.id] = c

  const handleAskAI = () => {
    if (!selection) return
    setAiPanelOpen({
      selectedText: selection.text,
      cite: chapterTitle,
      charactersForSession: sessionChars,
    })
    setAiPanelKey(k => k + 1)
    setSelection(null)
  }

  const persistCharacterChoice = async (charId: string, rtIds: string[]) => {
    if (!bookId) return
    try {
      const fresh = await getBook(bookId)
      if (!fresh) return
      fresh.bookState.characterId = charId
      fresh.bookState.roundtableCharacterIds = rtIds
      fresh.bookState.isRoundtableMode = rtIds.length > 1
      await saveBook(fresh)
    } catch { /* */ }
  }

  const handlePickerConfirmSingle = (char: Character) => {
    setActiveCharId(char.id)
    setRoundtableIds([])
    setPickerOpen(false)
    persistCharacterChoice(char.id, [])
    if (aiPanelOpen) {
      setAiPanelOpen({ ...aiPanelOpen, charactersForSession: [char] })
      setAiPanelKey(k => k + 1)
    }
  }
  const handlePickerConfirmRoundtable = (chars: Character[]) => {
    const ids = chars.map(c => c.id)
    setRoundtableIds(ids)
    if (chars.length > 0) setActiveCharId(chars[0].id)
    setPickerOpen(false)
    persistCharacterChoice(chars[0]?.id ?? activeCharId, ids)
    if (aiPanelOpen) {
      setAiPanelOpen({ ...aiPanelOpen, charactersForSession: chars })
      setAiPanelKey(k => k + 1)
    }
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
        onOpenToc={() => setTocOpen(true)}
        onOpenDisplay={() => setDisplayOpen(true)}
      />
      <div ref={viewportRef} className="reader__viewport">
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
        <div className="reader__selection-pill">
          <button
            className="reader__sel-btn"
            onClick={handleHighlight}
            aria-label="highlight"
          >🖍️</button>
          <span className="reader__sel-divider" />
          <button
            className="reader__sel-btn"
            onClick={handleNoteFromSelection}
            aria-label="note"
          >📝</button>
          <span className="reader__sel-divider" />
          <button
            className="reader__sel-btn reader__sel-btn--primary"
            onClick={handleAskAI}
          >
            问 {isRoundtable ? `圆桌·${roundtableChars.length}` : (activeChar?.name ?? '虚无主义者')} →
          </button>
        </div>
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

      {aiPanelOpen && bookId && sessionChars.length > 0 && (
        <AIPanel
          key={aiPanelKey}
          bookId={bookId}
          initialMessages={isRoundtable ? storedRoundtableMessages : storedMessages}
          selectedText={aiPanelOpen.selectedText}
          cite={aiPanelOpen.cite}
          characterMap={characterMap}
          characters={aiPanelOpen.charactersForSession}
          readingMode={readingMode}
          chapterIndex={0}
          chapterTitle={chapterTitle}
          chapterContent=""
          onClose={() => setAiPanelOpen(null)}
          onPickCharacters={() => setPickerOpen(true)}
        />
      )}

      {tocOpen && (
        <TocDrawer
          entries={tocFlat}
          currentHref={currentHref}
          onJump={(href) => {
            renditionRef.current?.display(href).catch(() => {})
          }}
          onClose={() => setTocOpen(false)}
        />
      )}

      {displayOpen && (
        <DisplaySheet
          fontSize={fontSize}
          onFontSize={setFontSize}
          readingMode={readingMode}
          onReadingMode={setReadingMode}
          onClose={() => setDisplayOpen(false)}
        />
      )}

      {freeNoteOpen && bookId && (
        <FreeNoteEditor
          initial={freeNoteText}
          bookTitle={bookTitle}
          onSave={async (text) => {
            try {
              const fresh = await getBook(bookId)
              if (!fresh) return
              fresh.bookState.freeNote = text
              await saveBook(fresh)
              setFreeNoteText(text)
            } catch (err) {
              console.error('save free note failed', err)
            }
          }}
          onClose={() => setFreeNoteOpen(false)}
        />
      )}

      {pickerOpen && (
        <CharacterPicker
          available={allCharacters}
          initialActiveId={activeCharId}
          initialRoundtable={roundtableIds}
          onConfirmSingle={handlePickerConfirmSingle}
          onConfirmRoundtable={handlePickerConfirmRoundtable}
          onCancel={() => setPickerOpen(false)}
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
          onOpenNotes={() => {
            setDrawerOpen(false)
            setFreeNoteOpen(true)
          }}
          onExport={handleExport}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}
