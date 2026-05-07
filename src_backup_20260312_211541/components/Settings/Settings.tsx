import { useState, useEffect } from 'react'
import type { LLMConfig, LLMProvider } from '../../types'
import { getLLMConfig, saveLLMConfig } from '../../store'
import './Settings.css'

interface Props {
  onClose: () => void
  theme?: 'dark' | 'light'
}

const PROVIDER_OPTIONS: { value: LLMProvider; label: string; defaultModel: string; defaultUrl: string }[] = [
  { value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o', defaultUrl: 'https://api.openai.com/v1' },
  { value: 'claude', label: 'Claude (Anthropic)', defaultModel: 'claude-sonnet-4-20250514', defaultUrl: 'https://api.anthropic.com' },
  { value: 'gemini', label: 'Gemini (Google AI Studio)', defaultModel: 'gemini-2.0-flash', defaultUrl: '' },
  { value: 'custom', label: '自定义 (OpenAI兼容)', defaultModel: '', defaultUrl: '' },
]

type ConnStatus = 'idle' | 'testing' | 'success' | 'error'

interface ModelOption {
  id: string
  name: string
}

// 拉取 OpenAI 兼容 API 的模型列表
async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<ModelOption[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  const models: ModelOption[] = (data.data || [])
    .map((m: { id: string }) => ({ id: m.id, name: m.id }))
    .sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name))
  return models
}

// Claude 没有 list models 的公开接口，给常用列表
const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
]

// Gemini 常用模型列表
const GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro Preview' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
]

// 测试 Claude 连接（用 GET models 接口，轻量秒回）
async function testClaudeConnection(apiKey: string, baseUrl: string): Promise<void> {
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

// 测试 Gemini 连接
async function testGeminiConnection(apiKey: string): Promise<void> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 100)}`)
  }
}

// 测试 OpenAI 兼容连接（用 GET /models 接口，轻量秒回）
async function testOpenAIConnection(apiKey: string, baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 100)}`)
  }
}

export default function Settings({ onClose, theme }: Props) {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
    baseUrl: '',
  })
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [connError, setConnError] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    const existing = getLLMConfig()
    if (existing) setConfig(existing)
  }, [])

  function handleProviderChange(provider: LLMProvider) {
    const opt = PROVIDER_OPTIONS.find(o => o.value === provider)!
    setConfig(prev => ({
      ...prev,
      provider,
      model: opt.defaultModel,
      baseUrl: opt.defaultUrl,
    }))
    setConnStatus('idle')
    setModels([])
    setConnError('')
  }

  async function handleFetchModels() {
    if (!config.apiKey) return
    setLoadingModels(true)
    setModels([])

    try {
      if (config.provider === 'claude') {
        setModels(CLAUDE_MODELS)
      } else if (config.provider === 'gemini') {
        setModels(GEMINI_MODELS)
      } else {
        const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
        const fetched = await fetchOpenAIModels(config.apiKey, baseUrl)
        setModels(fetched)
      }
    } catch {
      // 拉不到模型列表也没关系，可以手动输入
    } finally {
      setLoadingModels(false)
    }
  }

  async function handleTestAndSave() {
    if (!config.apiKey) {
      setConnError('请填写 API Key')
      setConnStatus('error')
      return
    }
    if (!config.model) {
      setConnError('请选择或输入模型')
      setConnStatus('error')
      return
    }

    setConnStatus('testing')
    setConnError('')

    try {
      if (config.provider === 'claude') {
        const baseUrl = config.baseUrl || 'https://api.anthropic.com'
        await testClaudeConnection(config.apiKey, baseUrl)
      } else if (config.provider === 'gemini') {
        await testGeminiConnection(config.apiKey)
      } else {
        const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
        await testOpenAIConnection(config.apiKey, baseUrl)
      }
      // 连接成功，保存
      saveLLMConfig(config)
      setConnStatus('success')
    } catch (err) {
      setConnStatus('error')
      setConnError(err instanceof Error ? err.message : '连接失败')
    }
  }

  const statusText = {
    idle: '测试连接并保存',
    testing: '连接中...',
    success: '连接成功，已保存',
    error: '连接失败',
  }

  const statusClass = {
    idle: '',
    testing: 'testing',
    success: 'success',
    error: 'error',
  }

  return (
    <div className={`settings-overlay${theme === 'light' ? ' light' : ''}`} onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <h2>API 设置</h2>

        <label>Provider</label>
        <select
          value={config.provider}
          onChange={e => handleProviderChange(e.target.value as LLMProvider)}
        >
          {PROVIDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label>API Key</label>
        <input
          type="password"
          value={config.apiKey}
          onChange={e => {
            setConfig(prev => ({ ...prev, apiKey: e.target.value }))
            setConnStatus('idle')
          }}
          placeholder="sk-..."
        />

        {(config.provider === 'custom' || config.provider === 'claude') && (
          <>
            <label>Base URL</label>
            <input
              type="text"
              value={config.baseUrl || ''}
              onChange={e => {
                setConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                setConnStatus('idle')
              }}
              placeholder="https://your-api-endpoint.com/v1"
            />
          </>
        )}

        <label>
          Model
          {config.apiKey && (
            <button
              className="fetch-models-btn"
              onClick={handleFetchModels}
              disabled={loadingModels}
            >
              {loadingModels ? '加载中...' : '获取模型列表'}
            </button>
          )}
        </label>

        {models.length > 0 ? (
          <select
            value={config.model}
            onChange={e => {
              setConfig(prev => ({ ...prev, model: e.target.value }))
              setConnStatus('idle')
            }}
          >
            {!models.find(m => m.id === config.model) && config.model && (
              <option value={config.model}>{config.model}</option>
            )}
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={config.model}
            onChange={e => {
              setConfig(prev => ({ ...prev, model: e.target.value }))
              setConnStatus('idle')
            }}
            placeholder={PROVIDER_OPTIONS.find(o => o.value === config.provider)?.defaultModel || '模型名称'}
          />
        )}

        {connError && (
          <div className="conn-error">{connError}</div>
        )}

        <div className="settings-actions">
          <button
            className={`btn-save ${statusClass[connStatus]}`}
            onClick={handleTestAndSave}
            disabled={connStatus === 'testing'}
          >
            {statusText[connStatus]}
          </button>
          <button className="btn-cancel" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
