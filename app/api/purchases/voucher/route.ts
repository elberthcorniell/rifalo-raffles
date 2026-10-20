import { NextResponse } from 'next/server'
import { getOrgFromHeaders } from '@/lib/tenant'
import { processVoucherPurchase } from '@/lib/voucher-purchase'

export async function POST(request: Request) {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    return await processVoucherPurchase({ org, formData })
  } catch (error) {
    console.error('Error processing voucher:', error)
    return NextResponse.json(
      { success: false, error: 'Error al procesar el comprobante' },
      { status: 500 }
    )
  }
}
