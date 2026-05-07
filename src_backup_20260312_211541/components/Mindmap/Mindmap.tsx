import { useState } from 'react'
import './Mindmap.css'

export interface MindmapNode {
  label: string
  children?: MindmapNode[]
}

function TreeNode({ node, depth }: { node: MindmapNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = !!(node.children && node.children.length > 0)
  const depthClass = `mm-depth-${Math.min(depth, 4)}`

  return (
    <div className="mm-node">
      <div
        className={`mm-label ${depthClass} ${hasChildren ? 'mm-has-children' : ''}`}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        {hasChildren ? (
          <span className="mm-toggle">{expanded ? '▾' : '▸'}</span>
        ) : (
          <span className="mm-leaf-dot" />
        )}
        {node.label}
      </div>
      {expanded && hasChildren && (
        <div className="mm-children">
          {node.children!.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  root: MindmapNode
  bookTitle: string
  onClose: () => void
}

export default function Mindmap({ root, bookTitle, onClose }: Props) {
  const countNodes = (node: MindmapNode): number =>
    1 + (node.children?.reduce((s, c) => s + countNodes(c), 0) ?? 0)
  const total = countNodes(root)

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div className="mm-panel" onClick={e => e.stopPropagation()}>
        <div className="mm-header">
          <div className="mm-header-left">
            <span className="mm-header-title">思维导图</span>
            <span className="mm-header-book">{bookTitle}</span>
            <span className="mm-header-count">{total} 个节点</span>
          </div>
          <button className="mm-close" onClick={onClose}>✕</button>
        </div>
        <div className="mm-content">
          <TreeNode node={root} depth={0} />
        </div>
      </div>
    </div>
  )
}
