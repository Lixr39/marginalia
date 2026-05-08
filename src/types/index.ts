// ===== LLM Provider =====
export type LLMProvider = 'openai' | 'claude' | 'custom' | 'gemini'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model: string
  baseUrl?: string // for custom/proxy endpoints
}

// ===== Character System =====
export interface Character {
  id: string
  name: string
  label: string // 性格标签：feminist, nihilist, etc.
  avatar: string // emoji or image
  description: string
  systemPrompt: string
  isPreset: boolean
  enableActions?: boolean // 是否启用动作/神态描写（*斜体*），默认关闭
}

// ===== Reading =====
export type ReadingMode = 'thinking' | 'writing'

export interface BookMeta {
  title: string
  author: string
  cover?: string
  totalChapters: number
}

export interface ChapterContext {
  currentChapter: number
  chapterTitle: string
  chapterContext: string      // 选段前后3段上下文
  chapterSummary?: string    // 本章预读概要（200字）
  bookSummary?: string       // 全书脉络概要（500字）
  previousSummaries: string[]
  preface?: string
}

// ===== Conversation =====
export interface Message {
  id: string
  role: 'character' | 'user'
  content: string
  thinking?: string // AI思考链
  selectedText?: string // 用户选中的文本
  chapterIndex?: number
  timestamp: number
  characterId?: string // 圆桌模式：标记是哪个角色说的
}

export interface OpinionCard {
  id: string
  messageId: string // 关联的角色消息ID
  bookTitle: string
  chapterIndex: number
  selectedText: string
  characterName: string
  opinion: string
  userStance: 'agree' | 'disagree' | 'skip' | null
  timestamp: number
}

// ===== Highlights =====
export interface Highlight {
  id: string
  cfiRange: string
  text: string
  note: string
  color: string // 高亮颜色
  chapterIndex?: number
  timestamp: number
}

// ===== Bookmarks =====
export interface Bookmark {
  id: string
  cfi: string
  label: string
  chapterIndex: number
  timestamp: number
}

// ===== Pre-read =====
export interface PreReadData {
  chapterIndex: number
  href: string // 章节文件路径，用于精确匹配
  label: string // 章节标题
  summary: string // AI预读的章节概要
}

// ===== Reading Session (历史阅读记录) =====
export interface ReadingSession {
  characterId: string
  characterName: string
  readingMode: ReadingMode
  messages: Message[]
  opinionCards: OpinionCard[]
  timestamp: number
}

// ===== Book Character Profile (from pre-read) =====
export interface BookCharacterProfile {
  name: string
  description: string // 身份/性格简介
  firstAppearance: number // 首次出现的章节 index
  chaptersLog: Record<number, string> // 章节 index → 本章行为摘要
}

// ===== Book Rating =====
export interface BookRatingQA {
  question: string
  answer: string
}

export interface BookRating {
  stars?: number        // 0.5~5，以 0.5 为步长
  questions?: BookRatingQA[]  // 旧字段保留，不再写入
  timestamp: number
}

// ===== Character Review =====
export interface CharacterReview {
  characterId: string
  characterName: string
  stars: number // 0.5~5
  review: string // 2-3句短评
  timestamp: number
}

// ===== Book State =====
export type BookTag = 'reading' | 'finished' | 'wishlist'

export interface BookState {
  meta: BookMeta
  currentLocation: string // epubcfi
  currentChapter: number
  characterId: string
  readingMode: ReadingMode
  messages: Message[]
  roundtableMessages?: Message[] // 圆桌模式消息，单独存储
  opinionCards: OpinionCard[]
  chapterSummaries: Record<number, string>
  tag?: BookTag
  highlights?: Highlight[] // 高亮标注
  bookmarks?: Bookmark[]  // 书签
  preReadData?: PreReadData[] // AI预读记忆
  sessions?: ReadingSession[] // 历史角色阅读记录
  summary?: string // 阅读复盘结果
  bookCharacters?: BookCharacterProfile[] // 书中人物档案
  rating?: BookRating // 引导式书评打分
  bookSummary?: string // 全书脉络概要（500字，预读全部时生成）
  freeNote?: string // 自由笔记（整体 MD 文档）
  roundtableCharacterIds?: string[] // 圆桌模式：已选角色 ID 列表
  isRoundtableMode?: boolean // 是否处于圆桌模式
  characterReviews?: Record<string, CharacterReview> // 角色书评，key 为角色 id
  featuredHighlightId?: string // 在 Library 显示的"代表批注"对应高亮 id
}
