import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await request.json()
  const { admin, org } = auth

  const updates: Record<string, unknown> = {}
  if (body.name != null) updates.name = body.name
  if (body.bank != null) updates.bank = body.bank
  if (body.accountNumber != null) updates.account_number = body.accountNumber
  if (body.accountType != null) updates.account_type = body.accountType
  if (body.currency != null) updates.currency = body.currency
  if (body.holderName !== undefined) updates.holder_name = body.holderName
  if (body.cedula !== undefined) updates.cedula = body.cedula
  if (body.isActive != null) updates.is_active = Boolean(body.isActive)
  if (body.sortOrder != null) updates.sort_order = Number(body.sortOrder)

  const { data, error } = await admin
    .from('bank_accounts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      name: data.name,
      bank: data.bank,
      accountNumber: data.account_number,
      accountType: data.account_type,
      currency: data.currency,
      holderName: data.holder_name,
      cedula: data.cedula,
      isActive: data.is_active,
      sortOrder: data.sort_order,
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { admin, org } = auth
  const { error } = await admin
    .from('bank_accounts')
    .delete()
    .eq('id', id)
    .eq('org_id', org.id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
