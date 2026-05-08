import type { StoredBook } from '../store'
import type { Character } from '../types'

/**
 * Render a StoredBook + character roster as a Markdown document.
 * Sections are skipped if empty; section numbering reflects what's present.
 */
export function bookToMarkdown(
  book: StoredBook,
  characters: Record<string, Character>,
): string {
  const { title, author, bookState } = book
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10)

  let md = `# ${title}\n\n`
  md += `> ${author || '—'}  \n`
  md += `> Exported from Marginalia · ${dateStr}\n\n`
  md += `---\n\n`

  let sectionNum = 1
  const roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 1] ?? String(n)

  // Highlights
  const hls = [...(bookState.highlights ?? [])].sort((a, b) => a.timestamp - b.timestamp)
  if (hls.length > 0) {
    md += `## ${roman(sectionNum++)}. Highlights\n\n`
    for (const h of hls) {
      md += `> ${escapeMd(h.text)}\n\n`
      if (h.note.trim()) {
        md += `**笔记：** ${escapeMd(h.note)}\n\n`
      }
      md += `<sub>${formatTime(h.timestamp)}</sub>\n\n`
      md += `---\n\n`
    }
  }

  // Bookmarks
  const bms = [...(bookState.bookmarks ?? [])].sort((a, b) => a.timestamp - b.timestamp)
  if (bms.length > 0) {
    md += `## ${roman(sectionNum++)}. Bookmarks\n\n`
    for (const b of bms) {
      md += `- **${escapeMd(b.label || '(unnamed)')}** — ${formatTime(b.timestamp)}\n`
    }
    md += `\n---\n\n`
  }

  // Voices (single chat + roundtable, merged & sorted)
  const allMsgs = [
    ...(bookState.messages ?? []),
    ...(bookState.roundtableMessages ?? []),
  ].sort((a, b) => a.timestamp - b.timestamp)

  if (allMsgs.length > 0) {
    md += `## ${roman(sectionNum++)}. Voices\n\n`
    let lastQuote = ''
    for (const m of allMsgs) {
      if (m.selectedText && m.selectedText !== lastQuote) {
        md += `> *${escapeMd(m.selectedText)}*\n\n`
        lastQuote = m.selectedText
      }
      const speakerName = m.role === 'user'
        ? '你'
        : (characters[m.characterId ?? '']?.name ?? '角色')
      md += `**${escapeMd(speakerName)}：** ${escapeMd(m.content)}\n\n`
    }
    md += `---\n\n`
  }

  // Opinion cards
  const cards = [...(bookState.opinionCards ?? [])].sort((a, b) => a.timestamp - b.timestamp)
  if (cards.length > 0) {
    md += `## ${roman(sectionNum++)}. Opinion Cards\n\n`
    for (const c of cards) {
      const stance = c.userStance === 'agree' ? '✓ 同意'
        : c.userStance === 'disagree' ? '✕ 反对'
        : c.userStance === 'skip' ? '— 跳过'
        : '（未表态）'
      md += `> ${escapeMd(c.selectedText)}\n\n`
      md += `**${escapeMd(c.characterName)}：** ${escapeMd(c.opinion)}\n\n`
      md += `*${stance}*\n\n`
      md += `---\n\n`
    }
  }

  // Free notes
  if (bookState.freeNote && bookState.freeNote.trim()) {
    md += `## ${roman(sectionNum++)}. Notes\n\n`
    md += bookState.freeNote.trim() + '\n\n'
  }

  // Rating
  if (bookState.rating?.stars) {
    md += `## ${roman(sectionNum++)}. Rating\n\n`
    md += `${'★'.repeat(Math.floor(bookState.rating.stars))}${bookState.rating.stars % 1 ? '½' : ''}  · ${bookState.rating.stars}/5\n\n`
  }

  return md
}

function escapeMd(s: string): string {
  // we don't aggressively escape — readable plain text is the goal.
  // only neutralize lone backticks that could break code spans.
  return s.replace(/\r\n/g, '\n').trim()
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(title: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)
  return `${cleaned || 'book'}-marginalia-${date}.md`
}
