import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authErrorMessage } from '@/lib/auth-errors'
import { requireOrgAdmin } from '@/lib/supabase/require-admin'

async function userHasPassword(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc('auth_user_has_password', {
    target_user_id: userId,
  })
  if (error) {
    throw new Error(error.message)
  }
  return data === true
}

export async function GET() {
  const auth = await requireOrgAdmin()
  if ('error' in auth) return auth.error

  try {
    const hasPassword = await userHasPassword(auth.admin, auth.user.id)
    return NextResponse.json({
      success: true,
      data: { email: auth.user.email || null, hasPassword },
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'No se pudo cargar tu cuenta',
      },
      { status: 500 }
    )
  }
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
  if (newPassword.length < 6) {
    return NextResponse.json(
      { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 }
    )
  }

  let hasPassword = true
  try {
    hasPassword = await userHasPassword(auth.admin, user.id)
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'No se pudo verificar la contraseña',
      },
      { status: 500 }
    )
  }

  if (hasPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Escribe tu contraseña actual' },
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
