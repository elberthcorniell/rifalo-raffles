import type { OrgPlan } from '@/lib/constants'
import { PLAN_LIMITS } from '@/lib/constants'

export type { OrgPlan }

export interface TicketQuota {
  plan: OrgPlan
  used: number
  limit: number | null
  remaining: number | null
}

export function normalizeOrgPlan(value: unknown): OrgPlan {
  if (value === 'plus' || value === 'unlimited') return value
  return 'free'
}

export function parseOrgPlanOverride(value: unknown): OrgPlan | null {
  if (value === 'free' || value === 'plus' || value === 'unlimited') return value
  return null
}

export function purchasedOrgPlan(org: { plan?: unknown }): OrgPlan {
  return normalizeOrgPlan(org.plan)
}

export function effectiveOrgPlan(org: {
  plan?: unknown
  plan_override?: unknown
}): OrgPlan {
  return parseOrgPlanOverride(org.plan_override) ?? purchasedOrgPlan(org)
}

export function planTicketLimit(plan: OrgPlan): number | null {
  return PLAN_LIMITS[plan]
}

export function parseQuotaRow(raw: unknown): TicketQuota {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const plan = normalizeOrgPlan(row.plan)
  const used = Number(row.used) || 0
  const limit =
    row.limit === null || row.limit === undefined ? null : Number(row.limit)
  const remaining =
    row.remaining === null || row.remaining === undefined
      ? limit === null
        ? null
        : Math.max(limit - used, 0)
      : Number(row.remaining)
  return { plan, used, limit, remaining }
}

export function isQuotaExceededError(message: string | undefined | null): boolean {
  return !!message && message.includes('TICKET_QUOTA_EXCEEDED')
}
