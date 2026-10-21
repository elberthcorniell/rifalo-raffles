import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgFromHeaders } from '@/lib/tenant'
import { REFERRAL_CODE_RE } from '@/lib/referral-code'
import { createOrGetReferral, loadReferableRaffle } from '@/lib/referrals'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function referableRaffle(raffleId: string) {
  if (!UUID_RE.test(raffleId)) return { error: 'ID de rifa inválido', status: 400 as const }

  const org = await getOrgFromHeaders()
  const supabase = createAdminClient()
  const raffle = await loadReferableRaffle(supabase, raffleId, org?.id || null)
  if (!raffle) {
    return { error: 'Esta rifa no acepta referidos', status: 404 as const }
  }
  return { supabase, raffle }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loaded = await referableRaffle(id)
    if ('error' in loaded) {
      return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status })
    }

    const code = new URL(request.url).searchParams.get('code')?.trim().toLowerCase() || ''
    if (!REFERRAL_CODE_RE.test(code)) {
      return NextResponse.json({
        success: true,
        data: { valid: false, rewardTickets: loaded.raffle.referral_reward_tickets },
      })
    }

    const { data, error } = await loaded.supabase
      .from('referrals')
      .select('id')
      .eq('raffle_id', loaded.raffle.id)
      .eq('org_id', loaded.raffle.org_id)
      .eq('code', code)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        valid: Boolean(data),
        rewardTickets: loaded.raffle.referral_reward_tickets,
      },
    })
  } catch (error) {
    console.error('Error checking referral:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo verificar el enlace' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loaded = await referableRaffle(id)
    if ('error' in loaded) {
      return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status })
    }

    const body = await request.json().catch(() => null)
    const phone = body && typeof body.phone === 'string' ? body.phone : ''

    let referral
    try {
      referral = await createOrGetReferral(loaded.supabase, {
        orgId: loaded.raffle.org_id,
        raffleId: loaded.raffle.id,
        phone,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el enlace'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        code: referral.code,
        phone: referral.phone,
        rewardTickets: loaded.raffle.referral_reward_tickets,
      },
    })
  } catch (error) {
    console.error('Error creating referral:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear el enlace de referido' },
      { status: 500 }
    )
  }
}
