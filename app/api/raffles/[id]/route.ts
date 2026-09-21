import { NextResponse } from 'next/server'
import { fetchRaffleById } from '@/lib/raffles'
import { getOrgFromHeaders } from '@/lib/tenant'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: 'ID de rifa inválido' },
        { status: 400 }
      )
    }

    const raffle = await fetchRaffleById(id, org.id)

    if (!raffle) {
      return NextResponse.json(
        { success: false, error: 'Rifa no encontrada' },
        { status: 404 }
      )
    }

    if (raffle.status && raffle.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Rifa no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: raffle,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar la rifa' },
      { status: 500 }
    )
  }
}
