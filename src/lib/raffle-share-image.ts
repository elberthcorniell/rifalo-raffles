export const POSTER_WIDTH = 1080
export const POSTER_HEIGHT = 1350

const NAVY = '#0B2447'
const FONT = 'Poppins, "Segoe UI", sans-serif'

export interface RafflePosterInput {
  title: string
  description: string
  imageUrl: string
  ticketPrice: number
  soldTickets: number
  totalTickets: number
  timeLeft: string
  endDate?: string | null
  featured?: boolean
  status?: string
  orgName: string
  siteLabel: string
  primaryColor: string
  secondaryColor: string
}

let fontReady: Promise<void> | null = null

export function ensurePosterFont(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (!fontReady) {
    fontReady = (async () => {
      if (!document.getElementById('raffle-poster-font')) {
        const link = document.createElement('link')
        link.id = 'raffle-poster-font'
        link.rel = 'stylesheet'
        link.href =
          'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap'
        document.head.appendChild(link)
      }
      await Promise.race([
        document.fonts.load(`800 64px ${FONT}`).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
    })()
  }
  return fontReady
}

export async function renderRafflePoster(input: RafflePosterInput): Promise<Blob> {
  const image = await loadImage(input.imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_WIDTH
  canvas.height = POSTER_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear la imagen')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawPoster(ctx, input, image)

  if (image && isTainted(canvas)) {
    ctx.clearRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
    drawPoster(ctx, input, null)
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo exportar la imagen')
  return blob
}

export function posterFileName(title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `rifa-${slug || 'compartir'}.png`
}

export function formatPosterPrice(amount: number) {
  return `RD$ ${amount.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  input: RafflePosterInput,
  image: HTMLImageElement | null
) {
  ctx.fillStyle = '#F6F8FB'
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  const pad = 72
  const contentW = POSTER_WIDTH - pad * 2
  const photoX = pad
  const photoY = 72
  const photoW = contentW
  const photoH = 860

  ctx.save()
  roundRect(ctx, photoX, photoY, photoW, photoH, 40)
  ctx.clip()
  if (image) {
    drawCover(ctx, image, photoX, photoY, photoW, photoH)
  } else {
    ctx.fillStyle = '#E6EDF5'
    ctx.fillRect(photoX, photoY, photoW, photoH)
  }
  ctx.restore()

  let y = photoY + photoH + 48
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = NAVY
  ctx.font = `800 58px ${FONT}`
  for (const line of wrapText(ctx, input.title, contentW, 2)) {
    ctx.fillText(line, pad, y)
    y += 70
  }

  y += 16
  const price = formatPosterPrice(input.ticketPrice)
  ctx.font = `800 42px ${FONT}`
  ctx.fillStyle = '#1565C0'
  ctx.fillText(price, pad, y)
  const priceWidth = ctx.measureText(price).width
  ctx.font = `600 28px ${FONT}`
  ctx.fillStyle = '#64748B'
  ctx.fillText('por boleto', pad + priceWidth + 16, y + 12)

  if (input.totalTickets > 0) {
    const available = Math.max(0, input.totalTickets - input.soldTickets)
    ctx.font = `600 28px ${FONT}`
    ctx.fillStyle = '#334155'
    ctx.fillText(`Quedan ${available.toLocaleString('es-DO')} boletos`, pad, y + 64)
  }

  ctx.fillStyle = '#94A3B8'
  ctx.font = `600 24px ${FONT}`
  ctx.fillText(fitText(ctx, input.siteLabel, contentW), pad, POSTER_HEIGHT - 72)
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src || src.endsWith('/placeholder.svg')) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img.width > 0 ? img : null)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function isTainted(canvas: HTMLCanvasElement) {
  try {
    canvas.getContext('2d')?.getImageData(0, 0, 1, 1)
    return false
  } catch {
    return true
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    if (lines.length === maxLines - 1) {
      const rest = [current, ...words.slice(i)].filter(Boolean).join(' ')
      lines.push(fitText(ctx, rest, maxWidth))
      return lines
    }
    if (!current) {
      lines.push(fitText(ctx, word, maxWidth))
      continue
    }
    lines.push(current)
    current = ''
    i -= 1
  }

  if (current) lines.push(fitText(ctx, current, maxWidth))
  return lines.slice(0, maxLines)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value.trimEnd()}…`
}
