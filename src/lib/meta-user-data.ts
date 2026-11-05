import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeMetaEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

/**
 * Digits only, with the Dominican Republic country prefix.
 * 809/829/849 (10 digits) become 1809/1829/1849.
 */
export function normalizeMetaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) {
    digits = `1${digits}`;
  }
  if (digits.length < 11 || digits.length > 15) return null;
  if (!/^1(809|829|849)\d{7}$/.test(digits) && digits.length < 11) return null;
  return digits;
}

export function normalizeMetaNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^\p{L}]/gu, "");
  return normalized || null;
}

export function splitMetaName(name: string | null | undefined): {
  fn: string | null;
  ln: string | null;
} {
  if (!name) return { fn: null, ln: null };
  const parts = name
    .trim()
    .split(/\s+/)
    .map((part) => normalizeMetaNamePart(part))
    .filter((part): part is string => Boolean(part));
  if (!parts.length) return { fn: null, ln: null };
  return {
    fn: parts[0],
    ln: parts.length > 1 ? parts.slice(1).join("") : null,
  };
}

export type MetaUserInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

/** Hashed buyer fields plus click/browser ids. Plaintext never leaves this function. */
export function buildMetaUserData(input: MetaUserInput): Record<string, string | string[]> {
  const userData: Record<string, string | string[]> = {};
  const email = normalizeMetaEmail(input.email);
  const phone = normalizeMetaPhone(input.phone);
  const name = splitMetaName(input.name);

  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (name.fn) userData.fn = [sha256(name.fn)];
  if (name.ln) userData.ln = [sha256(name.ln)];
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  return userData;
}
