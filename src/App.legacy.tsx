// @ts-nocheck
import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import ePub from 'epubjs'
import JSZip from 'jszip'
import type { NavItem } from 'epubjs/types/navigation'
import Reader from './components/Reader/Reader'
import type { ReaderHandle } from './components/Reader/Reader'
import Sidebar from './components/Sidebar/Sidebar'
import type { SidebarHandle } from './components/Sidebar/Sidebar'
import CharacterSelect from './components/CharacterSelect/CharacterSelect'
import CharacterCreate from './components/CharacterCreate/CharacterCreate'
import Settings from './components/Settings/Settings'
import Bookshelf from './components/Bookshelf/Bookshelf'
import YearReport from './components/YearReport/YearReport'
import type { Character, ReadingMode, Message, OpinionCard, BookState, PreReadData, Highlight, Bookmark, ReadingSession, BookCharacterProfile } from './types'
import type { StoredBook } from './store'
import {
  getBookState, saveBookState, getLLMConfig,
  saveBook, updateBookState, updateBookLocation, extractCoverFromEpub,
  getCustomCharacters, addReadingTime,
} from './store'
import { PRESET_CHARACTERS } from './characters/presets'
import { chatCompletion } from './services/llm'
import { buildPreReadPrompt, buildBookSummaryPrompt, buildCharacterExtractionPrompt } from './services/prompt'
import './App.legacy.css'

type AppView = 'home' | 'bookshelf' | 'character-select' | 'reading' | 'stats'

// Static star data: [x%, y%, sizePx, delayS, bright?]
const STAR_DATA: Array<[number, number, number, number, boolean]> = [
  [3,5,1,0,false],[8,12,1.5,1.3,false],[15,3,1,2.1,false],[22,18,1,0.7,false],[28,7,1.5,3.2,false],
  [35,15,1,1.8,false],[42,4,1,0.4,false],[48,20,1.5,2.6,false],[55,9,1,1.1,false],[62,16,1,3.8,false],
  [68,3,1.5,0.9,false],[75,13,1,2.4,false],[82,6,1,1.6,false],[88,19,1.5,3.5,false],[93,8,1,0.2,false],
  [5,32,1,2.8,false],[12,40,1.5,0.6,false],[18,28,1,1.9,false],[25,45,1,3.3,false],[32,35,1,0.8,false],
  [38,42,1.5,2.2,false],[45,30,1,1.4,false],[52,48,1,3.7,false],[58,38,1.5,0.3,false],[65,25,1,1.7,false],
  [72,43,1,2.9,false],[78,32,1.5,0.5,false],[85,40,1,1.2,false],[91,26,1,3.1,false],[97,35,1.5,2.0,false],
  [2,58,1,0.7,false],[10,65,1.5,2.3,false],[17,52,1,1.0,false],[24,70,1,3.6,false],[30,60,1.5,0.4,false],
  [37,55,1,1.8,false],[44,68,1,2.7,false],[50,62,1.5,0.1,false],[57,58,1,3.4,false],[64,72,1,1.5,false],
  [70,55,1.5,2.0,false],[77,62,1,0.6,false],[84,68,1,1.3,false],[90,58,1.5,3.0,false],[96,72,1,2.5,false],
  [6,80,1,1.1,false],[13,88,1.5,0.8,false],[20,75,1,2.4,false],[27,82,1,3.7,false],[33,90,1.5,1.6,false],
  [40,78,1,0.3,false],[47,85,1,2.9,false],[54,80,1.5,1.8,false],[60,72,1,0.9,false],[67,88,1,3.2,false],
  [73,78,1.5,1.4,false],[80,85,1,2.1,false],[87,80,1,0.6,false],[94,75,1.5,3.5,false],
  // Bright glowing stars
  [12,8,2.5,0,true],[35,22,2,1.5,true],[58,6,2.5,3.0,true],[80,18,2,0.8,true],
  [20,50,2.5,2.2,true],[45,38,2,0.4,true],[70,55,2.5,3.8,true],[92,42,2,1.8,true],
  [15,72,2.5,1.0,true],[40,80,2,2.7,true],[65,68,2.5,0.5,true],[88,85,2,3.3,true],
]

// Light mode sparkles: [x%, y%, sizePx, delayS, bright?]
// Colors cycle: pink → gold → lavender → rose → gold
const SPARKLE_COLORS = ['#e8a0b8', '#d4a06a', '#b899d4', '#d47090', '#c8a850']
const SPARKLE_DATA: Array<[number, number, number, number, boolean]> = [
  [4,8,1.5,0,false],[9,3,1,2.1,false],[16,14,1.5,0.9,false],[23,5,1,3.4,false],[30,11,2,1.6,false],
  [37,3,1.5,0.4,false],[44,16,1,2.8,false],[51,6,1.5,1.2,false],[58,13,1,3.7,false],[65,4,2,0.7,false],
  [72,17,1.5,2.3,false],[79,8,1,1.0,false],[86,15,1.5,3.1,false],[92,4,1,0.5,false],[97,11,2,2.6,false],
  [6,30,1,1.8,false],[13,38,1.5,3.2,false],[20,25,1,0.3,false],[27,43,2,1.9,false],[34,32,1.5,3.6,false],
  [41,40,1,0.8,false],[48,27,1.5,2.4,false],[55,45,1,1.3,false],[62,35,2,3.9,false],[69,28,1.5,0.6,false],
  [76,42,1,2.0,false],[83,30,1.5,1.5,false],[90,38,1,3.3,false],[96,26,2,0.2,false],
  [3,55,1.5,2.7,false],[11,62,1,0.9,false],[18,50,2,3.5,false],[25,68,1.5,1.4,false],[32,57,1,2.9,false],
  [39,65,1.5,0.1,false],[46,52,1,1.7,false],[53,70,2,3.0,false],[60,60,1.5,0.8,false],[67,55,1,2.5,false],
  [74,63,1.5,1.1,false],[81,58,1,3.8,false],[88,65,2,0.4,false],[94,52,1.5,2.2,false],
  [7,80,1,1.6,false],[14,88,1.5,3.1,false],[21,76,2,0.7,false],[28,83,1,2.4,false],[35,90,1.5,1.0,false],
  [42,78,1,3.6,false],[49,85,2,0.3,false],[56,80,1.5,1.9,false],[63,88,1,2.8,false],[70,76,2,0.6,false],
  [77,84,1.5,3.3,false],[84,79,1,1.5,false],[91,87,2,2.1,false],
  // Bright sparkles
  [18,10,2.5,0,true],[42,6,2.5,2.0,true],[67,14,2.5,1.0,true],[88,8,2.5,3.2,true],
  [10,45,2.5,1.5,true],[35,52,2.5,0.3,true],[62,40,2.5,2.8,true],[85,48,2.5,1.2,true],
  [22,75,2.5,3.5,true],[50,80,2.5,0.8,true],[75,72,2.5,2.3,true],[95,82,2.5,1.7,true],
]

