import { useState } from 'react'
import type { Character, ReadingMode } from '../../types'
import { PRESET_CHARACTERS } from '../../characters/presets'
import { getCustomCharacters, saveCustomCharacter } from '../../store'
import CharacterCreate from '../CharacterCreate/CharacterCreate'
import './CharacterSelect.css'

interface Props {
  onSelect: (character: Character, mode: ReadingMode) => void
  bookTitle?: string
  theme?: 'dark' | 'light'
  onBack?: () => void
}

export default function CharacterSelect({ onSelect, bookTitle, theme = 'dark', onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [readingMode, setReadingMode] = useState<ReadingMode>('thinking')
  const [customChars, setCustomChars] = useState<Character[]>(getCustomCharacters)
  const [showCreate, setShowCreate] = useState(false)
  const [editingChar, setEditingChar] = useState<Character | undefined>(undefined)

  const allCharacters = [...PRESET_CHARACTERS, ...customChars]

  function handleStart() {
    if (!selectedId) return
    const char = allCharacters.find(c => c.id === selectedId)!
    onSelect(char, readingMode)
  }

  function handleSaved(char: Character) {
    setCustomChars(getCustomCharacters())
    setSelectedId(char.id)
    setShowCreate(false)
    setEditingChar(undefined)
  }

  function handleDeleteCustom(e: React.MouseEvent, charId: string) {
    e.stopPropagation()
    if (!confirm('删除这个自定义角色？')) return
    const updated = customChars.filter(c => c.id !== charId)
    updated.forEach(c => saveCustomCharacter(c))
    // Remove from localStorage cleanly
    const raw = localStorage.getItem('reading-companion-custom-characters')
    if (raw) {
      const parsed: Character[] = JSON.parse(raw)
      const filtered = parsed.filter(c => c.id !== charId)
      localStorage.setItem('reading-companion-custom-characters', JSON.stringify(filtered))
    }
    setCustomChars(updated)
    if (selectedId === charId) setSelectedId(null)
  }

  function handleEditCustom(e: React.MouseEvent, char: Character) {
    e.stopPropagation()
    setEditingChar(char)
    setShowCreate(true)
  }

  return (
    <div className={`character-select ${theme}`}>
      <div className="cs-header">
        {onBack && (
          <button className="cs-back-btn" onClick={onBack} title="返回">&#8592;</button>
        )}
        <h1>选一个伴读搭子</h1>
        {bookTitle && <p className="cs-book-title">一起读《{bookTitle}》</p>}
        <p className="cs-subtitle">不可以是没有。</p>
      </div>

      <div className="cs-characters">
        {allCharacters.map(char => (
          <div
            key={char.id}
            className={`cs-card ${selectedId === char.id ? 'selected' : ''} ${!char.isPreset ? 'custom' : ''}`}
            onClick={() => setSelectedId(char.id)}
          >
            <div className="cs-avatar">{char.avatar}</div>
            <div className="cs-info">
              <div className="cs-name-row">
                <span className="cs-name">{char.name}</span>
                {!char.isPreset && (
                  <span className="cs-custom-tag">自定义</span>
                )}
              </div>
              <div className="cs-label">{char.label}</div>
              <div className="cs-desc">{char.description}</div>
            </div>
            {!char.isPreset && (
              <div className="cs-card-actions">
                <button className="cs-edit-btn" onClick={e => handleEditCustom(e, char)} title="编辑">✎</button>
                <button className="cs-delete-btn" onClick={e => handleDeleteCustom(e, char.id)} title="删除">✕</button>
              </div>
            )}
          </div>
        ))}

        {/* Create button */}
        <div className="cs-card cs-create-card" onClick={() => { setEditingChar(undefined); setShowCreate(true) }}>
          <div className="cs-create-icon">+</div>
          <div className="cs-info">
            <div className="cs-name">创建角色</div>
            <div className="cs-desc">手动填写或粘贴角色材料，AI 自动提取</div>
          </div>
        </div>
      </div>

      <div className="cs-mode">
        <h3>阅读模式</h3>
        <div className="cs-mode-options">
          <button
            className={`cs-mode-btn ${readingMode === 'thinking' ? 'active' : ''}`}
            onClick={() => setReadingMode('thinking')}
          >
            <span className="mode-icon">🧠</span>
            <span className="mode-name">深度思考</span>
            <span className="mode-desc">关注思想内核、价值观碰撞</span>
          </button>
          <button
            className={`cs-mode-btn ${readingMode === 'writing' ? 'active' : ''}`}
            onClick={() => setReadingMode('writing')}
          >
            <span className="mode-icon">✍️</span>
            <span className="mode-name">写作学习</span>
            <span className="mode-desc">关注叙事技巧、修辞手法</span>
          </button>
        </div>
      </div>

      <button
        className="cs-start-btn"
        disabled={!selectedId}
        onClick={handleStart}
      >
        开始共读
      </button>

      {showCreate && (
        <CharacterCreate
          onSave={handleSaved}
          onClose={() => { setShowCreate(false); setEditingChar(undefined) }}
          editChar={editingChar}
        />
      )}
    </div>
  )
}
