import posthog from "posthog-js";

type EventProperties = Record<string, string | number | boolean>;

/**
 * Campaign params from the landing URL are already part of every capture.
 * PostHog registers utm_* and fbclid as super properties, and copies the
 * session-entry values onto each event as $session_entry_utm_* and
 * $session_entry_fbclid. Do not add them again, and do not put names,
 * phones, emails, or cédulas in properties.
 */
export function captureClientEvent(
  event: string,
  properties?: EventProperties,
  sendInstantly = false,
) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(
    event,
    properties,
    sendInstantly ? { send_instantly: true } : undefined,
  );
}

export function safeErrorMessage(error: unknown) {
  const text =
    typeof error === "string" && error.trim()
      ? error.trim()
      : "Error inesperado";
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[redacted]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[redacted]")
    .slice(0, 200);
}
