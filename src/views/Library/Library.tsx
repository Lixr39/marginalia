import { useEffect, useState, useCallback, useRef } from 'react'
import { Masthead } from './Masthead'
import { SectionHeader } from './SectionHeader'
import { BookEntry, type BookEntryData } from './BookEntry'
import { EmptyLibrary } from './EmptyLibrary'
import {
  getAllBooks,
  saveBook,
  deleteBook,
  extractCoverFromEpub,
  type StoredBook,
} from '../../store'
import { pickFeaturedHighlight } from '../../lib/featuredHighlight'
import { normalizeEpub } from '../../lib/epubNormalize'
import './Library.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function formatVolumes(n: number): string {
  const words = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN']
  if (n <= 10) return `${words[n]} ${n === 1 ? 'VOLUME' : 'VOLUMES'}`
  return `${n} VOLUMES`
}

function truncateText(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1).trimEnd() + '…'
}

function computeProgress(cfi: string): number {
  if (!cfi) return 0
  // very rough placeholder; M4 will refine via epubjs locations
  const steps = cfi.match(/\//g)?.length ?? 0
  return Math.min(99, steps * 4)
}

function bookToEntry(book: StoredBook, idx: number): BookEntryData {
  const state = book.bookState
  const featured = pickFeaturedHighlight(state.highlights, state.featuredHighlightId)
  const progressPct = computeProgress(state.currentLocation)
  const noteCount = state.highlights?.length ?? 0
  const daysAgo = Math.max(0, Math.floor((Date.now() - book.lastOpened) / 86400000))

  const metaParts: string[] = []
  if (state.currentChapter > 0) metaParts.push(`§ CH. ${state.currentChapter}`)
  if (noteCount > 0) metaParts.push(`${noteCount} ${noteCount === 1 ? 'NOTE' : 'NOTES'}`)
  metaParts.push(daysAgo === 0 ? 'TODAY' : `${daysAgo}D AGO`)

  const titleTrim = book.title.trim()
  const firstLatin = titleTrim.match(/[A-Za-z]/)?.[0]
  const letter = (firstLatin ?? titleTrim.charAt(0) ?? '·').toUpperCase()

  return {
    id: book.id,
    title: book.title,
    author: book.author || '—',
    cover: book.cover || undefined,
    letter,
    coverVariant: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
    metaParts,
    progressPct,
    marginalia: featured?.text ? truncateText(featured.text, 60) : undefined,
  }
}

async function readEpubMeta(buf: ArrayBuffer): Promise<{ title: string; author: string }> {
  try {
    const ePubModule = await import('epubjs')
    const ePub = ePubModule.default
    const book = ePub(buf.slice(0) as unknown as string)
    await book.ready
    const meta = (await book.loaded.metadata) as { title?: string; creator?: string }
    book.destroy()
    return { title: meta.title || '', author: meta.creator || '' }
  } catch {
    return { title: '', author: '' }
  }
}

function ImportFooter({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="import-footer">
      <button
        className="empty-library__import"
        onClick={() => ref.current?.click()}
      >
        <em>+</em> IMPORT EPUB
      </button>
      <input
        ref={ref}
        type="file"
        accept=".epub,application/epub+zip"
        className="empty-library__hidden-input"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function Library() {
  const today = new Date()
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )

  const [books, setBooks] = useState<StoredBook[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [sheetFor, setSheetFor] = useState<StoredBook | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const all = await getAllBooks()
    setBooks(all)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleFile = useCallback(async (file: File) => {
    setImporting(true)
    try {
      const rawBuf = await file.arrayBuffer()
      const buf = await normalizeEpub(rawBuf)
      const cover = await extractCoverFromEpub(buf)
      const meta = await readEpubMeta(buf)
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const stored: StoredBook = {
        id,
        title: meta.title || file.name.replace(/\.epub$/i, ''),
        author: meta.author || '',
        cover,
        epubData: buf,
        bookState: {
          meta: {
            title: meta.title || file.name.replace(/\.epub$/i, ''),
            author: meta.author || '',
            totalChapters: 0,
          },
          currentLocation: '',
          currentChapter: 0,
          characterId: '',
          readingMode: 'thinking',
          messages: [],
          opinionCards: [],
          chapterSummaries: {},
        },
        lastOpened: Date.now(),
      }
      await saveBook(stored)
      await load()
    } catch (err) {
      console.error('import failed', err)
      alert('导入失败：' + (err as Error).message)
    } finally {
      setImporting(false)
    }
  }, [load])

  if (books === null) return null

  return (
    <main className="library">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />
      {books.length === 0 ? (
        <EmptyLibrary onFile={handleFile} />
      ) : (
        <>
          <div className="library__epigraph">
            阅读不是动词的对象，而是动词本身。
            <span className="library__epigraph-cite">— EPIGRAPH</span>
          </div>
          <SectionHeader
            roman="I."
            titlePrefix="In "
            titleAccent="Progress"
            sub={`${formatVolumes(books.length)} · CURRENTLY READING`}
          />
          <ul>
            {books.map((b, i) => (
              <li key={b.id}>
                <BookEntry
                  data={bookToEntry(b, i)}
                  onLongPress={(id) => {
                    const target = books.find(x => x.id === id) ?? null
                    setSheetFor(target)
                    setConfirmDelete(false)
                  }}
                />
              </li>
            ))}
          </ul>
          <ImportFooter onFile={handleFile} />
        </>
      )}
      {sheetFor && (
        <div
          className="sheet-backdrop"
          onClick={() => { setSheetFor(null); setConfirmDelete(false) }}
        >
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet__title">{sheetFor.title}</div>
            <div className="sheet__subtitle">{sheetFor.author || '—'}</div>
            <div className="sheet__divider" />
            {!confirmDelete ? (
              <>
                <button
                  className="sheet__action sheet__action--danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  DELETE BOOK
                </button>
                <button
                  className="sheet__action sheet__action--mute"
                  onClick={() => setSheetFor(null)}
                >
                  CANCEL
                </button>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 12,
                  opacity: 0.7,
                  padding: '12px 0 4px',
                  lineHeight: 1.5,
                }}>
                  This will erase all highlights, notes, conversations, and reading progress for this book.
                </div>
                <button
                  className="sheet__action sheet__action--danger"
                  onClick={async () => {
                    const id = sheetFor.id
                    setSheetFor(null)
                    setConfirmDelete(false)
                    await deleteBook(id)
                    await load()
                  }}
                >
                  YES, DELETE FOREVER
                </button>
                <button
                  className="sheet__action sheet__action--mute"
                  onClick={() => setConfirmDelete(false)}
                >
                  ← BACK
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {importing && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: 'var(--ls-mono)',
          color: '#fff',
          zIndex: 200,
        }}>
          IMPORTING…
        </div>
      )}
    </main>
  )
}
