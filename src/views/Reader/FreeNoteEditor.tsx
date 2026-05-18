import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  initial: string
  bookTitle: string
  onSave: (text: string) => void
  onClose: () => void
}

export function FreeNoteEditor({ initial, bookTitle, onSave, onClose }: Props) {
  const [text, setText] = useState(initial)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(text !== initial)
  }, [text, initial])

  const handleSave = () => {
    onSave(text)
  }

  const handleClose = () => {
    if (dirty) {
      if (!confirm('笔记未保存，确定关闭？')) return
    }
    onClose()
  }

  return (
    <div className="editor">
      <div className="editor__head">
        <button className="editor__close" onClick={handleClose}>← BACK</button>
        <span className="editor__head-title">{bookTitle}</span>
        <button
          className="editor__save-btn"
          disabled={!dirty}
          onClick={handleSave}
        >
          {dirty ? 'SAVE' : '✓ SAVED'}
        </button>
      </div>

      <div className="editor__tabs">
        <button
          className={'editor__tab' + (mode === 'edit' ? ' editor__tab--active' : '')}
          onClick={() => setMode('edit')}
        >
          WRITE
        </button>
        <button
          className={'editor__tab' + (mode === 'preview' ? ' editor__tab--active' : '')}
          onClick={() => setMode('preview')}
        >
          PREVIEW
        </button>
      </div>

      <div className="editor__body">
        {mode === 'edit' ? (
          <textarea
            className="editor__textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="自由笔记（支持 Markdown）...&#10;&#10;## 我的想法&#10;&#10;**重点**：..."
            style={{ minHeight: 'calc(100dvh - 200px)', fontSize: 14 }}
            autoFocus
          />
        ) : (
          <div className="freenote-preview">
            {text.trim() ? (
              <ReactMarkdown>{text}</ReactMarkdown>
            ) : (
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                opacity: 0.5,
                textAlign: 'center',
                padding: 40,
              }}>
                还没写什么。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
