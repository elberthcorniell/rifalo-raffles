import { escapeHtml, renderLegalMarkdown } from '@/lib/legal-markdown'
import { BLOG_ORIGIN, type BlogPost } from '@/lib/blog'

export type BlogEmailAction = { label: string; href: string }

export function withEmailUtms(url: string, slug: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set('utm_source', 'email')
  parsed.searchParams.set('utm_medium', 'email')
  parsed.searchParams.set('utm_campaign', slug)
  return parsed.toString()
}

export function defaultBlogEmailSubject(post: BlogPost): string {
  return post.emailSubjects[0] || post.seoTitle
}

export function cleanEmailSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function blogEmailMarkdown(post: BlogPost): string {
  return post.emailBody.trim() || post.intro
}

export function blogEmailActions(post: BlogPost, origin = BLOG_ORIGIN): {
  primary: BlogEmailAction
  secondary: BlogEmailAction
} {
  const article = withEmailUtms(`${origin}/blog/${post.slug}`, post.slug)
  const signup = withEmailUtms(`${origin}${post.ctaHref || '/signup'}`, post.slug)
  if (post.emailButtonLabel) {
    return {
      primary: { label: post.emailButtonLabel, href: article },
      secondary: { label: post.ctaButton || 'Crear mi cuenta gratis', href: signup },
    }
  }
  return {
    primary: { label: post.ctaButton || 'Crear mi cuenta gratis', href: signup },
    secondary: { label: 'Leer el artículo', href: article },
  }
}

export function listUnsubscribeHeaders(unsubscribeApiUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeApiUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

export function buildBlogEmail(input: {
  post: BlogPost
  subject: string
  coverUrl?: string | null
  unsubscribeUrl: string
  origin?: string
}): { html: string; text: string } {
  const origin = input.origin || BLOG_ORIGIN
  const subject = input.subject.trim()
  const preview = input.post.emailPreviewText
  const actions = blogEmailActions(input.post, origin)
  const bodyHtml = styleEmailHtml(stampHtmlLinks(renderLegalMarkdown(blogEmailMarkdown(input.post)), input.post.slug, origin))
  const cover = input.coverUrl
    ? `<a href="${escapeHtml(actions.primary.href)}" style="text-decoration:none;"><img src="${escapeHtml(input.coverUrl)}" alt="${escapeHtml(input.post.coverAlt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;"></a>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;color:#111111;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#0B2447;padding:22px 24px;">
                <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.04em;color:#FFD000;">Rifalo</p>
              </td>
            </tr>
            ${cover ? `<tr><td style="padding:0;line-height:0;">${cover}</td></tr>` : ''}
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#111111;">${escapeHtml(subject)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 8px;">
                <a href="${escapeHtml(actions.primary.href)}" style="display:block;padding:14px 16px;background-color:#FFD000;color:#111111;text-align:center;text-decoration:none;font-size:16px;font-weight:700;border-radius:8px;">${escapeHtml(actions.primary.label)}</a>
                <p style="margin:14px 0 0;text-align:center;font-size:14px;line-height:1.5;">
                  <a href="${escapeHtml(actions.secondary.href)}" style="color:#0B2447;font-weight:700;text-decoration:underline;">${escapeHtml(actions.secondary.label)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">Recibes este correo porque tienes una cuenta de organizador en Rifalo.</p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
                  <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Dejar de recibir estos correos</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    subject,
    '',
    preview,
    '',
    blogEmailMarkdown(input.post),
    '',
    `${actions.primary.label}: ${actions.primary.href}`,
    `${actions.secondary.label}: ${actions.secondary.href}`,
    '',
    `Dejar de recibir estos correos: ${input.unsubscribeUrl}`,
    '',
    'Rifalo',
  ].join('\n')

  return { html, text }
}

function stampHtmlLinks(html: string, slug: string, origin: string): string {
  return html.replace(/href="([^"]+)"/g, (_match, href: string) => {
    const decoded = decodeHref(href)
    let absolute = decoded
    if (absolute.startsWith('/') && !absolute.startsWith('//')) {
      absolute = `${origin}${absolute}`
    }
    let stamped = absolute
    try {
      const url = new URL(absolute)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        stamped = withEmailUtms(absolute, slug)
      }
    } catch {
      stamped = absolute
    }
    return `href="${escapeHtml(stamped)}"`
  })
}

function decodeHref(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function styleEmailHtml(html: string): string {
  return html
    .replace(/<h1>/g, '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111111;">')
    .replace(/<h2>/g, '<h2 style="margin:22px 0 8px;font-size:18px;line-height:1.35;color:#111111;">')
    .replace(/<h3>/g, '<h3 style="margin:18px 0 8px;font-size:16px;line-height:1.35;color:#111111;">')
    .replace(/<p>/g, '<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#1f2933;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding:0 0 0 18px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 12px;padding:0 0 0 18px;">')
    .replace(/<li>/g, '<li style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#1f2933;">')
    .replace(/<strong>/g, '<strong style="color:#111111;">')
    .replace(/<a /g, '<a style="color:#0B2447;font-weight:700;" ')
}
