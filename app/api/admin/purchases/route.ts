import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

export async function GET(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = admin
    .from('purchases')
    .select(`
      *,
      customers ( id, name, whatsapp, email ),
      raffles ( id, title, ticket_price ),
      bank_accounts ( id, bank, account_number, holder_name ),
      tickets ( display_number, number, status )
    `)
    .eq('org_id', org.id)
    .order('submitted_at', { ascending: false })

  if (status && ['pending', 'confirmed', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const purchases = (data || []).map((p) => {
    const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers
    const raffle = Array.isArray(p.raffles) ? p.raffles[0] : p.raffles
    const bank = Array.isArray(p.bank_accounts) ? p.bank_accounts[0] : p.bank_accounts
    const tickets = ((p.tickets || []) as { display_number: string; number: number }[])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((t) => t.display_number)

    return {
      id: p.id,
      status: p.status,
      quantity: p.quantity,
      totalAmount: Number(p.total_amount),
      voucherPath: p.voucher_path,
      submittedAt: p.submitted_at,
      reviewedAt: p.reviewed_at,
      notes: p.notes,
      customer,
      raffle,
      bankAccount: bank,
      ticketNumbers: tickets,
    }
  })

  return NextResponse.json({ success: true, data: purchases })
}
