import type { SyncPreview } from '@/lib/activation-contacts'

export type ActivationSettingsView = {
  enabled: boolean
  day1Subject: string
  day1Body: string
  day3Subject: string
  day3Body: string
  broadcastSubject: string
  broadcastBody: string
  broadcastSegment: 'no_sales' | 'organizers'
  resendBroadcastId: string | null
  storageReady: boolean
}

export type ActivationBroadcastView = {
  id: string
  subject: string
  status: string
  createdAt: string
  sent: number | null
  delivered: number | null
  opened: number | null
  clicked: number | null
}

export type ActivationView = {
  preview: SyncPreview
  settings: ActivationSettingsView
  broadcasts: ActivationBroadcastView[]
  broadcastsNote: string | null
  resendConfigured: boolean
  segments: { noSales: boolean; organizers: boolean }
  replyToConfigured: boolean
  storageReady: boolean
}

export const BROADCAST_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  queued: 'En cola',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falló',
}
