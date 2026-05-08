import type { Highlight } from '../types'

/**
 * 选取一本书的"代表批注"。
 *  1. featuredHighlightId 指定且仍存在 → 用它
 *  2. 否则取最新一条 highlight
 *  3. 一条都没有 → undefined
 */
export function pickFeaturedHighlight(
  highlights: Highlight[] | undefined,
  featuredId: string | undefined,
): Highlight | undefined {
  if (!highlights || highlights.length === 0) return undefined
  if (featuredId) {
    const found = highlights.find(h => h.id === featuredId)
    if (found) return found
  }
  return [...highlights].sort((a, b) => b.timestamp - a.timestamp)[0]
}
