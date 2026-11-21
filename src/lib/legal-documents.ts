import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import {
  emptyStoredLegalDocuments,
  type StoredLegalDocuments,
} from '@/lib/legal-docs'

export async function getStoredLegalDocuments(orgId: string): Promise<StoredLegalDocuments> {
  const empty = emptyStoredLegalDocuments()
  if (!orgId || !hasSupabaseConfig()) return empty

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('org_legal_documents')
    .select('terms_md, privacy_md, rules_md, support_md')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Error fetching legal documents:', error.message)
    return empty
  }

  return {
    terms: data.terms_md ?? null,
    privacy: data.privacy_md ?? null,
    rules: data.rules_md ?? null,
    support: data.support_md ?? null,
  }
}
