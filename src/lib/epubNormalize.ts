/**
 * Normalize an EPUB ArrayBuffer to fix common XHTML defects that
 * cause epubjs to fail rendering with browser XML parser errors:
 *   - leading BOM (﻿)
 *   - stray whitespace/text BEFORE the <?xml declaration
 *   - extra content AFTER the final </html> tag
 *   - duplicate <?xml ... ?> declarations
 *
 * Runs once at import time. Returns a fresh ArrayBuffer.
 * Preserves all non-XHTML files (images, fonts, opf, ncx, css) as-is.
 */
export async function normalizeEpub(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)

  const xhtmlPattern = /\.(x?html?|xht|htm)$/i
  let touched = 0

  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path]
    if (entry.dir) continue
    if (!xhtmlPattern.test(path)) continue

    const original = await entry.async('string')
    const cleaned = cleanXhtml(original)
    if (cleaned !== original) {
      zip.file(path, cleaned)
      touched++
    }
  }

  if (touched === 0) {
    // nothing to fix — return original to avoid unnecessary re-pack cost
    return buf
  }

  return await zip.generateAsync({ type: 'arraybuffer' })
}

export function cleanXhtml(s: string): string {
  // 1. strip BOM
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)

  // 2. drop any junk BEFORE the first '<' (whitespace, garbage chars)
  const firstAngle = s.indexOf('<')
  if (firstAngle > 0) s = s.slice(firstAngle)

  // 3. drop duplicate XML declarations — keep only the first
  //    e.g. some tools double-emit "<?xml version="1.0"?>"
  const xmlDecl = /<\?xml[^?]*\?>/g
  let firstDeclEnd = -1
  s = s.replace(xmlDecl, (m, offset: number) => {
    if (firstDeclEnd === -1) {
      firstDeclEnd = offset + m.length
      return m
    }
    return ''
  })

  // 4. strip everything AFTER the last </html>
  const lastClose = s.lastIndexOf('</html>')
  if (lastClose >= 0) {
    s = s.slice(0, lastClose + '</html>'.length)
  }

  // 5. ensure trailing newline (some XML serializers expect it)
  if (!s.endsWith('\n')) s += '\n'

  return s
}
