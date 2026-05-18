import { useState, useEffect, useCallback } from 'react'
import { Masthead } from '../Library/Masthead'
import { SectionHeader } from '../Library/SectionHeader'
import { PRESET_CHARACTERS } from '../../characters/presets'
import { getCustomCharacters } from '../../store'
import type { Character } from '../../types'
import { CharacterEditor } from './CharacterEditor'
import './Voices.css'

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
const TINTS = ['', 'voices__avatar--tint-rose', 'voices__avatar--tint-ink', 'voices__avatar--tint-warm'] as const

/**
 * Pull a representative one-line quote from a character's systemPrompt.
 * Heuristic: first sentence containing "你" (most prompts open with "你是...你..."),
 * skipping the very first "你是..." identifier line.
 */
function extractCharQuote(systemPrompt: string): string {
  const lines = systemPrompt
    .split(/[\n。]/)
    .map(s => s.trim())
    .filter(s => s.length >= 12 && s.length <= 70)
  // skip the opening "你是XX" identity line
  const candidate = lines.find(s => !s.startsWith('你是') && (s.includes('你') || s.includes('我')))
  return candidate ?? lines[0] ?? ''
}

interface ContribEntryProps {
  char: Character
  index: number
}
function ContribEntry({ char, index }: ContribEntryProps) {
  const tint = TINTS[index % TINTS.length]
  const quote = extractCharQuote(char.systemPrompt)
  return (
    <>
      <div className="voices__num">
        {ROMAN[index] ?? String(index + 1)}
        <small>{char.label.slice(0, 8).toUpperCase()}</small>
      </div>
      <div className="voices__head">
        <span className={'voices__avatar ' + tint}>
          {char.avatar.startsWith('data:') ? <img src={char.avatar} alt="" /> : char.avatar}
        </span>
        <span className="voices__meta">
          <h3 className="voices__name">{char.name}</h3>
          <div className="voices__label">
            {char.label}
          </div>
        </span>
      </div>
      <p className="voices__desc">{char.description}</p>
      {quote && <div className="voices__quote">{quote}</div>}
    </>
  )
}

export function Voices() {
  const today = new Date()
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )

  const [customChars, setCustomChars] = useState<Character[]>([])
  const [editing, setEditing] = useState<Character | null | 'new'>(null)

  const reload = useCallback(() => {
    setCustomChars(getCustomCharacters())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <main className="voices">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />

      <SectionHeader
        roman="II."
        titlePrefix="The "
        titleAccent="Voices"
        sub={`${PRESET_CHARACTERS.length} CONTRIBUTORS · IN ORDER OF JOINING`}
        ornament
      />

      {PRESET_CHARACTERS.map((c, i) => (
        <button
          key={c.id}
          className="voices__entry"
          onClick={() => setEditing(c)}
        >
          <ContribEntry char={c} index={i} />
        </button>
      ))}

      <div className="voices__divider">— ❦ —</div>

      <SectionHeader
        roman="III."
        titlePrefix="Your "
        titleAccent="Voices"
        sub={customChars.length === 0 ? 'CUSTOM · NONE YET' : `CUSTOM · ${customChars.length}`}
      />

      {customChars.length === 0 && (
        <div className="voices__empty-custom">
          创建你自己的角色——<br />
          贴一段材料，AI 会自动提取出五维度档案。
        </div>
      )}
      {customChars.map((c, i) => (
        <button
          key={c.id}
          className="voices__entry"
          onClick={() => setEditing(c)}
        >
          <ContribEntry char={c} index={i} />
        </button>
      ))}

      <button className="voices__add" onClick={() => setEditing('new')}>
        <em>+</em> NEW VOICE
      </button>

      {editing && (
        <CharacterEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            reload()
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}
