import { ACTIVATION_BUTTON_LABEL } from '@/lib/activation-copy'

export type ActivationUtmCampaign = 'activacion_d1' | 'activacion_d3' | 'activacion_broadcast'

/**
 * Query string for the "Ver mi rifa" button only. The raffle link inside the
 * message organizers paste to their contacts stays without these params.
 */
export function withActivationUtms(url: string, campaign: ActivationUtmCampaign): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const hashAt = trimmed.indexOf('#')
  const hash = hashAt >= 0 ? trimmed.slice(hashAt) : ''
  const withoutHash = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed
  const queryAt = withoutHash.indexOf('?')
  const base = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash
  const params = new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '')
  params.set('utm_source', 'email')
  params.set('utm_medium', 'resend')
  params.set('utm_campaign', campaign)
  return `${base}?${params.toString()}${hash}`
}

const TOKEN = /\{\{\{[^{}]+\}\}\}/g
const FIRST_NAME_TOKEN = /\{\{\{(?:contact\.first_name(?:\|[^}]+)?|FIRST_NAME)\}\}\}/g
const RAFFLE_TOKEN = /\{\{\{(?:raffle_link(?:\|[^}]+)?|RAFFLE_LINK)\}\}\}/g

export function cleanActivationSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function cleanActivationBody(value: string): string {
  return value.replace(/\r\n/g, '\n').trim().slice(0, 8000)
}

/** Map the aliases in the brief onto the contact-property syntax Resend documents. */
export function normalizeActivationMarkup(value: string): string {
  return value
    .replaceAll('{nombre}', '{{{contact.first_name|organizador}}}')
    .replaceAll('{{{FIRST_NAME}}}', '{{{contact.first_name|organizador}}}')
    .replaceAll('{{{RAFFLE_LINK}}}', '{{{raffle_link}}}')
    .replaceAll('[link]', '{{{raffle_link}}}')
}

export function buildActivationEmail(input: {
  subject: string
  body: string
  mode: 'broadcast' | 'personal'
  campaign: ActivationUtmCampaign
  firstName?: string
  raffleLink?: string
  unsubscribeUrl?: string
}): { subject: string; html: string; text: string } {
  const subjectSource = normalizeActivationMarkup(cleanActivationSubject(input.subject))
  const bodySource = normalizeActivationMarkup(cleanActivationBody(input.body))
  const personal = input.mode === 'personal'
  const firstName = (input.firstName || '').trim() || 'organizador'
  const raffleLink = (input.raffleLink || '').trim()

  const subject = personal ? fillTokens(subjectSource, firstName, raffleLink) : subjectSource
  const prose = personal ? fillTokens(bodySource, firstName, raffleLink) : bodySource
  const buttonHref = personal
    ? httpUrl(raffleLink)
      ? withActivationUtms(raffleLink, input.campaign)
      : null
    : withActivationUtms('{{{raffle_link}}}', input.campaign)
  const unsubscribe = input.unsubscribeUrl?.trim() || ''

  return {
    subject,
    html: renderHtml({ prose, buttonHref, unsubscribe, personal }),
    text: renderText({ subject, prose, buttonHref, unsubscribe, personal }),
  }
}

function fillTokens(value: string, firstName: string, raffleLink: string): string {
  return value.replace(FIRST_NAME_TOKEN, firstName).replace(RAFFLE_TOKEN, raffleLink)
}

function renderText(input: {
  subject: string
  prose: string
  buttonHref: string | null
  unsubscribe: string
  personal: boolean
}): string {
  const lines = [input.subject, '', input.prose, '']
  if (input.buttonHref) lines.push(`${ACTIVATION_BUTTON_LABEL}: ${input.buttonHref}`, '')
  if (input.unsubscribe) lines.push(`Date de baja: ${input.unsubscribe}`, '')
  lines.push('Rifalo')
  return lines.join('\n')
}

function renderHtml(input: {
  prose: string
  buttonHref: string | null
  unsubscribe: string
  personal: boolean
}): string {
  const paragraphs = input.prose
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const quoted = block.startsWith('"') && block.endsWith('"')
      const html = escapeKeepingTokens(block).replace(/\n/g, '<br>')
      if (quoted) {
        return `<blockquote style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #0B2447;font-size:15px;line-height:1.55;color:#0B2447;">${html}</blockquote>`
      }
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0B2447;">${html}</p>`
    })
    .join('')

  const button = input.buttonHref
    ? `<a href="${escapeAttr(input.buttonHref)}" style="display:block;margin:8px 0 0;padding:14px 16px;background-color:#0B2447;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;font-weight:700;border-radius:8px;">${ACTIVATION_BUTTON_LABEL}</a>`
    : ''
  const unsubscribe = input.unsubscribe
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;"><a href="${escapeAttr(input.unsubscribe)}" style="color:#64748b;">Date de baja</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;color:#0B2447;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#0B2447;padding:22px 24px;">
                <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.02em;color:#ffffff;">Rifalo</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">${paragraphs}</td>
            </tr>
            <tr>
              <td style="padding:4px 24px 28px;">${button}${unsubscribe}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeKeepingTokens(value: string): string {
  let out = ''
  let last = 0
  for (const match of value.matchAll(TOKEN)) {
    const index = match.index ?? 0
    out += escapeHtml(value.slice(last, index))
    out += match[0]
    last = index + match[0].length
  }
  return out + escapeHtml(value.slice(last))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: string): string {
  return escapeKeepingTokens(value)
}

function httpUrl(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return value
  } catch {
    return null
  }
}
