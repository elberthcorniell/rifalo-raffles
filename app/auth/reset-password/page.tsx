'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { PlatformLogo } from '@/components/platform/PlatformLogo'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const type = hash.get('type')

    if (!accessToken || !refreshToken || (type !== 'recovery' && type !== 'invite')) {
      setError('Este enlace no es válido o ya expiró. Pide uno nuevo.')
      return
    }

    const supabase = createClient()
    void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(
      ({ error: sessionError }) => {
        if (sessionError) {
          setError(authErrorMessage(sessionError, 'Este enlace no es válido o ya expiró. Pide uno nuevo.'))
          return
        }
        window.history.replaceState(null, '', '/auth/reset-password')
        setReady(true)
      }
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(authErrorMessage(updateError, 'No se pudo actualizar la contraseña'))
        return
      }
      await supabase.auth.signOut()
      setDone(true)
    } catch {
      setError('No se pudo actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <PlatformLogo height={40} variant="dark" />
          </div>
          <p className="text-muted-foreground text-sm">Elige una contraseña nueva</p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[#0B2447]">Tu contraseña ya está actualizada.</p>
            <Button asChild className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        ) : !ready ? (
          error ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar contraseña'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
