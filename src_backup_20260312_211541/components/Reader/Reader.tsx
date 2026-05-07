import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import type { Book, Rendition } from 'epubjs'
import type { NavItem } from 'epubjs/types/navigation'
import type { Highlight } from '../../types'
import './Reader.css'

export interface ReaderHandle {
  prev: () => void
  next: () => void
  goToChapter: (href: string) => void
  addHighlight: (cfiRange: string, color?: string) => void
}

interface Props {
  bookData: ArrayBuffer
  onTextSelected: (text: string, cfiRange: string) => void
  onChapterChange: (index: number, title: string, content: string, href: string) => void
  onChapterMeta?: (index: number, title: string, href: string) => void
  onBookLoaded: (title: string, author: string, toc: NavItem[]) => void
  onReady?: (handle: ReaderHandle) => void
  initialLocation?: string
  onLocationChange?: (location: string) => void
  highlights?: Highlight[]
  tocList?: NavItem[]
  readerTheme?: { bg: string; color: string; fontFamily: string; fontSize?: string; lineHeight?: number }
  flow?: 'scrolled-doc' | 'paginated'
  zoom?: number
}

export default function Reader({
  bookData,
  onTextSelected,
  onChapterChange,
  onChapterMeta,
  onBookLoaded,
  onReady,
  initialLocation,
  onLocationChange,
  highlights,
  tocList: externalTocList,
  readerTheme,
  flow = 'scrolled-doc',
  zoom = 1,
}: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const tocRef = useRef<NavItem[]>([])
  const tocHrefsRef = useRef<string[]>([])
  const currentHrefRef = useRef<string>('')
  const navDirRef = useRef<'prev' | 'next'>('next')
  const prevNextRef = useRef<{ prev: () => void; next: () => void }>({ prev: () => {}, next: () => {} })
  // ref 让 hook 闭包始终读到最新主题值
  const readerThemeRef = useRef(readerTheme)
  useEffect(() => { readerThemeRef.current = readerTheme }, [readerTheme])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!viewerRef.current || !bookData) return

    setError('')
    let destroyed = false

    const book = ePub(bookData as unknown as string)
    bookRef.current = book

    const container = viewerRef.current
    const rect = container.getBoundingClientRect()

    const rendition = book.renderTo(container, {
      width: rect.width || 600,
      height: rect.height || 500,
      flow: flow,
      spread: 'none',
    })
    renditionRef.current = rendition

    // Inject custom styles into epub iframe
    rendition.hooks.content.register((view: unknown) => {
      const v = view as { document: Document }
      if (!v?.document) return
      let style = v.document.getElementById('marginalia-custom') as HTMLStyleElement | null
      if (!style) {
        style = v.document.createElement('style') as HTMLStyleElement
        style.id = 'marginalia-custom'
        v.document.head?.appendChild(style)
      }
      // 用 href 而非 origin，兼容 Electron file:// 协议
      const base = window.location.href.replace(/\/[^/]*$/, '')
      const theme = readerThemeRef.current
      const fontFaces = [
        { family: 'XiangcuiDazijiti', file: 'XiangcuiDazijiti.ttf', fmt: 'truetype' },
        { family: 'HuiwenMincho',     file: 'HuiwenMincho.otf',     fmt: 'opentype' },
        { family: 'RunzhiKangxi',     file: 'RunzhiKangxi.ttf',     fmt: 'truetype' },
        { family: 'ChillHuoFangSong', file: 'ChillHuoFangSong.ttf', fmt: 'truetype' },
      ].map(f =>
        `@font-face { font-family: '${f.family}'; src: url('${base}/fonts/${f.file}') format('${f.fmt}'); font-display: swap; }`
      ).join('\n')
      style.textContent = [
        '::-webkit-scrollbar { width: 4px; height: 4px; }',
        '::-webkit-scrollbar-track { background: transparent; }',
        '::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }',
        'body { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }',
        `body { line-height: ${theme?.lineHeight || 1.9} !important; }`,
        fontFaces,
      ].join('\n')
    })

    // 主题
    rendition.themes.default({
      body: {
        'background-color': '#13132a !important',
        color: '#e0e0e0 !important',
        'font-family': '-apple-system, BlinkMacSystemFont, "Noto Serif SC", "Source Han Serif", Georgia, serif !important',
        'font-size': '17px !important',
        'line-height': `${readerTheme?.lineHeight || 1.9} !important`,
        padding: '56px 32px !important',
      },
      'a': { color: '#6c63ff !important' },
      '::selection': { background: 'rgba(108, 99, 255, 0.3) !important' },
    })

    // 从spine item提取文本的辅助函数
    async function extractSpineText(spineItem: unknown): Promise<string> {
      try {
        const item = spineItem as { load: (resolver: unknown) => Promise<unknown> }
        const doc = await item.load(book.load.bind(book))
        return (doc as unknown as { documentElement: HTMLElement }).documentElement?.innerText || ''
      } catch {
        return ''
      }
    }

    // 加载书
    book.ready
      .then(async () => {
        if (destroyed) return
        const nav = await book.loaded.navigation
        const meta = await book.loaded.metadata
        tocRef.current = nav.toc
        onBookLoaded(meta.title || '未知书名', meta.creator || '未知作者', nav.toc)

        const tocItems = (externalTocList && externalTocList.length > 0) ? externalTocList : nav.toc
        const tocHrefs = tocItems.map(t => t.href)
        tocHrefsRef.current = tocHrefs

        function findTocIndex(href: string): number {
          return tocHrefs.findIndex(th => {
            const thBase = th.split('#')[0]
            return href === thBase || href.includes(thBase) || thBase.includes(href)
          })
        }

        // Chapter-level navigation (for header buttons)
        const prevChapterFn = () => {
          navDirRef.current = 'prev'
          const cur = currentHrefRef.current
          const idx = findTocIndex(cur)
          if (idx > 0) {
            rendition.display(tocHrefs[idx - 1])
          } else if (idx === -1 && tocHrefs.length > 0) {
            rendition.display(tocHrefs[0])
          }
        }
        const nextChapterFn = () => {
          navDirRef.current = 'next'
          const cur = currentHrefRef.current
          const idx = findTocIndex(cur)
          if (idx >= 0 && idx < tocHrefs.length - 1) {
            rendition.display(tocHrefs[idx + 1])
          } else if (idx === -1 && tocHrefs.length > 0) {
            rendition.display(tocHrefs[0])
          }
        }

        // Page-level navigation for click zones (paginated mode)
        prevNextRef.current = {
          prev: () => { navDirRef.current = 'prev'; rendition.prev() },
          next: () => { navDirRef.current = 'next'; rendition.next() },
        }

        onReady?.({
          prev: prevChapterFn,
          next: nextChapterFn,
          goToChapter: (href: string) => rendition.display(href),
          addHighlight: (cfiRange: string, color?: string) => {
            try {
              rendition.annotations.highlight(
                cfiRange, {},
                undefined,
                undefined,
                { fill: color || 'rgba(255, 223, 0, 0.3)', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
              )
            } catch (e) { console.warn('Highlight error:', e) }
          },
        })

        // 恢复已有高亮
        if (highlights && highlights.length > 0) {
          for (const h of highlights) {
            try {
              rendition.annotations.highlight(
                h.cfiRange, {},
                undefined,
                undefined,
                { fill: h.color || 'rgba(255, 223, 0, 0.3)', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
              )
            } catch { /* skip invalid ranges */ }
          }
        }

        // TOC 加载完成后，用当前href重新触发一次 onChapterChange
        // 修复：relocated 可能在 TOC ready 之前触发导致 title 为空、index 不准
        const curHref = currentHrefRef.current
        if (curHref) {
          const chapter = nav.toc.find(t => {
            const tocHref = t.href.split('#')[0]
            return curHref === tocHref || curHref.includes(tocHref) || tocHref.includes(curHref)
          })
          const spine = book.spine as unknown as { items: Array<{ index: number; href: string }> }
          const spineItem = spine.items.find(s =>
            s.href === curHref || curHref.includes(s.href) || s.href.includes(curHref)
          )
          if (spineItem) {
            const text = await extractSpineText(spineItem)
            if (text && !destroyed) {
              onChapterChange(spineItem.index, chapter?.label?.trim() || '', text, curHref)
            }
          }
        }
      })
      .catch((err: Error) => {
        console.error('Book load error:', err)
        setError('epub 加载失败: ' + err.message)
      })

    // 显示
    const displayPromise = initialLocation
      ? rendition.display(initialLocation)
      : rendition.display()

    displayPromise.catch((err: Error) => {
      console.error('Display error:', err)
      setError('epub 渲染失败: ' + err.message)
    })

    // 文字选中
    rendition.on('selected', (cfiRange: string) => {
      try {
        const range = rendition.getRange(cfiRange)
        const text = range?.toString() || ''
        if (text.trim().length > 0) {
          onTextSelected(text.trim(), cfiRange)
        }
      } catch (e) {
        console.warn('Selection error:', e)
      }
    })

    // 章节切换 + 进度 + 翻页动画
    rendition.on('relocated', async (location: { start: { href: string; cfi: string; index: number; percentage?: number } }) => {
      if (destroyed) return
      const href = location.start.href
      currentHrefRef.current = href

      // Update reading progress
      if (typeof location.start.percentage === 'number' && location.start.percentage > 0) {
        setProgress(location.start.percentage)
      } else {
        // Fallback: use TOC index ratio
        const tocHrefs = tocHrefsRef.current
        if (tocHrefs.length > 0) {
          const idx = tocHrefs.findIndex(th => {
            const thBase = th.split('#')[0]
            return href === thBase || href.includes(thBase) || thBase.includes(href)
          })
          if (idx >= 0) setProgress((idx + 1) / tocHrefs.length)
        }
      }


      const currentToc = tocRef.current
      const chapter = currentToc.find(t => {
        const tocHref = t.href.split('#')[0]
        return href === tocHref || href.includes(tocHref) || tocHref.includes(href)
      })
      const title = chapter?.label?.trim() || ''
      onLocationChange?.(location.start.cfi)
      // Fire immediately so chapterIndex/title state updates without waiting for text extraction
      onChapterMeta?.(location.start.index, title, href)

      const spine = book.spine as unknown as { items: Array<{ index: number; href: string }> }
      const spineItem = spine.items.find(s => s.href === href || href.includes(s.href) || s.href.includes(href))
      if (spineItem) {
        const text = await extractSpineText(spineItem)
        if (text) {
          onChapterChange(location.start.index, title, text, href)
        }
      }
    })

    // 键盘翻页
    const handleKeydown = (e: KeyboardEvent) => {
      if (flow === 'paginated') {
        if (e.key === 'ArrowLeft') { navDirRef.current = 'prev'; rendition.prev() }
        if (e.key === 'ArrowRight') { navDirRef.current = 'next'; rendition.next() }
        return
      }
      // Scrolled mode: chapter-level
      const tocHrefs = tocHrefsRef.current
      if (tocHrefs.length === 0) return
      const cur = currentHrefRef.current
      const idx = tocHrefs.findIndex(th => {
        const thBase = th.split('#')[0]
        return cur === thBase || cur.includes(thBase) || thBase.includes(cur)
      })
      if (e.key === 'ArrowLeft') {
        navDirRef.current = 'prev'
        if (idx > 0) rendition.display(tocHrefs[idx - 1])
      }
      if (e.key === 'ArrowRight') {
        navDirRef.current = 'next'
        if (idx >= 0 && idx < tocHrefs.length - 1) {
          rendition.display(tocHrefs[idx + 1])
        } else if (idx === -1) {
          rendition.display(tocHrefs[0])
        }
      }
    }
    document.addEventListener('keydown', handleKeydown)

    // resize
    const handleResize = () => {
      try {
        if (renditionRef.current && viewerRef.current) {
          const r = viewerRef.current.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            renditionRef.current.resize(r.width, r.height)
          }
        }
      } catch { /* not ready */ }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      destroyed = true
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', handleResize)
      book.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookData, flow])

  // 动态切换阅读主题
  useEffect(() => {
    if (!renditionRef.current || !readerTheme) return
    renditionRef.current.themes.default({
      body: {
        'background-color': `${readerTheme.bg} !important`,
        color: `${readerTheme.color} !important`,
        'font-family': `${readerTheme.fontFamily} !important`,
        'font-size': `${readerTheme.fontSize || '17px'} !important`,
        'line-height': `${readerTheme.lineHeight || 1.9} !important`,
        padding: '56px 32px !important',
      },
      'a': { color: '#818cf8 !important' },
      '::selection': { background: 'rgba(99, 102, 241, 0.3) !important' },
    })
    // 直接更新 epub iframe 内已注入的 style 元素，确保行距/字体立即生效
    try {
      const iframe = viewerRef.current?.querySelector('iframe')
      const doc = iframe?.contentDocument
      if (doc) {
        const style = doc.getElementById('marginalia-custom') as HTMLStyleElement | null
        if (style) {
          // 替换 line-height 那一行
          style.textContent = style.textContent?.replace(
            /body \{ line-height:.*?important.*?\}/,
            `body { line-height: ${readerTheme.lineHeight || 1.9} !important; }`
          ) ?? style.textContent
        }
        const body = doc.body
        if (body) {
          body.style.setProperty('line-height', String(readerTheme.lineHeight || 1.9), 'important')
          body.style.setProperty('font-size', readerTheme.fontSize || '17px', 'important')
          body.style.setProperty('font-family', readerTheme.fontFamily, 'important')
          body.style.setProperty('background-color', readerTheme.bg, 'important')
          body.style.setProperty('color', readerTheme.color, 'important')
        }
      }
    } catch { /* cross-origin or not ready */ }
  }, [readerTheme])

  const [chapterScroll, setChapterScroll] = useState(0)

  // Track scroll progress within current chapter (scrolled mode only)
  // Re-attach on every chapter navigation via renditionRef, not MutationObserver
  useEffect(() => {
    if (flow !== 'scrolled-doc') return
    let rafId: number
    let currentDoc: Document | null = null

    const handleScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const el = currentDoc?.scrollingElement || currentDoc?.documentElement
        if (!el) return
        const max = el.scrollHeight - el.clientHeight
        setChapterScroll(max > 0 ? el.scrollTop / max : 0)
      })
    }

    function attach() {
      if (currentDoc) {
        currentDoc.removeEventListener('scroll', handleScroll)
      }
      const iframe = viewerRef.current?.querySelector('iframe')
      const doc = iframe?.contentDocument
      if (!doc) return
      currentDoc = doc
      setChapterScroll(0)
      doc.addEventListener('scroll', handleScroll, { passive: true })
    }

    // Attach now (initial load)
    attach()

    // Re-attach every time epub.js finishes rendering a chapter
    const rendition = renditionRef.current
    rendition?.on('rendered', attach)

    return () => {
      cancelAnimationFrame(rafId)
      currentDoc?.removeEventListener('scroll', handleScroll)
      rendition?.off('rendered', attach)
    }
  }, [flow])

  return (
    <div className="reader-container" style={{ background: readerTheme?.bg || '#13132a', zoom: zoom !== 1 ? zoom : undefined }}>
      {error && <div className="reader-error">{error}</div>}
      {flow === 'paginated' && (
        <div className="reader-click-prev" onClick={() => prevNextRef.current.prev()}>
          <span className="reader-click-icon">‹</span>
        </div>
      )}
      <div className="reader-viewer" ref={viewerRef} />
      {flow === 'paginated' && (
        <div className="reader-click-next" onClick={() => prevNextRef.current.next()}>
          <span className="reader-click-icon">›</span>
        </div>
      )}
      {flow === 'scrolled-doc' && (
        <div className="reader-chapter-scroll-track">
          <div className="reader-chapter-scroll-thumb" style={{ height: `${chapterScroll * 100}%` }} />
        </div>
      )}
      <div className="reader-progress-bar-wrap">
        <div className="reader-progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}
