import sgMail from '@sendgrid/mail'
import { PLATFORM, getRootDomain } from '@/lib/constants'
import type { OrgBrand } from '@/types/org'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

type EmailBrand = Pick<OrgBrand, 'name' | 'email' | 'adminEmail' | 'domain'>

function resolveBrand(brand?: EmailBrand) {
  const name = brand?.name || process.env.SENDGRID_FROM_NAME || PLATFORM.name
  const domain = brand?.domain || getRootDomain()
  const adminEmail =
    brand?.adminEmail || brand?.email || process.env.ADMIN_EMAIL || PLATFORM.email
  return {
    name,
    adminEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || `noreply@${domain}`,
      name,
    },
  }
}

interface PurchaseSubmittedEmailData {
  customerName: string
  customerWhatsapp: string
  raffleId: string
  raffleName?: string
  ticketQuantity: number
  totalAmount: number
  purchaseId: string
  ticketNumbers?: string[]
  submittedAt: string
  voucherUrl?: string
  brand?: EmailBrand
}

interface PurchaseReceivedCustomerEmailData {
  customerName: string
  customerEmail: string
  ticketQuantity: number
  totalAmount: number
  purchaseId: string
  ticketNumbers?: string[]
  submittedAt: string
  brand?: EmailBrand
}

interface PaymentApprovedEmailData {
  customerName: string
  customerWhatsapp: string
  customerEmail?: string
  raffleId: string
  raffleName?: string
  ticketQuantity: number
  totalAmount: number
  purchaseId: string
  ticketNumbers?: string[]
  approvedAt: string
  brand?: EmailBrand
}

export async function sendPurchaseSubmittedEmail(data: PurchaseSubmittedEmailData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email notification.')
    return false
  }

  const {
    customerName,
    customerWhatsapp,
    raffleId,
    raffleName,
    ticketQuantity,
    totalAmount,
    purchaseId,
    ticketNumbers,
    submittedAt,
    voucherUrl,
    brand: brandInput,
  } = data

  const brand = resolveBrand(brandInput)

  const formattedDate = new Date(submittedAt).toLocaleString('es-DO', {
    dateStyle: 'full',
    timeStyle: 'short'
  })

  const msg = {
    to: brand.adminEmail,
    from: brand.from,
    subject: `🎟️ Nueva Compra Pendiente - Orden #${purchaseId}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(11, 36, 71, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0B2447; margin: 0; font-size: 24px;">🎟️ Nueva Compra Pendiente</h1>
              <p style="color: #64748b; margin-top: 10px;">Se ha recibido un nuevo comprobante de pago</p>
            </div>
            
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0B2447; margin-top: 0; font-size: 18px; border-bottom: 2px solid #1976D2; padding-bottom: 10px;">Detalles del Cliente</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 140px;">Nombre:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">WhatsApp:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">
                    <a href="https://wa.me/${customerWhatsapp.replace(/\+/g, '')}" style="color: #25d366; text-decoration: none;">${customerWhatsapp}</a>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0B2447; margin-top: 0; font-size: 18px; border-bottom: 2px solid #1976D2; padding-bottom: 10px;">Detalles de la Compra</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 140px;">Orden ID:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">#${purchaseId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Rifa:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${raffleName || raffleId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cantidad de Boletos:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${ticketQuantity}</td>
                </tr>
                ${ticketNumbers && ticketNumbers.length > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Números:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${ticketNumbers.join(', ')}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Monto Total:</td>
                  <td style="padding: 8px 0; color: #27ae60; font-weight: bold; font-size: 18px;">RD$ ${totalAmount.toLocaleString('es-DO')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Fecha:</td>
                  <td style="padding: 8px 0; color: #0B2447;">${formattedDate}</td>
                </tr>
              </table>
            </div>
            
            ${voucherUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${voucherUrl}" style="display: inline-block; background-color: #1976D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Comprobante</a>
            </div>
            ` : ''}
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #DAA520;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                ⚠️ <strong>Acción requerida:</strong> Por favor verifica el comprobante de pago y aprueba o rechaza esta compra en el sistema de administración.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">Este es un mensaje automático de ${brand.name}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Nueva Compra Pendiente - Orden #${purchaseId}

Detalles del Cliente:
- Nombre: ${customerName}
- WhatsApp: ${customerWhatsapp}

Detalles de la Compra:
- Orden ID: #${purchaseId}
- Rifa: ${raffleName || raffleId}
- Cantidad de Boletos: ${ticketQuantity}
${ticketNumbers && ticketNumbers.length > 0 ? `- Números: ${ticketNumbers.join(', ')}` : ''}
- Monto Total: RD$ ${totalAmount.toLocaleString('es-DO')}
- Fecha: ${formattedDate}

${voucherUrl ? `Ver comprobante: ${voucherUrl}` : ''}

