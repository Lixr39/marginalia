import { useEffect, useState, useMemo } from 'react'
import { Masthead } from '../Library/Masthead'
import { SectionHeader } from '../Library/SectionHeader'
import {
  getAllBooks,
  getReadingTimeLog,
  updateOpinionStance,
  type StoredBook,
} from '../../store'
import { PRESET_CHARACTERS } from '../../characters/presets'
import { getCustomCharacters } from '../../store'
import type { Character, OpinionCard, Highlight } from '../../types'
import './Stats.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

interface OpinionWithCtx extends OpinionCard {
  bookTitleResolved: string
}

export function Stats() {
  const today = new Date()
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const yearStart = new Date(today.getFullYear(), 0, 1)

  const [books, setBooks] = useState<StoredBook[] | null>(null)
  const [allChars, setAllChars] = useState<Character[]>(PRESET_CHARACTERS)

  useEffect(() => {
    getAllBooks().then(setBooks)
    setAllChars([...PRESET_CHARACTERS, ...getCustomCharacters()])
  }, [])

  const stats = useMemo(() => {
    if (!books) return null
    const yearBooks = books // simple: all books count for now
    const finished = books.filter(b => b.bookState.tag === 'finished').length
    const highlights = books.reduce((s, b) => s + (b.bookState.highlights?.length ?? 0), 0)
    const noteCount = books.reduce(
      (s, b) => s + (b.bookState.highlights?.filter(h => h.note.trim()).length ?? 0), 0,
    )
    const summonedCount = books.reduce(
      (s, b) => s + (b.bookState.messages?.filter(m => m.role === 'character').length ?? 0)
                  + (b.bookState.roundtableMessages?.filter(m => m.role === 'character').length ?? 0), 0,
    )

    // reading time: sum log
    const log = getReadingTimeLog()
    const totalSeconds = Object.values(log).reduce((s, n) => s + n, 0)
    const readingMins = Math.round(totalSeconds / 60)

    // voice usage
    const voiceUses: Record<string, number> = {}
    for (const b of books) {
      for (const m of [...(b.bookState.messages ?? []), ...(b.bookState.roundtableMessages ?? [])]) {
        if (m.role === 'character' && m.characterId) {
          voiceUses[m.characterId] = (voiceUses[m.characterId] ?? 0) + 1
        }
      }
    }
    const topVoices = Object.entries(voiceUses)
      .map(([id, n]) => ({ id, n, char: allChars.find(c => c.id === id) }))
      .filter(v => !!v.char)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
    const maxVoiceN = topVoices[0]?.n ?? 1

    // featured highlight: longest one across all books
    let featured: { highlight: Highlight; bookTitle: string; characterReply?: string } | null = null
    for (const b of books) {
      for (const h of b.bookState.highlights ?? []) {
        if (!featured || h.text.length > featured.highlight.text.length) {
          featured = { highlight: h, bookTitle: b.title }
        }
      }
    }

    // opinion cards (all books, sorted by recent)
    const opinions: OpinionWithCtx[] = []
    for (const b of books) {
      for (const c of b.bookState.opinionCards ?? []) {
        opinions.push({ ...c, bookTitleResolved: b.title })
      }
    }
    opinions.sort((a, b) => b.timestamp - a.timestamp)

    const days = Math.max(1, Math.ceil((today.getTime() - yearStart.getTime()) / 86400000))
    const bookCadence = yearBooks.length > 0 ? Math.round(days / yearBooks.length) : 0

    return {
      bookCount: yearBooks.length,
      finished,
      highlights,
      noteCount,
      summonedCount,
      readingMins,
      topVoices,
      maxVoiceN,
      featured,
      opinions: opinions.slice(0, 12),
      bookCadence,
    }
  }, [books, allChars, today, yearStart])

  if (!books || !stats) return null

  const empty = books.length === 0

  return (
    <main className="stats">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />

      <SectionHeader
        roman="III."
        titlePrefix="The "
        titleAccent="Year"
        sub={`JAN 1 → ${formatIssueDate(today)} · ${dayOfYear} DAYS`}
        ornament
      />

      {empty ? (
        <div className="stats__empty">
          导入第一本书<br />
          数据就开始累积了。
        </div>
      ) : (
        <>
          <div className="stats__big">
            <div className="stats__big-lbl">VOLUMES IN PROGRESS</div>
            <div className="stats__big-num">{stats.bookCount}</div>
            {stats.bookCadence > 0 && (
              <div className="stats__big-sub">
                about <em>one every {stats.bookCadence} day{stats.bookCadence === 1 ? '' : 's'}</em>
              </div>
            )}
          </div>

          <div className="stats__grid">
            <div className="stats__cell">
              <div className="stats__cell-lbl">HIGHLIGHTS</div>
              <div className="stats__cell-num">{stats.highlights}</div>
            </div>
            <div className="stats__cell">
              <div className="stats__cell-lbl">NOTES</div>
              <div className="stats__cell-num">{stats.noteCount}</div>
            </div>
            <div className="stats__cell">
              <div className="stats__cell-lbl">VOICES SUMMONED</div>
              <div className="stats__cell-num">{stats.summonedCount} <small>times</small></div>
            </div>
            <div className="stats__cell">
              <div className="stats__cell-lbl">READING TIME</div>
              <div className="stats__cell-num">
                {stats.readingMins < 60
                  ? <>{stats.readingMins}<small>m</small></>
                  : <>{Math.floor(stats.readingMins / 60)}<small>h</small></>
                }
              </div>
            </div>
          </div>

          {stats.topVoices.length > 0 && (
            <>
              <SectionHeader
                roman="—"
                titlePrefix="Most-summoned "
                titleAccent="Voices"
              />
              <div className="stats__voice-bars">
                {stats.topVoices.map(v => (
                  <div key={v.id} className="stats__bar-row">
                    <div className="stats__bar-av">{v.char?.avatar}</div>
                    <div>
                      <div className="stats__bar-name">{v.char?.name}</div>
                      <div
                        className="stats__bar"
                        style={{ ['--w' as string]: `${(v.n / stats.maxVoiceN) * 100}%` }}
                      />
                    </div>
                    <div className="stats__bar-pct">{v.n}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {stats.featured && (
            <div className="stats__quote">
              {stats.featured.highlight.text}
              <span className="stats__quote-who">
                — FROM {stats.featured.bookTitle.toUpperCase()}
              </span>
            </div>
          )}

          {stats.opinions.length > 0 && (
            <>
              <SectionHeader
                roman="IV."
                titlePrefix="Opinion "
                titleAccent="Cards"
                sub={`${stats.opinions.length} CARDS · TAP TO STANCE`}
              />
              <OpinionList
                opinions={stats.opinions}
                onStanceUpdate={(bookId, cardId, stance) => {
                  updateOpinionStance(bookId, cardId, stance)
                  // refetch
                  getAllBooks().then(setBooks)
                }}
                books={books}
              />
            </>
          )}
        </>
      )}
    </main>
  )
}

function OpinionList({
  opinions,
  onStanceUpdate,
  books,
}: {
  opinions: OpinionWithCtx[]
  onStanceUpdate: (bookId: string, cardId: string, stance: 'agree' | 'disagree' | 'skip') => void
  books: StoredBook[]
}) {
  // map cardId → bookId
  const cardToBook: Record<string, string> = {}
  for (const b of books) {
    for (const c of b.bookState.opinionCards ?? []) {
      cardToBook[c.id] = b.id
    }
  }

  return (
    <>
      {opinions.map(c => {
        const bookId = cardToBook[c.id]
        return (
          <div key={c.id} className="stats__opinion-card">
            <div className="stats__opinion-card-by">
              {c.characterName} · {c.bookTitleResolved}
            </div>
            <div className="stats__opinion-card-quote">{c.selectedText}</div>
            <div className="stats__opinion-card-content">{c.opinion}</div>
            <div className="stats__opinion-card-stance">
              <button
                className={c.userStance === 'agree' ? 'active' : ''}
                onClick={() => bookId && onStanceUpdate(bookId, c.id, 'agree')}
              >✓ AGREE</button>
              <button
                className={c.userStance === 'disagree' ? 'active' : ''}
                onClick={() => bookId && onStanceUpdate(bookId, c.id, 'disagree')}
              >✕ DISAGREE</button>
              <button
                className={c.userStance === 'skip' ? 'active' : ''}
                onClick={() => bookId && onStanceUpdate(bookId, c.id, 'skip')}
              >— SKIP</button>
            </div>
          </div>
        )
      })}
    </>
  )
}
