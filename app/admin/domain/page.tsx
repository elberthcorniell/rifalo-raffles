'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { getRootDomain } from '@/lib/constants'

export default function AdminDomainPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [plan, setPlan] = useState<'free' | 'plus' | 'unlimited'>('free')

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
      setSuccess('Dominio actualizado.')
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
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
              <p className="text-xs text-muted-foreground">
                Crea un CNAME apuntando a{' '}
                <span className="font-mono">{getRootDomain()}</span>. No configuramos SSL
                automáticamente.
              </p>
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
