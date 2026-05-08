import { useState } from 'react'

interface Props {
  selectedText: string
  initialNote: string
  mode: 'create' | 'edit'
  onSave: (note: string) => void
  onCancel: () => void
  onDelete?: () => void
}

export function NoteModal({ selectedText, initialNote, mode, onSave, onCancel, onDelete }: Props) {
  const [v, setV] = useState(initialNote)

  return (
    <div className="note-modal-backdrop" onClick={onCancel}>
      <div className="note-modal" onClick={e => e.stopPropagation()}>
        <div className="note-modal__label">
          {mode === 'edit' ? 'EDIT NOTE' : 'NOTE'}
        </div>
        <div className="note-modal__quote">"{selectedText}"</div>
        <textarea
          className="note-modal__area"
          value={v}
          onChange={e => setV(e.target.value)}
          autoFocus
          rows={4}
          placeholder="写点什么…"
        />
        <div className="note-modal__row">
          {onDelete && (
            <button className="note-modal__btn note-modal__btn--danger" onClick={onDelete}>
              DELETE
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="note-modal__btn note-modal__btn--mute" onClick={onCancel}>
            CANCEL
          </button>
          <button className="note-modal__btn note-modal__btn--primary" onClick={() => onSave(v)}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
