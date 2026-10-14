import { NextResponse } from 'next/server'
import { authErrorMessage } from '@/lib/auth-errors'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  return NextResponse.json({
    success: true,
    data: { email: auth.user.email || null },
  })
}

export async function POST(request: Request) {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  const { user, supabase } = auth
  const body = await request.json().catch(() => ({}))
  const currentPassword = String(body.currentPassword || '')
  const newPassword = String(body.newPassword || '')

  if (!user.email) {
    return NextResponse.json(
      { success: false, error: 'Esta cuenta no tiene correo' },
      { status: 400 }
    )
  }
  if (!currentPassword) {
    return NextResponse.json(
      { success: false, error: 'Escribe tu contraseña actual' },
      { status: 400 }
    )
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 }
    )
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { success: false, error: 'Elige una contraseña distinta a la actual' },
      { status: 400 }
    )
  }

  const { error: signError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signError) {
    return NextResponse.json(
      { success: false, error: 'La contraseña actual no es correcta' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    return NextResponse.json(
      {
        success: false,
        error: authErrorMessage(updateError, 'No se pudo actualizar la contraseña'),
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
