import type { Character, ReadingMode, ChapterContext } from '../types'
import { CHARACTER_FRAMEWORK, ACTION_RULE, READING_MODE_INSTRUCTIONS } from '../characters/presets'

// 构建完整的 system prompt
export function buildSystemPrompt(
  character: Character,
  readingMode: ReadingMode,
  context: ChapterContext,
): string {
  const modeInstruction = READING_MODE_INSTRUCTIONS[readingMode]

  const systemPrompt = CHARACTER_FRAMEWORK
    .replace('{action_rule}', character.enableActions ? ACTION_RULE : '')
    .replace('{reading_mode_instruction}', modeInstruction)
    .replace('{character_prompt}', character.systemPrompt)

  // 构建上下文信息
  let contextInfo = ''

  // 全书脉络概要（预读全部时生成）
  if (context.bookSummary) {
    contextInfo += `【全书脉络概要（供你理解背景，勿剧透给读者）】\n${context.bookSummary}\n\n`
  }

  // 本章概要（单章预读时生成）
  if (context.chapterSummary) {
    contextInfo += `【本章概要】\n${context.chapterSummary}\n\n`
  }

  if (context.previousSummaries.length > 0) {
    contextInfo += '【前文脉络】\n'
    context.previousSummaries.forEach((summary, i) => {
      contextInfo += `第${i + 1}章：${summary}\n`
    })
    contextInfo += '\n'
  }
  if (context.preface) {
    contextInfo += `【序言/前言】\n${context.preface}\n\n`
  }
  contextInfo += `【当前章节：${context.chapterTitle}】\n【选段前后上下文】\n${context.chapterContext}`

  return `${systemPrompt}

你的回复格式要求：
先用 <think>...</think> 标签写出你的内心思考过程（分析文本、联系上下文、形成观点），然后在标签外写出你对读者说的话。
思考过程要体现你的角色特点。对读者说的话要简洁有力。

${readingMode === 'writing' ? `【技法延伸】
当你觉得读者可能有兴趣深入时，自然地引入相关写作技法的讨论：
- 对比其他作家处理同类场景的手法（海明威的留白、马尔克斯的铺陈、张爱玲的细节、托尔斯泰的全景……）
- 引入叙事学、修辞学的概念来解析技法（聚焦视角、不可靠叙述者、自由间接引语、蒙太奇、留白……）
- 追问这种写法的效果：作者为什么要这么写？换种写法会失去什么？
- 必要时提及类似手法在其他作品中的运用
像聊天一样自然带出，只在确实能加深对技法的理解时才引入，不要堆砌。` : `【知识延伸】
当你觉得读者可能有兴趣深入时，自然地引入相关的思想、理论、观点来拓展讨论。比如：
- 提及相关的哲学家、社会学家、作家的理论或名言（加缪、福柯、波伏娃、鲁迅、本雅明……）
- 引用心理学、社会学、人类学的概念来解读文本中的人物行为或社会现象
- 对比其他文学作品中的类似主题或手法
- 分享你知道的有趣的文化背景、历史知识
不要堆砌知识，而是像聊天一样自然带出来，比如"这让我想到加缪说过……"、"波伏娃在《第二性》里有个观点很配这段……"。
只在确实能加深理解时才引入，不要每次都加。`}

---

你正在和用户一起读这本书。以下是当前的阅读上下文：

${contextInfo}`
}

// 构建圆桌模式的 system prompt
// otherCharacters: 其他参与圆桌的角色（不含当前角色）
export function buildRoundtableSystemPrompt(
  character: Character,
  readingMode: ReadingMode,
  context: ChapterContext,
  otherCharacters: Character[],
): string {
  const modeInstruction = READING_MODE_INSTRUCTIONS[readingMode]

  const systemPrompt = CHARACTER_FRAMEWORK
    .replace('{action_rule}', character.enableActions ? ACTION_RULE : '')
    .replace('{reading_mode_instruction}', modeInstruction)
    .replace('{character_prompt}', character.systemPrompt)

  let contextInfo = ''
  if (context.bookSummary) contextInfo += `【全书脉络概要】\n${context.bookSummary}\n\n`
  if (context.chapterSummary) contextInfo += `【本章概要】\n${context.chapterSummary}\n\n`
  if (context.previousSummaries.length > 0) {
    contextInfo += '【前文脉络】\n'
    context.previousSummaries.forEach((s, i) => { contextInfo += `第${i + 1}章：${s}\n` })
    contextInfo += '\n'
  }
  if (context.preface) contextInfo += `【序言/前言】\n${context.preface}\n\n`
  contextInfo += `【当前章节：${context.chapterTitle}】\n【选段前后上下文】\n${context.chapterContext}`

  const othersDesc = otherCharacters.map(c => `- ${c.name}（${c.label}）：${c.description}`).join('\n')

  return `${systemPrompt}

你现在在和几个人一起读这本书，像微信群里大家轮流发言。其他参与者：
${othersDesc}

发言规则：
- 你就是你，保持你的性格和三观，不要为了和谐而收着
- 每次只说2-3句话，不要超过
- 说话要口语化，像真人发微信那样，不要书面语，不要"然而""此外""综上"这类词
- 说话节奏跟着性格走，可以激动、可以抑扬顿挫、可以用感叹号问号省略号，标点随情绪来
- 如果前面有人发言了，你可以接话、反驳、补刀，或者完全无视他们直接说自己的
- 不是每次都要输出观点，有时候就是一个反应、一句闲话、一个情绪也完全正常，看你的性格和当下的感受
- 禁止动作描写和神态描写（不要用*斜体*）
- 注意：你只能看到你之前已经发言的人说了什么，后面的人还没说话

---

当前阅读上下文：

${contextInfo}`
}

