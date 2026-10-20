'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BundleBadge, BundleDraft } from '@/lib/ticket-bundles'
import { Plus, Trash2 } from 'lucide-react'

function badgeValue(badge: BundleBadge | undefined): 'none' | BundleBadge {
  return badge === 'best' || badge === 'vip' ? badge : 'none'
}

export default function RaffleBundleFields({
  bundles,
  onChange,
}: {
  bundles: BundleDraft[]
  onChange: (bundles: BundleDraft[]) => void
}) {
  const update = (index: number, patch: Partial<BundleDraft>) => {
    onChange(bundles.map((bundle, i) => (i === index ? { ...bundle, ...patch } : bundle)))
  }

  return (
    <div className="space-y-3 rounded-md border bg-slate-50 px-3 py-3">
      <div>
        <h3 className="font-semibold text-sm">Paquetes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Si la cantidad no tiene paquete, se cobra el precio por boleto. Cada paquete tiene un
          precio especial.
        </p>
      </div>

      {bundles.map((bundle, index) => (
        <div key={index} className="space-y-2 rounded-md border bg-white p-3">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={bundle.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="Elite"
                maxLength={40}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar paquete"
              onClick={() => onChange(bundles.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Boletos</Label>
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                value={bundle.quantity}
                onChange={(e) => update(index, { quantity: e.target.value })}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio (RD$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={bundle.price}
                onChange={(e) => update(index, { price: e.target.value })}
                placeholder="800"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destacado</Label>
              <Select
                value={badgeValue(bundle.badge)}
                onValueChange={(value) =>
                  update(index, {
                    badge: value === 'best' || value === 'vip' ? value : '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  <SelectItem value="best">Mejor opción</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...bundles, { quantity: '', price: '', label: '', badge: '' }])
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar paquete
      </Button>
    </div>
  )
}
