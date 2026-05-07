import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Character, ReadingMode, Message, OpinionCard, PreReadData, Highlight, BookCharacterProfile } from '../../types'
import { chatCompletion } from '../../services/llm'
import { buildSystemPrompt, buildSelectionPrompt } from '../../services/prompt'
import { getLLMConfig, generateId, addMessage, addOpinionCard, updateOpinionStance } from '../../store'
import Mindmap from '../Mindmap/Mindmap'
import type { MindmapNode } from '../Mindmap/Mindmap'
import CardExport from '../CardExport/CardExport'
import './Sidebar.css'

// 解析 <think>...</think> 标签，支持流式（未闭合的<think>）
function parseThinking(text: string, isStreaming = false): { thinking: string; content: string } {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/)
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim()
    const content = text.replace(/<think>[\s\S]*?<\/think>/, '').trim()
    return { thinking, content }
  }
  if (isStreaming) {
    const openMatch = text.match(/<think>([\s\S]*)$/)
    if (openMatch) {
      return { thinking: openMatch[1].trim(), content: '' }
    }
    if (text.match(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/)) {
      return { thinking: '', content: '' }
    }
  }
  return { thinking: '', content: text }
}

// 从章节全文中提取选段前后各 N 段作为上下文
function extractSurroundingParagraphs(chapterContent: string, selectedText: string, count = 3): string {
  const paragraphs = chapterContent.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20)
  if (paragraphs.length === 0) return selectedText

  const searchKey = selectedText.slice(0, 60)
  let idx = paragraphs.findIndex(p => p.includes(searchKey))
  if (idx === -1 && selectedText.length > 20) {
    idx = paragraphs.findIndex(p => p.includes(selectedText.slice(0, 20)))
  }
  if (idx === -1) return selectedText // 找不到就直接用选中文本

  const start = Math.max(0, idx - count)
  const end = Math.min(paragraphs.length, idx + count + 1)
  return paragraphs.slice(start, end).join('\n\n')
}

export interface SidebarHandle {
  triggerAI: (text: string) => void
}

interface Props {
  character: Character
  readingMode: ReadingMode
  chapterIndex: number
  chapterTitle: string
  chapterContent: string
  previousSummaries: string[]
  preReadData?: PreReadData[]
  bookCharacters?: BookCharacterProfile[]
  bookSummary?: string
  messages: Message[]
  opinionCards: OpinionCard[]
  highlights: Highlight[]
  bookId: string
  bookTitle: string
  summary: string
  viewingHistory?: { characterName: string; timestamp: number } | null
  onMessagesChange: (messages: Message[]) => void
  onOpinionCardsChange: (cards: OpinionCard[]) => void
  onHighlightsChange: (highlights: Highlight[]) => void
  onSummaryChange: (summary: string) => void
  onExitHistory?: () => void
  onExportMD?: () => void
  onExportPDF?: () => void
}

