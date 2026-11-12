'use client'

import { useEffect } from 'react'
import { trackMetaPlanPurchase } from '@/lib/meta-browser'

const started = new Set<string>()
const SESSION_ID_RE = /^cs_[A-Za-z0-9_]{10,200}$/

/**
 * Fires the browser Purchase once, and only after the server confirms the
 * Stripe session is a paid Plus or Unlimited plan. The query string is not
 * trusted for the value, currency, or event id.
 */
export function PlanPurchasePixel() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return
    const sessionId = params.get('session_id') || ''
    if (!SESSION_ID_RE.test(sessionId) || started.has(sessionId)) return
    started.add(sessionId)

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/billing/purchase?session_id=${encodeURIComponent(sessionId)}`
        )
        const json = await res.json()
        const purchase = json?.data
        if (!json?.success || !purchase?.eventId || purchase.currency !== 'USD') return
        trackMetaPlanPurchase({
          eventId: String(purchase.eventId),
          value: Number(purchase.value),
          contentIds: Array.isArray(purchase.contentIds) ? purchase.contentIds.map(String) : [],
          contentName: String(purchase.contentName || ''),
          orderId: String(purchase.orderId || ''),
        })
      } catch {
        started.delete(sessionId)
      }
    })()
  }, [])

  return null
}
