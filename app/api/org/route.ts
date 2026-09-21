import { NextResponse } from 'next/server'
import { getOrgFromHeaders, getOrgBrand } from '@/lib/tenant'

export async function GET() {
  const org = await getOrgFromHeaders()
  if (!org) {
    return NextResponse.json(
      { success: false, error: 'Organización no encontrada' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      org,
      brand: getOrgBrand(org),
    },
  })
}
