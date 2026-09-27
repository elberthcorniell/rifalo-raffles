import { SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'

let loggerProvider: LoggerProvider | null | undefined

function getLoggerProvider() {
  if (loggerProvider !== undefined) return loggerProvider

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

    loggerProvider = null
    return loggerProvider
  }

  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({ 'service.name': 'rifalo-raffles' }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, '')}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${projectToken}`,
            'Content-Type': 'application/json',
          },
        }),
      }),
    ],
  })

  return loggerProvider
}

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    getLoggerProvider()
  }
}

export function emitPostHogLog(
  body: string,
  severityNumber: SeverityNumber,
  attributes: Record<string, string | number | boolean>
) {
  try {
    getLoggerProvider()?.getLogger('posthog-integration').emit({
      body,
      severityNumber,
      attributes,
    })
  } catch (error) {
    console.error('PostHog log capture failed:', error)
  }
}

export async function flushPostHogLogs() {
  try {
    await getLoggerProvider()?.forceFlush()
  } catch (error) {
    console.error('PostHog log flush failed:', error)
  }
}
