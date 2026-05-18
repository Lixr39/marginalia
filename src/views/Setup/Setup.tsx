import { useState, useEffect } from 'react'
import { Masthead } from '../Library/Masthead'
import { SectionHeader } from '../Library/SectionHeader'
import { PROVIDER_PRESETS, findPreset, type ProviderPreset } from '../../lib/providers'
import {
  fetchOpenAICompatModels,
  testClaudeConnection,
  testGeminiConnection,
  testOpenAICompatConnection,
  CLAUDE_MODELS,
  GEMINI_MODELS,
  GLM_MODELS,
  type ModelOption,
} from '../../lib/providerTest'
import { getLLMConfig, saveLLMConfig } from '../../store'
import type { LLMConfig } from '../../types'
import './Setup.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function inferPresetId(cfg: LLMConfig | null): ProviderPreset['id'] {
  if (!cfg) return 'glm'
  if (cfg.provider === 'claude') return 'claude'
  if (cfg.provider === 'gemini') return 'gemini'
  if (cfg.baseUrl?.includes('deepseek')) return 'deepseek'
  if (cfg.baseUrl?.includes('bigmodel')) return 'glm'
  return 'custom'
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 12) return '*'.repeat(key.length)
  return key.slice(0, 4) + '*'.repeat(Math.max(4, key.length - 8)) + key.slice(-4)
}

type ConnStatus = 'idle' | 'testing' | 'success' | 'error' | 'fetching-models'

