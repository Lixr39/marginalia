import { useState, useRef, useCallback, useEffect } from 'react'
import { chatCompletion } from '../../services/llm'
import {
  buildSystemPrompt,
  buildSelectionPrompt,
  buildRoundtableSystemPrompt,
  buildRoundtableUserPrompt,
} from '../../services/prompt'
import {
  getLLMConfig,
  generateId,
  addMessage,
  addOpinionCard,
} from '../../store'
import type { Character, Message, OpinionCard, ReadingMode } from '../../types'

/**
 * Parses optional <think>...</think> wrapper that some models (GLM, DeepSeek-R1)
 * emit before the visible content. Streaming-aware: handles partial open tag.
 * Lifted verbatim from desktop Sidebar to keep proven behavior.
 */
export function parseThinking(text: string, isStreaming = false): { thinking: string; content: string } {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/)
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim()
    const content = text.replace(/<think>[\s\S]*?<\/think>/, '').trim()
    return { thinking, content }
  }
  if (isStreaming) {
    const openMatch = text.match(/<think>([\s\S]*)$/)
    if (openMatch) return { thinking: openMatch[1].trim(), content: '' }
    if (text.match(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/)) return { thinking: '', content: '' }
  }
  return { thinking: '', content: text }
}

/**
 * Find the paragraph containing `selectedText` and return ±count paragraphs.
 * Lifted from desktop Sidebar.
 */
export function extractSurroundingParagraphs(chapterContent: string, selectedText: string, count = 3): string {
  const paragraphs = chapterContent.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20)
  if (paragraphs.length === 0) return selectedText
  const searchKey = selectedText.slice(0, 60)
  let idx = paragraphs.findIndex(p => p.includes(searchKey))
  if (idx === -1 && selectedText.length > 20) {
    idx = paragraphs.findIndex(p => p.includes(selectedText.slice(0, 20)))
  }
  if (idx === -1) return selectedText
  const start = Math.max(0, idx - count)
  const end = Math.min(paragraphs.length, idx + count + 1)
  return paragraphs.slice(start, end).join('\n\n')
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '网络连接失败，请检查网络或 API 地址配置'
  if (msg.includes('401') || msg.includes('403')) return 'API Key 无效或已过期'
  if (msg.includes('429')) return 'API 调用频率超限，请稍后再试'
  return msg
}

interface UseConversationArgs {
  bookId: string
  initialMessages: Message[]
  readingMode: ReadingMode
  chapterIndex: number
  chapterTitle: string
  chapterContent: string
  bookSummary?: string
  /** When set, every character message is also turned into an OpinionCard. */
  trackOpinionCards?: boolean
}

