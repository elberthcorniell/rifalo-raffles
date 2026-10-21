'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function RaffleReferralFields({
  enabled,
  rewardTickets,
  onEnabledChange,
  onRewardChange,
}: {
  enabled: boolean
  rewardTickets: string
  onEnabledChange: (enabled: boolean) => void
  onRewardChange: (rewardTickets: string) => void
}) {
  return (
    <div className="space-y-3 rounded-md border px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="referral-enabled">Referidos</Label>
          <p className="text-xs text-muted-foreground">
            Quien deje su teléfono recibe un enlace. Por cada compra confirmada con ese enlace, gana
            boletos.
          </p>
        </div>
        <Switch id="referral-enabled" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="space-y-2">
          <Label htmlFor="referral-reward">Boletos por compra referida</Label>
          <Input
            id="referral-reward"
            type="number"
            min="1"
            max="100"
            value={rewardTickets}
            onChange={(e) => onRewardChange(e.target.value)}
            required
          />
        </div>
      )}
    </div>
  )
}
