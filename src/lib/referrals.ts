import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneDigits, phonesMatch } from '@/lib/phone'
import { generateReferralCode, REFERRAL_CODE_RE } from '@/lib/referral-code'

type AdminClient = SupabaseClient

export function parseReferralRewardTickets(
  value: unknown
): number | { error: string } {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return { error: 'Los boletos por referido deben ser un entero entre 1 y 100' }
  }
  return parsed
}

export type ReferableRaffle = {
  id: string
  org_id: string
  referral_reward_tickets: number
}

export async function loadReferableRaffle(
  supabase: AdminClient,
  raffleId: string,
  orgId: string | null
): Promise<ReferableRaffle | null> {
  let query = supabase
    .from('raffles')
    .select('id, org_id, status, referral_enabled, referral_reward_tickets')
    .eq('id', raffleId)
    .eq('status', 'active')
    .eq('referral_enabled', true)

  if (orgId) query = query.eq('org_id', orgId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    org_id: data.org_id,
    referral_reward_tickets: Math.max(1, Number(data.referral_reward_tickets) || 1),
  }
}

type ReferralRow = {
  id: string
  code: string
  phone: string
  phone_key: string
}

async function findReferralByPhone(
  supabase: AdminClient,
  raffleId: string,
  orgId: string,
  digits: string
): Promise<ReferralRow | null> {
  const { data: exact, error } = await supabase
    .from('referrals')
    .select('id, code, phone, phone_key')
    .eq('raffle_id', raffleId)
    .eq('org_id', orgId)
    .eq('phone_key', digits)
    .maybeSingle()

  if (error) throw error
  if (exact) return exact as ReferralRow

  const tail = digits.slice(-10)
  const { data: loose, error: looseError } = await supabase
    .from('referrals')
    .select('id, code, phone, phone_key')
    .eq('raffle_id', raffleId)
    .eq('org_id', orgId)
    .like('phone_key', `%${tail}`)

  if (looseError) throw looseError
  const match = (loose || []).find((row) => phonesMatch(row.phone_key, digits))
  return (match as ReferralRow) || null
}

export async function createOrGetReferral(
  supabase: AdminClient,
  args: { orgId: string; raffleId: string; phone: string }
): Promise<ReferralRow> {
  const phone = normalizePhone(args.phone)
  const digits = phoneDigits(phone)
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Número de teléfono inválido')
  }

  const existing = await findReferralByPhone(supabase, args.raffleId, args.orgId, digits)
  if (existing) return existing

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode()
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        org_id: args.orgId,
        raffle_id: args.raffleId,
        phone,
        phone_key: digits,
        code,
      })
      .select('id, code, phone, phone_key')
      .single()

    if (!error && data) return data as ReferralRow

    if (error?.code === '23505') {
      const again = await findReferralByPhone(supabase, args.raffleId, args.orgId, digits)
      if (again) return again
      continue
    }

    throw error || new Error('No se pudo crear el enlace de referido')
  }

  throw new Error('No se pudo crear el enlace de referido')
}

/**
 * Attribute a purchase to a referral code.
 * Same-phone purchases are not attributed, so a referrer cannot pay themselves.
 */
export async function findReferralForPurchase(
  supabase: AdminClient,
  args: {
    orgId: string
    raffleId: string
    code: string | null | undefined
    buyerPhone: string | null
  }
): Promise<string | null> {
  const code = typeof args.code === 'string' ? args.code.trim().toLowerCase() : ''
  if (!REFERRAL_CODE_RE.test(code)) return null

  const { data: raffle, error: raffleError } = await supabase
    .from('raffles')
    .select('referral_enabled')
    .eq('id', args.raffleId)
    .eq('org_id', args.orgId)
    .maybeSingle()

  if (raffleError) throw raffleError
  if (!raffle?.referral_enabled) return null

  const { data: referral, error } = await supabase
    .from('referrals')
    .select('id, phone')
    .eq('raffle_id', args.raffleId)
    .eq('org_id', args.orgId)
    .eq('code', code)
    .maybeSingle()

  if (error) throw error
  if (!referral) return null
  if (args.buyerPhone && phonesMatch(args.buyerPhone, referral.phone)) return null
  return referral.id
}
