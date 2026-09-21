import { NextResponse } from 'next/server'
import { fetchRaffles } from '@/lib/raffles'
import { getOrgFromHeaders } from '@/lib/tenant'

export async function GET(request: Request) {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const { raffles, total } = await fetchRaffles({ page, limit, orgId: org.id })

    return NextResponse.json({
      success: true,
      data: raffles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar las rifas' },
      { status: 500 }
    )
  }
}
