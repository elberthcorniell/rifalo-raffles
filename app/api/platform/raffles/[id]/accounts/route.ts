import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BankAccount } from '@/types/raffle'

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
    const { data: raffle, error: raffleError } = await supabase
      .from('raffles')
      .select('id, org_id')
      .eq('id', id)
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

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('org_id', raffle.org_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    const bankAccounts: BankAccount[] = (data || []).map((account) => ({
      id: account.id,
      name: account.name || '',
      bank: account.bank || '',
      accountNumber: account.account_number || '',
      accountType: account.account_type || '',
      currency: account.currency || 'DOP',
      holderName: account.holder_name || undefined,
      cedula: account.cedula || undefined,
    }))

    return NextResponse.json({
      success: true,
      data: bankAccounts,
    })
  } catch (error) {
    console.error('Error fetching platform raffle accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar las cuentas bancarias' },
      { status: 500 }
    )
  }
}