// Theme presets with derived colors for full-page theming
const THEME_PRESETS = [
  { name: '浅粉', bg: '#fef0f3', color: '#2d1520',
    headerBg: '#fce8ef', sidebarBg: 'rgba(253,234,241,0.98)', surface: 'rgba(180,80,100,0.04)', border: 'rgba(190,130,140,0.15)', muted: '#9a7080', inputBg: 'rgba(254,240,243,0.8)', hover: 'rgba(196,80,100,0.06)',
    toolbarBg: '#fce8ef', toolbarColor: '#6B4C50', toolbarBtnBg: '#f0c8d4', toolbarBtnColor: '#5C3A3F', toolbarBtnHover: '#e8b8c4', toolbarShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  { name: '浅米', bg: '#f5f0e8', color: '#2c2820',
    headerBg: '#c8c3b8', sidebarBg: 'rgba(242,237,228,0.98)', surface: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.08)', muted: '#8b8578', inputBg: 'rgba(240,235,226,0.8)', hover: 'rgba(0,0,0,0.04)',
    toolbarBg: '#EDE6DA', toolbarColor: '#5C5244', toolbarBtnBg: '#D4C9B8', toolbarBtnColor: '#4A4236', toolbarBtnHover: '#C4B8A4', toolbarShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  { name: '护眼', bg: '#e8f0e8', color: '#1a2a1a',
    headerBg: '#b0c8b0', sidebarBg: 'rgba(228,240,228,0.98)', surface: 'rgba(0,60,0,0.03)', border: 'rgba(0,80,0,0.1)', muted: '#5a7a5a', inputBg: 'rgba(220,238,220,0.8)', hover: 'rgba(0,80,0,0.05)',
    toolbarBg: '#E4EBE0', toolbarColor: '#4A5548', toolbarBtnBg: '#B8C9B2', toolbarBtnColor: '#3D4F38', toolbarBtnHover: '#A8B9A2', toolbarShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  { name: '深蓝', bg: '#0d1b2a', color: '#c8d8e8',
    headerBg: '#060e16', sidebarBg: 'rgba(10,20,32,0.95)', surface: 'rgba(100,160,220,0.04)', border: 'rgba(100,160,220,0.08)', muted: '#6a8aa8', inputBg: 'rgba(8,16,26,0.6)', hover: 'rgba(100,160,220,0.06)',
    toolbarBg: '#1C2133', toolbarColor: '#9AA0B4', toolbarBtnBg: '#2A3148', toolbarBtnColor: '#B0B8D0', toolbarBtnHover: '#363E5C', toolbarShadow: '0 1px 4px rgba(0,0,0,0.35)' },
  { name: '纯黑', bg: '#000000', color: '#cccccc',
    headerBg: '#000000', sidebarBg: 'rgba(10,10,10,0.95)', surface: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)', muted: '#666666', inputBg: 'rgba(5,5,5,0.8)', hover: 'rgba(255,255,255,0.06)',
    toolbarBg: '#1A1A1E', toolbarColor: '#A0A0A8', toolbarBtnBg: '#2E2E34', toolbarBtnColor: '#C8C8D0', toolbarBtnHover: '#3E3E46', toolbarShadow: '0 1px 4px rgba(0,0,0,0.45)' },
  { name: '白色', bg: '#ffffff', color: '#2a2a2a',
    headerBg: '#F0F0F0', sidebarBg: 'rgba(245,245,245,0.98)', surface: 'rgba(0,0,0,0.02)', border: 'rgba(0,0,0,0.07)', muted: '#888888', inputBg: 'rgba(248,248,248,0.9)', hover: 'rgba(0,0,0,0.04)',
    toolbarBg: '#FAFAFA', toolbarColor: '#4A4A4A', toolbarBtnBg: '#E8E8E8', toolbarBtnColor: '#4A4A4A', toolbarBtnHover: '#DCDCDC', toolbarShadow: '0 1px 3px rgba(0,0,0,0.05)' },
] as const

const PINK_PRESET_IDX = 0      // 浅粉 — light mode default
const DARK_BLUE_PRESET_IDX = 3 // 深蓝 — dark mode default

export default function App() {
  const [view, setView] = useState<AppView>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [homeTheme, setHomeTheme] = useState<'dark' | 'light'>('dark')

  // Book state
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null)
  const [bookId, setBookId] = useState<string>('')
  const [bookTitle, setBookTitle] = useState<string>('')
  const [initialLocation, setInitialLocation] = useState<string | undefined>(undefined)

  // Reading state
  const [character, setCharacter] = useState<Character | null>(null)
  const [readingMode, setReadingMode] = useState<ReadingMode>('thinking')
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [opinionCards, setOpinionCards] = useState<OpinionCard[]>([])

  // Chapter context
  const [chapterIndex, setChapterIndex] = useState(0)
  const [chapterHref, setChapterHref] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterContent, setChapterContent] = useState('')
  const [previousSummaries] = useState<string[]>([])
  const [tocList, setTocList] = useState<NavItem[]>([])
  const [showToc, setShowToc] = useState(false)
  const [readerHandle, setReaderHandle] = useState<ReaderHandle | null>(null)

  // Pre-read
  const [preReadData, setPreReadData] = useState<PreReadData[]>([])
  const [bookSummary, setBookSummary] = useState<string>('')
  const [preReading, setPreReading] = useState(false)
  const [preReadProgress, setPreReadProgress] = useState('')
  const [showPreRead, setShowPreRead] = useState(false)
  const [bookCharacters, setBookCharacters] = useState<BookCharacterProfile[]>([])

  // Highlights
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [selectedCfi, setSelectedCfi] = useState<string>('')
  const [showAnnotation, setShowAnnotation] = useState(false)
  const [annotationText, setAnnotationText] = useState('')

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const currentCfiRef = useRef<string>('')
  // Refs to always have up-to-date chapter info (state updates are async, refs are sync)
  const chapterIndexRef = useRef<number>(0)
  const chapterTitleRef = useRef<string>('')
  const chapterHrefRef = useRef<string>('')

  const sidebarRef = useRef<SidebarHandle>(null)

  // Reading time tracker: counts seconds while view === 'reading'
  useEffect(() => {
    if (view !== 'reading') return
    const startTs = Date.now()
    return () => {
      const elapsed = Math.round((Date.now() - startTs) / 1000)
      if (elapsed > 5) addReadingTime(elapsed)
    }
  }, [view])
  // Panel refs for click-outside
  const themePanelRef = useRef<HTMLDivElement>(null)
  const prereadPanelRef = useRef<HTMLDivElement>(null)
  const tocPanelRef = useRef<HTMLDivElement>(null)
  const bookmarksPanelRef = useRef<HTMLDivElement>(null)

  // Character switch
  const [showSwitchDialog, setShowSwitchDialog] = useState(false)

  // Bookshelf refresh key
  const [bookshelfKey, setBookshelfKey] = useState(0)

  // Character gallery
  const [showCharGallery, setShowCharGallery] = useState(false)
  const [galleryCustomChars, setGalleryCustomChars] = useState<Character[]>(getCustomCharacters)
  const [showCreateChar, setShowCreateChar] = useState(false)
  const [editingChar, setEditingChar] = useState<Character | undefined>(undefined)

  // Reader theme
  const [readerTheme, setReaderTheme] = useState<{ bg: string; color: string; fontFamily: string; fontSize: string; lineHeight: number }>({
    bg: THEME_PRESETS[DARK_BLUE_PRESET_IDX].bg, color: THEME_PRESETS[DARK_BLUE_PRESET_IDX].color, fontFamily: '"Noto Serif SC", "Source Han Serif", Georgia, serif', fontSize: '17px', lineHeight: 1.9,
  })
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [themePresetIdx, setThemePresetIdx] = useState(DARK_BLUE_PRESET_IDX)
  const [readerFlow, setReaderFlow] = useState<'scrolled-doc' | 'paginated'>('scrolled-doc')

  // Index tab hover tooltip
  const [hoveredTabIdx, setHoveredTabIdx] = useState<number | null>(null)
  const [tabTooltipPos, setTabTooltipPos] = useState({ x: 0, y: 0 })

  // Zoom level (percent: 70–150, step 10)
  const [zoomPercent, setZoomPercent] = useState(100)

  // Highlight color picker
  const [showHighlightColors, setShowHighlightColors] = useState(false)

  // Summary
  const [summary, setSummary] = useState('')

  // Roundtable mode
  const [isRoundtableMode, setIsRoundtableMode] = useState(false)
  const [roundtableCharacterIds, setRoundtableCharacterIds] = useState<string[]>([])
  const [roundtableMessages, setRoundtableMessages] = useState<Message[]>([])

  // Persist roundtable state when it changes
  useEffect(() => {
    if (!bookId) return
    const existing = getBookState(bookId)
    if (!existing) return
    const updated = { ...existing, isRoundtableMode, roundtableCharacterIds, roundtableMessages }
    saveBookState(bookId, updated)
    updateBookState(bookId, updated).catch(() => {})
  }, [isRoundtableMode, roundtableCharacterIds, roundtableMessages, bookId])

  // History
  const [showHistory, setShowHistory] = useState(false)
  const [viewingSession, setViewingSession] = useState<{ idx: number; characterName: string; timestamp: number } | null>(null)
  // Saved current session when viewing history
  const savedSessionRef = useRef<{ messages: Message[]; opinionCards: OpinionCard[] } | null>(null)
  const savedCharacterRef = useRef<typeof character>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bookDataRef = useRef<ArrayBuffer | null>(null)

  // 查看历史时，消息变化同步回写到对应 session
  useEffect(() => {
    if (!viewingSession || !bookId) return
    const state = getBookState(bookId)
    if (!state?.sessions) return
    const sessions = [...state.sessions]
    if (!sessions[viewingSession.idx]) return
    sessions[viewingSession.idx] = { ...sessions[viewingSession.idx], messages, opinionCards }
    const updated = { ...state, sessions }
    saveBookState(bookId, updated)
    updateBookState(bookId, updated).catch(() => {})
  }, [messages, opinionCards, viewingSession, bookId])

  // ===== Ctrl+scroll zoom + wheel forwarding in reading view =====
  useEffect(() => {
    if (view !== 'reading') return
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 1 : -1
        setReaderTheme(prev => ({
          ...prev,
          fontSize: Math.max(12, Math.min(28, parseInt(prev.fontSize) + delta)) + 'px',
        }))
        return
      }
      // Forward wheel to epub iframe when scrolling over non-iframe areas
      const iframe = document.querySelector('.reader-viewer iframe') as HTMLIFrameElement | null
      if (iframe?.contentWindow && (e.target as Element)?.closest?.('.reader-container') && e.target !== iframe) {
        iframe.contentWindow.scrollBy({ top: e.deltaY, left: 0 })
      }
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [view])

  // ===== Auto-save messages and opinionCards to IndexedDB =====
  const bookIdRef = useRef<string>('')
  bookIdRef.current = bookId

  useEffect(() => {
    if (!bookIdRef.current || view !== 'reading') return
    const id = bookIdRef.current
    // Save to localStorage (existing behavior)
    const state = getBookState(id)
    if (state) {
      state.messages = messages
      saveBookState(id, state)
      // Also persist to IndexedDB
      updateBookState(id, state).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    if (!bookIdRef.current || view !== 'reading') return
    const id = bookIdRef.current
    const state = getBookState(id)
    if (state) {
      state.opinionCards = opinionCards
      saveBookState(id, state)
      updateBookState(id, state).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opinionCards])

  // ===== File handling for new book =====
  async function processEpubFile(file: File) {
    if (!getLLMConfig()?.apiKey) {
      setShowSettings(true)
      return
    }

    const title = file.name.replace(/\.[^.]+$/, '')
    const id = title + '_' + Date.now().toString(36)
    setBookId(id)
    setBookTitle(title)
    setInitialLocation(undefined)

    const buffer = await file.arrayBuffer()
    // Store the original buffer
    bookDataRef.current = buffer

    // Extract cover
    const cover = await extractCoverFromEpub(buffer.slice(0))

    // Extract metadata from epub
    let author = ''
    try {
      const tempBook = ePub(buffer.slice(0) as unknown as string)
      await tempBook.ready
      const meta = await tempBook.loaded.metadata
      author = meta.creator || ''
      tempBook.destroy()
    } catch { /* ignore */ }

    // Create initial book state
    const newState: BookState = {
      meta: { title, author, cover, totalChapters: 0 },
      currentLocation: '',
      currentChapter: 0,
      characterId: '',
      readingMode: 'thinking',
      messages: [],
      opinionCards: [],
      chapterSummaries: {},
      highlights: [],
      preReadData: [],
    }

    // Save to IndexedDB
    const storedBook: StoredBook = {
      id,
      title,
      author,
      cover,
      epubData: buffer,
      bookState: newState,
      lastOpened: Date.now(),
    }
    await saveBook(storedBook)

    // Also save to localStorage for compatibility
    saveBookState(id, newState)

    // Give Reader a clone of the buffer (original stays intact)
    setBookData(buffer.slice(0))
    setView('character-select')
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processEpubFile(file)
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleDropFile(file: File) {
    processEpubFile(file)
  }

  // ===== Open book from bookshelf =====
  async function handleSelectBook(stored: StoredBook) {
    if (!getLLMConfig()?.apiKey) {
      setShowSettings(true)
      return
    }

    setBookId(stored.id)
    setBookTitle(stored.title)
    bookDataRef.current = stored.epubData

    // Restore state
    const state = stored.bookState
    saveBookState(stored.id, state) // sync to localStorage

    if (state.characterId && state.readingMode) {
      // Has character + mode -> go directly to reading
      setMessages(state.messages || [])
      setOpinionCards(state.opinionCards || [])
      setPreReadData(state.preReadData || [])
      setBookSummary(state.bookSummary || '')
      setHighlights(state.highlights || [])
      setBookmarks(state.bookmarks || [])
      setSummary(state.summary || '')
      setBookCharacters(state.bookCharacters || [])
      setReadingMode(state.readingMode)
      setIsRoundtableMode(state.isRoundtableMode || false)
      setRoundtableCharacterIds(state.roundtableCharacterIds || [])
      setRoundtableMessages(state.roundtableMessages || [])
      setInitialLocation(state.currentLocation || undefined)

      // Need to reconstruct Character object - use characterId
      // We'll set character via the select screen for simplicity
      // unless we can look it up
      const { PRESET_CHARACTERS } = await import('./characters/presets')
      const { getCustomCharacters } = await import('./store')
      const allChars = [...PRESET_CHARACTERS, ...getCustomCharacters()]
      const found = allChars.find(c => c.id === state.characterId)

      if (found) {
        setCharacter(found)
        setBookData(stored.epubData.slice(0))
        setView('reading')
        // Update lastOpened
        stored.lastOpened = Date.now()
        saveBook(stored).catch(() => {})
        return
      }
    }

    // No character selected yet, go to character select
    setBookData(stored.epubData.slice(0))
    setView('character-select')
  }

  // ===== Re-read with different character =====
  async function handleRereadBook(stored: StoredBook) {
    if (!getLLMConfig()?.apiKey) {
      setShowSettings(true)
      return
    }

    setBookId(stored.id)
    setBookTitle(stored.title)
    bookDataRef.current = stored.epubData

    // Save current session to history
    const state = stored.bookState
    if (state.characterId && state.messages.length > 0) {
      const { PRESET_CHARACTERS } = await import('./characters/presets')
      const { getCustomCharacters } = await import('./store')
      const allChars = [...PRESET_CHARACTERS, ...getCustomCharacters()]
      const charName = allChars.find(c => c.id === state.characterId)?.name || state.characterId

      const session: ReadingSession = {
        characterId: state.characterId,
        characterName: charName,
        readingMode: state.readingMode,
        messages: [...state.messages],
        opinionCards: [...state.opinionCards],
        timestamp: Date.now(),
      }
      const sessions = state.sessions || []
      sessions.push(session)
      state.sessions = sessions
    }

    // Clear current session but keep highlights/preread/location
    state.characterId = ''
    state.messages = []
    state.opinionCards = []
    saveBookState(stored.id, state)
    updateBookState(stored.id, state).catch(() => {})

    setMessages([])
    setOpinionCards([])
    setPreReadData(state.preReadData || [])
    setBookSummary(state.bookSummary || '')
    setHighlights(state.highlights || [])
    setBookmarks(state.bookmarks || [])
    setBookCharacters(state.bookCharacters || [])
    setInitialLocation(state.currentLocation || undefined)
    setBookData(stored.epubData.slice(0))
    setView('character-select')
  }

  function handleAddBook() {
    if (!getLLMConfig()?.apiKey) {
      setShowSettings(true)
      return
    }
    fileInputRef.current?.click()
  }

  function handleCharacterSelected(char: Character, mode: ReadingMode) {
    setCharacter(char)
    setReadingMode(mode)

    const existing = getBookState(bookId)
    if (existing) {
      // Restore existing messages if any, update character/mode
      setMessages(existing.messages)
      setOpinionCards(existing.opinionCards)
      setPreReadData(existing.preReadData || [])
      setHighlights(existing.highlights || [])
      setSummary(existing.summary || '')
      setBookCharacters(existing.bookCharacters || [])
      existing.characterId = char.id
      existing.readingMode = mode
      saveBookState(bookId, existing)
      updateBookState(bookId, existing).catch(() => {})
    } else {
      const newState: BookState = {
        meta: { title: bookTitle, author: '', totalChapters: 0 },
        currentLocation: '',
        currentChapter: 0,
        characterId: char.id,
        readingMode: mode,
        messages: [],
        opinionCards: [],
        chapterSummaries: {},
        highlights: [],
        preReadData: [],
      }
      saveBookState(bookId, newState)
      updateBookState(bookId, newState).catch(() => {})
    }

    setView('reading')
  }

  const handleTextSelected = useCallback((text: string, cfiRange: string) => {
    setSelectedText(text)
    setSelectedCfi(cfiRange)
    setShowHighlightColors(false)
  }, [])

  const handleChapterChange = useCallback((index: number, title: string, content: string, _href: string) => {
    setChapterContent(content)
    // index/title/href already set by handleChapterMeta (fired before text extraction)
    // Keep refs in sync in case meta wasn't called (e.g. book.ready re-sync)
    chapterIndexRef.current = index
    if (title) chapterTitleRef.current = title
  }, [])

  const handleChapterMeta = useCallback((index: number, title: string, href: string) => {
    setChapterIndex(index)
    setChapterHref(href)
    if (title) setChapterTitle(title)
    chapterIndexRef.current = index
    if (title) chapterTitleRef.current = title
    chapterHrefRef.current = href
  }, [])

  const handleBookLoaded = useCallback((_title: string, author: string, _toc: NavItem[]) => {
    setBookTitle(prev => prev || _title)
    setTocList(_toc)
    const state = getBookState(bookId)
    if (state) {
      state.meta.title = _title || state.meta.title
      state.meta.author = author
      saveBookState(bookId, state)
      updateBookState(bookId, state).catch(() => {})
    }
  }, [bookId])

  // ===== Save reading position on location change =====
  const handleLocationChange = useCallback((location: string) => {
    currentCfiRef.current = location
    if (!bookId) return
    const state = getBookState(bookId)
    if (state) {
      state.currentLocation = location
      saveBookState(bookId, state)
      updateBookLocation(bookId, location).catch(() => {})
    }
  }, [bookId])

  // ===== Selection Action Bar =====
  function handleActionRead() {
    if (!selectedText) return
    sidebarRef.current?.triggerAI(selectedText)
    setSelectedText(null)
    setSelectedCfi('')
  }

  // (highlight color picker now handles highlighting directly via handleAddHighlight)

  function handleActionAnnotate() {
    setShowAnnotation(true)
  }

  function handleSaveAnnotation() {
    if (!selectedText || !selectedCfi) return
    const h: Highlight = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfiRange: selectedCfi,
      text: selectedText,
      note: annotationText,
      color: 'rgba(147, 130, 255, 0.3)',
      chapterIndex,
      timestamp: Date.now(),
    }
    readerHandle?.addHighlight(selectedCfi, h.color)
    const updated = [...highlights, h]
    setHighlights(updated)
    const state = getBookState(bookId)
    if (state) {
      state.highlights = updated
      saveBookState(bookId, state)
      updateBookState(bookId, state).catch(() => {})
    }
    setSelectedText(null)
    setSelectedCfi('')
    setAnnotationText('')
    setShowAnnotation(false)
  }

  function handleDismissSelection() {
    setSelectedText(null)
    setSelectedCfi('')
    setShowAnnotation(false)
    setAnnotationText('')
    setShowHighlightColors(false)
  }

  // ===== Highlight =====
  function handleAddHighlight(color = 'rgba(255, 223, 0, 0.3)') {
    if (!selectedText || !selectedCfi) return
    const h: Highlight = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfiRange: selectedCfi,
      text: selectedText,
      note: '',
      color,
      chapterIndex,
      timestamp: Date.now(),
    }
    readerHandle?.addHighlight(selectedCfi, color)
    const updated = [...highlights, h]
    setHighlights(updated)
    // Save
    const state = getBookState(bookId)
    if (state) {
      state.highlights = updated
      saveBookState(bookId, state)
      updateBookState(bookId, state).catch(() => {})
    }
  }

  // Auto-save highlights
  useEffect(() => {
    if (!bookIdRef.current || view !== 'reading') return
    const id = bookIdRef.current
    const state = getBookState(id)
    if (state) {
      state.highlights = highlights
      saveBookState(id, state)
      updateBookState(id, state).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights])

  // ===== Bookmarks =====
  function handleAddBookmark() {
    const cfi = currentCfiRef.current
    if (!cfi) return
    const curIndex = chapterIndexRef.current
    const curTitle = chapterTitleRef.current
    const bm: Bookmark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfi,
      label: curTitle || `第${curIndex + 1}章`,
      chapterIndex: curIndex,
      timestamp: Date.now(),
    }
    setBookmarks(prev => [...prev, bm])
  }

  // Auto-save bookmarks
  useEffect(() => {
    if (!bookIdRef.current || view !== 'reading') return
    const id = bookIdRef.current
    const state = getBookState(id)
    if (state) {
      state.bookmarks = bookmarks
      saveBookState(id, state)
      updateBookState(id, state).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks])

  // Click-outside handler for all panels
  useEffect(() => {
    if (view !== 'reading') return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (showThemePicker && themePanelRef.current && !themePanelRef.current.contains(target)) {
        setShowThemePicker(false)
      }
      if (showPreRead && prereadPanelRef.current && !prereadPanelRef.current.contains(target)) {
        setShowPreRead(false)
      }
      if (showToc && tocPanelRef.current && !tocPanelRef.current.contains(target)) {
        setShowToc(false)
      }
      if (showBookmarks && bookmarksPanelRef.current && !bookmarksPanelRef.current.contains(target)) {
        setShowBookmarks(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [view, showThemePicker, showPreRead, showToc, showBookmarks])

  // Auto-save summary
  useEffect(() => {
    if (!bookIdRef.current || view !== 'reading' || !summary) return
    const id = bookIdRef.current
    const state = getBookState(id)
    if (state) {
      state.summary = summary
      saveBookState(id, state)
      updateBookState(id, state).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary])

  // ===== AI Pre-read =====
  // 用JSZip直接解压epub，读取所有HTML/XHTML文件的纯文本
  async function extractAllChaptersText(data: ArrayBuffer): Promise<Array<{ index: number; href: string; label: string; text: string }>> {
    const zip = await JSZip.loadAsync(data.slice(0))
    const chapters: Array<{ index: number; href: string; label: string; text: string }> = []

    // 先解析 container.xml 找到 opf 文件
    const containerXml = await zip.file('META-INF/container.xml')?.async('text')
    let opfPath = ''
    if (containerXml) {
      const match = containerXml.match(/full-path="([^"]+)"/)
      if (match) opfPath = match[1]
    }

    // 解析 opf 找到 spine 顺序和 manifest
    let spineOrder: string[] = []
    const manifest: Record<string, { href: string; mediaType: string }> = {}
    let opfDir = ''

    if (opfPath) {
      opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
      const opfXml = await zip.file(opfPath)?.async('text')
      if (opfXml) {
        // 解析 manifest
        const manifestRegex = /<item\s[^>]*id="([^"]*)"[^>]*href="([^"]*)"[^>]*media-type="([^"]*)"[^>]*\/?>/g
        let m
        while ((m = manifestRegex.exec(opfXml)) !== null) {
          manifest[m[1]] = { href: m[2], mediaType: m[3] }
        }
        // 也匹配属性顺序不同的情况
        const manifestRegex2 = /<item\s[^>]*href="([^"]*)"[^>]*id="([^"]*)"[^>]*media-type="([^"]*)"[^>]*\/?>/g
        while ((m = manifestRegex2.exec(opfXml)) !== null) {
          if (!manifest[m[2]]) {
            manifest[m[2]] = { href: m[1], mediaType: m[3] }
          }
        }

        // 解析 spine
        const spineRegex = /<itemref\s[^>]*idref="([^"]*)"[^>]*\/?>/g
        while ((m = spineRegex.exec(opfXml)) !== null) {
          spineOrder.push(m[1])
        }
      }
    }

    // 如果解析不到spine，直接按文件名找所有html/xhtml
    if (spineOrder.length === 0) {
      const htmlFiles: string[] = []
      zip.forEach((path, file) => {
        if (!file.dir && (path.endsWith('.html') || path.endsWith('.xhtml') || path.endsWith('.htm'))) {
          htmlFiles.push(path)
        }
      })
      htmlFiles.sort()
      for (let i = 0; i < htmlFiles.length; i++) {
        try {
          const html = await zip.file(htmlFiles[i])?.async('text')
          if (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const text = doc.body?.innerText || ''
            if (text.trim().length > 30) {
              chapters.push({ index: i, href: htmlFiles[i], label: `第${i + 1}节`, text: text.trim() })
            }
          }
        } catch { /* skip */ }
      }
    } else {
      // 按spine顺序读取
      // 同时试图获取toc匹配标题
      const tocLabels: Record<string, string> = {}
      for (const t of tocList) {
        const href = t.href.split('#')[0]
        tocLabels[href] = t.label?.trim() || ''
      }

      for (let i = 0; i < spineOrder.length; i++) {
        const itemId = spineOrder[i]
        const item = manifest[itemId]
        if (!item) continue
        if (!item.mediaType.includes('html') && !item.mediaType.includes('xml')) continue

        const fullPath = opfDir + item.href
        try {
          const html = await zip.file(fullPath)?.async('text')
          if (!html) continue
          const doc = new DOMParser().parseFromString(html, 'text/html')
          const text = doc.body?.innerText || ''
          if (text.trim().length > 30) {
            // 匹配toc标题
            let label = tocLabels[item.href] || tocLabels[fullPath] || ''
            if (!label) {
              for (const [href, lbl] of Object.entries(tocLabels)) {
                if (item.href.includes(href) || href.includes(item.href) || fullPath.includes(href) || href.includes(fullPath)) {
                  label = lbl
                  break
                }
              }
            }
            chapters.push({
              index: i,
              href: item.href,
              label: label || `第${i + 1}节`,
              text: text.trim(),
            })
          }
        } catch (err) {
          console.warn(`Extract ${fullPath} failed:`, err)
        }
      }
    }

    console.log(`JSZip extracted ${chapters.length} chapters, spine had ${spineOrder.length} items`)
    return chapters
  }

  async function handlePreRead(mode: 'toc-item' | 'all', tocHref?: string, tocLabel?: string) {
    const config = getLLMConfig()
    if (!config || !bookDataRef.current) {
      setPreReadProgress('错误：没有API配置或书籍数据')
      return
    }

    setPreReading(true)
    setPreReadProgress('正在提取章节内容...')
    const results: PreReadData[] = [...preReadData]

    try {
      // 一次性提取所有章节文本
      const allSpineItems = await extractAllChaptersText(bookDataRef.current)
      console.log(`Extracted ${allSpineItems.length} spine items from epub`)

      if (allSpineItems.length === 0) {
        setPreReadProgress('无法从epub中提取文本内容')
        setTimeout(() => { setPreReading(false); setPreReadProgress('') }, 2000)
        return
      }

      // 用目录过滤出真正的"章节"（而非扉页、版权页等）
      // 如果有目录，只预读目录中列出的章节
      let chapters = allSpineItems
      if (tocList.length > 0) {
        const tocChapters: typeof allSpineItems = []
        for (const toc of tocList) {
          const tocHref = toc.href.split('#')[0]
          const matched = allSpineItems.find(s => {
            const sHref = s.href.split('#')[0]
            return sHref === tocHref || sHref.endsWith('/' + tocHref) || tocHref.endsWith('/' + sHref) || sHref.includes(tocHref) || tocHref.includes(sHref)
          })
          if (matched && !tocChapters.find(c => c.href === matched.href)) {
            tocChapters.push({ ...matched, label: toc.label?.trim() || matched.label })
          }
        }
        if (tocChapters.length > 0) {
          chapters = tocChapters
          console.log(`Filtered to ${chapters.length} TOC chapters from ${allSpineItems.length} spine items`)
        }
      }

      if (mode === 'toc-item') {
        // Match the TOC item href against extracted spine items
        const targetHref = (tocHref || '').split('#')[0]
        const target =
          allSpineItems.find(c => {
            const cHref = c.href.split('#')[0]
            return cHref === targetHref || cHref.endsWith('/' + targetHref) || targetHref.endsWith('/' + cHref) || cHref.includes(targetHref) || targetHref.includes(cHref)
          }) ||
          chapters[0]

        if (!target) {
          setPreReadProgress('找不到对应章节内容')
          setTimeout(() => { setPreReading(false); setPreReadProgress('') }, 1500)
          return
        }

        // Use the TOC label (more accurate than spine item label)
        const label = tocLabel || target.label

        if (results.find(r => {
          const rHref = r.href.split('#')[0]
          const tHref = target.href.split('#')[0]
          return rHref === tHref || rHref.includes(tHref) || tHref.includes(rHref)
        })) {
          setPreReadProgress(`"${label}" 已预读过`)
          setTimeout(() => { setPreReading(false); setPreReadProgress('') }, 1500)
          return
        }

        setPreReadProgress(`正在预读：${label}`)
        const summary = await chatCompletion(config, [
          { role: 'system', content: '你是一个精确的文本概括助手。只输出概要，不评论。' },
          { role: 'user', content: buildPreReadPrompt(label, target.text.slice(0, 8000)) },
        ])
        results.push({ chapterIndex: target.index, href: target.href, label, summary })
      } else {
        // 预读全部：一次调用生成全书脉络概要（500字内）
        setPreReadProgress(`发现 ${chapters.length} 个章节，正在生成全书脉络概要...`)
        const bookContent = chapters
          .map(ch => `【${ch.label}】\n${ch.text.slice(0, 1500)}`)
          .join('\n\n---\n\n')
          .slice(0, 25000)

        const newBookSummary = await chatCompletion(config, [
          { role: 'system', content: '你是一个精确的文本概括助手。只输出概要，不评论。' },
          { role: 'user', content: buildBookSummaryPrompt(bookContent) },
        ])
        setBookSummary(newBookSummary)
        const stateForSummary = getBookState(bookId)
        if (stateForSummary) {
          stateForSummary.bookSummary = newBookSummary
          saveBookState(bookId, stateForSummary)
          updateBookState(bookId, stateForSummary).catch(() => {})
        }
      }

      // 保存单章预读数据（'all' 模式不产生 per-chapter 条目）
      if (mode === 'toc-item') {
        setPreReadData(results)
        const state = getBookState(bookId)
        if (state) {
          state.preReadData = results
          saveBookState(bookId, state)
          updateBookState(bookId, state).catch(() => {})
        }
      }

      const doneLabel = mode === 'all'
        ? '全书脉络概要生成完成，正在提取人物档案…'
        : `章节预读完成，正在提取人物档案…`
      setPreReadProgress(doneLabel)

      // 人物档案提取（在预读完成后追加一轮）
      try {
        // 从 store 读最新的 profiles，避免 React state 闭包旧值
        const latestState = getBookState(bookId)
        let profiles: BookCharacterProfile[] = [...(latestState?.bookCharacters || [])]

        // chaptersToExtract：toc-item 模式用 chapters（有 text），all 模式也用 chapters
        const chaptersToExtract = mode === 'toc-item'
          ? (() => {
              const lastResult = results[results.length - 1]
              if (!lastResult) return []
              const rHref = lastResult.href.split('#')[0]
              return chapters.filter(c => {
                const cHref = c.href.split('#')[0]
                return cHref === rHref || cHref.includes(rHref) || rHref.includes(cHref)
              })
            })()
          : chapters

        for (const ch of chaptersToExtract) {
          const existing = profiles.length > 0 ? JSON.stringify(profiles.map(p => ({
            name: p.name, description: p.description, firstAppearance: p.firstAppearance,
          }))) : undefined
          const raw = await chatCompletion(config, [
            { role: 'system', content: '你是一个文学分析助手，专注提取书中人物档案。只输出JSON数组，不要其他内容。' },
            { role: 'user', content: buildCharacterExtractionPrompt(ch.label, ch.text, ch.index, existing) },
          ])
          const jsonMatch = raw.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const extracted: BookCharacterProfile[] = JSON.parse(jsonMatch[0])
            for (const newChar of extracted) {
              const idx = profiles.findIndex(p => p.name === newChar.name)
              if (idx >= 0) {
                profiles[idx].chaptersLog = { ...profiles[idx].chaptersLog, ...newChar.chaptersLog }
              } else {
                profiles.push(newChar)
              }
            }
          }
        }
        setBookCharacters(profiles)
        const stateAfter = getBookState(bookId)
        if (stateAfter) {
          stateAfter.bookCharacters = profiles
          saveBookState(bookId, stateAfter)
          updateBookState(bookId, stateAfter).catch(() => {})
        }
      } catch (err) {
        console.warn('Character extraction failed:', err)
      }

      const doneMsg = mode === 'all'
        ? `完成！全书脉络已生成 · ${bookCharacters.length}个人物`
        : `完成！${results.length}章记忆 · ${bookCharacters.length}个人物`
      setPreReadProgress(doneMsg)
      setTimeout(() => setPreReadProgress(''), 3000)
    } catch (err) {
      console.error('Pre-read error:', err)
      setPreReadProgress(`预读出错：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setPreReading(false)
    }
  }

  // ===== Character Switch =====
  function handleSwitchCharacter() {
    setShowSwitchDialog(true)
  }

  function confirmSwitchCharacter() {
    if (!character || !bookId) return
    // Save current session to history
    const state = getBookState(bookId)
    if (state) {
      const session: ReadingSession = {
        characterId: character.id,
        characterName: character.name,
        readingMode,
        messages: [...messages],
        opinionCards: [...opinionCards],
        timestamp: Date.now(),
      }
      const sessions = state.sessions || []
      sessions.push(session)
      state.sessions = sessions
      state.characterId = ''
      state.messages = []
      state.opinionCards = []
      saveBookState(bookId, state)
      updateBookState(bookId, state).catch(() => {})
    }
    // Reset current session and go to character select
    setMessages([])
    setOpinionCards([])
    setCharacter(null)
    setShowSwitchDialog(false)
    setView('character-select')
  }

  // ===== History viewing =====
  function handleViewSession(sessionIdx: number) {
    const sessions = getBookState(bookId)?.sessions || []
    const session = sessions[sessionIdx]
    if (!session) return
    // Save current state including character
    savedSessionRef.current = { messages: [...messages], opinionCards: [...opinionCards] }
    savedCharacterRef.current = character
    // Load history session
    setMessages(session.messages)
    setOpinionCards(session.opinionCards)
    // Switch to the character used in that session
    const allChars = [...PRESET_CHARACTERS, ...getCustomCharacters()]
    const historyChar = allChars.find(c => c.id === session.characterId)
    if (historyChar) setCharacter(historyChar)
    setViewingSession({ idx: sessionIdx, characterName: session.characterName, timestamp: session.timestamp })
    setShowHistory(false)
  }

  function handleExitHistory() {
    if (savedSessionRef.current) {
      setMessages(savedSessionRef.current.messages)
      setOpinionCards(savedSessionRef.current.opinionCards)
      savedSessionRef.current = null
    }
    if (savedCharacterRef.current) {
      setCharacter(savedCharacterRef.current)
      savedCharacterRef.current = null
    }
    setViewingSession(null)
  }

  // ===== Export =====
  function exportToMarkdown() {
    const lines: string[] = []
    lines.push(`# 《${bookTitle}》阅读笔记\n`)
    if (character) lines.push(`**伴读角色**: ${character.name}（${character.label}）\n`)
    lines.push(`**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`)

    // Highlights
    if (highlights.length > 0) {
      lines.push(`\n## 高亮与批注\n`)
      highlights.forEach(h => {
        lines.push(`> "${h.text}"\n`)
        if (h.note) lines.push(`**批注**: ${h.note}\n`)
        lines.push('')
      })
    }

    // Opinion cards
    const agreed = opinionCards.filter(c => c.userStance === 'agree')
    const disagreed = opinionCards.filter(c => c.userStance === 'disagree')
    if (opinionCards.length > 0) {
      lines.push(`\n## 观点库\n`)
      if (agreed.length > 0) {
        lines.push(`### 认同的观点\n`)
        agreed.forEach(c => {
          lines.push(`> "${c.selectedText}"\n`)
          lines.push(`**${c.characterName}**: ${c.opinion}\n`)
        })
      }
      if (disagreed.length > 0) {
        lines.push(`### 不认同的观点\n`)
        disagreed.forEach(c => {
          lines.push(`> "${c.selectedText}"\n`)
          lines.push(`**${c.characterName}**: ${c.opinion}\n`)
        })
      }
    }

    // Chat highlights
    const charMsgs = messages.filter(m => m.role === 'character' && m.content)
    if (charMsgs.length > 0) {
      lines.push(`\n## 对话精选\n`)
      charMsgs.slice(-20).forEach(m => {
        if (m.selectedText) lines.push(`> "${m.selectedText}"\n`)
        lines.push(`**${character?.name || 'AI'}**: ${m.content}\n`)
      })
    }

    const md = lines.join('\n')
    downloadFile(md, `${bookTitle}_阅读笔记.md`, 'text/markdown')
  }

  function exportToPDF() {
    // Generate HTML and use print dialog
    const lines: string[] = []
    lines.push(`<html><head><meta charset="utf-8"><title>${bookTitle} 阅读笔记</title>`)
    lines.push(`<style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8}h1{border-bottom:2px solid #6c63ff;padding-bottom:8px}h2{color:#6c63ff;margin-top:32px}h3{color:#555}blockquote{border-left:3px solid #6c63ff;padding-left:12px;color:#666;font-style:italic;margin:12px 0}strong{color:#222}.card{background:#f5f5f5;border-radius:8px;padding:12px;margin:8px 0}</style>`)
    lines.push(`</head><body>`)
    lines.push(`<h1>${bookTitle} 阅读笔记</h1>`)
    if (character) lines.push(`<p><strong>伴读角色</strong>: ${character.name}（${character.label}）</p>`)

    if (highlights.length > 0) {
      lines.push(`<h2>高亮与批注</h2>`)
      highlights.forEach(h => {
        lines.push(`<blockquote>${h.text}</blockquote>`)
        if (h.note) lines.push(`<p><strong>批注</strong>: ${h.note}</p>`)
      })
    }

    if (opinionCards.length > 0) {
      lines.push(`<h2>观点库</h2>`)
      opinionCards.forEach(c => {
        lines.push(`<div class="card"><blockquote>${c.selectedText}</blockquote>`)
        lines.push(`<p><strong>${c.characterName}</strong>: ${c.opinion}</p>`)
        if (c.userStance) lines.push(`<p style="color:${c.userStance === 'agree' ? 'green' : c.userStance === 'disagree' ? 'red' : '#999'}">${c.userStance === 'agree' ? '已认同' : c.userStance === 'disagree' ? '不认同' : 'skipped'}</p>`)
        lines.push(`</div>`)
      })
    }

    lines.push(`</body></html>`)
    const html = lines.join('\n')
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 500)
    }
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleBack() {
    // Save final state before going back
    if (bookId) {
      const state = getBookState(bookId)
      if (state) {
        state.messages = messages
        state.opinionCards = opinionCards
        state.preReadData = preReadData
        state.bookSummary = bookSummary
        state.highlights = highlights
        saveBookState(bookId, state)
        updateBookState(bookId, state).catch(() => {})
      }
    }

    setView('bookshelf')
    setCharacter(null)
    setMessages([])
    setOpinionCards([])
    setSelectedText(null)
    setSelectedCfi('')
    setBookData(null)
    setPreReadData([])
    setBookSummary('')
    setHighlights([])
    setSummary('')
    setIsRoundtableMode(false)
    setRoundtableCharacterIds([])
    setRoundtableMessages([])
    setInitialLocation(undefined)
    setViewingSession(null)
    savedSessionRef.current = null
    bookDataRef.current = null
    setBookshelfKey(k => k + 1) // refresh bookshelf
  }

  return (
    <div className="app">
      {view === 'home' && (
        <>
          <div
            className={`home ${homeTheme}`}
            onMouseMove={(e) => {
              e.currentTarget.style.setProperty('--mx', `${e.clientX}px`)
              e.currentTarget.style.setProperty('--my', `${e.clientY}px`)
            }}
          >
            <div className="home-cursor-glow" aria-hidden="true" />
            {homeTheme === 'dark' && (
              <div className="home-stars" aria-hidden="true">
                {STAR_DATA.map(([x, y, s, d, bright], i) => (
                  <span
                    key={i}
                    className={`home-star${bright ? ' bright' : ''}`}
                    style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            )}
            {homeTheme === 'light' && (
              <div className="home-sparkles" aria-hidden="true">
                {SPARKLE_DATA.map(([x, y, s, d, bright], i) => (
                  <span
                    key={i}
                    className={`home-sparkle${bright ? ' bright' : ''}`}
                    style={{
                      left: `${x}%`, top: `${y}%`, width: s, height: s,
                      animationDelay: `${d}s`,
                      background: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
                    }}
                  />
                ))}
              </div>
            )}
            {/* Theme toggle */}
            <button
              className="home-theme-toggle"
              onClick={() => {
                const next = homeTheme === 'dark' ? 'light' : 'dark'
                setHomeTheme(next)
                if (next === 'light') {
                  setThemePresetIdx(PINK_PRESET_IDX)
                  setReaderTheme(prev => ({ ...prev, bg: THEME_PRESETS[PINK_PRESET_IDX].bg, color: THEME_PRESETS[PINK_PRESET_IDX].color }))
                } else {
                  setThemePresetIdx(DARK_BLUE_PRESET_IDX)
                  setReaderTheme(prev => ({ ...prev, bg: THEME_PRESETS[DARK_BLUE_PRESET_IDX].bg, color: THEME_PRESETS[DARK_BLUE_PRESET_IDX].color }))
                }
              }}
              title={homeTheme === 'dark' ? '切换浅色' : '切换深色'}
            >
              {homeTheme === 'dark' ? '☀' : '☾'}
            </button>

            <div className="home-content">
              {/* Brand header — centered, title huge */}
              <div className="home-brand">
                <div className="home-title-wrap">
                  <h1 className="home-title">
                    {'Marginalia'.split('').map((char, i) => (
                      <span
                        key={i}
                        className="letter"
                        style={{ animationDelay: `${i * 0.07}s` }}
                      >
                        <span className="letter-inner">{char}</span>
                      </span>
                    ))}
                  </h1>
                </div>
                <p className="home-subtitle">
                  {'自定义角色卡伴读，在交互中收获观点碰撞'.split('').map((char, i) => (
                    <span
                      key={i}
                      className="sub-char"
                      style={{ animationDelay: `${1.1 + i * 0.05}s` }}
                    >{char}</span>
                  ))}
                </p>
              </div>

              {/* Main CTA — bookshelf */}
              <div className="home-main-card" onClick={() => setView('bookshelf')}>
                <div className="home-main-card-left">
                  <div className="home-main-card-label">开始阅读</div>
                  <div className="home-main-card-title">进入书架</div>
                  <div className="home-main-card-desc">导入 epub 电子书，选择伴读角色，开始一次有观点碰撞的阅读</div>
                  <div className="home-main-card-cta">进入 &rarr;</div>
                </div>
                <div className="home-main-card-deco" aria-hidden="true">
                  <div className="home-deco-line" style={{ width: 120 }} />
                  <div className="home-deco-line" style={{ width: 80 }} />
                  <div className="home-deco-line" style={{ width: 100 }} />
                  <div className="home-deco-line" style={{ width: 60 }} />
                  <div className="home-deco-line" style={{ width: 90 }} />
                </div>
              </div>

              {/* Secondary cards */}
              <div className="home-sub-cards">
                {/* API 配置 */}
                <div className="home-sub-card api" onClick={() => setShowSettings(true)}>
                  <div className="home-sub-card-header">
                    <div className="home-sub-card-label">API</div>
                    {getLLMConfig()?.apiKey ? (
                      <span className="home-card-status done">已配置</span>
                    ) : (
                      <span className="home-card-status pending">未配置</span>
                    )}
                  </div>
                  <div className="home-sub-card-title">API 配置</div>
                  <div className="home-sub-card-desc">
                    {getLLMConfig()?.apiKey
                      ? `当前使用 ${getLLMConfig()?.provider === 'claude' ? 'Claude' : getLLMConfig()?.provider === 'openai' ? 'OpenAI' : '自定义接口'}`
                      : '配置大模型 API Key 以启用伴读功能'}
                  </div>
                  <div className="home-sub-card-arrow">点击配置 &rarr;</div>
                </div>

                {/* 角色库 */}
                <div className="home-sub-card chars" onClick={() => setShowCharGallery(true)}>
                  <div className="home-sub-card-header">
                    <div className="home-sub-card-label">Characters</div>
                    <span className="home-card-status done">{PRESET_CHARACTERS.length} 个角色</span>
                  </div>
                  <div className="home-sub-card-title">角色库</div>
                  <div className="home-sub-card-desc">浏览预置伴读角色，导入书籍后可自由选择</div>
                  <div className="home-sub-card-arrow">点击查看 &rarr;</div>
                </div>

                {/* 阅读统计 */}
                <div className="home-sub-card report" onClick={() => setView('stats')}>
                  <div className="home-sub-card-header">
                    <div className="home-sub-card-label">Stats</div>
                    <span className="home-card-status done">{new Date().getFullYear()}</span>
                  </div>
                  <div className="home-sub-card-title">阅读统计</div>
                  <div className="home-sub-card-desc">阅读时长、高亮趋势、观点分布，一览你的阅读数据</div>
                  <div className="home-sub-card-arrow">点击查看 &rarr;</div>
                </div>
              </div>
            </div>
          </div>
          {/* 底部题记 */}
          <div className="home-footer-tagline">
            <span className="home-footer-cn">—我亲爱的玛珈莉亚</span>
            <span className="home-footer-en">· My Dearest Marginalia ·</span>
            <span className="home-footer-cn">—</span>
          </div>

          {/* 角色库浮层 */}
          {showCharGallery && (
            <div className={`char-gallery-overlay ${homeTheme}`} onClick={() => setShowCharGallery(false)}>
              <div className="char-gallery" onClick={e => e.stopPropagation()}>
                <div className="char-gallery-header">
                  <h2>角色库</h2>
                  <button className="char-gallery-close" onClick={() => setShowCharGallery(false)}>&#10005;</button>
                </div>
                <p className="char-gallery-hint">预置角色不可编辑。自定义角色可在书架选角时使用。</p>
                <div className="char-gallery-grid">
                  {[...PRESET_CHARACTERS, ...galleryCustomChars].map(c => (
                    <div key={c.id} className={`char-gallery-card${!c.isPreset ? ' custom' : ''}`}>
                      {!c.isPreset && (
                        <div className="char-gallery-card-actions">
                          <button className="char-gallery-edit-btn" onClick={() => { setEditingChar(c); setShowCreateChar(true) }} title="编辑">✎</button>
                          <button className="char-gallery-del-btn" onClick={() => {
                            if (!confirm(`删除「${c.name}」？`)) return
                            const updated = galleryCustomChars.filter(x => x.id !== c.id)
                            const raw = localStorage.getItem('reading-companion-custom-characters')
                            if (raw) {
                              const filtered = (JSON.parse(raw) as Character[]).filter(x => x.id !== c.id)
                              localStorage.setItem('reading-companion-custom-characters', JSON.stringify(filtered))
                            }
                            setGalleryCustomChars(updated)
                          }} title="删除">✕</button>
                        </div>
                      )}
                      <div className="char-gallery-card-avatar">
                        {c.avatar.startsWith('data:')
                          ? <img src={c.avatar} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                          : c.avatar}
                      </div>
                      <div className="char-gallery-card-name">{c.name}</div>
                      <span className="char-gallery-label">{c.label}</span>
                      <div className="char-gallery-card-desc">{c.description}</div>
                    </div>
                  ))}
                  {/* 创建角色卡 */}
                  <div className="char-gallery-card char-gallery-create-card" onClick={() => { setEditingChar(undefined); setShowCreateChar(true) }}>
                    <div className="char-gallery-card-avatar char-gallery-create-icon">+</div>
                    <div className="char-gallery-card-name">创建角色</div>
                    <div className="char-gallery-card-desc">手动填写或粘贴材料，AI 自动提取</div>
                  </div>
                </div>
              </div>
              {showCreateChar && (
                <CharacterCreate
                  onSave={(_char) => {
                    setGalleryCustomChars(getCustomCharacters())
                    setShowCreateChar(false)
                    setEditingChar(undefined)
                  }}
                  onClose={() => { setShowCreateChar(false); setEditingChar(undefined) }}
                  editChar={editingChar}
                />
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </>
      )}

      {view === 'stats' && (
        <YearReport onBack={() => setView('home')} theme={homeTheme} />
      )}
      {view === 'bookshelf' && (
        <>
          <Bookshelf
            key={bookshelfKey}
            onSelectBook={handleSelectBook}
            onRereadBook={handleRereadBook}
            onAddBook={handleAddBook}
            onOpenSettings={() => setShowSettings(true)}
            onBack={() => setView('home')}
            theme={homeTheme}
            onDropFile={handleDropFile}
            onToggleTheme={() => {
              const next = homeTheme === 'dark' ? 'light' : 'dark'
              setHomeTheme(next)
              if (next === 'light') {
                setThemePresetIdx(PINK_PRESET_IDX)
                setReaderTheme(prev => ({ ...prev, bg: THEME_PRESETS[PINK_PRESET_IDX].bg, color: THEME_PRESETS[PINK_PRESET_IDX].color }))
              } else {
                setThemePresetIdx(DARK_BLUE_PRESET_IDX)
                setReaderTheme(prev => ({ ...prev, bg: THEME_PRESETS[DARK_BLUE_PRESET_IDX].bg, color: THEME_PRESETS[DARK_BLUE_PRESET_IDX].color }))
              }
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </>
      )}

      {view === 'character-select' && (
        <CharacterSelect
          onSelect={handleCharacterSelected}
          bookTitle={bookTitle}
          theme={homeTheme}
          onBack={() => setView('home')}
        />
      )}

      {view === 'reading' && character && bookData && (
        <div className="reading-layout" style={{
          '--t-bg': THEME_PRESETS[themePresetIdx].bg,
          '--t-color': THEME_PRESETS[themePresetIdx].color,
          '--t-header': THEME_PRESETS[themePresetIdx].headerBg,
          '--t-sidebar': THEME_PRESETS[themePresetIdx].sidebarBg,
          '--t-surface': THEME_PRESETS[themePresetIdx].surface,
          '--t-border': THEME_PRESETS[themePresetIdx].border,
          '--t-muted': THEME_PRESETS[themePresetIdx].muted,
          '--t-input': THEME_PRESETS[themePresetIdx].inputBg,
          '--t-hover': THEME_PRESETS[themePresetIdx].hover,
          '--t-toolbar': THEME_PRESETS[themePresetIdx].toolbarBg,
          '--t-toolbar-color': THEME_PRESETS[themePresetIdx].toolbarColor,
          '--t-toolbar-btn': THEME_PRESETS[themePresetIdx].toolbarBtnBg,
          '--t-toolbar-btn-color': THEME_PRESETS[themePresetIdx].toolbarBtnColor,
          '--t-toolbar-btn-hover': THEME_PRESETS[themePresetIdx].toolbarBtnHover,
          '--t-toolbar-shadow': THEME_PRESETS[themePresetIdx].toolbarShadow,
        } as React.CSSProperties}>
          <div className="reading-header">
            <div className="header-group-left">
              <button className="back-btn" onClick={handleBack} title="返回书架">&#8592;</button>
              <button className="header-btn" onClick={() => setShowToc(!showToc)} title="目录">&#9776;</button>
            </div>
            <span className="reading-title">《{bookTitle}》</span>
            <div className="header-group-right">
              <span className="reading-mode-tag" title={readingMode === 'thinking' ? '当前模式：AI会深入分析文本含义' : '当前模式：AI会从写作技巧角度评析'}>
                {readingMode === 'thinking' ? '深度思考' : '写作学习'}
              </span>
              <button
                className={`header-btn ${(preReadData.length > 0 || bookSummary) ? 'preread-btn has-data' : ''}`}
                onClick={() => setShowPreRead(!showPreRead)}
                disabled={preReading}
                title="AI预读"
              >
                {preReading ? '...' : `预读${preReadData.length > 0 ? `(${preReadData.length}章)` : bookSummary ? '(全书)' : ''}`}
              </button>
              <button className="header-btn" onClick={() => setShowThemePicker(!showThemePicker)} title="阅读主题">Aa</button>
              <div className="header-btn-spacer" />
              <button className="header-btn" onClick={() => setShowBookmarks(p => !p)} title="书签列表">
                🔖{bookmarks.length > 0 ? <span className="bm-count">{bookmarks.length}</span> : null}
              </button>
              <button className="header-btn" onClick={() => setShowHistory(true)} title="历史记录">&#128337;</button>
              <button className="header-btn" onClick={handleSwitchCharacter} title="切换角色">&#128101;</button>
              <button className="header-btn" onClick={() => setShowSettings(true)} title="设置">&#9881;</button>
            </div>
          </div>

          {/* Theme picker */}
          {showThemePicker && (
            <div className="theme-picker-panel" ref={themePanelRef} onMouseDown={e => e.stopPropagation()}>
              <div className="theme-picker-section">
                <div className="theme-picker-label">背景</div>
                <div className="theme-picker-row">
                  {THEME_PRESETS.map((t, i) => (
                    <div
                      key={t.name}
                      className={`theme-swatch-wrap ${themePresetIdx === i ? 'active' : ''}`}
                      onClick={() => { setThemePresetIdx(i); setReaderTheme(prev => ({ ...prev, bg: t.bg, color: t.color })) }}
                    >
                      <div className="theme-swatch-circle" style={{ background: t.bg, borderColor: themePresetIdx === i ? '#6366f1' : 'rgba(255,255,255,0.15)' }} />
                      <span className="theme-swatch-name">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="theme-picker-section">
                <div className="theme-picker-label">字体</div>
                <div className="theme-picker-row">
                  {[
                    { name: '衬线', family: '"Noto Serif SC", "Source Han Serif", Georgia, serif' },
                    { name: '无衬线', family: '-apple-system, "Noto Sans SC", "PingFang SC", sans-serif' },
                    { name: '楷体', family: '"Kaiti SC", "STKaiti", KaiTi, serif' },
                    { name: '香萃', family: '"XiangcuiDazijiti", "Kaiti SC", serif' },
                    { name: '汇文', family: '"HuiwenMincho", "Noto Serif SC", serif' },
                    { name: '润植', family: '"RunzhiKangxi", "Noto Serif SC", serif' },
                    { name: '寒蝉仿宋', family: '"ChillHuoFangSong", "FangSong", serif' },
                  ].map(f => (
                    <button
                      key={f.name}
                      className={`theme-font-btn ${readerTheme.fontFamily === f.family ? 'active' : ''}`}
                      onClick={() => setReaderTheme(prev => ({ ...prev, fontFamily: f.family }))}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="theme-picker-section">
                <div className="theme-picker-label">字号</div>
                <div className="font-size-control">
                  <button
                    className="font-size-btn"
                    onClick={() => setReaderTheme(prev => ({ ...prev, fontSize: Math.max(12, parseInt(prev.fontSize) - 1) + 'px' }))}
                  >
                    A-
                  </button>
                  <span className="font-size-value">{parseInt(readerTheme.fontSize)}px</span>
                  <input
                    type="range"
                    className="font-size-slider"
                    min="12"
                    max="28"
                    value={parseInt(readerTheme.fontSize)}
                    onChange={e => setReaderTheme(prev => ({ ...prev, fontSize: e.target.value + 'px' }))}
                  />
                  <button
                    className="font-size-btn"
                    onClick={() => setReaderTheme(prev => ({ ...prev, fontSize: Math.min(28, parseInt(prev.fontSize) + 1) + 'px' }))}
                  >
                    A+
                  </button>
                </div>
              </div>
              <div className="theme-picker-section">
                <div className="theme-picker-label">行距</div>
                <div className="font-size-control">
                  <button
                    className="font-size-btn"
                    onClick={() => setReaderTheme(prev => ({ ...prev, lineHeight: Math.max(1.2, Math.round((prev.lineHeight - 0.1) * 10) / 10) }))}
                  >−</button>
                  <span className="font-size-value">{readerTheme.lineHeight.toFixed(1)}</span>
                  <input
                    type="range"
                    className="font-size-slider"
                    min="1.2"
                    max="2.8"
                    step="0.1"
                    value={readerTheme.lineHeight}
                    onChange={e => setReaderTheme(prev => ({ ...prev, lineHeight: parseFloat(e.target.value) }))}
                  />
                  <button
                    className="font-size-btn"
                    onClick={() => setReaderTheme(prev => ({ ...prev, lineHeight: Math.min(2.8, Math.round((prev.lineHeight + 0.1) * 10) / 10) }))}
                  >+</button>
                </div>
              </div>
              <div className="theme-picker-section">
                <div className="theme-picker-label">排版</div>
                <div className="theme-picker-row">
                  <button
                    className={`theme-font-btn ${readerFlow === 'scrolled-doc' ? 'active' : ''}`}
                    onClick={() => setReaderFlow('scrolled-doc')}
                  >
                    滚动
                  </button>
                  <button
                    className={`theme-font-btn ${readerFlow === 'paginated' ? 'active' : ''}`}
                    onClick={() => setReaderFlow('paginated')}
                  >
                    翻页
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pre-read panel */}
          {showPreRead && (
            <div className="preread-panel" ref={prereadPanelRef} onMouseDown={e => e.stopPropagation()}>
              <h3>AI预读</h3>
              <p className="preread-desc">让AI提前阅读章节，理解剧情脉络。预读结果不会显示给你（防剧透），但AI回复时会关联剧情理解。</p>
              <div className="preread-actions">
                <button
                  className="preread-action-btn"
                  onClick={() => handlePreRead('all')}
                  disabled={preReading}
                >
                  预读全部章节
                </button>
              </div>
              {preReadProgress && <div className="preread-progress">{preReadProgress}</div>}
              {tocList.length > 0 && (
                <div className="preread-toc-list">
                  {tocList.map((item, i) => {
                    const isDone = preReadData.some(d => {
                      const dHref = d.href.split('#')[0]
                      const iHref = item.href.split('#')[0]
                      return dHref === iHref || dHref.includes(iHref) || iHref.includes(dHref)
                    })
                    return (
                      <div key={i} className={`preread-toc-item ${isDone ? 'done' : ''}`}>
                        <span className="preread-toc-label">{item.label}</span>
                        <button
                          className="preread-toc-btn"
                          onClick={() => handlePreRead('toc-item', item.href, item.label?.trim())}
                          disabled={preReading || isDone}
                        >
                          {isDone ? '已预读' : '预读'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {showToc && (
            <div className="toc-panel" ref={tocPanelRef} onMouseDown={e => e.stopPropagation()}>
              <h3>目录</h3>
              {tocList.map((item, i) => (
                <div
                  key={i}
                  className="toc-item"
                  onClick={() => { readerHandle?.goToChapter(item.href); setShowToc(false) }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}

          {/* 书签面板 */}
          {showBookmarks && (
            <div className="bookmarks-panel" ref={bookmarksPanelRef} onMouseDown={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#e0e0f0' }}>书签</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="preread-action-btn" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => { handleAddBookmark(); }}>+ 添加当前位置</button>
                  <button onClick={() => setShowBookmarks(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
              </div>
              {bookmarks.length === 0 ? (
                <p className="preread-desc">暂无书签。点击上方按钮保存当前位置。</p>
              ) : (
                <div className="bookmarks-list">
                  {bookmarks.map(bm => (
                    <div key={bm.id} className="bookmark-item">
                      <div className="bookmark-label" onClick={() => { readerHandle?.goToChapter(bm.cfi); setShowBookmarks(false) }}>
                        <span>{bm.label}</span>
                        <span className="bookmark-time">{new Date(bm.timestamp).toLocaleDateString('zh-CN')}</span>
                      </div>
                      <button className="bookmark-delete" onClick={() => setBookmarks(prev => prev.filter(b => b.id !== bm.id))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 选中文字操作栏 */}
          {selectedText && (
            <div className="selection-bar">
              <div className="selection-bar-text">"{selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText}"</div>
              <div className="selection-bar-actions">
                <button className="sel-action-btn sel-read" onClick={handleActionRead}>伴读</button>
                <button className="sel-action-btn sel-highlight" onClick={() => setShowHighlightColors(p => !p)}>高亮</button>
                <button className="sel-action-btn sel-annotate" onClick={handleActionAnnotate}>批注</button>
                <button className="sel-action-btn sel-dismiss" onClick={handleDismissSelection}>×</button>
              </div>
              {showHighlightColors && (
                <div className="highlight-color-row">
                  <span className="highlight-color-label">颜色：</span>
                  {[
                    { color: 'rgba(255,223,0,0.35)',   bg: '#ffd700' },
                    { color: 'rgba(255,100,100,0.3)',  bg: '#ff6464' },
                    { color: 'rgba(100,200,120,0.3)',  bg: '#64c878' },
                    { color: 'rgba(100,160,255,0.3)',  bg: '#64a0ff' },
                    { color: 'rgba(200,100,255,0.3)',  bg: '#c864ff' },
                    { color: 'rgba(255,160,80,0.35)',  bg: '#ffa050' },
                  ].map(({ color, bg }) => (
                    <span
                      key={bg}
                      className="highlight-color-swatch"
                      style={{ background: bg }}
                      onClick={() => { handleAddHighlight(color); setShowHighlightColors(false); setSelectedText(null); setSelectedCfi('') }}
                    />
                  ))}
                </div>
              )}
              {showAnnotation && (
                <div className="annotation-input-row">
                  <input
                    type="text"
                    value={annotationText}
                    onChange={e => setAnnotationText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveAnnotation()}
                    placeholder="写下你的批注..."
                    autoFocus
                  />
                  <button onClick={handleSaveAnnotation}>保存</button>
                </div>
              )}
            </div>
          )}

          <div className="reading-body">
            {/* Chapter index tabs */}
            {tocList.length > 0 && (
              <div className="reading-index-tabs">
                {tocList.map((item, i) => {
                  // Muted low-saturation pastel colors cycling every 7
                  const TAB_COLORS = [
                    'rgba(147,197,253,0.28)',
                    'rgba(167,243,208,0.28)',
                    'rgba(253,186,116,0.28)',
                    'rgba(249,168,212,0.28)',
                    'rgba(196,181,253,0.28)',
                    'rgba(254,240,138,0.28)',
                    'rgba(165,243,252,0.28)',
                  ]
                  const itemHref = item.href.split('#')[0]
                  const curHref = chapterHref.split('#')[0]
                  const isActive = curHref
                    ? curHref === itemHref || curHref.includes(itemHref) || itemHref.includes(curHref)
                    : i === chapterIndex
                  const tabBg = isActive
                    ? 'rgba(129,140,248,0.38)'
                    : TAB_COLORS[i % TAB_COLORS.length]
                  return (
                    <div
                      key={item.href}
                      className={`reading-index-tab${isActive ? ' active' : ''}`}
                      style={{ background: tabBg }}
                      onClick={() => readerHandle?.goToChapter(item.href)}
                      onMouseEnter={e => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setHoveredTabIdx(i)
                        setTabTooltipPos({ x: r.right + 8, y: r.top + r.height / 2 })
                      }}
                      onMouseLeave={() => setHoveredTabIdx(null)}
                    >
                      <span className="index-tab-num">{tocList.length <= 50 ? i + 1 : ''}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Fixed-position tab tooltip — not clipped by overflow:hidden */}
            {hoveredTabIdx !== null && tocList[hoveredTabIdx] && (
              <div
                className="index-tab-tooltip-fixed"
                style={{ left: tabTooltipPos.x, top: tabTooltipPos.y }}
              >
                {tocList[hoveredTabIdx].label?.trim() || `第${hoveredTabIdx + 1}章`}
              </div>
            )}
            <Reader
              bookData={bookData}
              onTextSelected={handleTextSelected}
              onChapterChange={handleChapterChange}
              onChapterMeta={handleChapterMeta}
              onBookLoaded={handleBookLoaded}
              onReady={setReaderHandle}
              initialLocation={initialLocation}
              onLocationChange={handleLocationChange}
              highlights={highlights}
              tocList={tocList}
              readerTheme={readerTheme}
              flow={readerFlow}
              zoom={zoomPercent / 100}
            />
            {/* Zoom widget — bottom-right corner of reading area */}
            <div className="reading-zoom-widget">
              <button className="zoom-btn" onClick={() => setZoomPercent(p => Math.max(70, p - 10))}>−</button>
              <span className="zoom-pct" onClick={() => setZoomPercent(100)}>{zoomPercent}%</span>
              <button className="zoom-btn" onClick={() => setZoomPercent(p => Math.min(150, p + 10))}>+</button>
            </div>
            <Sidebar
              ref={sidebarRef as RefObject<SidebarHandle>}
              character={character}
              readingMode={readingMode}
              chapterIndex={chapterIndex}
              chapterTitle={chapterTitle}
              chapterContent={chapterContent}
              previousSummaries={previousSummaries}
              preReadData={preReadData}
              bookSummary={bookSummary}
              bookCharacters={bookCharacters}
              messages={messages}
              opinionCards={opinionCards}
              highlights={highlights}
              bookId={bookId}
              bookTitle={bookTitle}
              summary={summary}
              viewingHistory={viewingSession ? { characterName: viewingSession.characterName, timestamp: viewingSession.timestamp } : null}
              isRoundtableMode={isRoundtableMode}
              roundtableCharacterIds={roundtableCharacterIds}
              roundtableMessages={roundtableMessages}
              onMessagesChange={setMessages}
              onRoundtableMessagesChange={setRoundtableMessages}
              onOpinionCardsChange={setOpinionCards}
              onHighlightsChange={setHighlights}
              onSummaryChange={setSummary}
              onExitHistory={handleExitHistory}
              onExportMD={exportToMarkdown}
              onExportPDF={exportToPDF}
              onRoundtableModeChange={setIsRoundtableMode}
              onRoundtableCharactersChange={setRoundtableCharacterIds}
            />
          </div>

          {/* 切换角色确认弹窗 */}
          {showSwitchDialog && (
            <div className="dialog-overlay" onClick={() => setShowSwitchDialog(false)}>
              <div className="dialog-box" onClick={e => e.stopPropagation()}>
                <h3>切换角色</h3>
                <p>确定要切换伴读角色吗？当前的聊天记录和观点会被保存到历史记录中。</p>
                <div className="dialog-actions">
                  <button className="dialog-cancel" onClick={() => setShowSwitchDialog(false)}>取消</button>
                  <button className="dialog-confirm" onClick={confirmSwitchCharacter}>确定切换</button>
                </div>
              </div>
            </div>
          )}

          {/* 历史记录弹窗 */}
          {showHistory && (() => {
            const sessions = getBookState(bookId)?.sessions || []
            return (
              <div className="dialog-overlay" onClick={() => setShowHistory(false)}>
                <div className="history-dialog" onClick={e => e.stopPropagation()}>
                  <div className="history-header">
                    <h3>历史伴读记录</h3>
                    <button className="char-gallery-close" onClick={() => setShowHistory(false)}>&#10005;</button>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="history-empty">暂无历史记录。切换角色后，之前的对话会保存在这里。</div>
                  ) : (
                    <div className="history-list">
                      {sessions.map((s, i) => (
                        <div key={i} className="history-item" onClick={() => handleViewSession(i)} style={{ cursor: 'pointer' }}>
                          <div className="history-item-header">
                            <span className="history-char-name">{s.characterName}</span>
                            <span className="history-mode">{s.readingMode === 'thinking' ? '深度思考' : '写作学习'}</span>
                            <span className="history-time">{new Date(s.timestamp).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <div className="history-stats">
                            {s.messages.length} 条对话 · {s.opinionCards.length} 个观点
                          </div>
                          {s.messages.filter(m => m.role === 'character' && m.content).slice(-2).map((m, j) => (
                            <div key={j} className="history-preview">
                              {m.content.slice(0, 100)}{m.content.length > 100 ? '...' : ''}
                            </div>
                          ))}
                          <div className="history-action-hint">点击查看完整对话</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} theme={homeTheme} />}
    </div>
  )
}
