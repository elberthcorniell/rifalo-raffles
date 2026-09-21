import { NextResponse } from 'next/server'
import { getOrgFromHeaders } from '@/lib/tenant'
import { listOrgTestimonials } from '@/lib/testimonials'

export async function GET() {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const data = await listOrgTestimonials(org.id, { activeOnly: true })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching testimonials:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar testimonios' },
      { status: 500 }
    )
  }
}
