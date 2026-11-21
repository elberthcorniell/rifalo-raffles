import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { LegalMarkdown } from '@/components/legal/LegalMarkdown'
import { StorefrontDocument } from '@/components/storefront/StorefrontDocument'
import { getStoredLegalDocuments } from '@/lib/legal-documents'
import {
  LEGAL_DOCUMENT_LIST,
  resolveLegalMarkdown,
  type LegalDocKey,
} from '@/lib/legal-docs'
import { getOrgFromHeaders } from '@/lib/tenant'

function documentFor(key: LegalDocKey) {
  const doc = LEGAL_DOCUMENT_LIST.find((item) => item.key === key)
  if (!doc) throw new Error(`Unknown legal document: ${key}`)
  return doc
}

export async function legalMetadata(key: LegalDocKey): Promise<Metadata> {
  const doc = documentFor(key)
  const org = await getOrgFromHeaders()
  if (!org) return { title: doc.title }
  return {
    title: `${doc.title} | ${org.name}`,
    description: `${doc.title} de ${org.name}.`,
  }
}

export async function PublicLegalDocument({ docKey }: { docKey: LegalDocKey }) {
  const org = await getOrgFromHeaders()
  if (!org) notFound()

  const doc = documentFor(docKey)
  const stored = await getStoredLegalDocuments(org.id)
  const markdown = resolveLegalMarkdown(docKey, stored[docKey], {
    organizerName: org.name,
    email: org.email,
    phone: org.phone,
  })

  return (
    <StorefrontDocument title={doc.title}>
      <Card className="border-card-border bg-gradient-card p-6 md:p-10">
        <LegalMarkdown markdown={markdown} />
      </Card>
    </StorefrontDocument>
  )
}
