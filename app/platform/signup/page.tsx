'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSessionHandoffUrl } from '@/lib/auth-handoff'
import { authErrorMessage } from '@/lib/auth-errors'
import { getRootDomain, slugifyOrgName, isValidSlug } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { PlatformLogo } from '@/components/platform/PlatformLogo'
import { OnboardingShell } from '@/components/onboarding/OnboardingShell'

type Phase = 'account' | 'org'

function handoffToAdmin(
  adminUrl: string,
  session: { access_token: string; refresh_token: string } | null
) {
  window.location.href =
    session?.access_token && session.refresh_token
      ? getSessionHandoffUrl(adminUrl, session)
      : adminUrl
}

export default function SignupPage() {
  const [phase, setPhase] = useState<Phase>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const suggested = useMemo(() => slugifyOrgName(orgName), [orgName])
  const effectiveSlug = slugTouched ? slug : suggested
  const root = getRootDomain()

  const handleOrgNameChange = (value: string) => {
    setOrgName(value)
    if (!slugTouched) setSlug(slugifyOrgName(value))
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    try {
      const supabase = createClient()

      const { data: signData, error: signError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signError) {
        if (signError.message.toLowerCase().includes('already')) {
          const { error: inError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (inError) {
            setError(authErrorMessage(inError))
            return
          }
        } else {
          setError(authErrorMessage(signError, 'Error al registrarse'))
          return
        }
      }

      if (signData?.user && !signData.session) {
        setInfo(
          'Revisa tu correo para confirmar la cuenta. Luego inicia sesión y crea tu organización.'
        )
        return
      }

      const orgsRes = await fetch('/api/platform/me/orgs')
      const orgsJson = await orgsRes.json()
      if (orgsJson.success && orgsJson.data?.length) {
        const { data: sessionData } = await supabase.auth.getSession()
        handoffToAdmin(orgsJson.data[0].adminUrl, sessionData.session)
        return
      }

      setPhase('org')
    } catch {
      setError('Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const finalSlug = (slugTouched ? slug : suggested).toLowerCase().trim()

    if (!isValidSlug(finalSlug)) {
      setError('Subdominio inválido. Usa 3–32 caracteres: letras, números y guiones.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const res = await fetch('/api/platform/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), slug: finalSlug }),
      })
      const json = await res.json()

      if (!json.success) {
        setError(json.error || 'No se pudo crear la organización')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      handoffToAdmin(json.data.adminUrl, sessionData.session)
    } catch {
      setError('Error al crear la organización')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'org') {
    return (
      <OnboardingShell currentStep={1} orgName={orgName}>
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Tu organización</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Elige el nombre y el enlace de tu sitio de rifas.
            </p>
          </div>
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nombre de la organización</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                required
                minLength={2}
                placeholder="Mi Rifa RD"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Subdominio</Label>
              <Input
                id="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                https://{effectiveSlug || 'tu-org'}.{root}
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
            </Button>
          </form>
        </Card>
      </OnboardingShell>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <PlatformLogo height={40} />
          </div>
          <p className="text-muted-foreground text-sm">
            Crea tu cuenta. Luego configuramos tu sitio, cobros y primera rifa.
          </p>
        </div>

        <form onSubmit={handleAccountSubmit} className="space-y-4">
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
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {info && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-md px-3 py-2">{info}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#FFD000] text-black hover:bg-[#F0C400]"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-black hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </Card>
    </div>
  )
}
