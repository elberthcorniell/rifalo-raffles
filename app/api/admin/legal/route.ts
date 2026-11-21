import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { getStoredLegalDocuments } from '@/lib/legal-documents'
import { LEGAL_DOCUMENT_LIST, normalizeStoredLegalMarkdown } from '@/lib/legal-docs'

function payload(
  org: { name: string; email: string | null; phone: string | null },
  documents: Awaited<ReturnType<typeof getStoredLegalDocuments>>
) {
  return {
    organizerName: org.name,
    email: org.email,
    phone: org.phone,
    documents,
  }
}

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const documents = await getStoredLegalDocuments(auth.org.id)
  return NextResponse.json({
    success: true,
    data: payload(auth.org, documents),
  })
}

export async function PATCH(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const source =
    body && typeof body === 'object' && 'documents' in body
      ? (body as { documents?: unknown }).documents
      : body
  if (!source || typeof source !== 'object') {
    return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 })
  }

  const incoming = source as Record<string, unknown>
  const row: Record<string, string | null> = {
    org_id: auth.org.id,
    updated_by: auth.user.id,
  }
  let touched = false

  for (const doc of LEGAL_DOCUMENT_LIST) {
    if (incoming[doc.key] === undefined) continue
    touched = true
    try {
      row[doc.column] = normalizeStoredLegalMarkdown(incoming[doc.key])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Texto inválido'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }

  if (!touched) {
    return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 })
  }

  const { error } = await auth.admin.from('org_legal_documents').upsert(row, { onConflict: 'org_id' })
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const documents = await getStoredLegalDocuments(auth.org.id)
  return NextResponse.json({
    success: true,
    data: payload(auth.org, documents),
  })
}