export function Setup() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  const [presetId, setPresetId] = useState<ProviderPreset['id']>('glm')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [connError, setConnError] = useState('')
  const [theme, setTheme] = useState<'day' | 'night'>(
    (localStorage.getItem('marginalia-theme') as 'day' | 'night' | null) || 'day'
  )

  useEffect(() => {
    const cfg = getLLMConfig()
    const id = inferPresetId(cfg)
    setPresetId(id)
    if (cfg) {
      setApiKey(cfg.apiKey || '')
      setModel(cfg.model || '')
      setBaseUrl(cfg.baseUrl || '')
      // pre-fill model list for non-OpenAI-compat providers
      if (cfg.provider === 'claude') setModels(CLAUDE_MODELS)
      else if (cfg.provider === 'gemini') setModels(GEMINI_MODELS)
      else if (cfg.baseUrl?.includes('bigmodel')) setModels(GLM_MODELS)
    } else {
      const p = findPreset(id)
      setModel(p?.defaultModel ?? '')
      setBaseUrl(p?.baseUrl ?? '')
      if (id === 'glm') setModels(GLM_MODELS)
    }
  }, [])

  // any field edit resets conn status
  const resetStatus = () => {
    if (connStatus !== 'idle') setConnStatus('idle')
    if (connError) setConnError('')
  }

  const onPickPreset = (id: ProviderPreset['id']) => {
    setPresetId(id)
    resetStatus()
    setModels([])
    const p = findPreset(id)
    if (!p) return
    if (id !== 'custom') {
      setBaseUrl(p.baseUrl ?? '')
      setModel(p.defaultModel)
    } else if (!model) {
      setModel(p.defaultModel)
    }
    // pre-fill known model lists
    if (id === 'claude') setModels(CLAUDE_MODELS)
    else if (id === 'gemini') setModels(GEMINI_MODELS)
    else if (id === 'glm') setModels(GLM_MODELS)
  }

  const onFetchModels = async () => {
    if (!apiKey.trim()) {
      setConnError('请先填 API Key')
      setConnStatus('error')
      return
    }
    setConnStatus('fetching-models')
    setConnError('')
    try {
      const p = findPreset(presetId)
      if (presetId === 'claude') {
        setModels(CLAUDE_MODELS)
      } else if (presetId === 'gemini') {
        setModels(GEMINI_MODELS)
      } else {
        const url = (baseUrl.trim() || p?.baseUrl || 'https://api.openai.com/v1')
        const fetched = await fetchOpenAICompatModels(apiKey.trim(), url)
        setModels(fetched)
      }
      setConnStatus('idle')
    } catch (err) {
      setConnError(err instanceof Error ? err.message : '拉模型列表失败')
      setConnStatus('error')
    }
  }

  const onTestAndSave = async () => {
    if (!apiKey.trim()) {
      setConnError('请填 API Key')
      setConnStatus('error')
      return
    }
    if (!model.trim()) {
      setConnError('请选择或填写模型名')
      setConnStatus('error')
      return
    }
    setConnStatus('testing')
    setConnError('')

    const p = findPreset(presetId)
    if (!p) return
    try {
      if (presetId === 'claude') {
        await testClaudeConnection(apiKey.trim(), baseUrl.trim() || 'https://api.anthropic.com')
      } else if (presetId === 'gemini') {
        await testGeminiConnection(apiKey.trim())
      } else {
        await testOpenAICompatConnection(apiKey.trim(), baseUrl.trim() || p.baseUrl || 'https://api.openai.com/v1')
      }
      // connected → save
      const cfg: LLMConfig = {
        provider: p.provider,
        apiKey: apiKey.trim(),
        model: model.trim() || p.defaultModel,
        baseUrl: (baseUrl.trim() || p.baseUrl) || undefined,
      }
      saveLLMConfig(cfg)
      setConnStatus('success')
      setTimeout(() => setConnStatus(s => s === 'success' ? 'idle' : s), 2500)
    } catch (err) {
      setConnStatus('error')
      setConnError(err instanceof Error ? err.message : '连接失败')
    }
  }

  const onChangeTheme = (next: 'day' | 'night') => {
    setTheme(next)
    localStorage.setItem('marginalia-theme', next)
    document.documentElement.classList.remove('theme-day', 'theme-night')
    document.documentElement.classList.add(`theme-${next}`)
    const themeColor = next === 'night' ? '#0c0a10' : '#ffffff'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }

  const preset = findPreset(presetId)
  const showBaseUrl = presetId === 'custom'
  const isCustomKey = apiKey && !showKey

  const saveBtnLabel: Record<ConnStatus, string> = {
    idle: 'TEST & SAVE',
    testing: 'TESTING...',
    success: '✓ CONNECTED · SAVED',
    error: 'TEST & SAVE',
    'fetching-models': 'TEST & SAVE',
  }

  return (
    <main className="setup">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />

      <SectionHeader
        roman="IV."
        titleAccent="Colophon"
        sub="PROVIDER · DISPLAY · ABOUT"
      />
      <SectionHeader roman="A." label="PROVIDER" />
      <div className="setup__provider-list">
        {PROVIDER_PRESETS.map(p => (
          <button
            key={p.id}
            className={'setup__provider' + (p.id === presetId ? ' setup__provider--active' : '')}
            onClick={() => onPickPreset(p.id)}
          >
            <span className="setup__provider-radio" aria-hidden />
            <span className="setup__provider-body">
              <span className={
                'setup__provider-label' + (p.isFeatured ? ' setup__provider-label--featured' : '')
              }>
                {p.label}
              </span>
              <span className="setup__provider-hint">{p.hint}</span>
            </span>
            {p.isFree && <span className="setup__provider-tag">FREE</span>}
          </button>
        ))}
      </div>

      <div className="setup__form">
        {showBaseUrl && (
          <div className="setup__field">
            <label className="setup__field-label">BASE URL</label>
            <input
              className="setup__input"
              type="text"
              value={baseUrl}
              onChange={e => { setBaseUrl(e.target.value); resetStatus() }}
              placeholder="https://api.example.com/v1"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className="setup__field">
          <label className="setup__field-label setup__field-label--with-action">
            <span>API KEY</span>
            {preset?.signupUrl && (
              <a
                className="setup__signup"
                href={preset.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ {preset.isFree ? '免费 KEY' : '注册'}
              </a>
            )}
          </label>
          <div className="setup__key-row">
            <input
              className="setup__input"
              type={showKey ? 'text' : 'password'}
              value={isCustomKey && !showKey ? maskKey(apiKey) : apiKey}
              onChange={e => { setApiKey(e.target.value); resetStatus() }}
              onFocus={() => setShowKey(true)}
              placeholder="sk-..."
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              className="setup__key-toggle"
              onClick={() => setShowKey(s => !s)}
              aria-label="toggle key visibility"
            >
              {showKey ? '◐' : '○'}
            </button>
          </div>
        </div>

        <div className="setup__field">
          <label className="setup__field-label setup__field-label--with-action">
            <span>MODEL</span>
            {apiKey.trim() && (
              <button
                className="setup__fetch-btn"
                onClick={onFetchModels}
                disabled={connStatus === 'fetching-models'}
              >
                {connStatus === 'fetching-models' ? 'LOADING...' : '⟳ FETCH LIST'}
              </button>
            )}
          </label>
          {models.length > 0 ? (
            <select
              className="setup__input"
              value={model}
              onChange={e => { setModel(e.target.value); resetStatus() }}
            >
              {!models.find(m => m.id === model) && model && (
                <option value={model}>{model} (current)</option>
              )}
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <input
              className="setup__input"
              type="text"
              value={model}
              onChange={e => { setModel(e.target.value); resetStatus() }}
              placeholder={preset?.defaultModel ?? ''}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </div>

        {connError && (
          <div className="setup__conn-error">{connError}</div>
        )}

        <button
          className={'setup__save setup__save--' + connStatus}
          onClick={onTestAndSave}
          disabled={connStatus === 'testing' || connStatus === 'fetching-models'}
        >
          {saveBtnLabel[connStatus]}
        </button>
      </div>

      <SectionHeader roman="B." label="DISPLAY" />
      <div className="setup__theme-row">
        <button
          className={'setup__theme-btn' + (theme === 'day' ? ' setup__theme-btn--active' : '')}
          onClick={() => onChangeTheme('day')}
        >
          <span className="setup__theme-swatch" style={{ background: '#ffffff' }} />
          DAY
        </button>
        <button
          className={'setup__theme-btn' + (theme === 'night' ? ' setup__theme-btn--active' : '')}
          onClick={() => onChangeTheme('night')}
        >
          <span className="setup__theme-swatch" style={{ background: '#0c0a10' }} />
          NIGHT
        </button>
      </div>

      <div className="setup__about">
        Marginalia · 0.1<br />
        a reading companion with AI characters in the margins.
      </div>
    </main>
  )
}
