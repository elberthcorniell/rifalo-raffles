import type { Metadata } from 'next'
import { legalMetadata, PublicLegalDocument } from '@/components/legal/PublicLegalDocument'

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('privacy')
}

export default function PrivacidadPage() {
  return <PublicLegalDocument docKey="privacy" />
}
