/**
 * Provider connection tests + model list fetchers.
 * Lifted from desktop Settings — keeps proven behavior.
 */

export interface ModelOption {
  id: string
  name: string
}

// Hardcoded fallbacks for providers without public list-models endpoints
export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
]

export const GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
]

export const GLM_MODELS: ModelOption[] = [
  { id: 'glm-4-flash', name: 'GLM-4-Flash (免费)' },
  { id: 'glm-4-air', name: 'GLM-4-Air' },
  { id: 'glm-4-plus', name: 'GLM-4-Plus' },
]

export async function fetchOpenAICompatModels(apiKey: string, baseUrl: string): Promise<ModelOption[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return ((data.data || []) as { id: string }[])
    .map(m => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function testClaudeConnection(apiKey: string, baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 100)}`)
  }
}

export async function testGeminiConnection(apiKey: string): Promise<void> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 100)}`)
  }
}

export async function testOpenAICompatConnection(apiKey: string, baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 100)}`)
  }
}
