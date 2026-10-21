import { SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { postHogDevCredentials, postHogProductionCredentials } from '@/lib/posthog-env'

let loggerProvider: LoggerProvider | null | undefined

function getLoggerProvider() {
  if (loggerProvider !== undefined) return loggerProvider

  const credentials =
    process.env.NODE_ENV === 'development'
      ? postHogDevCredentials()
      : postHogProductionCredentials()

  if (!credentials) {
    loggerProvider = null
    return loggerProvider
  }

  const { token: projectToken, host } = credentials

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
