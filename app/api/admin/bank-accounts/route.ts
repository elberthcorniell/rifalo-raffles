import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const { data, error } = await admin
    .from('bank_accounts')
    .select('*')
    .eq('org_id', org.id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: (data || []).map((a) => ({
      id: a.id,
      name: a.name,
      bank: a.bank,
      accountNumber: a.account_number,
      accountType: a.account_type,
      currency: a.currency,
      holderName: a.holder_name,
      cedula: a.cedula,
      isActive: a.is_active,
      sortOrder: a.sort_order,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { admin, org } = auth

  const { data, error } = await admin
    .from('bank_accounts')
    .insert({
      org_id: org.id,
      name: body.name || '',
      bank: body.bank || '',
      account_number: body.accountNumber,
      account_type: body.accountType || '',
      currency: body.currency || 'DOP',
      holder_name: body.holderName || null,
      cedula: body.cedula || null,
      is_active: body.isActive !== false,
      sort_order: body.sortOrder ?? 0,
    })
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
