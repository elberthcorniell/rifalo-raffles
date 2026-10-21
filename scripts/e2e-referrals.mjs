/**
 * End-to-end check for raffle referrals.
 *
 * Creates an isolated organization, confirms a referred purchase, and checks
 * that the referrer receives the configured number of tickets. Cleans up
 * unless KEEP_E2E_REFERRAL=1.
 *
 * Usage: node scripts/e2e-referrals.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function referralCode() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, 'a')
}

const failures = []

function check(condition, message) {
  if (!condition) {
    failures.push(message)
    console.error(`FAIL ${message}`)
    return
  }
  console.log(`ok   ${message}`)
}

async function soldCount(purchaseId) {
  const { count, error } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('purchase_id', purchaseId)
    .eq('status', 'sold')
  if (error) throw error
  return count ?? 0
}

async function rewardFor(sourcePurchaseId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, quantity, total_amount, status, kind, customer_id')
    .eq('reward_source_purchase_id', sourcePurchaseId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function main() {
  const slug = `e2e${Date.now().toString(36)}`
  const referrerPhone = '+18095550100'
  const buyerPhone = '+18095550200'
  const selfPhone = '8095550100'
  const rewardTickets = 3

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      slug,
      name: 'E2E Referrals',
      tagline: 'temporary referral test',
      plan: 'unlimited',
    })
    .select('id')
    .single()
  if (orgError) throw orgError

  const orgId = org.id
  console.log(`org  ${slug}`)

  try {
    const { data: bank, error: bankError } = await supabase
      .from('bank_accounts')
      .insert({
        org_id: orgId,
        name: 'Test',
        bank: 'Banco E2E',
        account_number: '000',
        account_type: 'ahorro',
        holder_name: 'E2E',
      })
      .select('id')
      .single()
    if (bankError) throw bankError

    async function makeRaffle({ enabled, reward, from, to, title }) {
      const { data: raffle, error } = await supabase
        .from('raffles')
        .insert({
          org_id: orgId,
          title,
          description: 'e2e',
          ticket_price: 100,
          min_tickets: 1,
          status: 'active',
          referral_enabled: enabled,
          referral_reward_tickets: reward,
        })
        .select('id')
        .single()
      if (error) throw error

      const { error: rangeError } = await supabase.rpc('generate_ticket_range', {
        p_raffle_id: raffle.id,
        p_start: from,
        p_end: to,
      })
      if (rangeError) throw rangeError
      return raffle.id
    }

    async function customer(phone, name) {
      const { data, error } = await supabase
        .from('customers')
        .insert({ org_id: orgId, name, whatsapp: phone })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    }

    async function purchaseAndConfirm({ raffleId, customerId, quantity, referralId }) {
      const { data: purchase, error } = await supabase
        .from('purchases')
        .insert({
          org_id: orgId,
          customer_id: customerId,
          raffle_id: raffleId,
          bank_account_id: bank.id,
          quantity,
          total_amount: quantity * 100,
          status: 'pending',
          voucher_path: 'e2e/voucher.png',
          referral_id: referralId || null,
        })
        .select('id')
        .single()
      if (error) throw error

      const { error: assignError } = await supabase.rpc('assign_random_tickets', {
        p_raffle_id: raffleId,
        p_quantity: quantity,
        p_purchase_id: purchase.id,
      })
      if (assignError) throw assignError

      const { error: confirmError } = await supabase.rpc('admin_confirm_purchase', {
        p_purchase_id: purchase.id,
        p_reviewed_by: null,
      })
      return { id: purchase.id, confirmError }
    }

    const raffleId = await makeRaffle({
      enabled: true,
      reward: rewardTickets,
      from: 1,
      to: 40,
      title: 'Rifa con referidos',
    })

    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .insert({
        org_id: orgId,
        raffle_id: raffleId,
        phone: referrerPhone,
        phone_key: '18095550100',
        code: referralCode(),
      })
      .select('id, code')
      .single()
    if (referralError) throw referralError

    const { error: duplicateError } = await supabase.from('referrals').insert({
      org_id: orgId,
      raffle_id: raffleId,
      phone: '+1 809-555-0100',
      phone_key: '18095550100',
      code: referralCode(),
    })
    check(Boolean(duplicateError), 'the same phone cannot get a second referral for one raffle')

    const buyerId = await customer(buyerPhone, 'Comprador')
    const paid = await purchaseAndConfirm({
      raffleId,
      customerId: buyerId,
      quantity: 2,
      referralId: referral.id,
    })
    check(!paid.confirmError, 'confirming a referred purchase succeeds')

    const reward = await rewardFor(paid.id)
    check(Boolean(reward), 'a reward purchase is created')
    check(reward?.kind === 'referral_reward', 'reward purchase is marked as a referral reward')
    check(reward?.status === 'confirmed', 'reward purchase is confirmed')
    check(Number(reward?.total_amount) === 0, 'reward tickets are free')
    check(reward?.quantity === rewardTickets, `referrer receives ${rewardTickets} tickets`)
    if (reward) {
      check(
        (await soldCount(reward.id)) === rewardTickets,
        'reward tickets are sold and linked to the referrer'
      )
    }
    check((await soldCount(paid.id)) === 2, 'the buyer keeps the tickets they paid for')

    const again = await supabase.rpc('admin_confirm_purchase', {
      p_purchase_id: paid.id,
      p_reviewed_by: null,
    })
    check(Boolean(again.error), 'confirming the same purchase again is rejected')
    const rewards = await supabase
      .from('purchases')
      .select('id')
      .eq('reward_source_purchase_id', paid.id)
    check((rewards.data || []).length === 1, 'a purchase awards tickets only once')

    const selfId = await customer(selfPhone, 'Mismo numero')
    const selfPurchase = await purchaseAndConfirm({
      raffleId,
      customerId: selfId,
      quantity: 1,
      referralId: referral.id,
    })
    check(!selfPurchase.confirmError, 'a purchase from the referrer phone still confirms')
    check(
      (await rewardFor(selfPurchase.id)) == null,
      'the referrer does not earn tickets from their own purchase'
    )

    const plainId = await customer('+18095550300', 'Sin referido')
    const plain = await purchaseAndConfirm({
      raffleId,
      customerId: plainId,
      quantity: 1,
      referralId: null,
    })
    check(!plain.confirmError, 'a purchase without a referral confirms')
    check((await rewardFor(plain.id)) == null, 'a purchase without a referral does not award tickets')

    const { data: pending, error: pendingError } = await supabase
      .from('purchases')
      .insert({
        org_id: orgId,
        customer_id: buyerId,
        raffle_id: raffleId,
        bank_account_id: bank.id,
        quantity: 1,
        total_amount: 100,
        status: 'pending',
        voucher_path: 'e2e/voucher.png',
        referral_id: referral.id,
      })
      .select('id')
      .single()
    if (pendingError) throw pendingError
    const { error: assignPendingError } = await supabase.rpc('assign_random_tickets', {
      p_raffle_id: raffleId,
      p_quantity: 1,
      p_purchase_id: pending.id,
    })
    if (assignPendingError) throw assignPendingError
    const { error: rejectError } = await supabase.rpc('admin_reject_purchase', {
      p_purchase_id: pending.id,
      p_reviewed_by: null,
      p_notes: 'e2e reject',
    })
    check(!rejectError, 'rejecting a referred purchase succeeds')
    check((await rewardFor(pending.id)) == null, 'a rejected purchase does not award tickets')

    const tightId = await makeRaffle({
      enabled: true,
      reward: 5,
      from: 1,
      to: 2,
      title: 'Rifa sin boletos de sobra',
    })
    const { data: tightReferral, error: tightReferralError } = await supabase
      .from('referrals')
      .insert({
        org_id: orgId,
        raffle_id: tightId,
        phone: referrerPhone,
        phone_key: '18095550100',
        code: referralCode(),
      })
      .select('id')
      .single()
    if (tightReferralError) throw tightReferralError

    const tightBuyer = await customer('+18095550400', 'Compra el resto')
    const tight = await purchaseAndConfirm({
      raffleId: tightId,
      customerId: tightBuyer,
      quantity: 2,
      referralId: tightReferral.id,
    })
    check(!tight.confirmError, 'confirmation still succeeds when no reward tickets are left')
    check(
      (await rewardFor(tight.id)) == null,
      'no reward is created when the raffle has no tickets left'
    )

    const offId = await makeRaffle({
      enabled: false,
      reward: 4,
      from: 1,
      to: 10,
      title: 'Rifa sin referidos',
    })
    const { data: offReferral, error: offReferralError } = await supabase
      .from('referrals')
      .insert({
        org_id: orgId,
        raffle_id: offId,
        phone: referrerPhone,
        phone_key: '18095550100',
        code: referralCode(),
      })
      .select('id')
      .single()
    if (offReferralError) throw offReferralError
    const offBuyer = await customer('+18095550500', 'Compra apagada')
    const off = await purchaseAndConfirm({
      raffleId: offId,
      customerId: offBuyer,
      quantity: 1,
      referralId: offReferral.id,
    })
    check(!off.confirmError, 'confirmation succeeds when referrals are turned off')
    check(
      (await rewardFor(off.id)) == null,
      'tickets are not awarded when referrals are turned off'
    )

    const partialId = await makeRaffle({
      enabled: true,
      reward: 5,
      from: 1,
      to: 4,
      title: 'Rifa con pocos boletos',
    })
    const { data: partialReferral, error: partialReferralError } = await supabase
      .from('referrals')
      .insert({
        org_id: orgId,
        raffle_id: partialId,
        phone: '+18095550600',
        phone_key: '18095550600',
        code: referralCode(),
      })
      .select('id')
      .single()
    if (partialReferralError) throw partialReferralError
    const partialBuyer = await customer('+18095550611', 'Compra parcial')
    const partial = await purchaseAndConfirm({
      raffleId: partialId,
      customerId: partialBuyer,
      quantity: 2,
      referralId: partialReferral.id,
    })
    check(!partial.confirmError, 'confirmation succeeds when only some reward tickets remain')
    const partialReward = await rewardFor(partial.id)
    check(partialReward?.quantity === 2, 'the referrer receives the tickets that are still available')

    if (process.env.KEEP_E2E_REFERRAL === '1') {
      console.log(`kept raffle ${raffleId} on ${slug}.localhost`)
    }
  } finally {
    if (process.env.KEEP_E2E_REFERRAL !== '1') {
      await supabase.from('purchases').delete().eq('org_id', orgId)
      const { error: cleanupError } = await supabase.from('organizations').delete().eq('id', orgId)
      if (cleanupError) {
        console.error('cleanup failed:', cleanupError.message)
      } else {
        console.log('cleaned up test organization')
      }
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`)
    process.exit(1)
  }
  console.log('\nreferral e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
