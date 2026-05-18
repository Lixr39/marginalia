import type { BookState } from '../types'

const DB_NAME = 'reading-companion-db'
const DB_VERSION = 1
const STORE_NAME = 'books'

export interface StoredBook {
  id: string
  title: string
  author: string
  cover: string // base64
  epubData: ArrayBuffer
  bookState: BookState
  lastOpened: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txStore(mode: IDBTransactionMode): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
  return openDB().then(db => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    // Close DB after transaction completes
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
    return { store, tx }
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== Public API =====

export async function getAllBooks(): Promise<StoredBook[]> {
  const { store } = await txStore('readonly')
  const all = await reqToPromise(store.getAll()) as StoredBook[]
  // Sort by lastOpened descending
  return all.sort((a, b) => b.lastOpened - a.lastOpened)
}

export async function getBook(id: string): Promise<StoredBook | undefined> {
  const { store } = await txStore('readonly')
  return reqToPromise(store.get(id)) as Promise<StoredBook | undefined>
}

export async function saveBook(book: StoredBook): Promise<void> {
  const { store } = await txStore('readwrite')
  await reqToPromise(store.put(book))
}

export async function deleteBook(id: string): Promise<void> {
  const { store } = await txStore('readwrite')
  await reqToPromise(store.delete(id))
}

export async function updateBookState(id: string, state: BookState): Promise<void> {
  const existing = await getBook(id)
  if (!existing) return
  existing.bookState = state
  existing.lastOpened = Date.now()
  await saveBook(existing)
}

export async function updateBookLocation(id: string, location: string): Promise<void> {
  const existing = await getBook(id)
  if (!existing) return
  existing.bookState.currentLocation = location
  existing.lastOpened = Date.now()
  await saveBook(existing)
}

// ===== Highlights / Bookmarks =====
export async function addHighlight(bookId: string, h: import('../types').Highlight) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = [...(book.bookState.highlights ?? []), h]
  book.lastOpened = Date.now()
  await saveBook(book)
}

export async function deleteHighlight(bookId: string, highlightId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.highlights = (book.bookState.highlights ?? []).filter(h => h.id !== highlightId)
  await saveBook(book)
}

export async function updateHighlightNote(bookId: string, highlightId: string, note: string) {
  const book = await getBook(bookId)
  if (!book) return
  const h = book.bookState.highlights?.find(x => x.id === highlightId)
  if (!h) return
  h.note = note
  await saveBook(book)
}

export async function setFeaturedHighlight(bookId: string, highlightId: string | undefined) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.featuredHighlightId = highlightId
  await saveBook(book)
}

export async function addBookmark(bookId: string, bm: import('../types').Bookmark) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = [...(book.bookState.bookmarks ?? []), bm]
  book.lastOpened = Date.now()
  await saveBook(book)
}

export async function deleteBookmark(bookId: string, bookmarkId: string) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.bookmarks = (book.bookState.bookmarks ?? []).filter(b => b.id !== bookmarkId)
  await saveBook(book)
}

// ===== Messages + Opinion cards (IndexedDB-backed) =====
export async function appendMessage(
  bookId: string,
  msg: import('../types').Message,
  bucket: 'messages' | 'roundtableMessages' = 'messages',
) {
  const book = await getBook(bookId)
  if (!book) return
  const list = (book.bookState[bucket] ?? []) as import('../types').Message[]
  book.bookState[bucket] = [...list, msg]
  book.lastOpened = Date.now()
  await saveBook(book)
}

export async function removeMessage(
  bookId: string,
  msgId: string,
  bucket: 'messages' | 'roundtableMessages' = 'messages',
) {
  const book = await getBook(bookId)
  if (!book) return
  const list = (book.bookState[bucket] ?? []) as import('../types').Message[]
  book.bookState[bucket] = list.filter(m => m.id !== msgId)
  await saveBook(book)
}

export async function appendOpinionCard(bookId: string, card: import('../types').OpinionCard) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.opinionCards = [...(book.bookState.opinionCards ?? []), card]
  await saveBook(book)
}

// ===== Book tag (在读 / 已读 / 想读) =====
export async function setBookTag(bookId: string, tag: import('../types').BookTag | undefined) {
  const book = await getBook(bookId)
  if (!book) return
  book.bookState.tag = tag
  await saveBook(book)
}

/** Extract cover image from epub ArrayBuffer as base64 data URL */
export async function extractCoverFromEpub(data: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import to avoid circular deps at module level
    const ePubModule = await import('epubjs')
    const ePub = ePubModule.default
    const book = ePub(data.slice(0) as unknown as string)
    await book.ready
    const coverUrl = await book.coverUrl()
    if (!coverUrl) {
      book.destroy()
      return ''
    }
    // Fetch the blob URL and convert to base64
    const resp = await fetch(coverUrl)
    const blob = await resp.blob()
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    book.destroy()
    return base64
  } catch {
    return ''
  }
}
