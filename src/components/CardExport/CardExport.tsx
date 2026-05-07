import { useRef, useState, useEffect } from 'react'
import type { Highlight } from '../../types'
import './CardExport.css'

interface Props {
  highlight: Highlight
  bookTitle: string
  author?: string
  onClose: () => void
}

const CARD_FONTS = [
  { label: '仙草希欢', value: 'XimaiXihuan' },
  { label: '向粹大字体', value: 'XiangcuiDazijiti' },
  { label: '汇文明朝', value: 'HuiwenMincho' },
  { label: '润智康熙', value: 'RunzhiKangxi' },
  { label: '寒假火方宋', value: 'ChillHuoFangSong' },
  { label: '寒假拙', value: 'ChillZhuo' },
  { label: '方可后', value: 'Fangkehou' },
  { label: '胖饭虎涂涂', value: 'PFanHuTuTi' },
  { label: 'Tokyo', value: 'Tokyo' },
  { label: 'Arkipelago', value: 'Arkipelago' },
  { label: 'Are You Serious', value: 'AreYouSerious-Regular' },
  { label: '系统衬线', value: 'Georgia, serif' },
  { label: '系统无衬线', value: '-apple-system, sans-serif' },
]

const CARD_THEMES = [
  { label: '深夜', bg: 'linear-gradient(135deg, #13132a 0%, #1a1a3e 100%)', color: '#e0e0e0', accent: 'rgba(108,99,255,0.5)', border: 'rgba(108,99,255,0.2)', titleColor: 'rgba(180,170,255,0.7)' },
  { label: '晨雾', bg: 'linear-gradient(135deg, #f5f0e8 0%, #ede6d8 100%)', color: '#2c2820', accent: 'rgba(160,120,80,0.4)', border: 'rgba(160,120,80,0.2)', titleColor: 'rgba(120,90,60,0.7)' },
  { label: '樱粉', bg: 'linear-gradient(135deg, #fef0f3 0%, #fce4ec 100%)', color: '#2d1520', accent: 'rgba(196,80,100,0.4)', border: 'rgba(196,80,100,0.2)', titleColor: 'rgba(160,60,80,0.7)' },
  { label: '墨绿', bg: 'linear-gradient(135deg, #0d1f0d 0%, #1a2e1a 100%)', color: '#c8e0c8', accent: 'rgba(80,160,80,0.4)', border: 'rgba(80,160,80,0.2)', titleColor: 'rgba(120,200,120,0.7)' },
  { label: '月白', bg: 'linear-gradient(135deg, #f8f8ff 0%, #eeeeff 100%)', color: '#1a1a2e', accent: 'rgba(100,100,200,0.3)', border: 'rgba(100,100,200,0.15)', titleColor: 'rgba(80,80,180,0.6)' },
  { label: '烟灰', bg: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)', color: '#cccccc', accent: 'rgba(200,200,200,0.3)', border: 'rgba(200,200,200,0.1)', titleColor: 'rgba(180,180,180,0.6)' },
]

export default function CardExport({ highlight, bookTitle, author, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [fontIdx, setFontIdx] = useState(0)
  const [themeIdx, setThemeIdx] = useState(0)
  const [showNote, setShowNote] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [fontsLoaded, setFontsLoaded] = useState(false)

  const theme = CARD_THEMES[themeIdx]
  const font = CARD_FONTS[fontIdx]

  // Preload fonts
  useEffect(() => {
    document.fonts.ready.then(() => setFontsLoaded(true))
  }, [])

  async function exportCard() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      // Dynamically import html2canvas
      const { default: html2canvas } = await import('html2canvas')
      await document.fonts.ready
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${bookTitle}-书摘.png`
      a.click()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const date = new Date(highlight.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="card-export-overlay" onClick={onClose}>
      <div className="card-export-modal" onClick={e => e.stopPropagation()}>
        <div className="card-export-header">
          <span>导出书摘卡片</span>
          <button className="card-export-close" onClick={onClose}>×</button>
        </div>

        {/* Controls */}
        <div className="card-export-controls">
          <div className="card-export-control-group">
            <label>主题</label>
            <div className="card-theme-swatches">
              {CARD_THEMES.map((t, i) => (
                <button
                  key={i}
                  className={`card-theme-swatch${themeIdx === i ? ' active' : ''}`}
                  style={{ background: t.bg }}
                  title={t.label}
                  onClick={() => setThemeIdx(i)}
                />
              ))}
            </div>
          </div>
          <div className="card-export-control-group">
            <label>字体</label>
            <select value={fontIdx} onChange={e => setFontIdx(Number(e.target.value))}>
              {CARD_FONTS.map((f, i) => (
                <option key={i} value={i}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="card-export-control-group">
            <label>
              <input type="checkbox" checked={showNote} onChange={e => setShowNote(e.target.checked)} />
              {' '}显示笔记
            </label>
          </div>
        </div>

        {/* Card Preview */}
        <div className="card-export-preview-wrap">
          <div
            ref={cardRef}
            className="card-preview"
            style={{
              background: theme.bg,
              color: theme.color,
              fontFamily: font.value,
              '--card-accent': theme.accent,
              '--card-border': theme.border,
              '--card-title-color': theme.titleColor,
            } as React.CSSProperties}
          >
            <div className="card-preview-deco-line" style={{ background: theme.accent }} />
            <div className="card-preview-quote">
              <span className="card-preview-quote-mark" style={{ color: theme.accent }}>"</span>
              <p className="card-preview-text">{highlight.text}</p>
              <span className="card-preview-quote-mark card-preview-quote-mark-end" style={{ color: theme.accent }}>"</span>
            </div>
            {showNote && highlight.note && (
              <div className="card-preview-note" style={{ borderColor: theme.border, color: theme.titleColor }}>
                <span className="card-preview-note-label">笔记</span>
                <p>{highlight.note}</p>
              </div>
            )}
            <div className="card-preview-footer" style={{ borderColor: theme.border }}>
              <div className="card-preview-book-info">
                <span className="card-preview-title" style={{ color: theme.titleColor }}>《{bookTitle}》</span>
                {author && <span className="card-preview-author" style={{ color: theme.titleColor }}> · {author}</span>}
              </div>
              <div className="card-preview-meta" style={{ color: theme.titleColor }}>
                <span className="card-preview-app">玛珈莉亚</span>
                <span className="card-preview-date">{date}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card-export-actions">
          <button className="card-export-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="card-export-btn-export"
            onClick={exportCard}
            disabled={exporting || !fontsLoaded}
          >
            {exporting ? '导出中...' : '保存图片'}
          </button>
        </div>
      </div>
    </div>
  )
}
