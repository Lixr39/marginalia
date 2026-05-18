export interface TocEntry {
  href: string
  label: string
  depth: number
}

interface Props {
  entries: TocEntry[]
  currentHref: string
  onJump: (href: string) => void
  onClose: () => void
}

export function TocDrawer({ entries, currentHref, onJump, onClose }: Props) {
  return (
    <div className="annot-drawer-backdrop" onClick={onClose}>
      <aside className="annot-drawer toc-drawer" onClick={e => e.stopPropagation()}>
        <div className="annot-drawer__head">
          <span><span className="annot-drawer__roman">—</span> CONTENTS</span>
          <span>{entries.length}</span>
        </div>
        {entries.length === 0 && (
          <div className="annot-drawer__empty">
            (这本书没有目录)
          </div>
        )}
        {entries.map((e, i) => {
          const isCurrent = e.href.split('#')[0] === currentHref.split('#')[0]
          return (
            <button
              key={i}
              className={'toc-drawer__item' + (isCurrent ? ' toc-drawer__item--current' : '')}
              style={{ paddingLeft: 16 + e.depth * 14 }}
              onClick={() => { onJump(e.href); onClose() }}
            >
              {isCurrent && <span className="toc-drawer__dot">●</span>}
              <span className="toc-drawer__label">{e.label.trim()}</span>
            </button>
          )
        })}
      </aside>
    </div>
  )
}
