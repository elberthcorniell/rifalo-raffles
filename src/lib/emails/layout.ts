export type SimpleEmailContent = {
  subject: string
  html: string
  text: string
}

export function isHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return trimmed
  } catch {
    return null
  }
}

export function cleanLine(value: string | null | undefined, max = 200): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function renderSimpleEmail(input: {
  subject: string
  preheader: string
  heading: string
  paragraphs: string[]
  noteLabel?: string
  note?: string | null
  actionHref?: string | null
  actionLabel?: string
}): SimpleEmailContent {
  const subject = cleanLine(input.subject, 120) || 'Rifalo'
  const paragraphs = input.paragraphs.map((paragraph) => cleanLine(paragraph, 500)).filter(Boolean)
  const note = cleanLine(input.note, 500)
  const noteLabel = cleanLine(input.noteLabel, 40)
  const actionLabel = cleanLine(input.actionLabel, 40)
  const actionHref = isHttpUrl(input.actionHref)

  return {
    subject,
    html: renderHtml({
      subject,
      preheader: cleanLine(input.preheader, 140),
      heading: cleanLine(input.heading, 120) || subject,
      paragraphs,
      noteLabel: note && noteLabel ? noteLabel : null,
      note,
      actionHref,
      actionLabel: actionHref && actionLabel ? actionLabel : null,
    }),
    text: renderText({
      subject,
      paragraphs,
      noteLabel: note && noteLabel ? noteLabel : null,
      note,
      actionHref,
      actionLabel: actionHref && actionLabel ? actionLabel : null,
    }),
  }
}

function renderText(input: {
  subject: string
  paragraphs: string[]
  noteLabel: string | null
  note: string | null
  actionHref: string | null
  actionLabel: string | null
}): string {
  const lines = [input.subject, '', 'Hola,']
  for (const paragraph of input.paragraphs) lines.push('', paragraph)
  if (input.note && input.noteLabel) lines.push('', `${input.noteLabel}: ${input.note}`)
  if (input.actionHref && input.actionLabel) lines.push('', `${input.actionLabel}: ${input.actionHref}`)
  lines.push('', 'Rifalo')
  return lines.join('\n')
}

function renderHtml(input: {
  subject: string
  preheader: string
  heading: string
  paragraphs: string[]
  noteLabel: string | null
  note: string | null
  actionHref: string | null
  actionLabel: string | null
}): string {
  const body = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:12px 0 0; font-size:16px; line-height:1.55; color:#0B2447;">${escapeHtml(paragraph)}</p>`,
    )
    .join('')
  const note =
    input.note && input.noteLabel
      ? `<tr>
              <td style="padding:8px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:8px; border-left:4px solid #FFD000;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 6px; font-size:13px; font-weight:700; letter-spacing:0.02em; color:#64748b;">${escapeHtml(input.noteLabel)}</p>
                      <p style="margin:0; font-size:15px; line-height:1.5; color:#0B2447;">${escapeHtml(input.note)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
      : ''
  const action =
    input.actionHref && input.actionLabel
      ? `<tr>
              <td style="padding:20px 24px 8px;">
                <a href="${escapeHtml(input.actionHref)}" style="display:block; margin:0; padding:14px 16px; background-color:#FFD000; color:#111111; text-align:center; text-decoration:none; font-size:16px; font-weight:700; border-radius:8px;">${escapeHtml(input.actionLabel)}</a>
              </td>
            </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; color:#0B2447; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:#0B2447; padding:22px 24px;">
                <p style="margin:0; font-size:20px; font-weight:700; letter-spacing:0.02em; color:#FFD000;">Rifalo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 12px; font-size:24px; line-height:1.3; color:#0B2447;">${escapeHtml(input.heading)}</h1>
                <p style="margin:0; font-size:16px; line-height:1.55; color:#0B2447;">Hola,</p>
                ${body}
              </td>
            </tr>
            ${note}
            ${action}
            <tr>
              <td style="padding:8px 24px 28px;">
                <p style="margin:16px 0 0; font-size:13px; line-height:1.5; color:#64748b;">Rifalo</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
