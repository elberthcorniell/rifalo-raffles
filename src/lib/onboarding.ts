export const ONBOARDING_STEPS = [
  { id: 1, label: 'Organización' },
  { id: 2, label: 'Marca' },
  { id: 3, label: 'Cuenta' },
  { id: 4, label: 'Rifa' },
] as const

export const ONBOARDING_PATH = '/admin/onboarding'

export function orgNeedsOnboarding(org: {
  onboarding_completed_at?: string | null
}): boolean {
  return !org.onboarding_completed_at
}

export function orgAdminPath(org: { onboarding_completed_at?: string | null }): string {
  return orgNeedsOnboarding(org) ? ONBOARDING_PATH : '/admin'
}
