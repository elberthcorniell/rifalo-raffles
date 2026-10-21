import { NextResponse } from 'next/server'
import { getVerifiedPlatformRaffle } from '@/lib/platform-raffle'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getVerifiedPlatformRaffle(id)

  if (result.kind === 'error') {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true, data: result.data })
}
