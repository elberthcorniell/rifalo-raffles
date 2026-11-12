const AUTH_PARAM =
  /^(access_token|refresh_token|provider_token|id_token|token|code)$/i;

const URL_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_referrer",
];

/** Drop auth credentials from a page URL. Other query params stay. */
export function stripAuthFromUrl(value: string): string {
  try {
    const absolute = value.startsWith("http://") || value.startsWith("https://");
    const url = new URL(value, "https://rifalo.local");
    for (const key of [...url.searchParams.keys()]) {
      if (AUTH_PARAM.test(key)) url.searchParams.delete(key);
    }
    if (url.hash.length > 1) {
      const hash = new URLSearchParams(url.hash.slice(1));
      let changed = false;
      for (const key of [...hash.keys()]) {
        if (AUTH_PARAM.test(key)) {
          hash.delete(key);
          changed = true;
        }
      }
      if (changed) {
        const next = hash.toString();
        url.hash = next ? `#${next}` : "";
      }
    }
    if (absolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

export function stripAuthFromAnalyticsProperties(
  properties: { [key: string]: unknown } | null | undefined,
): void {
  if (!properties) return;
  for (const key of URL_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "string") properties[key] = stripAuthFromUrl(value);
  }
}
