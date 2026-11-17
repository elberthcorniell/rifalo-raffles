export type HeroCopy = {
  title: string
  subtitle: string
}

export const DEFAULT_HERO_COPY: HeroCopy = {
  title: 'Vende los boletos de tu rifa con un link, no por chat.',
  subtitle:
    'Tus participantes compran, suben el comprobante y reciben su número al azar. El dinero va directo a tu cuenta.',
}

const CAMPAIGN = 'rifalo_manual_v3'

/** Copy keyed by utm_content, only when utm_campaign is rifalo_manual_v3. */
const COPY_BY_CONTENT: Record<string, HeroCopy> = {
  '1A': {
    title: 'Influencer: tus DMs no son una caja registradora.',
    subtitle:
      'Pon un link en tu bio. Tus seguidores compran, suben el comprobante y reciben su número. Tú solo apruebas los pagos.',
  },
  '1C': {
    title: 'Influencer: que nadie diga que tu rifa está arreglada.',
    subtitle:
      'Tú no escoges los números. El sistema los asigna al azar y cada seguidor los consulta cuando quiera con su WhatsApp.',
  },
  '2A': {
    title: 'Dueño de negocio: tu rifa con tu logo, no en un chat.',
    subtitle:
      'Tus clientes compran en una página con tu nombre y tus colores, y pagan por transferencia directo a la cuenta del negocio.',
  },
  '3A': {
    title: 'Fundación: que todo el dinero de la rifa se vea claro.',
    subtitle:
      'La gente transfiere directo a la cuenta de la organización. Rifalo no recibe ese dinero. Ustedes ven los boletos vendidos, los pagos pendientes y los aprobados en un solo panel.',
  },
}

function firstParam(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Match utm_campaign and utm_content together. Content alone is not enough. */
export function heroCopyForUtms(
  campaign: string | string[] | null | undefined,
  content: string | string[] | null | undefined,
): HeroCopy {
  if (firstParam(campaign) !== CAMPAIGN) return DEFAULT_HERO_COPY
  return COPY_BY_CONTENT[firstParam(content)] ?? DEFAULT_HERO_COPY
}
