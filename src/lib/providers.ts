import type { LLMProvider } from '../types'

export interface ProviderPreset {
  id: 'custom' | 'claude' | 'deepseek' | 'gemini' | 'glm'
  label: string
  hint: string
  provider: LLMProvider
  baseUrl?: string
  defaultModel: string
  signupUrl?: string
  isFree?: boolean
  isFeatured?: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    hint: '主入口 · 自填 endpoint + key',
    provider: 'custom',
    defaultModel: 'gpt-4o-mini',
    isFeatured: true,
  },
  {
    id: 'claude',
    label: 'Claude',
    hint: 'Anthropic 官方 · 付费',
    provider: 'claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    signupUrl: 'https://console.anthropic.com',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hint: '中文好 · 极便宜',
    provider: 'custom',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    signupUrl: 'https://platform.deepseek.com',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    hint: '免费额度 · 国内需梯子',
    provider: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    signupUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'glm',
    label: '智谱 GLM-4-Flash',
    hint: '免费 · 五分钟拿 key',
    provider: 'custom',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    signupUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    isFree: true,
  },
]

export function findPreset(id: ProviderPreset['id']): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === id)
}
