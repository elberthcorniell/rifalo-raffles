import posthog from "posthog-js";
import { captureClientEvent } from "@/lib/explore-analytics";
import { rememberLandingUtms, readSignupUtms } from "@/lib/landing-utm";
import { isMetaBrowserEnabled, readMetaBrowserIds, trackMetaCompleteRegistration } from "@/lib/meta-browser";
import { sanitizeEventSourceUrl, signupEventId } from "@/lib/meta-host";

const firedSignups = new Set<string>();

function markSignupOnce(eventId: string): boolean {
  if (firedSignups.has(eventId)) return false;
  if (typeof window !== "undefined") {
    try {
      const key = `rifalo_signup_${eventId}`;
      if (window.sessionStorage.getItem(key) === "1") {
        firedSignups.add(eventId);
        return false;
      }
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Private mode can block storage. The in-memory set still covers this page.
    }
  }
  firedSignups.add(eventId);
  return true;
}

function sendRegistrationCapi(eventId: string, email?: string | null, phone?: string | null) {
  if (typeof window === "undefined" || !isMetaBrowserEnabled()) return;
  const eventSourceUrl = sanitizeEventSourceUrl(window.location.href);
  if (!eventSourceUrl) return;
  const ids = readMetaBrowserIds();
  const body: Record<string, string> = {
    eventName: "CompleteRegistration",
    eventId,
    eventSourceUrl,
  };
  if (ids.fbp) body.fbp = ids.fbp;
  if (ids.fbc) body.fbc = ids.fbc;
  if (email) body.email = email;
  if (phone) body.phone = phone;

  void fetch("/api/meta/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {
    // A tracking failure must not affect signup.
  });
}

function captureSignup(userId: string, email?: string | null) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  const person: Record<string, string> = {};
  const normalized = email?.trim().toLowerCase();
  if (normalized && normalized.includes("@")) person.email = normalized;
  posthog.identify(userId, person);
  const utms = readSignupUtms();
  captureClientEvent("user_signed_up", Object.keys(utms).length ? utms : undefined, true);
}

/**
 * Pixel, CAPI, and PostHog for one new auth user. Never throws.
 * event id is signup_<user id> on both Meta channels. Login does not call this.
 */
export function reportSignupCompleted(input: {
  userId: string;
  email?: string | null;
  phone?: string | null;
}) {
  try {
    const eventId = signupEventId(input.userId);
    if (!eventId || !markSignupOnce(eventId)) return;
    if (typeof window !== "undefined") rememberLandingUtms(window.location.search);
    trackMetaCompleteRegistration(eventId);
    sendRegistrationCapi(eventId, input.email, input.phone);
    captureSignup(input.userId, input.email);
  } catch {
    // A tracking failure must not break signup.
  }
}
