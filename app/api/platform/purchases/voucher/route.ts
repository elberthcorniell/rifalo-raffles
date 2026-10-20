import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processVoucherPurchase } from '@/lib/voucher-purchase'
import type { Organization } from '@/types/org'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const raffleId = formData.get('raffleId') as string

    if (!raffleId || !UUID_RE.test(raffleId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: raffle, error: raffleError } = await supabase
      .from('raffles')
      .select('id, org_id, status, verification_status')
      .eq('id', raffleId)
      .eq('status', 'active')
      .eq('verification_status', 'verified')
      .maybeSingle()

    if (raffleError) throw raffleError
    if (!raffle) {
      return NextResponse.json(
        { success: false, error: 'Rifa no encontrada o no disponible' },
        { status: 404 }
      )
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', raffle.org_id)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    return await processVoucherPurchase({
      org: org as Organization,
      formData,
      requireVerified: true,
    })
  } catch (error) {
    console.error('Error processing platform voucher:', error)
    return NextResponse.json(
      { success: false, error: 'Error al procesar el comprobante' },
      { status: 500 }
    )
  }
}
