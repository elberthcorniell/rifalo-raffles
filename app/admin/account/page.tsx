'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function AdminAccountPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/password')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setEmail(json.data?.email || null)
        else setError(json.error || 'No se pudo cargar tu cuenta')
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar tu cuenta')
      })
      .finally(() => {
        if (!cancelled) setLoadingAccount(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo actualizar la contraseña')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Tu contraseña ya está actualizada.')
    } catch {
      setError('No se pudo actualizar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2447]">Cuenta</h1>
        <p className="text-muted-foreground">
          Cambia la contraseña de tu usuario. Si administras varias organizaciones, usarás
          la misma para entrar a cada una.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={loadingAccount ? '' : email || ''}
              placeholder={loadingAccount ? 'Cargando…' : 'Sin correo'}
              readOnly
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-800 bg-green-50 rounded-md px-3 py-2">{success}</p>
          )}

          <Button
            type="submit"
            className="bg-[#1976D2] hover:bg-[#1565C0]"
            disabled={saving || loadingAccount}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar contraseña'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
