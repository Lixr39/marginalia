import type { LLMConfig } from '../types'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 通用LLM调用接口，支持OpenAI / Claude / 任何兼容OpenAI格式的API
export async function chatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
  onStream?: (chunk: string) => void
): Promise<string> {
  if (config.provider === 'claude') {
    return callClaude(config, messages, onStream)
  }
  if (config.provider === 'gemini') {
    return callGemini(config, messages, onStream)
  }
  // OpenAI and custom providers all use OpenAI-compatible format
  return callOpenAICompatible(config, messages, onStream)
}

// ===== Gemini API (Google AI Studio) =====
async function callGemini(
  config: LLMConfig,
  messages: ChatMessage[],
  onStream?: (chunk: string) => void
): Promise<string> {
  const model = config.model || 'gemini-2.0-flash'
  const apiKey = config.apiKey
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  // Convert to Gemini format
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }
  body.generationConfig = { maxOutputTokens: 4096 }

  if (onStream) {
    const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} - ${err}`)
    }
    if (res.body) {
      return readGeminiStream(res.body, onStream)
    }
  }

  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${res.status} - ${err}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function readGeminiStream(
  body: ReadableStream<Uint8Array>,
  onStream: (chunk: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            full += text
            onStream(full)
          }
        } catch { /* skip */ }
      }
    }
  }
  return full
}

// ===== Claude API =====
async function callClaude(
  config: LLMConfig,
  messages: ChatMessage[],
  onStream?: (chunk: string) => void
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com'
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))

  const body: Record<string, unknown> = {
    model: config.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: chatMessages,
  }
  if (systemMsg) {
    body.system = systemMsg.content
  }
  if (onStream) {
    body.stream = true
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${res.status} - ${err}`)
  }

  if (onStream && res.body) {
    return readClaudeStream(res.body, onStream)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

async function readClaudeStream(
  body: ReadableStream<Uint8Array>,
  onStream: (chunk: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            full += parsed.delta.text
            onStream(full)
          }
        } catch {
          // skip invalid JSON
        }
      }
    }
  }
  return full
}

// ===== OpenAI-Compatible API =====
async function callOpenAICompatible(
  config: LLMConfig,
  messages: ChatMessage[],
  onStream?: (chunk: string) => void
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1'

  const body: Record<string, unknown> = {
    model: config.model || 'gpt-4o',
    messages,
  }
  if (onStream) {
    body.stream = true
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error: ${res.status} - ${err}`)
  }

  if (onStream && res.body) {
    return readOpenAIStream(res.body, onStream)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function readOpenAIStream(
  body: ReadableStream<Uint8Array>,
  onStream: (chunk: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            full += content
            onStream(full)
          }
        } catch {
          // skip
        }
      }
    }
  }
  return full
}

