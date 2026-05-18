import { useState } from 'react'
import type { Character } from '../../types'
import { saveCustomCharacter, deleteCustomCharacter, generateId, getLLMConfig } from '../../store'
import { chatCompletion } from '../../services/llm'
import { EXTRACT_PROMPT, AVATAR_OPTIONS } from '../../lib/characterExtract'

interface Props {
  initial?: Character | null
  onClose: () => void
  onSaved: () => void
}

type Mode = 'manual' | 'import'

export function CharacterEditor({ initial, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('manual')

  const [name, setName] = useState(initial?.name ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [avatar, setAvatar] = useState(initial?.avatar ?? '🌟')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [enableActions, setEnableActions] = useState(initial?.enableActions ?? false)

  const [docText, setDocText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  const isEdit = !!initial && !initial.isPreset
  const isPresetView = !!initial?.isPreset
  const readOnly = isPresetView

  const canSave = !readOnly && name.trim() && systemPrompt.trim()

  const handleSave = () => {
    if (!canSave) return
    const char: Character = {
      id: initial?.id ?? ('custom_' + generateId()),
      name: name.trim(),
      label: label.trim() || '自定义角色',
      avatar,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      isPreset: false,
      enableActions,
    }
    saveCustomCharacter(char)
    onSaved()
  }

  const handleDuplicate = () => {
    const char: Character = {
      id: 'custom_' + generateId(),
      name: name.trim() + ' (副本)',
      label: label.trim() || '自定义角色',
      avatar,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      isPreset: false,
      enableActions,
    }
    saveCustomCharacter(char)
    onSaved()
  }

  const handleDelete = () => {
    if (!initial) return
    if (!confirm(`删除角色「${initial.name}」？历史对话不会受影响。`)) return
    deleteCustomCharacter(initial.id)
    onSaved()
  }

  const handleExtract = async () => {
    if (!docText.trim()) return
    const config = getLLMConfig()
    if (!config) {
      setExtractError('请先在 SETUP 配置 AI Key')
      return
    }
    setExtracting(true)
    setExtractError('')
    try {
      const raw = await chatCompletion(config, [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: docText },
      ])
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI 返回的不是 JSON，请重试或换个 model')
      const parsed = JSON.parse(jsonMatch[0])
      setName(parsed.name || '')
      setLabel(parsed.label || '')
      setAvatar(parsed.avatar || '🌟')
      setDescription(parsed.description || '')
      setSystemPrompt(parsed.systemPrompt || '')
      setMode('manual')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '提取失败')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="editor">
      <div className="editor__head">
        <button className="editor__close" onClick={onClose}>← BACK</button>
        <span className="editor__head-title">
          {isPresetView ? 'PRESET' : isEdit ? 'EDIT VOICE' : 'NEW VOICE'}
        </span>
        {readOnly ? (
          <span style={{ width: 50 }} />
        ) : (
          <button className="editor__save-btn" disabled={!canSave} onClick={handleSave}>
            SAVE
          </button>
        )}
      </div>

      {!isEdit && !isPresetView && (
        <div className="editor__tabs">
          <button
            className={'editor__tab' + (mode === 'manual' ? ' editor__tab--active' : '')}
            onClick={() => setMode('manual')}
          >
            手动
          </button>
          <button
            className={'editor__tab' + (mode === 'import' ? ' editor__tab--active' : '')}
            onClick={() => setMode('import')}
          >
            AI 提取
          </button>
        </div>
      )}

      <div className="editor__body">
        {mode === 'import' && (
          <>
            <div className="editor__extract-hint">
              贴一段角色相关材料（小说片段 / 设定文档 / 对话记录），AI 会自动提取出五个维度的角色档案，填好下面所有字段。
            </div>
            <textarea
              className="editor__textarea"
              value={docText}
              onChange={e => setDocText(e.target.value)}
              placeholder="贴材料到这里..."
              rows={8}
            />
            <button
              className="editor__extract-btn"
              disabled={extracting || !docText.trim()}
              onClick={handleExtract}
            >
              {extracting ? 'EXTRACTING…' : 'EXTRACT WITH AI'}
            </button>
            {extractError && <div className="editor__extract-error">{extractError}</div>}
          </>
        )}

        {mode === 'manual' && (
          <>
            <div className="editor__field">
              <label className="editor__field-label">AVATAR</label>
              <div className="editor__avatar-row">
                <div className="editor__avatar-current">
                  {avatar.startsWith('data:') ? <img src={avatar} alt="" /> : avatar}
                </div>
              </div>
              {!readOnly && (
                <div className="editor__avatar-grid">
                  {AVATAR_OPTIONS.map(emo => (
                    <button
                      key={emo}
                      className={'editor__avatar-opt' + (emo === avatar ? ' editor__avatar-opt--active' : '')}
                      onClick={() => setAvatar(emo)}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="editor__field">
              <label className="editor__field-label">NAME</label>
              <input
                className="editor__input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="角色名"
                disabled={readOnly}
              />
            </div>

            <div className="editor__field">
              <label className="editor__field-label">LABEL · 性格标签</label>
              <input
                className="editor__input"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="如：女性主义者 / 虚无主义者"
                disabled={readOnly}
              />
            </div>

            <div className="editor__field">
              <label className="editor__field-label">DESCRIPTION · 一句话简介</label>
              <input
                className="editor__input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="15 字以内，会显示在角色列表"
                maxLength={40}
                disabled={readOnly}
              />
            </div>

            {!readOnly && (
              <>
                <div className="editor__field">
                  <label className="editor__field-label">SYSTEM PROMPT · 角色 prompt（必填）</label>
                  <textarea
                    className="editor__textarea"
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={12}
                    placeholder="你是XX。&#10;&#10;【说话风格】&#10;...&#10;&#10;【性格内核】&#10;..."
                  />
                </div>

                <div className="editor__toggle-row">
                  <div>
                    <div className="editor__toggle-label">动作 / 神态描写</div>
                    <div className="editor__toggle-hint">允许 AI 用 *斜体* 写动作（如 *沉默片刻*）</div>
                  </div>
                  <button
                    className={'editor__toggle' + (enableActions ? ' editor__toggle--on' : '')}
                    onClick={() => setEnableActions(v => !v)}
                    aria-label="toggle actions"
                  />
                </div>
              </>
            )}

            {isEdit && (
              <button className="editor__delete" onClick={handleDelete}>
                ✕ 删除此角色
              </button>
            )}
            {isPresetView && (
              <button className="editor__extract-btn" onClick={handleDuplicate}>
                ⎘ 复制为我的角色（可改）
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
