import { LEGAL_DOC_PATHS } from '@/lib/storefront-paths'
import { plainLegalText } from '@/lib/legal-markdown'

export const LEGAL_MARKDOWN_MAX = 20000

export type LegalDocKey = 'terms' | 'privacy' | 'rules' | 'support'

export type StoredLegalDocuments = Record<LegalDocKey, string | null>

export type LegalTemplateContext = {
  organizerName?: string | null
  email?: string | null
  phone?: string | null
}

export const LEGAL_DOCUMENT_LIST: {
  key: LegalDocKey
  column: 'terms_md' | 'privacy_md' | 'rules_md' | 'support_md'
  path: string
  title: string
  short: string
}[] = [
  {
    key: 'terms',
    column: 'terms_md',
    path: LEGAL_DOC_PATHS.terms,
    title: 'Términos y Condiciones',
    short: 'Términos',
  },
  {
    key: 'privacy',
    column: 'privacy_md',
    path: LEGAL_DOC_PATHS.privacy,
    title: 'Política de Privacidad',
    short: 'Privacidad',
  },
  {
    key: 'rules',
    column: 'rules_md',
    path: LEGAL_DOC_PATHS.rules,
    title: 'Reglamento de Rifas',
    short: 'Reglamento',
  },
  {
    key: 'support',
    column: 'support_md',
    path: LEGAL_DOC_PATHS.support,
    title: 'Soporte',
    short: 'Soporte',
  },
]

export function emptyStoredLegalDocuments(): StoredLegalDocuments {
  return { terms: null, privacy: null, rules: null, support: null }
}

export function normalizeStoredLegalMarkdown(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).replace(/\u0000/g, '').trim()
  if (!text) return null
  if (text.length > LEGAL_MARKDOWN_MAX) {
    throw new Error(
      `Cada documento admite hasta ${LEGAL_MARKDOWN_MAX.toLocaleString('es-DO')} caracteres.`
    )
  }
  return text
}

function plainEmail(value: string | null | undefined): string {
  const clean = plainLegalText(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : ''
}

function plainPhone(value: string | null | undefined): string {
  const clean = plainLegalText(value)
  return /^[+0-9][0-9\s().-]{6,}$/.test(clean) ? clean : ''
}

function contactBlock(context: LegalTemplateContext): string {
  const email = plainEmail(context.email)
  const phone = plainPhone(context.phone)
  const lines = [
    email ? `- Correo: ${email}` : '',
    phone ? `- Teléfono: ${phone}` : '',
  ].filter(Boolean)
  if (lines.length === 0) {
    return 'Usa el correo, el teléfono o las redes que aparecen en el pie de este sitio.'
  }
  return `Puedes escribirnos por:\n\n${lines.join('\n')}\n\nEsos datos también están en el pie de este sitio.`
}

export function defaultLegalMarkdown(key: LegalDocKey, context: LegalTemplateContext = {}): string {
  const name = plainLegalText(context.organizerName, 'el organizador')

  if (key === 'terms') {
    return `${name} organiza rifas desde República Dominicana. Estas condiciones explican cómo participas en las rifas publicadas en este sitio.

## Quién organiza

Las rifas, los premios y la confirmación de los pagos corresponden a **${name}**. El pago de los boletos se hace a las cuentas que el organizador muestra al comprar.

## Cómo participas

- Debes ser mayor de edad.
- El precio, los números y la fecha de cada sorteo están en la página de esa rifa.
- Un boleto queda confirmado cuando ${name} aprueba tu comprobante de pago.
- Guarda tu comprobante y el teléfono que usaste. Con ellos consultas tus números.

## Sorteo y premio

Participan los números de las compras confirmadas. El resultado se comunica por los medios que ${name} indique, y el premio se coordina con la persona que compró el número ganador.

## Actualizaciones

${name} puede actualizar este texto. La versión publicada en esta página es la que está vigente.`
  }

  if (key === 'privacy') {
    return `${name} usa los datos que dejas al comprar un boleto o al pedir ayuda para organizar sus rifas y responderte.

## Datos que pedimos

Según el formulario de compra, podemos pedir tu nombre, tu correo y tu teléfono o WhatsApp. También recibimos el comprobante que tú envías.

## Para qué los usamos

- Confirmar el pago y asignar números.
- Avisarte del estado de tu compra o del sorteo.
- Responder tus mensajes.
- Llevar el registro de las rifas de ${name}.

No vendemos estos datos.

## Conservación y contacto

Los guardamos mientras hagan falta para la rifa, la entrega del premio y la atención de un reclamo. Si quieres corregir o retirar tus datos de contacto, escribe a ${name} por los medios del pie de página.`
  }

  if (key === 'rules') {
    return `Este reglamento aplica a las rifas que publica **${name}**.

## Boletos

- El número se asigna cuando el pago queda confirmado.
- Un número confirmado entra en el sorteo de esa rifa.
- Si el pago no se confirma, el número puede volver a estar disponible.

## Sorteo

La fecha o la condición del sorteo se publican en la página de la rifa. Solo participan compras confirmadas. ${name} comunica el resultado por sus canales habituales.

## Premio

El premio es el que describe la página de la rifa. ${name} coordina la entrega con quien compró el número ganador, usando los datos de esa compra.

## Consulta

Puedes revisar tus boletos en este sitio con el teléfono de la compra.`
  }

  return `Si necesitas ayuda con un pago, un comprobante o tus números, **${name}** te atiende.

## Cómo escribirnos

${contactBlock(context)}

Incluye tu nombre, el teléfono de la compra y, si ya lo tienes, el número de boleto.

## En qué te ayudamos

- Saber si tu pago ya fue revisado.
- Volver a enviarte tus números.
- Aclarar la fecha o el premio de una rifa.
- Explicarte por qué un comprobante no fue aprobado.

La respuesta depende del horario de ${name}. Si tu consulta es sobre un pago, ten el comprobante a mano.`
}

export function resolveLegalMarkdown(
  key: LegalDocKey,
  stored: string | null | undefined,
  context: LegalTemplateContext = {}
): string {
  const custom = typeof stored === 'string' ? stored.trim() : ''
  return custom || defaultLegalMarkdown(key, context)
}
