'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSessionHandoffUrl } from '@/lib/auth-handoff'
import { authErrorMessage } from '@/lib/auth-errors'
import { PLATFORM } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, Sparkles } from 'lucide-react'

export default function PlatformLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signError) {
        setError(authErrorMessage(signError))
        return
      }

      const res = await fetch('/api/platform/me/orgs')
      const json = await res.json()

      if (!json.success || !json.data?.length) {
        // No org yet — send to signup to create one
        window.location.href = '/signup'
        return
      }

      const session = signData.session
      const adminUrl = json.data[0].adminUrl
      window.location.href =
        session?.access_token && session.refresh_token
          ? getSessionHandoffUrl(adminUrl, session)
          : adminUrl
    } catch {
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 font-bold text-[#0B2447] text-xl">
            <Sparkles className="h-5 w-5 text-[#1976D2]" />
            {PLATFORM.name}
          </div>
          <p className="text-muted-foreground text-sm">Accede a tu panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#1976D2] hover:bg-[#1565C0]"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar sesión'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Nuevo aquí?{' '}
          <Link href="/signup" className="text-[#1976D2] hover:underline">
            Crear organización
          </Link>
        </p>
      </Card>
    </div>
  )
}
