const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const FIRST_TOUCH_KEY = "rifalo_utm_first";
const SESSION_KEY = "rifalo_utm_session";

export type UtmStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type UtmStores = {
  local: UtmStorage | null;
  session: UtmStorage | null;
};

function sanitizeUtm(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 200);
  return cleaned || null;
}

export function utmsFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const found: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = sanitizeUtm(params.get(key));
    if (value) found[key] = value;
  }
  return found;
}

function browserStores(): UtmStores {
  if (typeof window === "undefined") return { local: null, session: null };
  return { local: window.localStorage, session: window.sessionStorage };
}

function readStored(storage: UtmStorage | null, key: string): Record<string, string> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const found: Record<string, string> = {};
    for (const utmKey of UTM_KEYS) {
      const value = sanitizeUtm(typeof parsed[utmKey] === "string" ? parsed[utmKey] : null);
      if (value) found[utmKey] = value;
    }
    return found;
  } catch {
    return {};
  }
}

function writeIfEmpty(storage: UtmStorage | null, key: string, value: string) {
  if (!storage) return;
  try {
    if (!storage.getItem(key)) storage.setItem(key, value);
  } catch {
    // Storage can be blocked. Signup still reads the current URL.
  }
}

/** Keep the first landing UTMs of this browser, and of this tab session. */
export function rememberLandingUtms(search: string, storage?: UtmStores) {
  const found = utmsFromSearch(search);
  if (Object.keys(found).length === 0) return;
  const stores = storage ?? browserStores();
  const serialized = JSON.stringify(found);
  writeIfEmpty(stores.local, FIRST_TOUCH_KEY, serialized);
  writeIfEmpty(stores.session, SESSION_KEY, serialized);
}

/**
 * UTMs for the signup event. The current session's landing wins.
 * A later visit with no campaign params falls back to the first touch.
 */
export function readSignupUtms(storage?: UtmStores): Record<string, string> {
  const stores = storage ?? browserStores();
  const sessionUtms = readStored(stores.session, SESSION_KEY);
  if (Object.keys(sessionUtms).length > 0) return sessionUtms;
  const firstTouch = readStored(stores.local, FIRST_TOUCH_KEY);
  if (Object.keys(firstTouch).length > 0) return firstTouch;
  if (!storage && typeof window !== "undefined") return utmsFromSearch(window.location.search);
  return {};
}
