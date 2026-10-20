import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantUrl } from '@/lib/constants'
import { getTicketCounts, listRaffleBundles, mapRaffle } from '@/lib/raffles'
import { normalizeCheckoutFields } from '@/types/org'
import type { DbRaffle } from '@/types/raffle'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: raffle, error } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .eq('verification_status', 'verified')
      .maybeSingle()

    if (error) throw error
    if (!raffle) {
      return NextResponse.json(
        { success: false, error: 'Rifa no encontrada o no disponible' },
        { status: 404 }
      )
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, checkout_fields')
      .eq('id', raffle.org_id)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org?.slug) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const [counts, bundles] = await Promise.all([
      getTicketCounts([id]),
      listRaffleBundles(supabase, [id]),
    ])

    const mapped = {
      ...mapRaffle(raffle as DbRaffle, counts[id]),
      bundles: bundles[id] || [],
    }

    return NextResponse.json({
      success: true,
      data: {
        raffle: mapped,
        org: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          checkoutFields: normalizeCheckoutFields(org.checkout_fields),
          siteUrl: getTenantUrl(org.slug),
          raffleUrl: getTenantUrl(org.slug, `/raffles/${id}`),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching platform raffle:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar la rifa' },
      { status: 500 }
    )
  }
}