Por favor verifica el comprobante de pago y aprueba o rechaza esta compra.
    `
  }

  try {
    await sgMail.send(msg)
    console.log('Purchase submitted email sent successfully')
    return true
  } catch (error) {
    console.error('Error sending purchase submitted email:', error)
    return false
  }
}

export async function sendPurchaseReceivedCustomerEmail(data: PurchaseReceivedCustomerEmailData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email notification.')
    return false
  }

  const {
    customerName,
    customerEmail,
    ticketQuantity,
    totalAmount,
    purchaseId,
    ticketNumbers,
    submittedAt,
    brand: brandInput,
  } = data

  const brand = resolveBrand(brandInput)

  const formattedDate = new Date(submittedAt).toLocaleString('es-DO', {
    dateStyle: 'full',
    timeStyle: 'short'
  })

  const ticketNumbersHtml = ticketNumbers && ticketNumbers.length > 0
    ? `
      <div style="background-color: #e8f0fe; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #0B2447; margin-top: 0; font-size: 18px;">🎟️ Tus Números de Boletos</h2>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 15px;">
          ${ticketNumbers.map(num => `
            <span style="background-color: #1976D2; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 18px;">${num}</span>
          `).join('')}
        </div>
      </div>
    `
    : ''

  const msg = {
    to: customerEmail,
    from: brand.from,
    subject: `📩 Compra Recibida - Orden #${purchaseId}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(11, 36, 71, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1976D2; margin: 0; font-size: 28px;">📩 ¡Compra Recibida!</h1>
              <p style="color: #64748b; margin-top: 10px; font-size: 16px;">Hola ${customerName}, hemos recibido tu comprobante de pago</p>
            </div>
            
            <div style="background-color: #e8f0fe; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <p style="margin: 0; color: #0B2447; font-size: 16px;">
                🔍 Tu pago está siendo verificado. Te notificaremos por correo electrónico cuando tu compra sea confirmada.
              </p>
            </div>
            
            ${ticketNumbersHtml}
            
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0B2447; margin-top: 0; font-size: 18px; border-bottom: 2px solid #1976D2; padding-bottom: 10px;">Resumen de tu Compra</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 160px;">Número de Orden:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">#${purchaseId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cantidad de Boletos:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${ticketQuantity}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Monto Total:</td>
                  <td style="padding: 8px 0; color: #27ae60; font-weight: bold; font-size: 18px;">RD$ ${totalAmount.toLocaleString('es-DO')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Fecha de Envío:</td>
                  <td style="padding: 8px 0; color: #0B2447;">${formattedDate}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #DAA520;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                ⏳ <strong>Estado:</strong> Pendiente de verificación. Este proceso puede tomar unos minutos.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">Gracias por participar en ${brand.name}</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 5px;">
                ¿Tienes preguntas? Contáctanos por WhatsApp
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
¡Compra Recibida! - Orden #${purchaseId}

Hola ${customerName},

Hemos recibido tu comprobante de pago. Tu pago está siendo verificado y te notificaremos por correo electrónico cuando tu compra sea confirmada.

${ticketNumbers && ticketNumbers.length > 0 ? `Tus números de boletos: ${ticketNumbers.join(', ')}\n` : ''}
Resumen de tu compra:
- Número de Orden: #${purchaseId}
- Cantidad de Boletos: ${ticketQuantity}
- Monto Total: RD$ ${totalAmount.toLocaleString('es-DO')}
- Fecha de Envío: ${formattedDate}

Estado: Pendiente de verificación. Este proceso puede tomar unos minutos.

Gracias por participar en ${brand.name}
    `
  }

  try {
    await sgMail.send(msg)
    console.log('Purchase received customer email sent successfully to', customerEmail)
    return true
  } catch (error) {
    console.error('Error sending purchase received customer email:', error)
    return false
  }
}

export async function sendPaymentApprovedEmail(data: PaymentApprovedEmailData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email notification.')
    return false
  }

  const {
    customerName,
    customerEmail,
    raffleName,
    ticketQuantity,
    totalAmount,
    purchaseId,
    ticketNumbers,
    approvedAt,
    brand: brandInput,
  } = data

  const brand = resolveBrand(brandInput)

  if (!customerEmail) {
    console.warn('No customer email provided. Cannot send payment approved notification to customer.')
    return false
  }

  const formattedDate = new Date(approvedAt).toLocaleString('es-DO', {
    dateStyle: 'full',
    timeStyle: 'short'
  })

  const ticketNumbersHtml = ticketNumbers && ticketNumbers.length > 0
    ? `
      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #155724; margin-top: 0; font-size: 18px;">🎉 Tus Números de Boletos</h2>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 15px;">
          ${ticketNumbers.map(num => `
            <span style="background-color: #1976D2; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 18px;">${num}</span>
          `).join('')}
        </div>
      </div>
    `
    : ''

  const msg = {
    to: customerEmail,
    from: brand.from,
    subject: `✅ ¡Pago Confirmado! - Orden #${purchaseId}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(11, 36, 71, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #27ae60; margin: 0; font-size: 28px;">✅ ¡Pago Confirmado!</h1>
              <p style="color: #64748b; margin-top: 10px; font-size: 16px;">Hola ${customerName}, tu pago ha sido verificado exitosamente</p>
            </div>
            
            ${ticketNumbersHtml}
            
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0B2447; margin-top: 0; font-size: 18px; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">Detalles de tu Compra</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 140px;">Orden ID:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">#${purchaseId}</td>
                </tr>
                ${raffleName ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Rifa:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${raffleName}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cantidad de Boletos:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${ticketQuantity}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Monto Pagado:</td>
                  <td style="padding: 8px 0; color: #27ae60; font-weight: bold; font-size: 18px;">RD$ ${totalAmount.toLocaleString('es-DO')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Fecha de Aprobación:</td>
                  <td style="padding: 8px 0; color: #0B2447;">${formattedDate}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #e8f0fe; padding: 15px; border-radius: 8px; border-left: 4px solid #1976D2;">
              <p style="margin: 0; color: #0B2447; font-size: 14px;">
                🍀 <strong>¡Buena suerte!</strong> Te notificaremos cuando se realice el sorteo.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">Gracias por participar en ${brand.name}</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 5px;">
                ¿Tienes preguntas? Contáctanos por WhatsApp
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
¡Pago Confirmado! - Orden #${purchaseId}

Hola ${customerName},

Tu pago ha sido verificado exitosamente.

${ticketNumbers && ticketNumbers.length > 0 ? `Tus números de boletos: ${ticketNumbers.join(', ')}` : ''}

Detalles de tu compra:
- Orden ID: #${purchaseId}
${raffleName ? `- Rifa: ${raffleName}` : ''}
- Cantidad de Boletos: ${ticketQuantity}
- Monto Pagado: RD$ ${totalAmount.toLocaleString('es-DO')}
- Fecha de Aprobación: ${formattedDate}

¡Buena suerte! Te notificaremos cuando se realice el sorteo.

Gracias por participar en ${brand.name}
    `
  }

  try {
    await sgMail.send(msg)
    console.log('Payment approved email sent successfully to', customerEmail)
    return true
  } catch (error) {
    console.error('Error sending payment approved email:', error)
    return false
  }
}

export async function sendPaymentApprovedAdminEmail(data: PaymentApprovedEmailData): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email notification.')
    return false
  }

  const {
    customerName,
    customerWhatsapp,
    raffleName,
    raffleId,
    ticketQuantity,
    totalAmount,
    purchaseId,
    ticketNumbers,
    approvedAt,
    brand: brandInput,
  } = data

  const brand = resolveBrand(brandInput)

  const formattedDate = new Date(approvedAt).toLocaleString('es-DO', {
    dateStyle: 'full',
    timeStyle: 'short'
  })

  const msg = {
    to: brand.adminEmail,
    from: brand.from,
    subject: `✅ Pago Aprobado - Orden #${purchaseId}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(11, 36, 71, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #27ae60; margin: 0; font-size: 24px;">✅ Pago Aprobado</h1>
              <p style="color: #64748b; margin-top: 10px;">La orden #${purchaseId} ha sido confirmada</p>
            </div>
            
            <div style="background-color: #f5f7fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #0B2447; margin-top: 0; font-size: 18px; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">Detalles del Cliente</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 140px;">Nombre:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">WhatsApp:</td>
                  <td style="padding: 8px 0; color: #0B2447; font-weight: bold;">
                    <a href="https://wa.me/${customerWhatsapp.replace(/\+/g, '')}" style="color: #25d366; text-decoration: none;">${customerWhatsapp}</a>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #155724; margin-top: 0; font-size: 18px;">Resumen de la Venta</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #155724; width: 140px;">Orden ID:</td>
                  <td style="padding: 8px 0; color: #155724; font-weight: bold;">#${purchaseId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #155724;">Rifa:</td>
                  <td style="padding: 8px 0; color: #155724; font-weight: bold;">${raffleName || `ID: ${raffleId}`}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #155724;">Boletos:</td>
                  <td style="padding: 8px 0; color: #155724; font-weight: bold;">${ticketQuantity}</td>
                </tr>
                ${ticketNumbers && ticketNumbers.length > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #155724;">Números:</td>
                  <td style="padding: 8px 0; color: #155724; font-weight: bold;">${ticketNumbers.join(', ')}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #155724;">Monto:</td>
                  <td style="padding: 8px 0; color: #155724; font-weight: bold; font-size: 18px;">RD$ ${totalAmount.toLocaleString('es-DO')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #155724;">Aprobado:</td>
                  <td style="padding: 8px 0; color: #155724;">${formattedDate}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">Este es un mensaje automático de ${brand.name}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Pago Aprobado - Orden #${purchaseId}

Detalles del Cliente:
- Nombre: ${customerName}
- WhatsApp: ${customerWhatsapp}

Resumen de la Venta:
- Orden ID: #${purchaseId}
- Rifa: ${raffleName || `ID: ${raffleId}`}
- Cantidad de Boletos: ${ticketQuantity}
${ticketNumbers && ticketNumbers.length > 0 ? `- Números: ${ticketNumbers.join(', ')}` : ''}
- Monto: RD$ ${totalAmount.toLocaleString('es-DO')}
- Aprobado: ${formattedDate}
    `
  }

  try {
    await sgMail.send(msg)
    console.log('Payment approved admin email sent successfully')
    return true
  } catch (error) {
    console.error('Error sending payment approved admin email:', error)
    return false
  }
}
