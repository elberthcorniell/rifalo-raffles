'use client'

import { PlatformLogo } from '@/components/platform/PlatformLogo'
import { ONBOARDING_STEPS } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

export function OnboardingShell({
  currentStep,
  orgName,
  children,
}: {
  currentStep: number
  orgName?: string
  children: React.ReactNode
}) {
  const done = currentStep > ONBOARDING_STEPS.length

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-xl px-4 py-4 flex items-center justify-between gap-3">
          <PlatformLogo height={32} />
          <p className="text-xs text-muted-foreground truncate">
            {done ? 'Listo' : `Paso ${currentStep} de ${ONBOARDING_STEPS.length}`}
            {orgName ? ` · ${orgName}` : ''}
          </p>
        </div>
        <div className="mx-auto max-w-xl px-4 pb-4">
          <ol className="flex items-center gap-1">
            {ONBOARDING_STEPS.map((step) => {
              const reached = currentStep > step.id
              const active = currentStep === step.id
              return (
                <li key={step.id} className="flex-1 flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 w-full">
                    <div
                      className={cn(
                        'h-1.5 w-full rounded-full',
                        reached || active || done ? 'bg-[#FFD000]' : 'bg-slate-200'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] sm:text-xs truncate w-full text-center',
                        active
                          ? 'font-semibold text-[#111111]'
                          : reached || done
                            ? 'text-black'
                            : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 py-8">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  )
}
