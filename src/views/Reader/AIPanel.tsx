import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Character, Message, ReadingMode } from '../../types'
import { useConversation } from './useConversation'

interface Props {
  bookId: string
  initialMessages: Message[]
  /** Selected text that summoned this panel. Empty if user opened it manually. */
  selectedText: string
  cite: string
  characterMap: Record<string, Character>
  /** Either single character (length 1) or roundtable (length > 1). */
  characters: Character[]
  readingMode: ReadingMode
  chapterIndex: number
  chapterTitle: string
  chapterContent: string
  bookSummary?: string
  onClose: () => void
  /** Callback to swap characters mid-conversation. */
  onPickCharacters: () => void
}

export function AIPanel(props: Props) {
  const {
    bookId,
    initialMessages,
    selectedText,
    cite,
    characterMap,
    characters,
    readingMode,
    chapterIndex,
    chapterTitle,
    chapterContent,
    bookSummary,
    onClose,
    onPickCharacters,
  } = props

  const isRoundtable = characters.length > 1
  const single = characters[0]

  const conv = useConversation({
    bookId,
    initialMessages,
    readingMode,
    chapterIndex,
    chapterTitle,
    chapterContent,
    bookSummary,
  })

  const [draft, setDraft] = useState('')
  const triggeredRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-trigger first response on mount when summoned with a selection
  useEffect(() => {
    if (triggeredRef.current) return
    if (!selectedText) return
    // skip auto-trigger if the conversation already has the same selection at the tail
    const last = initialMessages[initialMessages.length - 1]
    if (last?.selectedText === selectedText) return

    triggeredRef.current = true
    if (isRoundtable) {
      conv.triggerRoundtable(characters, selectedText, null)
    } else {
      conv.triggerCharacterResponse(single, selectedText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conv.messages.length, conv.streaming, conv.roundtableStreamingMap])

  // Touch swipe to close
  const startX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current
    if (dx > 80) onClose()
  }

  const sendDraft = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    if (isRoundtable) {
      conv.triggerRoundtable(characters, '', text)
    } else {
      conv.sendReply(single, text)
    }
  }

  // Render a streaming-in-progress AI bubble at the end
  const showStreaming = !isRoundtable && conv.streaming
  const roundtableStreaming = Object.entries(conv.roundtableStreamingMap)

  return (
    <div className="ai-panel-backdrop" onClick={onClose}>
      <aside
        className="ai-panel"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="ai-panel__head">
          {isRoundtable ? (
            <button className="ai-panel__head-tag" onClick={onPickCharacters}>
              <span className="ai-panel__head-stack">
                {characters.slice(0, 4).map(c => (
                  <span key={c.id} className="ai-panel__head-av-mini">{c.avatar}</span>
                ))}
              </span>
              <span>圆桌 · {characters.length} 位 ⌄</span>
            </button>
          ) : (
            <button className="ai-panel__head-tag" onClick={onPickCharacters}>
              <span className="ai-panel__head-av">{single.avatar}</span>
              <span>{single.name} ⌄</span>
            </button>
          )}
          <button className="ai-panel__close" onClick={onClose}>✕</button>
        </div>

        {selectedText && (
          <div className="ai-panel__quote">
            <div className="ai-panel__quote-label">ORIGINAL</div>
            <div className="ai-panel__quote-body">{selectedText}</div>
            {cite && <div className="ai-panel__quote-meta">{cite}</div>}
          </div>
        )}

        <div className="ai-panel__convo" ref={scrollRef}>
          {conv.messages.length === 0 && !conv.loading && (
            <div className="ai-panel__empty">让 AI 给你第一反应…</div>
          )}
          {conv.messages.map(m => {
            const isUser = m.role === 'user'
            const charName = m.characterId ? characterMap[m.characterId]?.name : single?.name
            const charAvatar = m.characterId ? characterMap[m.characterId]?.avatar : single?.avatar
            return (
              <div key={m.id} className={'ai-bub' + (isUser ? ' ai-bub--user' : '')}>
                {!isUser && isRoundtable && charName && (
                  <div className="ai-bub__char">
                    <span className="ai-bub__char-av">{charAvatar}</span>
                    {charName}
                  </div>
                )}
                {isUser && m.selectedText && !m.content && (
                  <div className="ai-bub__from-selection">↑ 就这段</div>
                )}
                {(!isUser || m.content) && (
                  <div className="ai-bub__content">
                    {isUser ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                  </div>
                )}
              </div>
            )
          })}

          {/* in-progress streaming bubble (single mode) */}
          {showStreaming && (
            <div className="ai-bub ai-bub--streaming">
              <div className="ai-bub__content">
                <ReactMarkdown>{conv.streaming}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* in-progress streaming bubbles (roundtable: one per character) */}
          {roundtableStreaming.map(([cid, text]) => {
            const c = characters.find(x => x.id === cid)
            return (
              <div key={cid} className="ai-bub ai-bub--streaming">
                {c && (
                  <div className="ai-bub__char">
                    <span className="ai-bub__char-av">{c.avatar}</span>
                    {c.name}
                  </div>
                )}
                <div className="ai-bub__content">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              </div>
            )
          })}

          {conv.loading && !showStreaming && roundtableStreaming.length === 0 && (
            <div className="ai-bub ai-bub--streaming">
              <div className="ai-bub__content"><em>思考中…</em></div>
            </div>
          )}
        </div>

        <form
          className="ai-panel__input"
          onSubmit={e => { e.preventDefault(); sendDraft() }}
        >
          <input
            className="ai-panel__pill"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={isRoundtable ? '说点什么 · @名字 优先回应' : '说点什么…'}
            disabled={conv.loading}
          />
          <button
            type="submit"
            className="ai-panel__send"
            disabled={conv.loading || !draft.trim()}
          >
            ↑
          </button>
        </form>
      </aside>
    </div>
  )
}
