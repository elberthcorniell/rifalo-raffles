export function isLocalHostname(hostname: string) {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Dev project only. Never fall back to the production project token. */
export function postHogDevCredentials() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_DEV_PROJECT_TOKEN;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_DEV_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return null;
  return { token, host };
}

export function postHogProductionCredentials() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return null;
  return { token, host };
}
