import type { CatalogRaffle } from '@/lib/raffle-catalog'
import type { RaffleStatus } from '@/types/raffle'

const STATUS_LABEL: Record<RaffleStatus, string> = {
  draft: 'Borrador',
  active: 'En curso',
  ended: 'Finalizada',
  cancelled: 'Cancelada',
}

export function CatalogGrid({ raffles }: { raffles: CatalogRaffle[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {raffles.map((raffle) => {
        const sold =
          raffle.totalTickets > 0
            ? Math.min(100, Math.round((raffle.soldTickets / raffle.totalTickets) * 100))
            : 0
        return (
          <a
            key={raffle.id}
            href={raffle.href}
            className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative h-44 bg-neutral-200">
              <img
                src={raffle.image}
                alt={raffle.title}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 rounded-full bg-[#FFD000] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                {STATUS_LABEL[raffle.status]}
              </span>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-xs font-medium text-neutral-500">{raffle.orgName}</p>
              <h3 className="font-bold leading-tight text-[#111111] group-hover:underline">
                {raffle.title}
              </h3>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">RD${raffle.ticketPrice.toLocaleString()}</span>
                <span className="text-[10px] text-neutral-500">por boleto</span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full bg-[#FFD000]" style={{ width: `${sold}%` }} />
                </div>
                <p className="text-right text-[10px] text-neutral-500">{sold}% vendido</p>
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}