const Sidebar = forwardRef<SidebarHandle, Props>(function Sidebar({
  character,
  readingMode,
  chapterIndex,
  chapterTitle,
  chapterContent,
  previousSummaries,
  preReadData,
  bookCharacters,
  bookSummary,
  messages,
  opinionCards,
  highlights,
  bookId,
  bookTitle,
  summary,
  viewingHistory,
  onMessagesChange,
  onOpinionCardsChange,
  onHighlightsChange,
  onSummaryChange,
  onExitHistory,
  onExportMD,
  onExportPDF,
}, ref) {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'highlights' | 'characters'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messagesRef = useRef(messages)
  const opinionCardsRef = useRef(opinionCards)
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { opinionCardsRef.current = opinionCards }, [opinionCards])

  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [cardExportHighlight, setCardExportHighlight] = useState<Highlight | null>(null)
  const [expandedChars, setExpandedChars] = useState<Set<string>>(new Set())
  const [chatSearch, setChatSearch] = useState('')

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const resizingRef = useRef(false)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.max(300, Math.min(600, newWidth)))
    }
    const handleMouseUp = () => { resizingRef.current = false; document.body.style.cursor = '' }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp) }
  }, [])

  // +笔记片段编辑
  const [editingNoteCardId, setEditingNoteCardId] = useState<string | null>(null)
  const [editingNoteExcerpt, setEditingNoteExcerpt] = useState('')
  const [editingNoteComment, setEditingNoteComment] = useState('')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useImperativeHandle(ref, () => ({
    triggerAI: (text: string) => {
      triggerCharacterResponse(text)
    }
  }))

  const triggerCharacterResponse = useCallback(async (text: string) => {
    const config = getLLMConfig()
    if (!config) {
      alert('请先在设置中配置API')
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

    const currentMessages = [...messagesRef.current, userMsg]
    onMessagesChange(currentMessages)
    addMessage(bookId, userMsg)

    setLoading(true)
    setStreaming('')
    setActiveTab('chat')

    try {
      const chapterContext = extractSurroundingParagraphs(chapterContent, text)
      const chapterSummary = preReadData?.find(d => d.chapterIndex === chapterIndex)?.summary

      const systemPrompt = buildSystemPrompt(character, readingMode, {
        currentChapter: chapterIndex,
        chapterTitle,
        chapterContext,
        chapterSummary,
        bookSummary,
        previousSummaries,
      })

      const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ]

      const recentMsgs = currentMessages.slice(-10)
      for (const msg of recentMsgs) {
        if (msg.selectedText) {
          chatMessages.push({ role: 'user', content: buildSelectionPrompt(msg.selectedText, readingMode) })
        } else if (msg.role === 'user') {
          chatMessages.push({ role: 'user', content: msg.content })
        } else {
          chatMessages.push({ role: 'assistant', content: msg.content })
        }
      }

      if (chatMessages[chatMessages.length - 1]?.role !== 'user') {
        chatMessages.push({ role: 'user', content: buildSelectionPrompt(text, readingMode) })
      }

      const rawResponse = await chatCompletion(config, chatMessages, (chunk) => {
        setStreaming(chunk)
      })

      const { thinking, content } = parseThinking(rawResponse)

      const charMsgId = generateId()
      const charMsg: Message = {
        id: charMsgId,
        role: 'character',
        content,
        thinking: thinking || undefined,
        chapterIndex,
        timestamp: Date.now(),
      }

      const latestMessages = [...messagesRef.current, charMsg]
      onMessagesChange(latestMessages)
      addMessage(bookId, charMsg)

      const card: OpinionCard = {
        id: generateId(),
        messageId: charMsgId,
        bookTitle: '',
        chapterIndex,
        selectedText: text,
        characterName: character.name,
        opinion: content,
        userStance: null,
        timestamp: Date.now(),
      }
      const latestCards = [...opinionCardsRef.current, card]
      onOpinionCardsChange(latestCards)
      addOpinionCard(bookId, card)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      const friendly = msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? '网络连接失败，请检查网络或 API 地址配置'
        : msg.includes('401') || msg.includes('403')
        ? 'API Key 无效或已过期'
        : msg.includes('429')
        ? 'API 调用频率超限，请稍后再试'
        : msg
      const errMsg: Message = {
        id: generateId(),
        role: 'character',
        content: `出错了：${friendly}`,
        chapterIndex,
        timestamp: Date.now(),
      }
      onMessagesChange([...messagesRef.current, errMsg])
      setLastFailedAction(() => () => triggerCharacterResponse(text))
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }, [character, readingMode, chapterIndex, chapterTitle, chapterContent, previousSummaries, preReadData, bookId, onMessagesChange, onOpinionCardsChange])

  async function handleSendReply() {
    if (!input.trim() || loading) return
    const config = getLLMConfig()
    if (!config) return

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      chapterIndex,
      timestamp: Date.now(),
    }
    const currentMessages = [...messagesRef.current, userMsg]
    onMessagesChange(currentMessages)
    addMessage(bookId, userMsg)
    setInput('')
    setLoading(true)
    setStreaming('')

    try {
      // 用户回复时用最近一次选段的前后文，没有则不传段落上下文
      const lastSelected = messagesRef.current.slice().reverse().find(m => m.selectedText)?.selectedText ?? ''
      const chapterContext = lastSelected
        ? extractSurroundingParagraphs(chapterContent, lastSelected)
        : chapterContent.slice(0, 1000)
      const chapterSummary = preReadData?.find(d => d.chapterIndex === chapterIndex)?.summary

      const systemPrompt = buildSystemPrompt(character, readingMode, {
        currentChapter: chapterIndex,
        chapterTitle,
        chapterContext,
        chapterSummary,
        bookSummary,
        previousSummaries,
      })

      const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ]

      const recentMsgs = currentMessages.slice(-12)
      for (const msg of recentMsgs) {
        if (msg.selectedText) {
          chatMessages.push({ role: 'user', content: buildSelectionPrompt(msg.selectedText, readingMode) })
        } else if (msg.role === 'user') {
          chatMessages.push({ role: 'user', content: msg.content })
        } else {
          chatMessages.push({ role: 'assistant', content: msg.content })
        }
      }

      const rawResponse = await chatCompletion(config, chatMessages, (chunk) => {
        setStreaming(chunk)
      })

      const { thinking, content } = parseThinking(rawResponse)

      const charMsg: Message = {
        id: generateId(),
        role: 'character',
        content,
        thinking: thinking || undefined,
        chapterIndex,
        timestamp: Date.now(),
      }
      onMessagesChange([...messagesRef.current, charMsg])
      addMessage(bookId, charMsg)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      const friendly = msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? '网络连接失败，请检查网络或 API 地址配置'
        : msg.includes('401') || msg.includes('403')
        ? 'API Key 无效或已过期'
        : msg.includes('429')
        ? 'API 调用频率超限，请稍后再试'
        : msg
      const errMsg: Message = {
        id: generateId(),
        role: 'character',
        content: `出错了：${friendly}`,
        chapterIndex,
        timestamp: Date.now(),
      }
      onMessagesChange([...messagesRef.current, errMsg])
      setLastFailedAction(() => handleSendReply)
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }

  function handleStance(cardId: string, stance: 'agree' | 'disagree' | 'skip') {
    updateOpinionStance(bookId, cardId, stance)
    const updated = opinionCardsRef.current.map(c =>
      c.id === cardId ? { ...c, userStance: stance } : c
    )
    onOpinionCardsChange(updated)
  }

  function toggleThinking(msgId: string) {
    setExpandedThinking(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  // ===== 删除 =====
  function deleteMessage(msgId: string) {
    onMessagesChange(messages.filter(m => m.id !== msgId))
  }

  function deleteOpinionCard(cardId: string) {
    onOpinionCardsChange(opinionCards.filter(c => c.id !== cardId))
  }

  function handleQuickAddToNotes(e: React.MouseEvent, card: OpinionCard) {
    e.preventDefault()
    const h: Highlight = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfiRange: '',
      text: card.selectedText,
      note: card.opinion,
      color: 'rgba(108, 99, 255, 0.3)',
      chapterIndex,
      timestamp: Date.now(),
    }
    onHighlightsChange([...highlights, h])
  }

  function deleteHighlight(hId: string) {
    onHighlightsChange(highlights.filter(h => h.id !== hId))
  }

  // ===== +笔记（片段摘录） =====
  function handleStartNoteEdit(card: OpinionCard) {
    setEditingNoteCardId(card.id)
    setEditingNoteExcerpt(card.selectedText)
    setEditingNoteComment('')
  }

  function handleSaveNoteExcerpt() {
    if (!editingNoteExcerpt.trim()) return
    const h: Highlight = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      cfiRange: '',
      text: editingNoteExcerpt.trim(),
      note: editingNoteComment.trim(),
      color: 'rgba(108, 99, 255, 0.3)',
      chapterIndex,
      timestamp: Date.now(),
    }
    onHighlightsChange([...highlights, h])
    setEditingNoteCardId(null)
    setEditingNoteExcerpt('')
    setEditingNoteComment('')
  }

  // ===== 一键总结（流式） =====
  const [summarizing, setSummarizing] = useState(false)
  const [summaryStreaming, setSummaryStreaming] = useState('')

  // ===== Mindmap =====
  const [mindmapData, setMindmapData] = useState<MindmapNode | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [showMindmap, setShowMindmap] = useState(false)

  // 错误重试
  const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null)

  async function handleSummarize() {
    const config = getLLMConfig()
    if (!config) return
    setSummarizing(true)
    onSummaryChange('')
    setSummaryStreaming('')
    setLastFailedAction(null)
    try {
      const agreed = opinionCards.filter(c => c.userStance === 'agree')
      const disagreed = opinionCards.filter(c => c.userStance === 'disagree')
      const skipped = opinionCards.filter(c => !c.userStance || c.userStance === 'skip')
      const selectedTexts = messages.filter(m => m.selectedText).map(m => `"${m.selectedText}"`).join('\n')
      const dialogSummary = messages.filter(m => m.role === 'character' && m.content).slice(-10).map(m => m.content).join('\n---\n')
      const hlTexts = highlights.map(h => `"${h.text}"${h.note ? ` —— ${h.note}` : ''}`).join('\n')

      const systemPrompt = `你是${character.name}（${character.label}）。${character.systemPrompt.slice(0, 200)}

你刚和读者一起读完了《${bookTitle}》（或若干章节）。现在你要帮读者做一份阅读复盘。

核心原则：
- 你总结的是【读者的思考】，不是这本书讲了什么
- 读者在阅读过程中选中了哪些段落、和你讨论了什么、认同了哪些观点、反对了哪些观点——这些才是复盘的主体
- 你要用你的角色风格来写这份复盘，但内容核心是读者自己的收获
- 不要写成书评。这是一份"我读了这本书之后我变成了什么样的人"的记录

输出结构：
一、你这次阅读最关注什么（从用户选中的段落和讨论频次中提炼，不超过3个核心关注点）
二、你形成了什么立场（从认同/不认同的观点库中提炼，用角色口吻点评用户的立场——可以赞同、可以挑衅、可以追问）
三、你和我吵过的地方（列出分歧点，用角色风格回顾）
四、你可能还没想清楚的（从用户跳过/没有标记的观点中找出模糊地带，用角色风格提出一两个追问）
五、一句话总结（角色用自己的风格给这次阅读一个收尾，简短有力）`

      const userPrompt = `以下是这次阅读的数据：

【书名】《${bookTitle}》

【用户选中过的段落】
${selectedTexts || '（暂无）'}

【用户与角色的对话记录摘要】
${dialogSummary || '（暂无）'}

【观点库：用户标记"认同"的观点】
${agreed.length > 0 ? agreed.map(c => `- 原文："${c.selectedText}"\n  ${c.characterName}说：${c.opinion}`).join('\n') : '（暂无）'}

【观点库：用户标记"不认同"的观点】
${disagreed.length > 0 ? disagreed.map(c => `- 原文："${c.selectedText}"\n  ${c.characterName}说：${c.opinion}`).join('\n') : '（暂无）'}

【用户跳过/未标记的观点】
${skipped.length > 0 ? skipped.map(c => `- "${c.selectedText}" → ${c.opinion}`).join('\n') : '（暂无）'}

【用户的笔记/高亮】
${hlTexts || '（暂无）'}

请按照输出结构生成阅读复盘。`

      setActiveTab('highlights')
      const result = await chatCompletion(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], (chunk) => {
        setSummaryStreaming(chunk)
      })
      onSummaryChange(result)
      setSummaryStreaming('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      const friendly = msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? '网络连接失败，请检查网络或 API 地址是否正确'
        : msg.includes('401') || msg.includes('403')
        ? 'API Key 无效或已过期，请检查设置'
        : msg.includes('429')
        ? 'API 调用频率超限，请稍后再试'
        : `复盘生成失败：${msg}`
      onSummaryChange(friendly)
      setLastFailedAction(() => handleSummarize)
    } finally {
      setSummarizing(false)
      setSummaryStreaming('')
    }
  }

  async function handleGenerateMindmap() {
    const config = getLLMConfig()
    if (!config) return
    setMindmapLoading(true)
    try {
      const hlTexts = highlights.map(h => `${h.text}${h.note ? `（${h.note}）` : ''}`).slice(0, 10).join('\n')
      const agreedOpinions = opinionCards.filter(c => c.userStance === 'agree').map(c => c.opinion).slice(0, 8).join('\n')
      const disagreedOpinions = opinionCards.filter(c => c.userStance === 'disagree').map(c => c.opinion).slice(0, 5).join('\n')
      const selectedTexts = messages.filter(m => m.selectedText).map(m => m.selectedText!).slice(0, 8).join('\n')

      const prompt = `请根据读者对《${bookTitle}》的阅读记录，生成一份思维导图的JSON结构。

读者的高亮笔记：
${hlTexts || '（暂无）'}

读者认同的观点：
${agreedOpinions || '（暂无）'}

读者不认同的观点：
${disagreedOpinions || '（暂无）'}

读者关注的文本段落：
${selectedTexts || '（暂无）'}

要求：
- 根节点是《${bookTitle}》的核心主题或书名
- 2~4个一级主题（从读者实际关注的内容中提炼）
- 每个主题下2~4个子节点，可继续展开（最多3层深，含根节点）
- 叶节点内容具体，贴近读者实际阅读轨迹
- 如无阅读数据，基于书名提炼通用框架

只输出JSON，严格按如下格式，不要有其他文字：
{
  "label": "核心主题",
  "children": [
    {
      "label": "一级主题",
      "children": [
        { "label": "子节点" },
        { "label": "子节点", "children": [{ "label": "更深层节点" }] }
      ]
    }
  ]
}`

      const raw = await chatCompletion(config, [{ role: 'user', content: prompt }])
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('返回格式不是有效JSON')
      const data: MindmapNode = JSON.parse(jsonMatch[0])
      setMindmapData(data)
      setShowMindmap(true)
    } catch (err) {
      console.error('Mindmap generation failed:', err)
      alert('思维导图生成失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setMindmapLoading(false)
    }
  }

  const streamParsed = parseThinking(streaming, true)

  return (
    <div className="sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-resize-handle" onMouseDown={() => { resizingRef.current = true; document.body.style.cursor = 'col-resize' }} />
      {/* 查看历史记录横幅 */}
      {viewingHistory && (
        <div className="history-banner">
          <span>查看历史：{viewingHistory.characterName} · {new Date(viewingHistory.timestamp).toLocaleDateString('zh-CN')}</span>
          <button onClick={onExitHistory}>返回当前</button>
        </div>
      )}

      {/* Mindmap 覆盖层 */}
      {showMindmap && mindmapData && (
        <Mindmap root={mindmapData} bookTitle={bookTitle} onClose={() => setShowMindmap(false)} />
      )}
      {/* 书摘卡片导出 */}
      {cardExportHighlight && (
        <CardExport
          highlight={cardExportHighlight}
          bookTitle={bookTitle}
          onClose={() => setCardExportHighlight(null)}
        />
      )}
      <div className="sidebar-header">
        <div className="sidebar-character">
          <span className="sidebar-avatar">{character.avatar}</span>
          <span className="sidebar-name">{character.name}</span>
          <span className="sidebar-label">{character.label}</span>
        </div>
        <div className="sidebar-tabs">
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            对话
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            观点库 ({opinionCards.filter(c => c.userStance === 'agree').length}/{opinionCards.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'highlights' ? 'active' : ''}`}
            onClick={() => setActiveTab('highlights')}
          >
            笔记 ({highlights.length})
          </button>
          {bookCharacters && bookCharacters.length > 0 && (
            <button
              className={`tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              人物 ({bookCharacters.length})
            </button>
          )}
        </div>
      </div>

      {/* ===== 人物档案 tab ===== */}
      {activeTab === 'characters' ? (
        <div className="sidebar-notes">
          <div className="notes-toolbar">
            <span style={{ fontSize: 11, color: '#6b6b8d' }}>预读后自动生成，随章节更新</span>
          </div>
          {(!bookCharacters || bookCharacters.length === 0) ? (
            <div className="sidebar-empty">
              <div className="empty-icon">👤</div>
              <p>暂无人物档案</p>
              <p className="sidebar-empty-sub">使用"预读"功能后自动生成</p>
            </div>
          ) : (
            bookCharacters.map((char, i) => {
              const key = char.name + i
              const expanded = expandedChars.has(key)
              const hasLog = Object.keys(char.chaptersLog).length > 0
              return (
                <div
                  key={i}
                  className={`note-card char-profile-card${expanded ? ' expanded' : ''}`}
                  onClick={() => {
                    if (!hasLog) return
                    setExpandedChars(prev => {
                      const next = new Set(prev)
                      next.has(key) ? next.delete(key) : next.add(key)
                      return next
                    })
                  }}
                  style={{ cursor: hasLog ? 'pointer' : 'default' }}
                >
                  <div className="char-profile-name">{char.name}</div>
                  <div className="char-profile-desc">{char.description}</div>
                  {expanded && hasLog && (
                    <div className="char-profile-log">
                      {Object.entries(char.chaptersLog)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([ch, log]) => (
                          <div key={ch} className="char-log-item">
                            <span className="char-log-chapter">第{Number(ch) + 1}章</span>
                            <span className="char-log-text">{log}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

      /* ===== 笔记 tab ===== */
      ) : activeTab === 'highlights' ? (
        <div className="sidebar-notes">
          <div className="notes-toolbar">
            <button className="notes-tool-btn" onClick={onExportMD}>导出 MD</button>
            <button className="notes-tool-btn" onClick={onExportPDF}>导出 PDF</button>
            <button
              className="notes-tool-btn mindmap-btn"
              onClick={handleGenerateMindmap}
              disabled={mindmapLoading}
              title="根据阅读记录生成思维导图"
            >
              {mindmapLoading ? '生成中…' : '思维导图'}
            </button>
            {highlights.length > 0 && (
              <button className="notes-tool-btn danger" onClick={() => { if (confirm('清空所有笔记？')) onHighlightsChange([]) }}>清空</button>
            )}
          </div>

          {(summary || summaryStreaming) && (
            <div className="summary-card">
              <div className="summary-title">
                阅读复盘
                {summary && <button className="summary-clear-btn" onClick={() => onSummaryChange('')}>&times;</button>}
              </div>
              <div className="summary-content">
                <ReactMarkdown>{summaryStreaming || summary}</ReactMarkdown>
                {summarizing && <span className="summary-cursor">|</span>}
              </div>
            </div>
          )}

          {highlights.length === 0 && !summary && !summaryStreaming ? (
            <div className="sidebar-empty">
              <div className="empty-icon">&#128221;</div>
              <p>还没有笔记</p>
              <p className="sidebar-empty-sub">选中文字后点击"高亮"或"批注"<br/>也可以从观点库摘录片段到这里</p>
            </div>
          ) : (
            highlights.map(h => (
              <div key={h.id} className="note-card">
                <button className="item-delete-btn" onClick={() => deleteHighlight(h.id)}>&times;</button>
                <div className="highlight-color-dot" style={{ backgroundColor: h.color }} />
                <div className="note-selection">&ldquo;{h.text}&rdquo;</div>
                {h.note && <div className="note-opinion"><ReactMarkdown>{h.note}</ReactMarkdown></div>}
                <div className="note-meta">
                  {new Date(h.timestamp).toLocaleDateString('zh-CN')}
                  <button className="note-card-export-btn" onClick={() => setCardExportHighlight(h)} title="导出书摘卡片">🌸</button>
                </div>
              </div>
            ))
          )}

          {(highlights.length > 0 || opinionCards.length > 0) && (
            <button
              className="summarize-btn-bottom"
              onClick={handleSummarize}
              disabled={summarizing}
            >
              {summarizing ? '复盘生成中...' : '一键阅读复盘'}
            </button>
          )}
        </div>

      /* ===== 对话 tab ===== */
      ) : activeTab === 'chat' ? (
        <>
          <div className="sidebar-messages">
            {messages.length === 0 ? (
              <div className="sidebar-empty">
                <div className="empty-icon">{character.avatar}</div>
                <p>选中书中的文字</p>
                <p className="sidebar-empty-sub">{character.name}会告诉你ta怎么看</p>
              </div>
            ) : (
              <>
                <div className="notes-toolbar">
                  <input
                    className="chat-search-input"
                    placeholder="搜索对话…"
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                  />
                  <button className="notes-tool-btn danger" onClick={() => { if (confirm('清空所有对话？')) onMessagesChange([]) }}>清空对话</button>
                </div>
                {messages.filter(msg => {
                  if (!chatSearch.trim()) return true
                  const q = chatSearch.toLowerCase()
                  return msg.content.toLowerCase().includes(q) || msg.selectedText?.toLowerCase().includes(q)
                }).map(msg => (
                  <div key={msg.id} className={`msg msg-${msg.role}`}>
                    <button className="item-delete-btn" onClick={() => deleteMessage(msg.id)}>&times;</button>
                    {msg.selectedText && (
                      <div className="msg-selection">&ldquo;{msg.selectedText}&rdquo;</div>
                    )}
                    {msg.thinking && (
                      <div className="msg-thinking">
                        <button
                          className="thinking-toggle"
                          onClick={() => toggleThinking(msg.id)}
                        >
                          {expandedThinking.has(msg.id) ? '\u25BC' : '\u25B6'} 思考过程
                        </button>
                        {expandedThinking.has(msg.id) && (
                          <div className="thinking-content">{msg.thinking}</div>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="msg-content">
                        {msg.role === 'character' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                      </div>
                    )}
                    {msg.role === 'character' && msg.content && (() => {
                      const card = opinionCards.find(c => c.messageId === msg.id)
                      if (!card) return null
                      if (card.userStance) {
                        return (
                          <div className="msg-stance-actions">
                            <span className={`stance-tag ${card.userStance}`}>
                              {card.userStance === 'agree' ? '已认同' : card.userStance === 'disagree' ? '不认同' : 'skipped'}
                            </span>
                          </div>
                        )
                      }
                      return (
                        <div className="msg-stance-actions">
                          <button className="stance-btn agree" onClick={() => handleStance(card.id, 'agree')}>认同</button>
                          <button className="stance-btn disagree" onClick={() => handleStance(card.id, 'disagree')}>不认同</button>
                          <button className="stance-btn skip" onClick={() => handleStance(card.id, 'skip')}>skip</button>
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </>
            )}
            {streaming && (
              <div className="msg msg-character">
                {streamParsed.thinking && (
                  <div className="msg-thinking">
                    <div className="thinking-label">思考中...</div>
                    <div className="thinking-content streaming">{streamParsed.thinking}</div>
                  </div>
                )}
                {streamParsed.content && (
                  <div className="msg-content"><ReactMarkdown>{streamParsed.content}</ReactMarkdown></div>
                )}
                {!streamParsed.content && !streamParsed.thinking && (
                  <div className="msg-content"><ReactMarkdown>{streaming}</ReactMarkdown></div>
                )}
              </div>
            )}
            {loading && !streaming && (
              <div className="msg msg-character">
                <div className="msg-content typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            {lastFailedAction && !loading && (
              <div className="retry-bar">
                <button className="retry-btn" onClick={() => { setLastFailedAction(null); lastFailedAction() }}>
                  重试
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="sidebar-input">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendReply()}
              placeholder={viewingHistory ? '查看历史记录中...' : `想对${character.name}说什么...`}
              disabled={loading || !!viewingHistory}
            />
            <button onClick={handleSendReply} disabled={loading || !input.trim()}>
              发送
            </button>
          </div>
        </>

      /* ===== 观点库 tab ===== */
      ) : (
        <div className="sidebar-notes">
          {opinionCards.length > 0 && (
            <div className="notes-toolbar">
              <button className="notes-tool-btn danger" onClick={() => { if (confirm('清空所有观点？')) onOpinionCardsChange([]) }}>清空观点库</button>
            </div>
          )}
          {opinionCards.length === 0 ? (
            <div className="sidebar-empty">
              <div className="empty-icon">&#128173;</div>
              <p>还没有观点卡片</p>
              <p className="sidebar-empty-sub">选中书中文字后点击"伴读"<br/>{character.name}会发表ta的见解</p>
            </div>
          ) : (
            opinionCards.map(card => (
              <div key={card.id} className={`note-card ${card.userStance ? `stance-${card.userStance}` : ''}`} onContextMenu={(e) => handleQuickAddToNotes(e, card)} title="右键快速添加到笔记">
                <button className="item-delete-btn" onClick={() => deleteOpinionCard(card.id)}>&times;</button>
                <div className="note-selection">&ldquo;{card.selectedText}&rdquo;</div>
                <div className="note-opinion"><ReactMarkdown>{card.opinion}</ReactMarkdown></div>
                <div className="note-footer">
                  <span className="note-meta">{card.characterName} · 第{card.chapterIndex + 1}章</span>
                  <div className="note-actions">
                    {!card.userStance ? (
                      <>
                        <button className="stance-btn agree" onClick={() => handleStance(card.id, 'agree')}>认同</button>
                        <button className="stance-btn disagree" onClick={() => handleStance(card.id, 'disagree')}>不认同</button>
                        <button className="stance-btn skip" onClick={() => handleStance(card.id, 'skip')}>skip</button>
                      </>
                    ) : (
                      <span className={`stance-tag ${card.userStance}`}>
                        {card.userStance === 'agree' ? '已认同' : card.userStance === 'disagree' ? '不认同' : 'skipped'}
                      </span>
                    )}
                    <button className="stance-btn add-note" onClick={() => handleStartNoteEdit(card)}>+笔记</button>
                  </div>
                </div>

                {/* 片段摘录编辑 */}
                {editingNoteCardId === card.id && (
                  <div className="note-edit-form">
                    <label className="note-edit-label">摘录内容（可编辑选取片段）</label>
                    <textarea
                      className="note-edit-textarea"
                      value={editingNoteExcerpt}
                      onChange={e => setEditingNoteExcerpt(e.target.value)}
                      rows={5}
                    />
                    <label className="note-edit-label">你的笔记（可选）</label>
                    <input
                      className="note-edit-input"
                      type="text"
                      value={editingNoteComment}
                      onChange={e => setEditingNoteComment(e.target.value)}
                      placeholder="写点什么..."
                      onKeyDown={e => e.key === 'Enter' && handleSaveNoteExcerpt()}
                    />
                    <div className="note-edit-actions">
                      <button className="note-edit-save" onClick={handleSaveNoteExcerpt}>保存到笔记</button>
                      <button className="note-edit-cancel" onClick={() => setEditingNoteCardId(null)}>取消</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
})

export default Sidebar
