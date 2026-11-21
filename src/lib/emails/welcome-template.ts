/**
 * Welcome email for a raffle owner. Sections are data so later onboarding
 * items can be appended without rewriting the layout.
 */

export type WelcomeSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  href?: string
  linkLabel?: string
  imageUrl?: string
}

export type WelcomeEmailInput = {
  raffleTitle: string
  raffleUrl: string
  panelUrl: string
  /** Hosted poster file. Omit when the afiche only exists as a download in the panel. */
  posterUrl?: string | null
  /** Extra kit items, rendered after the built-in ones. */
  extraSections?: WelcomeSection[]
}

export type WelcomeEmailContent = {
  subject: string
  html: string
  text: string
}

const SUBJECT = 'Tu rifa ya está en línea'

export function raffleShareMessage(title: string, raffleUrl: string): string {
  return `¡Participa en ${title}! ${raffleUrl}`
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function buildWelcomeEmail(input: WelcomeEmailInput): WelcomeEmailContent {
  const raffleTitle = cleanLine(input.raffleTitle) || 'tu rifa'
  const raffleUrl = input.raffleUrl.trim()
  const panelUrl = input.panelUrl.trim()
  const intro = `Gracias por crear tu cuenta en Rifalo. ${raffleTitle} ya está publicada y lista para compartir.`
  const sections = welcomeSections({
    ...input,
    raffleTitle,
    raffleUrl,
    panelUrl,
  })

  return {
    subject: SUBJECT,
    html: renderHtml({ intro, raffleTitle, raffleUrl, panelUrl, sections }),
    text: renderText({ intro, raffleUrl, panelUrl, sections }),
  }
}

function welcomeSections(input: WelcomeEmailInput): WelcomeSection[] {
  const shareUrl = whatsappShareUrl(raffleShareMessage(input.raffleTitle, input.raffleUrl))
  const posterUrl = httpUrl(input.posterUrl)
  const poster: WelcomeSection = posterUrl
    ? {
        id: 'poster',
        title: 'Afiche',
        paragraphs: ['Bájalo y compártelo junto con el enlace de tu rifa.'],
        href: posterUrl,
        linkLabel: 'Ver afiche',
        imageUrl: posterUrl,
      }
    : {
        id: 'poster',
        title: 'Afiche',
        paragraphs: [
          'El afiche se baja desde tu panel. Ábrelo y compártelo junto con el enlace de tu rifa.',
        ],
        href: input.panelUrl,
        linkLabel: 'Bajar el afiche',
      }

  const extras = (input.extraSections ?? []).filter((section) => cleanLine(section.title))

  return [
    {
      id: 'tips',
      title: 'Tips para compartir',
      bullets: [
        'Mándale el enlace a tus contactos de WhatsApp, de uno en uno.',
        'Publícalo en tu estado y en los grupos donde ya te conocen.',
        'Cuando tengas el afiche, compártelo junto con el enlace.',
      ],
    },
    poster,
    {
      id: 'whatsapp',
      title: 'Compartir por WhatsApp',
      paragraphs: ['Este mensaje ya incluye el enlace de tu rifa.'],
      href: shareUrl,
      linkLabel: 'Compartir por WhatsApp',
    },
    ...extras,
  ]
}

function renderText(input: {
  intro: string
  raffleUrl: string
  panelUrl: string
  sections: WelcomeSection[]
}): string {
  const lines = [
    SUBJECT,
    '',
    'Hola,',
    '',
    input.intro,
    '',
    `Ver mi rifa: ${input.raffleUrl}`,
    `Ir a mi panel: ${input.panelUrl}`,
    '',
    'Kit de bienvenida',
  ]

  for (const section of input.sections) {
    lines.push('', section.title)
    for (const paragraph of section.paragraphs ?? []) lines.push(paragraph)
    for (const bullet of section.bullets ?? []) lines.push(`- ${bullet}`)
    const href = httpUrl(section.href)
    if (href && section.linkLabel) lines.push(`${section.linkLabel}: ${href}`)
  }

  lines.push('', 'Si no creaste esta cuenta, ignora este correo.', '', 'Rifalo')
  return lines.join('\n')
}

function renderHtml(input: {
  intro: string
  raffleTitle: string
  raffleUrl: string
  panelUrl: string
  sections: WelcomeSection[]
}): string {
  const raffleHref = httpUrl(input.raffleUrl)
  const panelHref = httpUrl(input.panelUrl)
  const actions = [
    raffleHref
      ? button(raffleHref, 'Ver mi rifa', '#FFD000', '#111111')
      : `<p style="margin:0; font-size:15px; line-height:1.5; color:#0B2447;">${escapeHtml(input.raffleUrl)}</p>`,
    panelHref
      ? button(panelHref, 'Ir a mi panel', '#0B2447', '#ffffff')
      : '',
  ]
    .filter(Boolean)
    .join('')

  const kit = input.sections.map(renderSection).join('')

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(SUBJECT)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; color:#0B2447; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Ya puedes compartir el enlace. Este es tu kit de bienvenida.</div>
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
                <h1 style="margin:0 0 12px; font-size:24px; line-height:1.3; color:#0B2447;">Ya tu rifa está en línea</h1>
                <p style="margin:0; font-size:16px; line-height:1.55; color:#0B2447;">Hola,</p>
                <p style="margin:12px 0 0; font-size:16px; line-height:1.55; color:#0B2447;">${escapeHtml(input.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">${actions}</td>
            </tr>
            <tr>
              <td style="padding:8px 24px 4px;">
                <h2 style="margin:0; font-size:18px; line-height:1.4; color:#0B2447;">Kit de bienvenida</h2>
              </td>
            </tr>
            ${kit}
            <tr>
              <td style="padding:8px 24px 28px;">
                <p style="margin:0; font-size:13px; line-height:1.5; color:#64748b;">Si no creaste esta cuenta, ignora este correo.</p>
                <p style="margin:8px 0 0; font-size:13px; line-height:1.5; color:#64748b;">Rifalo</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderSection(section: WelcomeSection): string {
  const paragraphs = (section.paragraphs ?? [])
    .map(
      (paragraph) =>
        `<p style="margin:0 0 8px; font-size:15px; line-height:1.5; color:#0B2447;">${escapeHtml(paragraph)}</p>`,
    )
    .join('')
  const bullets = section.bullets?.length
    ? `<ul style="margin:0 0 8px; padding:0 0 0 18px;">${section.bullets
        .map(
          (bullet) =>
            `<li style="margin:0 0 6px; font-size:15px; line-height:1.5; color:#0B2447;">${escapeHtml(bullet)}</li>`,
        )
        .join('')}</ul>`
    : ''
  const imageUrl = httpUrl(section.imageUrl)
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="Afiche de tu rifa" width="512" style="display:block; width:100%; max-width:512px; height:auto; border:0; border-radius:8px; margin:0 0 12px;">`
    : ''
  const href = httpUrl(section.href)
  const link =
    href && section.linkLabel
      ? `<a href="${escapeHtml(href)}" style="display:inline-block; margin-top:4px; color:#0B2447; font-size:15px; font-weight:700; text-decoration:underline;">${escapeHtml(section.linkLabel)}</a>`
      : ''

  return `<tr>
    <td style="padding:8px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:8px; border-left:4px solid #FFD000;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 8px; font-size:15px; font-weight:700; color:#0B2447;">${escapeHtml(section.title)}</p>
            ${image}${paragraphs}${bullets}${link}
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

function button(href: string, label: string, background: string, color: string): string {
  return `<a href="${escapeHtml(href)}" style="display:block; margin:0 0 10px; padding:14px 16px; background-color:${background}; color:${color}; text-align:center; text-decoration:none; font-size:16px; font-weight:700; border-radius:8px;">${escapeHtml(label)}</a>`
}

function cleanLine(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

function httpUrl(value: string | null | undefined): string | null {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
