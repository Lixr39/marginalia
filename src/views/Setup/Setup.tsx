import { useState, useEffect } from 'react'
import { Masthead } from '../Library/Masthead'
import { SectionHeader } from '../Library/SectionHeader'
import { PROVIDER_PRESETS, findPreset, type ProviderPreset } from '../../lib/providers'
import { getLLMConfig, saveLLMConfig } from '../../store'
import type { LLMConfig } from '../../types'
import './Setup.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function inferPresetId(cfg: LLMConfig | null): ProviderPreset['id'] {
  if (!cfg) return 'glm'  // default to free preset for first-time users
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

export function Setup() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  const [presetId, setPresetId] = useState<ProviderPreset['id']>('glm')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
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
    } else {
      const p = findPreset(id)
      setModel(p?.defaultModel ?? '')
      setBaseUrl(p?.baseUrl ?? '')
    }
  }, [])

  const onPickPreset = (id: ProviderPreset['id']) => {
    setPresetId(id)
    const p = findPreset(id)
    if (!p) return
    // For non-Custom presets, snap fields to preset defaults.
    if (id !== 'custom') {
      setBaseUrl(p.baseUrl ?? '')
      setModel(p.defaultModel)
    } else if (!model) {
      setModel(p.defaultModel)
    }
  }

  const onSave = () => {
    const p = findPreset(presetId)
    if (!p) return
    const cfg: LLMConfig = {
      provider: p.provider,
      apiKey: apiKey.trim(),
      model: model.trim() || p.defaultModel,
      baseUrl: (baseUrl.trim() || p.baseUrl) || undefined,
    }
    saveLLMConfig(cfg)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(0), 1500)
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
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className="setup__field">
          <label className="setup__field-label">MODEL</label>
          <input
            className="setup__input"
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder={preset?.defaultModel ?? ''}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="setup__field">
          <label className="setup__field-label">API KEY</label>
          <div className="setup__key-row">
            <input
              className="setup__input"
              type={showKey ? 'text' : 'password'}
              value={isCustomKey && !showKey ? maskKey(apiKey) : apiKey}
              onChange={e => setApiKey(e.target.value)}
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
          {preset?.signupUrl && (
            <a
              className="setup__signup"
              href={preset.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ {preset.isFree ? '五分钟注册免费 KEY' : '注册账号 / 申请 KEY'}
            </a>
          )}
        </div>

        <button
          className={'setup__save' + (savedAt ? ' setup__save--saved' : '')}
          onClick={onSave}
        >
          {savedAt ? '✓ SAVED' : 'SAVE'}
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
