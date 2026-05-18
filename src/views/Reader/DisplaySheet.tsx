import type { ReadingMode } from '../../types'

interface Props {
  fontSize: number
  onFontSize: (px: number) => void
  readingMode: ReadingMode
  onReadingMode: (m: ReadingMode) => void
  onClose: () => void
}

const FONT_MIN = 13
const FONT_MAX = 24

export function DisplaySheet({
  fontSize, onFontSize,
  readingMode, onReadingMode,
  onClose,
}: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet display-sheet" onClick={e => e.stopPropagation()}>
        <div className="display-sheet__group">
          <div className="display-sheet__label">FONT SIZE</div>
          <div className="display-sheet__font-row">
            <button
              className="display-sheet__font-btn"
              onClick={() => onFontSize(Math.max(FONT_MIN, fontSize - 1))}
              disabled={fontSize <= FONT_MIN}
            >
              A−
            </button>
            <div className="display-sheet__font-current">{fontSize}px</div>
            <button
              className="display-sheet__font-btn"
              onClick={() => onFontSize(Math.min(FONT_MAX, fontSize + 1))}
              disabled={fontSize >= FONT_MAX}
            >
              A＋
            </button>
          </div>
        </div>

        <div className="display-sheet__group">
          <div className="display-sheet__label">READING MODE</div>
          <div className="display-sheet__mode-row">
            <button
              className={'display-sheet__mode' + (readingMode === 'thinking' ? ' display-sheet__mode--active' : '')}
              onClick={() => onReadingMode('thinking')}
            >
              <div className="display-sheet__mode-name">THINKING</div>
              <div className="display-sheet__mode-hint">AI 深入分析文本含义</div>
            </button>
            <button
              className={'display-sheet__mode' + (readingMode === 'writing' ? ' display-sheet__mode--active' : '')}
              onClick={() => onReadingMode('writing')}
            >
              <div className="display-sheet__mode-name">WRITING</div>
              <div className="display-sheet__mode-hint">AI 评析写作技巧</div>
            </button>
          </div>
        </div>

        <button className="sheet__action sheet__action--mute" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  )
}
