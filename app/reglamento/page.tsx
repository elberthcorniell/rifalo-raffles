import type { Metadata } from 'next'
import { legalMetadata, PublicLegalDocument } from '@/components/legal/PublicLegalDocument'

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('rules')
}

export default function ReglamentoPage() {
  return <PublicLegalDocument docKey="rules" />
}