export function useConversation(args: UseConversationArgs) {
  const {
    bookId, initialMessages, readingMode, chapterIndex,
    chapterTitle, chapterContent, bookSummary,
    trackOpinionCards = true,
  } = args

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [streaming, setStreaming] = useState('')
  const [roundtableStreamingMap, setRoundtableStreamingMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // refs to avoid stale closures within long-running streams
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ===== Single-character: triggered by selection =====
  const triggerCharacterResponse = useCallback(async (character: Character, text: string) => {
    const config = getLLMConfig()
    if (!config) {
      alert('请先在 SETUP 配置 AI Key')
      return
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: '',
      selectedText: text,
      chapterIndex,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    addMessage(bookId, userMsg)
    setLoading(true)
    setStreaming('')

    try {
      const ctx = chapterContent
        ? extractSurroundingParagraphs(chapterContent, text)
        : text
      const systemPrompt = buildSystemPrompt(character, readingMode, {
        currentChapter: chapterIndex,
        chapterTitle,
        chapterContext: ctx,
        bookSummary,
        previousSummaries: [],
      })

      const recent = messagesRef.current.slice(-10)
      const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ]
      for (const m of recent) {
        if (m.selectedText) {
          chatMessages.push({ role: 'user', content: buildSelectionPrompt(m.selectedText, readingMode) })
        } else if (m.role === 'user') {
          chatMessages.push({ role: 'user', content: m.content })
        } else {
          chatMessages.push({ role: 'assistant', content: m.content })
        }
      }
      if (chatMessages[chatMessages.length - 1]?.role !== 'user') {
        chatMessages.push({ role: 'user', content: buildSelectionPrompt(text, readingMode) })
      }

      const raw = await chatCompletion(config, chatMessages, (chunk) => {
        setStreaming(chunk)
      })
      const { thinking, content } = parseThinking(raw)

      const charMsg: Message = {
        id: generateId(),
        role: 'character',
        content,
        thinking: thinking || undefined,
        chapterIndex,
        characterId: character.id,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, charMsg])
      addMessage(bookId, charMsg)

      if (trackOpinionCards) {
        const card: OpinionCard = {
          id: generateId(),
          messageId: charMsg.id,
          bookTitle: '',
          chapterIndex,
          selectedText: text,
          characterName: character.name,
          opinion: content,
          userStance: null,
          timestamp: Date.now(),
        }
        addOpinionCard(bookId, card)
      }
    } catch (err) {
      const errMsg: Message = {
        id: generateId(),
        role: 'character',
        content: `出错了：${friendlyError(err)}`,
        chapterIndex,
        characterId: character.id,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }, [bookId, chapterIndex, chapterTitle, chapterContent, readingMode, bookSummary, trackOpinionCards])

  // ===== Roundtable: trigger with selection or follow-up text =====
  const triggerRoundtable = useCallback(async (
    chars: Character[],
    selectedText: string,
    userMessage: string | null,
  ) => {
    const config = getLLMConfig()
    if (!config) { alert('请先在 SETUP 配置 AI Key'); return }
    if (chars.length === 0) return

    // @-mention reorder
    let order = chars
    if (userMessage) {
      const mentioned = chars.filter(c => userMessage.includes('@' + c.name))
      if (mentioned.length > 0) {
        const ids = new Set(mentioned.map(c => c.id))
        order = [...mentioned, ...chars.filter(c => !ids.has(c.id))]
      }
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: userMessage || '',
      selectedText: selectedText || undefined,
      chapterIndex,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    addMessage(bookId, userMsg)
    setLoading(true)

    const ctx = selectedText
      ? (chapterContent ? extractSurroundingParagraphs(chapterContent, selectedText) : selectedText)
      : (chapterContent ? chapterContent.slice(0, 1000) : '')

    const previousReplies: { name: string; content: string }[] = []
    for (const char of order) {
      const others = order.filter(c => c.id !== char.id)
      const systemPrompt = buildRoundtableSystemPrompt(char, readingMode, {
        currentChapter: chapterIndex,
        chapterTitle,
        chapterContext: ctx,
        bookSummary,
        previousSummaries: [],
      }, others)
      const userPrompt = buildRoundtableUserPrompt(selectedText, userMessage, previousReplies, char.name)

      setRoundtableStreamingMap(prev => ({ ...prev, [char.id]: '' }))

      try {
        const raw = await chatCompletion(config, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], (chunk) => {
          const { content } = parseThinking(chunk, true)
          setRoundtableStreamingMap(prev => ({ ...prev, [char.id]: content || chunk }))
        })

        const { thinking, content } = parseThinking(raw)
        previousReplies.push({ name: char.name, content })

        const charMsg: Message = {
          id: generateId(),
          role: 'character',
          content,
          thinking: thinking || undefined,
          chapterIndex,
          timestamp: Date.now(),
          characterId: char.id,
        }
        setMessages(prev => [...prev, charMsg])
        addMessage(bookId, charMsg)
      } catch (err) {
        const errMsg: Message = {
          id: generateId(),
          role: 'character',
          content: `[${char.name}] 出错了：${friendlyError(err)}`,
          chapterIndex,
          characterId: char.id,
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, errMsg])
      } finally {
        setRoundtableStreamingMap(prev => {
          const next = { ...prev }
          delete next[char.id]
          return next
        })
      }
    }
    setLoading(false)
  }, [bookId, chapterIndex, chapterTitle, chapterContent, readingMode, bookSummary])

  // ===== Follow-up reply (single character mode) =====
  const sendReply = useCallback(async (character: Character, text: string) => {
    const config = getLLMConfig()
    if (!config || !text.trim()) return
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      chapterIndex,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    addMessage(bookId, userMsg)
    setLoading(true)
    setStreaming('')

    try {
      const lastSelected = messagesRef.current.slice().reverse().find(m => m.selectedText)?.selectedText ?? ''
      const ctx = lastSelected
        ? (chapterContent ? extractSurroundingParagraphs(chapterContent, lastSelected) : lastSelected)
        : (chapterContent ? chapterContent.slice(0, 1000) : '')
      const systemPrompt = buildSystemPrompt(character, readingMode, {
        currentChapter: chapterIndex,
        chapterTitle,
        chapterContext: ctx,
        bookSummary,
        previousSummaries: [],
      })
      const recent = messagesRef.current.slice(-12)
      const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ]
      for (const m of recent) {
        if (m.selectedText) {
          chatMessages.push({ role: 'user', content: buildSelectionPrompt(m.selectedText, readingMode) })
        } else if (m.role === 'user') {
          chatMessages.push({ role: 'user', content: m.content })
        } else {
          chatMessages.push({ role: 'assistant', content: m.content })
        }
      }

      const raw = await chatCompletion(config, chatMessages, (chunk) => {
        setStreaming(chunk)
      })
      const { thinking, content } = parseThinking(raw)
      const charMsg: Message = {
        id: generateId(),
        role: 'character',
        content,
        thinking: thinking || undefined,
        chapterIndex,
        characterId: character.id,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, charMsg])
      addMessage(bookId, charMsg)
    } catch (err) {
      const errMsg: Message = {
        id: generateId(),
        role: 'character',
        content: `出错了：${friendlyError(err)}`,
        chapterIndex,
        characterId: character.id,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }, [bookId, chapterIndex, chapterTitle, chapterContent, readingMode, bookSummary])

  return {
    messages,
    streaming,
    roundtableStreamingMap,
    loading,
    triggerCharacterResponse,
    triggerRoundtable,
    sendReply,
  }
}
