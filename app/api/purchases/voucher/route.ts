import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPurchaseSubmittedEmail, sendPurchaseReceivedCustomerEmail } from '@/lib/email'
import { getOrgFromHeaders, getOrgBrand } from '@/lib/tenant'
import { normalizeCheckoutFields } from '@/types/org'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeWhatsapp(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, '')
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
    const brand = getOrgBrand(org)
    const checkoutFields = normalizeCheckoutFields(org.checkout_fields)

    const formData = await request.formData()

    const voucher = formData.get('voucher') as File
    const raffleId = formData.get('raffleId') as string
    const ticketQuantity = formData.get('ticketQuantity')
    const totalAmount = formData.get('totalAmount')
    const name = formData.get('name')
    const email = formData.get('email') as string | null
    const whatsappNumber = formData.get('whatsappNumber')
    const accountId = formData.get('accountId') as string

    if (!voucher || !raffleId || !ticketQuantity || !totalAmount || !accountId) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (!UUID_RE.test(raffleId) || !UUID_RE.test(accountId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      )
    }

    if (checkoutFields.name && (typeof name !== 'string' || name.trim().length < 2)) {
      return NextResponse.json(
        { success: false, error: 'El nombre debe tener al menos 2 caracteres' },
        { status: 400 }
      )
    }

    if (checkoutFields.phone && (typeof whatsappNumber !== 'string' || whatsappNumber.trim().length < 10)) {
      return NextResponse.json(
        { success: false, error: 'Número de WhatsApp inválido' },
        { status: 400 }
      )
    }

    const emailValue = typeof email === 'string' ? email.trim() : ''
    if (checkoutFields.email) {
      if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        return NextResponse.json(
          { success: false, error: 'Correo electrónico inválido' },
          { status: 400 }
        )
      }
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(voucher.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no válido. Solo se aceptan imágenes (JPG, PNG) o PDF' },
        { status: 400 }
      )
    }

    if (voucher.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'El archivo es demasiado grande. Máximo 5MB' },
        { status: 400 }
      )
    }

    const parsedTicketQuantity = parseInt(ticketQuantity as string, 10)
    const parsedTotalAmount = parseFloat(totalAmount as string)

    if (!Number.isFinite(parsedTicketQuantity) || parsedTicketQuantity < 1) {
      return NextResponse.json(
        { success: false, error: 'Cantidad de boletos inválida' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { error: quotaError } = await supabase.rpc('assert_org_ticket_quota', {
      p_org_id: org.id,
      p_quantity: parsedTicketQuantity,
    })

    if (quotaError) {
      const msg = quotaError.message || ''
      if (msg.includes('TICKET_QUOTA_EXCEEDED')) {
        return NextResponse.json(
          {
            success: false,
            code: 'TICKET_QUOTA_EXCEEDED',
            error:
              'Esta rifa no está aceptando compras en este momento. Intenta más tarde.',
          },
          { status: 402 }
        )
      }
      throw quotaError
    }

    const { data: raffle, error: raffleError } = await supabase
      .from('raffles')
      .select('id, title, ticket_price, min_tickets, status')
      .eq('id', raffleId)
      .eq('org_id', org.id)
      .eq('status', 'active')
      .maybeSingle()

    if (raffleError) throw raffleError
    if (!raffle) {
      return NextResponse.json(
        { success: false, error: 'Rifa no encontrada o no disponible' },
        { status: 404 }
      )
    }

    const minTickets = Math.max(1, Number(raffle.min_tickets) || 1)
    if (parsedTicketQuantity < minTickets) {
      return NextResponse.json(
        {
          success: false,
          error: `El mínimo de boletos para esta rifa es ${minTickets}`,
        },
        { status: 400 }
      )
    }

    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('org_id', org.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError) throw accountError
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Cuenta bancaria no válida' },
        { status: 400 }
      )
    }

    const { count: availableCount, error: countError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('raffle_id', raffleId)
      .eq('status', 'available')

    if (countError) throw countError

    if ((availableCount ?? 0) < parsedTicketQuantity) {
      return NextResponse.json(
        {
          success: false,
          error: `No hay suficientes boletos disponibles. Disponibles: ${availableCount ?? 0}, Solicitados: ${parsedTicketQuantity}`,
        },
        { status: 400 }
      )
    }

    const whatsapp =
      checkoutFields.phone && typeof whatsappNumber === 'string'
        ? normalizeWhatsapp(whatsappNumber)
        : null
    const customerName =
      checkoutFields.name && typeof name === 'string' ? name.trim() : null
    const customerEmail = checkoutFields.email ? emailValue || null : null

    let existingCustomer: { id: string } | null = null
    if (whatsapp) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('org_id', org.id)
        .eq('whatsapp', whatsapp)
        .maybeSingle()
      existingCustomer = data
    } else if (customerEmail) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('org_id', org.id)
        .eq('email', customerEmail)
        .maybeSingle()
      existingCustomer = data
    }

    let customerId: string

    if (existingCustomer) {
      customerId = existingCustomer.id
      const update: Record<string, string> = {}
      if (customerName) update.name = customerName
      if (customerEmail) update.email = customerEmail
      if (whatsapp) update.whatsapp = whatsapp
      if (Object.keys(update).length > 0) {
        await supabase.from('customers').update(update).eq('id', customerId)
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          org_id: org.id,
          name: customerName,
          whatsapp,
          email: customerEmail,
        })
        .select('id')
        .single()

      if (customerError) throw customerError
      customerId = newCustomer.id
    }

    const ext = voucher.name.split('.').pop() || 'bin'
    const voucherPath = `${org.id}/${raffleId}/${Date.now()}_${crypto.randomUUID()}.${ext}`
    const arrayBuffer = await voucher.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('vouchers')
      .upload(voucherPath, buffer, {
        contentType: voucher.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Voucher upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Error al subir el comprobante' },
        { status: 500 }
      )
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        org_id: org.id,
        customer_id: customerId,
        raffle_id: raffleId,
        bank_account_id: accountId,
        quantity: parsedTicketQuantity,
        total_amount: parsedTotalAmount,
        status: 'pending',
        voucher_path: voucherPath,
      })
      .select('id, submitted_at')
      .single()

    if (purchaseError) {
      await supabase.storage.from('vouchers').remove([voucherPath])
      throw purchaseError
    }

    const { data: ticketNumbers, error: assignError } = await supabase.rpc(
      'assign_random_tickets',
      {
        p_raffle_id: raffleId,
        p_quantity: parsedTicketQuantity,
        p_purchase_id: purchase.id,
      }
    )

    if (assignError) {
      console.error('Ticket assignment error:', assignError)
      await supabase.from('purchases').delete().eq('id', purchase.id)
      await supabase.storage.from('vouchers').remove([voucherPath])
      return NextResponse.json(
        {
          success: false,
          error: assignError.message?.includes('Not enough')
            ? 'No hay suficientes boletos disponibles. Intenta con menos boletos.'
            : 'Error al asignar boletos',
        },
        { status: 400 }
      )
    }

    const numbers: string[] = ticketNumbers || []

    const { data: signed } = await supabase.storage
      .from('vouchers')
      .createSignedUrl(voucherPath, 60 * 60 * 24 * 7)

    sendPurchaseSubmittedEmail({
      customerName: customerName || 'Cliente',
      customerWhatsapp: whatsapp || '',
      raffleId,
      raffleName: raffle.title,
      ticketQuantity: parsedTicketQuantity,
      totalAmount: parsedTotalAmount,
      purchaseId: purchase.id,
      ticketNumbers: numbers,
      submittedAt: purchase.submitted_at || new Date().toISOString(),
      voucherUrl: signed?.signedUrl,
      brand,
    }).catch((error) => {
      console.error('Failed to send purchase notification email:', error)
    })

    if (customerEmail) {
      sendPurchaseReceivedCustomerEmail({
        customerName: customerName || 'Cliente',
        customerEmail,
        ticketQuantity: parsedTicketQuantity,
        totalAmount: parsedTotalAmount,
        purchaseId: purchase.id,
        ticketNumbers: numbers,
        submittedAt: purchase.submitted_at || new Date().toISOString(),
        brand,
      }).catch((error) => {
        console.error('Failed to send customer confirmation email:', error)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Comprobante recibido exitosamente',
      data: {
        purchaseId: purchase.id,
        raffleId,
        ticketQuantity: parsedTicketQuantity,
        ticketNumbers: numbers,
        totalAmount: parsedTotalAmount,
        name: customerName,
        whatsappNumber: whatsapp,
        status: 'pending_verification',
        submittedAt: purchase.submitted_at || new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error processing voucher:', error)
    return NextResponse.json(
      { success: false, error: 'Error al procesar el comprobante' },
      { status: 500 }
    )
  }
}