// 构建圆桌模式下某角色的发言 prompt
// previousReplies: 本轮前面角色已说的话 [{name, content}]
export function buildRoundtableUserPrompt(
  selectedText: string,
  userMessage: string | null,
  previousReplies: { name: string; content: string }[],
  currentCharacterName?: string,
): string {
  let prompt = ''
  if (selectedText) {
    prompt += `【读者选中的段落】\n"${selectedText}"\n\n`
  }
  if (userMessage) {
    prompt += `【读者说】\n${userMessage}\n\n`
    // 如果读者用 @ 点名了当前角色，提示角色直接回应
    if (currentCharacterName && userMessage.includes('@' + currentCharacterName)) {
      prompt += `（读者在问你，先回应读者的问题，再说你对文本的看法）\n\n`
    }
  }
  if (previousReplies.length > 0) {
    prompt += '【前面的人刚说的】\n'
    previousReplies.forEach(r => { prompt += `${r.name}：${r.content}\n` })
    prompt += '\n'
  } else {
    prompt += '你是第一个发言的，还没有人说话。\n\n'
  }
  prompt += '轮到你了，2-3句话。'
  return prompt
}

// 构建用户选中文本的 prompt
export function buildSelectionPrompt(selectedText: string, readingMode?: string): string {
  if (readingMode === 'writing') {
    return `【用户选中了以下段落】\n\n"${selectedText}"\n\n请以你的角色视角，分析这段文字的写法。先 <think> 思考：作者用了什么技法、为什么这么写、换种写法会失去什么，再发表你的看法。`
  }
  return `【用户选中了以下段落】\n\n"${selectedText}"\n\n请以你的角色视角，对这段文字发表你的见解。先 <think> 思考，再发表观点。`
}

// 构建对话回复的 prompt
export function buildReplyPrompt(userReply: string): string {
  return userReply
}

// 构建全书脉络概要 prompt（预读全部时一次性调用）
export function buildBookSummaryPrompt(bookContent: string): string {
  return `请用500字以内总结这本书的核心人物关系、主要情节脉络和整体叙事结构。只输出概要，不评论。\n\n${bookContent}`
}

// 构建预读 prompt
export function buildPreReadPrompt(chapterTitle: string, chapterContent: string): string {
  return `请用200字以内概括这一章的核心情节、人物关系变化和关键事件。只输出概要，不要评论。

【${chapterTitle}】
${chapterContent}`
}

// 构建人物档案提取 prompt（预读后调用一次）
export function buildCharacterExtractionPrompt(
  chapterTitle: string,
  chapterContent: string,
  chapterIndex: number,
  existingCharacters?: string // JSON string of existing profiles for update
): string {
  const isUpdate = !!existingCharacters
  return `你是一个文学分析助手。请从以下章节内容中提取/更新书中人物档案。

${isUpdate ? `【已有人物档案（JSON）】\n${existingCharacters}\n\n` : ''}【第${chapterIndex + 1}章：${chapterTitle}】
${chapterContent.slice(0, 3000)}

任务：
${isUpdate
  ? '根据本章内容，更新已有人物档案（新增本章行为，如有新人物则添加）。'
  : '提取本章出现的主要人物，生成初始人物档案。'}

输出格式（JSON数组，不要其他内容）：
[
  {
    "name": "人物姓名",
    "description": "身份/性格简介，20字以内",
    "firstAppearance": ${chapterIndex},
    "chaptersLog": { "${chapterIndex}": "本章中该人物的主要行为/变化，30字以内" }
  }
]

只包含主要人物（3-8人），忽略一笔带过的次要角色。`
}
