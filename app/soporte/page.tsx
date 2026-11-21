import type { Metadata } from 'next'
import { legalMetadata, PublicLegalDocument } from '@/components/legal/PublicLegalDocument'

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('support')
}

export default function SoportePage() {
  return <PublicLegalDocument docKey="support" />
}
