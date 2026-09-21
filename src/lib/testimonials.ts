import { createAdminClient, hasSupabaseConfig } from '@/lib/supabase/admin'
import { initialsFromName, type Testimonial } from '@/types/testimonial'

type DbTestimonial = {
  id: string
  name: string
  quote: string
  rating: number
  role_label: string
  is_active: boolean
  sort_order: number
}

export function mapTestimonial(row: DbTestimonial): Testimonial {
  return {
    id: row.id,
    name: row.name,
    quote: row.quote,
    rating: Math.min(5, Math.max(1, Number(row.rating) || 5)),
    roleLabel: row.role_label || 'Ganador verificado',
    initials: initialsFromName(row.name),
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function listOrgTestimonials(
  orgId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<Testimonial[]> {
  if (!hasSupabaseConfig()) return []
  const supabase = createAdminClient()
  let query = supabase
    .from('testimonials')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (opts.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching testimonials:', error)
    return []
  }
  return (data || []).map((row) => mapTestimonial(row as DbTestimonial))
}
