import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'
import { sendPaymentApprovedEmail, sendPaymentApprovedAdminEmail } from '@/lib/email'
import { getOrgBrand } from '@/lib/tenant'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { admin, org } = auth

  const { data: p, error } = await admin
    .from('purchases')
    .select(`
      *,
      customers ( id, name, whatsapp, email ),
      raffles ( id, title, ticket_price ),
      bank_accounts ( id, bank, account_number, holder_name, account_type ),
      tickets ( display_number, number, status )
    `)
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  if (!p) {
    return NextResponse.json({ success: false, error: 'Compra no encontrada' }, { status: 404 })
  }

  const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers
  const raffle = Array.isArray(p.raffles) ? p.raffles[0] : p.raffles
  const bank = Array.isArray(p.bank_accounts) ? p.bank_accounts[0] : p.bank_accounts
  const ticketNumbers = ((p.tickets || []) as { display_number: string; number: number }[])
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((t) => t.display_number)

  let voucherUrl: string | null = null
  if (p.voucher_path) {
    const { data: signed } = await admin.storage
      .from('vouchers')
      .createSignedUrl(p.voucher_path, 60 * 60)
    voucherUrl = signed?.signedUrl || null
  }

  return NextResponse.json({
    success: true,
    data: {
      id: p.id,
      status: p.status,
      quantity: p.quantity,
      totalAmount: Number(p.total_amount),
      voucherPath: p.voucher_path,
      voucherUrl,
      submittedAt: p.submitted_at,
      reviewedAt: p.reviewed_at,
      notes: p.notes,
      customer,
      raffle,
      bankAccount: bank,
      ticketNumbers,
    },
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { user, admin, org } = auth
  const brand = getOrgBrand(org)
  const body = await request.json()
  const action = body.action as 'confirm' | 'reject'
  const notes = body.notes as string | undefined

  if (!['confirm', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('purchases')
    .select('id')
    .eq('id', id)
    .eq('org_id', org.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Compra no encontrada' }, { status: 404 })
  }

  if (action === 'confirm') {
    const { error } = await admin.rpc('admin_confirm_purchase', {
      p_purchase_id: id,
      p_reviewed_by: user.id,
    })
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
  } else {
    const { error } = await admin.rpc('admin_reject_purchase', {
      p_purchase_id: id,
      p_reviewed_by: user.id,
      p_notes: notes || null,
    })
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
  }

  const { data: p } = await admin
    .from('purchases')
    .select(`
      *,
      customers ( name, whatsapp, email ),
      raffles ( id, title ),
      tickets ( display_number, number )
    `)
    .eq('id', id)
    .eq('org_id', org.id)
    .single()

  if (action === 'confirm' && p) {
    const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers
    const raffle = Array.isArray(p.raffles) ? p.raffles[0] : p.raffles
    const ticketNumbers = ((p.tickets || []) as { display_number: string; number: number }[])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((t) => t.display_number)

    const emailData = {
      customerName: customer?.name || '',
      customerWhatsapp: customer?.whatsapp || '',
      customerEmail: customer?.email || undefined,
      raffleId: raffle?.id || '',
      raffleName: raffle?.title,
      ticketQuantity: p.quantity,
      totalAmount: Number(p.total_amount),
      purchaseId: p.id,
      ticketNumbers,
      approvedAt: new Date().toISOString(),
      brand,
    }

    if (customer?.email) {
      sendPaymentApprovedEmail(emailData).catch(console.error)
    }
    sendPaymentApprovedAdminEmail(emailData).catch(console.error)
  }

  return NextResponse.json({ success: true, data: { id, action } })
}
