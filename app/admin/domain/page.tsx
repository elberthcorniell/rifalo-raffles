'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { getRootDomain } from '@/lib/constants'
import type { CustomDomainStatus, DomainDnsRecord } from '@/lib/custom-domain'

export default function AdminDomainPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [plan, setPlan] = useState<'free' | 'plus' | 'unlimited'>('free')
  const [domainStatus, setDomainStatus] = useState<CustomDomainStatus | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/org')
        const json = await res.json()
        if (json.success) {
          const o = json.data.org
          setSlug(o.slug)
          setCustomDomain(o.custom_domain || '')
          setPlan(o.plan === 'plus' || o.plan === 'unlimited' ? o.plan : 'free')
          if (o.custom_domain) {
            const statusRes = await fetch('/api/admin/domain')
            const statusJson = await statusRes.json()
            if (statusJson.success) setDomainStatus(statusJson.data)
          }
        } else {
          setError(json.error || 'Error al cargar')
        }
      } catch {
        setError('Error al cargar el dominio')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDomain }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Error al guardar')
        return
      }
      setCustomDomain(json.data.org?.custom_domain || '')
      setDomainStatus(json.data.domainStatus || null)
      setSuccess('Dominio actualizado.')
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const refreshStatus = async () => {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/domain')
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo consultar el dominio')
        return
      }
      setDomainStatus(json.data)
    } catch {
      setError('No se pudo consultar el dominio')
    } finally {
      setVerifying(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/domain', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo verificar el dominio')
        return
      }
      setDomainStatus(json.data)
    } catch {
      setError('No se pudo verificar el dominio')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Dominio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          El subdominio no se puede cambiar. El dominio personalizado está en el plan Ilimitado.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label>Subdominio</Label>
            <Input
              value={`${slug}.${getRootDomain()}`}
              disabled
              className="font-mono bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Dominio personalizado</Label>
            <Input
              id="customDomain"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="rifas.midominio.com"
              disabled={plan !== 'unlimited'}
              className="font-mono"
            />
            {plan !== 'unlimited' ? (
              <p className="text-xs text-muted-foreground">
                Disponible en el plan Ilimitado.{' '}
                <Link href="/admin/billing" className="text-[#1976D2] hover:underline">
                  Mejorar plan
                </Link>
              </p>
            ) : (
              <DomainSetup
                status={domainStatus}
                verifying={verifying}
                onVerify={handleVerify}
                onRefresh={refreshStatus}
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">{success}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              className="bg-[#1976D2] hover:bg-[#1565C0]"
              disabled={saving || plan !== 'unlimited'}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar dominio'}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/admin">Volver al dashboard</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function DomainSetup({
  status,
  verifying,
  onVerify,
  onRefresh,
}: {
  status: CustomDomainStatus | null
  verifying: boolean
  onVerify: () => void
  onRefresh: () => void
}) {
  const needsVerify = status?.mode === 'ready' && status.domain && status.verified !== true
  const canRefresh = status?.mode === 'ready' && !!status.domain

  return (
    <div className="space-y-3 text-xs text-muted-foreground">
      <p>{domainStatusMessage(status)}</p>
      {status?.error && status.records.length > 0 && (
        <p className="text-amber-800 bg-amber-50 rounded-md px-3 py-2">{status.error}</p>
      )}
      {status && status.records.length > 0 && (
        <ul className="space-y-2">
          {status.records.map((record) => (
            <li
              key={`${record.purpose}-${record.type}-${record.host}-${record.value}`}
              className="rounded-md border bg-slate-50 px-3 py-2 space-y-1"
            >
              <p className="font-medium text-slate-700">{recordTitle(record)}</p>
              <p>
                Tipo <span className="font-mono text-slate-900">{record.type}</span>
                {' · '}
                Nombre <span className="font-mono text-slate-900">{record.host}</span>
              </p>
              <p className="font-mono text-slate-900 break-all">{record.value}</p>
            </li>
          ))}
        </ul>
      )}
      {canRefresh && (
        <div className="flex flex-wrap gap-2">
          {needsVerify && (
            <Button type="button" size="sm" variant="outline" onClick={onVerify} disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onRefresh} disabled={verifying}>
            Actualizar estado
          </Button>
        </div>
      )}
    </div>
  )
}

function recordTitle(record: DomainDnsRecord): string {
  if (record.purpose === 'verification') return 'Verificación de propiedad'
  if (record.purpose === 'redirect') return 'www redirige a tu dominio'
  return 'Apuntar el dominio a Vercel'
}

function domainStatusMessage(status: CustomDomainStatus | null): string {
  if (!status || status.mode === 'none') {
    return 'Al guardar, el dominio se agrega al proyecto de Vercel. HTTPS se emite solo cuando el DNS apunta bien y el dominio queda verificado.'
  }
  if (status.mode === 'skipped') {
    return 'En local el dominio solo se guarda. En Vercel, al guardar se registra el hostname y HTTPS se emite automáticamente.'
  }
  if (status.mode === 'missing') {
    return 'Falta VERCEL_TOKEN en el proyecto. Sin ese token Vercel no puede registrar el dominio ni emitir el certificado.'
  }
  if (status.verified && status.misconfigured === false) {
    return 'Listo. Vercel emite y renueva el certificado HTTPS.'
  }
  if (status.verified) {
    return 'Dominio verificado. Cuando el DNS apunte a Vercel, el certificado se emite solo. Puede tardar unos minutos.'
  }
  if (status.error && status.records.length === 0) return status.error
  return 'Agrega estos registros en el DNS de tu dominio. Si aparece un TXT, publícalo y pulsa Verificar.'
}
