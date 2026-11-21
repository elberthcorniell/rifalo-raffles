import type { Metadata } from 'next'
import { legalMetadata, PublicLegalDocument } from '@/components/legal/PublicLegalDocument'

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata('terms')
}

export default function TerminosPage() {
  return <PublicLegalDocument docKey="terms" />
}
