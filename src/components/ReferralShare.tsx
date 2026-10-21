'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Gift, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import PhoneInput from '@/components/ui/phone-input'
import { useToast } from '@/hooks/use-toast'
import { phoneDigits } from '@/lib/phone'
import {
  REFERRAL_CODE_RE,
  referralStorageKey,
  storeReferralCode,
} from '@/lib/referral-code'

export default function ReferralShare({
  raffleId,
  rewardTickets,
}: {
  raffleId: string
  rewardTickets: number
}) {
  const { toast } = useToast()
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [invited, setInvited] = useState(false)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase() || ''
    if (!REFERRAL_CODE_RE.test(code)) return
    storeReferralCode(raffleId, code)

    let cancelled = false
    fetch(`/api/raffles/${raffleId}/referrals?code=${encodeURIComponent(code)}`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return
        if (!result?.success || !result.data?.valid) {
          try {
            const current = sessionStorage.getItem(referralStorageKey(raffleId))
            if (current === code) sessionStorage.removeItem(referralStorageKey(raffleId))
          } catch {
            // Ignore storage failures.
          }
          return
        }
        setInvited(true)
      })
      .catch(() => {
        // The purchase still works without the banner.
      })

    return () => {
      cancelled = true
    }
  }, [raffleId])

  const rewardLabel =
    rewardTickets === 1 ? '1 boleto' : `${rewardTickets.toLocaleString('es-DO')} boletos`

  const createLink = async (event: React.FormEvent) => {
    event.preventDefault()
    if (phoneDigits(phone).length < 10) {
      toast({
        title: 'Teléfono inválido',
        description: 'Escribe un número de WhatsApp con código de país.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/raffles/${raffleId}/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'No se pudo crear el enlace')

      const url = new URL(window.location.href)
      url.search = ''
      url.hash = ''
      url.searchParams.set('ref', result.data.code)
      setLink(url.toString())
    } catch (err) {
      toast({
        title: 'No se pudo crear el enlace',
        description: err instanceof Error ? err.message : 'Intenta de nuevo',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: 'Selecciona el enlace y cópialo manualmente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="p-6 bg-gradient-card border-card-border">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Gift className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Refiere y gana {rewardLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Deja tu WhatsApp y te damos un enlace. Cada compra confirmada de alguien que entre
              con ese enlace te da {rewardLabel}.
            </p>
          </div>
        </div>

        {invited && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
            Llegaste con un enlace de referido. Si tu compra se confirma, quien te invitó recibe{' '}
            {rewardLabel}.
          </p>
        )}

        {link ? (
          <div className="space-y-2">
            <Label>Tu enlace</Label>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Los boletos aparecen en Verificar boletos cuando el pago de tu referido se confirma.
            </p>
          </div>
        ) : (
          <form onSubmit={createLink} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="referral-phone">Tu WhatsApp</Label>
              <PhoneInput
                defaultCountry="do"
                value={phone}
                onChange={setPhone}
                inputProps={{ id: 'referral-phone' }}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Obtener enlace
            </Button>
          </form>
        )}
      </div>
    </Card>
  )
}
