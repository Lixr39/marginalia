import type { Highlight, Bookmark } from '../../types'

interface Props {
  highlights: Highlight[]
  bookmarks: Bookmark[]
  onJumpHighlight: (cfiRange: string) => void
  onJumpBookmark: (cfi: string) => void
  onDeleteBookmark: (id: string) => void
  onOpenNotes: () => void
  onExport: () => void
  onClose: () => void
}

export function AnnotationsDrawer({
  highlights,
  bookmarks,
  onJumpHighlight,
  onJumpBookmark,
  onDeleteBookmark,
  onOpenNotes,
  onExport,
  onClose,
}: Props) {
  const sortedHl = [...highlights].sort((a, b) => b.timestamp - a.timestamp)
  const sortedBm = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="annot-drawer-backdrop" onClick={onClose}>
      <aside className="annot-drawer" onClick={e => e.stopPropagation()}>
        <div className="annot-drawer__head">
          <span><span className="annot-drawer__roman">I.</span> HIGHLIGHTS</span>
          <span>{sortedHl.length}</span>
        </div>
        {sortedHl.length === 0 && (
          <div className="annot-drawer__empty">
            长按选段 → 🖍️ 即可高亮
          </div>
        )}
        {sortedHl.map(h => (
          <button
            key={h.id}
            className="annot-drawer__item"
            onClick={() => { onJumpHighlight(h.cfiRange); onClose() }}
          >
            <div className="annot-drawer__quote">"{h.text}"</div>
            {h.note && <div className="annot-drawer__note">— {h.note}</div>}
          </button>
        ))}

        <div className="annot-drawer__head" style={{ marginTop: 18 }}>
          <span><span className="annot-drawer__roman">II.</span> BOOKMARKS</span>
          <span>{sortedBm.length}</span>
        </div>
        {sortedBm.length === 0 && (
          <div className="annot-drawer__empty">
            顶栏 ＋ 即可添加当前位置书签
          </div>
        )}
        {sortedBm.map(b => (
          <div key={b.id} className="annot-drawer__bm-row">
            <button
              className="annot-drawer__item annot-drawer__item--bm"
              onClick={() => { onJumpBookmark(b.cfi); onClose() }}
            >
              <div className="annot-drawer__bookmark">{b.label || '(unnamed)'}</div>
              <div className="annot-drawer__bm-meta">
                {new Date(b.timestamp).toLocaleString()}
              </div>
            </button>
            <button
              className="annot-drawer__bm-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteBookmark(b.id) }}
              aria-label="delete bookmark"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="annot-drawer__footer">
          <button className="annot-drawer__notes-btn" onClick={onOpenNotes}>
            <em>✎</em> FREE NOTES
          </button>
          <button
            className="annot-drawer__export"
            onClick={onExport}
          >
            ⤓ EXPORT MARKDOWN
          </button>
          <div className="annot-drawer__footer-hint">
            含高亮、笔记、书签、对话{(highlights.length === 0 && bookmarks.length === 0) ? '（暂无内容）' : ''}
          </div>
        </div>
      </aside>
    </div>
  )
}
