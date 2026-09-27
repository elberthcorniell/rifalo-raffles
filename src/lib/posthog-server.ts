import { SeverityNumber } from '@opentelemetry/api-logs'
import { PostHog } from 'posthog-node'
import { emitPostHogLog, flushPostHogLogs } from '@/instrumentation'

let posthog: PostHog | null | undefined

function getPostHog() {
  if (posthog !== undefined) return posthog

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!projectToken || !host) {
    if (process.env.NODE_ENV === 'development') {
      const missingVariable = projectToken
        ? 'NEXT_PUBLIC_POSTHOG_HOST'
        : 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'

      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
      )
    }

    posthog = null
    return posthog
  }

  posthog = new PostHog(projectToken, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })

  return posthog
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean>
) {
  const client = getPostHog()
  if (!client) return

  try {
    client.capture({ distinctId, event, properties })
    await client.flush()

    emitPostHogLog('Product analytics event delivered', SeverityNumber.INFO, {
      analytics_event: event,
      delivery_channel: 'server',
    })
    await flushPostHogLogs()
  } catch (error) {
    emitPostHogLog('Product analytics event delivery failed', SeverityNumber.WARN, {
      analytics_event: event,
      delivery_channel: 'server',
    })
    await flushPostHogLogs()
    console.error('PostHog event capture failed:', error)
  }
}
