import { useState } from 'react'
import type { Character } from '../../types'

interface Props {
  available: Character[]
  initialActiveId: string
  initialRoundtable: string[]
  onConfirmSingle: (char: Character) => void
  onConfirmRoundtable: (chars: Character[]) => void
  onCancel: () => void
}

export function CharacterPicker({
  available,
  initialActiveId,
  initialRoundtable,
  onConfirmSingle,
  onConfirmRoundtable,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<'single' | 'roundtable'>(
    initialRoundtable.length > 1 ? 'roundtable' : 'single'
  )
  const [singleId, setSingleId] = useState(initialActiveId || available[0]?.id || '')
  const [roundtableIds, setRoundtableIds] = useState<Set<string>>(
    new Set(initialRoundtable.length ? initialRoundtable : (initialActiveId ? [initialActiveId] : []))
  )

  const toggleRoundtable = (id: string) => {
    const next = new Set(roundtableIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setRoundtableIds(next)
  }

  const onConfirm = () => {
    if (mode === 'single') {
      const char = available.find(c => c.id === singleId)
      if (char) onConfirmSingle(char)
    } else {
      const chars = available.filter(c => roundtableIds.has(c.id))
      if (chars.length > 0) onConfirmRoundtable(chars)
    }
  }

  return (
    <div className="note-modal-backdrop" onClick={onCancel}>
      <div className="note-modal char-picker" onClick={e => e.stopPropagation()}>
        <div className="char-picker__tabs">
          <button
            className={'char-picker__tab' + (mode === 'single' ? ' char-picker__tab--active' : '')}
            onClick={() => setMode('single')}
          >
            SINGLE
          </button>
          <button
            className={'char-picker__tab' + (mode === 'roundtable' ? ' char-picker__tab--active' : '')}
            onClick={() => setMode('roundtable')}
          >
            ROUNDTABLE · {roundtableIds.size}
          </button>
        </div>

        <ul className="char-picker__list">
          {available.map(c => {
            const checked = mode === 'single'
              ? c.id === singleId
              : roundtableIds.has(c.id)
            return (
              <li key={c.id}>
                <button
                  className={'char-picker__row' + (checked ? ' char-picker__row--checked' : '')}
                  onClick={() => mode === 'single' ? setSingleId(c.id) : toggleRoundtable(c.id)}
                >
                  <span className="char-picker__avatar">{c.avatar}</span>
                  <span className="char-picker__body">
                    <span className="char-picker__name">{c.name}</span>
                    <span className="char-picker__label">{c.label}</span>
                  </span>
                  <span className="char-picker__check">{checked ? '✓' : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="note-modal__row">
          <button className="note-modal__btn note-modal__btn--mute" onClick={onCancel}>
            CANCEL
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="note-modal__btn note-modal__btn--primary"
            onClick={onConfirm}
            disabled={mode === 'roundtable' && roundtableIds.size === 0}
          >
            START
          </button>
        </div>
      </div>
    </div>
  )
}
