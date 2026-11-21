const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE[char])
}

/** Keep organizer names and contact lines from becoming markup. */
export function plainLegalText(value: string | null | undefined, fallback = ''): string {
  const clean = String(value || '')
    .replace(/[\u0000-\u001f<>*_`#[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || fallback
}

export function safeHref(raw: string): string | null {
  const url = raw.trim()
  if (!url || /[\s<>"']/.test(url)) return null
  if (url.startsWith('#') || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\'))) {
    return url
  }
  const lower = url.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return null
  }
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:'
    ) {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}

function renderInline(raw: string): string {
  const pattern =
    /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g
  let html = ''
  let last = 0
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0
    html += escapeHtml(raw.slice(last, index))
    if (match[1] != null && match[2] != null) {
      const href = safeHref(match[2])
      const label = escapeHtml(match[1])
      html += href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${label}</a>`
        : label
    } else if (match[3] != null) {
      html += `<strong>${escapeHtml(match[3])}</strong>`
    } else if (match[4] != null) {
      html += `<em>${escapeHtml(match[4])}</em>`
    }
    last = index + match[0].length
  }
  html += escapeHtml(raw.slice(last))
  return html
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,3}\s+\S/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+\S/.test(line) ||
    /^\d+\.\s+\S/.test(line)
  )
}

/**
 * Small Markdown subset. Text is escaped before tags are added, so raw HTML
 * in the source is shown as text.
 */
export function renderLegalMarkdown(source: string): string {
  const lines = String(source || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(renderInline(lines[index].replace(/^>\s?/, '')))
        index += 1
      }
      blocks.push(`<blockquote><p>${quote.join('<br>')}</p></blockquote>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+\S/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^[-*]\s+/, ''))}</li>`)
        index += 1
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+\S/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+\S/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\d+\.\s+/, ''))}</li>`)
        index += 1
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(renderInline(lines[index].trim()))
      index += 1
    }
    blocks.push(`<p>${paragraph.join('<br>')}</p>`)
  }

  return blocks.join('')
}
