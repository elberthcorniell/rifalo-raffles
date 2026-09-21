import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgFromHeaders } from '@/lib/tenant'
import type { BankAccount } from '@/types/raffle'

export type { BankAccount }

export async function GET() {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('org_id', org.id)
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
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar las cuentas bancarias' },
      { status: 500 }
    )
  }
}
