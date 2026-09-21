'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useOrgBrand } from '@/components/OrgBrandProvider'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const brand = useOrgBrand()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'unauthorized'
      ? 'No tienes permisos de administrador para esta organización'
      : null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signError) {
        setError(authErrorMessage(signError))
        return
      }

      // Membership is enforced by middleware / requireOrgAdmin
      const me = await fetch('/api/admin/org')
      if (!me.ok) {
        await supabase.auth.signOut()
        setError('No tienes permisos de administrador para esta organización')
        return
      }

      const next = searchParams.get('next') || '/admin'
      router.push(next)
      router.refresh()
    } catch {
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[#0B2447]">{brand.name}</h1>
          <p className="text-muted-foreground text-sm">Panel de administración</p>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
