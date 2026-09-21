import { NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { admin, org } = auth
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = (formData.get('bucket') as string) || 'raffle-images'

  if (!file) {
    return NextResponse.json({ success: false, error: 'Archivo requerido' }, { status: 400 })
  }

  if (!['raffle-images', 'vouchers'].includes(bucket)) {
    return NextResponse.json({ success: false, error: 'Bucket inválido' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `${org.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let publicUrl: string | null = null
  if (bucket === 'raffle-images') {
    const { data } = admin.storage.from(bucket).getPublicUrl(path)
    publicUrl = data.publicUrl
  }

  return NextResponse.json({
    success: true,
    data: { path, publicUrl },
  })
}
