import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgFromHeaders } from '@/lib/tenant'

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, '')
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function POST(request: Request) {
  try {
    const org = await getOrgFromHeaders()
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      )
    }

    const { phone } = await request.json()

    if (!phone || typeof phone !== 'string' || phone.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Número de teléfono inválido' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const normalized = normalizePhone(phone)
    const digits = digitsOnly(phone)

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, name, whatsapp, email')
      .eq('org_id', org.id)
      .or(`whatsapp.eq.${normalized},whatsapp.ilike.%${digits.slice(-10)}`)

    if (customerError) throw customerError

    if (!customers || customers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          contact: null,
          tickets: [],
        },
        message: 'No se encontraron registros para este número',
      })
    }

    const contact = customers[0]
    const customerIds = customers.map((c) => c.id)

    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select(`
        id,
        quantity,
        total_amount,
        status,
        submitted_at,
        raffle_id,
        raffles ( id, title, ticket_price ),
        tickets ( display_number, number, status )
      `)
      .eq('org_id', org.id)
      .in('customer_id', customerIds)
      .order('submitted_at', { ascending: false })

    if (purchasesError) throw purchasesError

    const statusMap: Record<string, string> = {
      pending: 'PENDING',
      confirmed: 'COMPLETED',
      rejected: 'CANCELLED',
    }

    const tickets = (purchases || []).map((p) => {
      const raffle = Array.isArray(p.raffles) ? p.raffles[0] : p.raffles
      const ticketRows = (p.tickets || []) as { display_number: string; number: number }[]
      const ticketNumbers = ticketRows
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((t) => t.display_number)

      return {
        id: p.id,
        date: p.submitted_at,
        state: statusMap[p.status] || p.status,
        amount: Number(p.total_amount),
        currency: 'DOP',
        paid: p.status === 'confirmed' ? Number(p.total_amount) : 0,
        dueToPay: p.status === 'pending' ? Number(p.total_amount) : 0,
        description: raffle?.title || 'Boletos de rifa',
        elements: [
          {
            description: raffle?.title || 'Boleto de rifa',
            quantity: p.quantity,
            price: Number(raffle?.ticket_price) || Number(p.total_amount) / p.quantity,
            resourceId: raffle?.id,
          },
        ],
        ticketNumbers,
        metadata: {
          name: contact.name,
          status: p.status,
          submittedAt: p.submitted_at,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          id: contact.id,
          name: contact.name,
        },
        tickets,
      },
    })
  } catch (error) {
    console.error('Error verifying tickets:', error)
    return NextResponse.json(
      { success: false, error: 'Error al verificar los boletos' },
      { status: 500 }
    )
  }
}
