type AuthLikeError = {
  code?: string
  message?: string
} | null | undefined

export function authErrorMessage(error: AuthLikeError, fallback = 'Error al iniciar sesión'): string {
  const code = (error?.code || '').toLowerCase()
  const message = (error?.message || '').toLowerCase()

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid_credentials')
  ) {
    return 'Correo o contraseña incorrectos'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión'
  }
  if (code === 'user_banned' || message.includes('banned')) {
    return 'Esta cuenta está deshabilitada'
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    message.includes('too many') ||
    message.includes('rate limit')
  ) {
    return 'Demasiados intentos. Inténtalo de nuevo en un momento'
  }
  if (code === 'weak_password' || message.includes('password')) {
    if (message.includes('weak') || message.includes('least') || message.includes('characters')) {
      return 'La contraseña no cumple los requisitos'
    }
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Ese correo ya está registrado. Inicia sesión'
  }
  if (message.includes('user already')) {
    return 'Ese correo ya está registrado. Inicia sesión'
  }

  return fallback
}
