import { SeverityNumber } from '@opentelemetry/api-logs'
import { PostHog } from 'posthog-node'
import { headers } from 'next/headers'
import { emitPostHogLog, flushPostHogLogs } from '@/instrumentation'
import {
  isLocalHostname,
  postHogDevCredentials,
  postHogProductionCredentials,
} from '@/lib/posthog-env'

let posthog: PostHog | null | undefined
let devPosthog: PostHog | null | undefined

function createClient(token: string, host: string) {
  return new PostHog(token, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })
}

function getPostHog() {
  if (posthog !== undefined) return posthog

  const credentials = postHogProductionCredentials()
  if (!credentials) {
    posthog = null
    return posthog
  }

  posthog = createClient(credentials.token, credentials.host)
  return posthog
}

function getDevPostHog() {
  if (devPosthog !== undefined) return devPosthog
  const credentials = postHogDevCredentials()
  devPosthog = credentials ? createClient(credentials.token, credentials.host) : null
  return devPosthog
}

async function isLocalRequest() {
  try {
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') || headerList.get('host') || ''
    return isLocalHostname(host.split(',')[0] || '')
  } catch {
    return process.env.NODE_ENV === 'development'
  }
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean>
) {
  const client = (await isLocalRequest()) ? getDevPostHog() : getPostHog()
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
