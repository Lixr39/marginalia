import type { LLMConfig, BookState, Message, OpinionCard, Character } from '../types'

// Re-export IndexedDB functions
export {
  getAllBooks,
  getBook,
  saveBook,
  deleteBook,
  updateBookState,
  updateBookLocation,
  extractCoverFromEpub,
  addHighlight,
  deleteHighlight,
  updateHighlightNote,
  setFeaturedHighlight,
  addBookmark,
  deleteBookmark,
} from './db'
export type { StoredBook } from './db'

const STORAGE_KEYS = {
  llmConfig: 'reading-companion-llm-config',
  bookStates: 'reading-companion-book-states',
  customCharacters: 'reading-companion-custom-characters',
  currentBookId: 'reading-companion-current-book',
}

// ===== LLM Config =====
export function getLLMConfig(): LLMConfig | null {
  const raw = localStorage.getItem(STORAGE_KEYS.llmConfig)
  return raw ? JSON.parse(raw) : null
}

export function saveLLMConfig(config: LLMConfig) {
  localStorage.setItem(STORAGE_KEYS.llmConfig, JSON.stringify(config))
}

// ===== Book States (localStorage - kept for compatibility) =====
function getAllBookStates(): Record<string, BookState> {
  const raw = localStorage.getItem(STORAGE_KEYS.bookStates)
  return raw ? JSON.parse(raw) : {}
}

export function getBookState(bookId: string): BookState | null {
  const states = getAllBookStates()
  return states[bookId] || null
}

export function saveBookState(bookId: string, state: BookState) {
  const states = getAllBookStates()
  states[bookId] = state
  localStorage.setItem(STORAGE_KEYS.bookStates, JSON.stringify(states))
}

// ===== Messages =====
export function addMessage(bookId: string, message: Message) {
  const state = getBookState(bookId)
  if (!state) return
  state.messages.push(message)
  saveBookState(bookId, state)
}

export function getMessages(bookId: string): Message[] {
  const state = getBookState(bookId)
  return state?.messages || []
}

// ===== Opinion Cards =====
export function addOpinionCard(bookId: string, card: OpinionCard) {
  const state = getBookState(bookId)
  if (!state) return
  state.opinionCards.push(card)
  saveBookState(bookId, state)
}

export function updateOpinionStance(
  bookId: string,
  cardId: string,
  stance: 'agree' | 'disagree' | 'skip'
) {
  const state = getBookState(bookId)
  if (!state) return
  const card = state.opinionCards.find(c => c.id === cardId)
  if (card) {
    card.userStance = stance
    saveBookState(bookId, state)
  }
}

// ===== Custom Characters =====
export function getCustomCharacters(): Character[] {
  const raw = localStorage.getItem(STORAGE_KEYS.customCharacters)
  return raw ? JSON.parse(raw) : []
}

export function saveCustomCharacter(char: Character) {
  const chars = getCustomCharacters()
  const idx = chars.findIndex(c => c.id === char.id)
  if (idx >= 0) {
    chars[idx] = char
  } else {
    chars.push(char)
  }
  localStorage.setItem(STORAGE_KEYS.customCharacters, JSON.stringify(chars))
}

// ===== Current Book =====
export function getCurrentBookId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.currentBookId)
}

export function setCurrentBookId(id: string) {
  localStorage.setItem(STORAGE_KEYS.currentBookId, id)
}

// ===== Utils =====
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
export function saveChapterSummary(bookId: string, chapter: number, summary: string) {
  const state = getBookState(bookId)
  if (!state) return
  state.chapterSummaries[chapter] = summary
  saveBookState(bookId, state)
}

// ===== Book Recommendations History =====
const RECO_KEY = 'marginalia-book-recommendations'

export interface BookReco {
  date: string // YYYY-MM-DD
  books: Array<{ title: string; author: string; reason: string }>
}

export function getRecoHistory(): BookReco[] {
  const raw = localStorage.getItem(RECO_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveReco(reco: BookReco) {
  const history = getRecoHistory()
  history.unshift(reco)
  // Keep last 60 entries
  localStorage.setItem(RECO_KEY, JSON.stringify(history.slice(0, 60)))
}

// Stored as Record<'YYYY-MM-DD', seconds>
const READING_TIME_KEY = 'marginalia-reading-time'

export function getReadingTimeLog(): Record<string, number> {
  const raw = localStorage.getItem(READING_TIME_KEY)
  return raw ? JSON.parse(raw) : {}
}

export function addReadingTime(seconds: number) {
  if (seconds <= 0) return
  const log = getReadingTimeLog()
  const today = new Date().toISOString().slice(0, 10)
  log[today] = (log[today] || 0) + seconds
  localStorage.setItem(READING_TIME_KEY, JSON.stringify(log))
}

