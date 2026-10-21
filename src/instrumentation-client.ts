import posthog from "posthog-js";
import {
  isLocalHostname,
  postHogDevCredentials,
  postHogProductionCredentials,
} from "@/lib/posthog-env";

function isMetaInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua);
}

/**
 * PostHog waits to send $pageview until document.visibilityState is "visible",
 * but it still sends $pageleave on pagehide. Facebook and Instagram in-app
 * browsers often prefetch or open the ad landing hidden, then discard it.
 * That shows up as $pageleave with no $pageview. Capture the pageview
 * immediately for those browsers, and mark it captured so the SDK does not
 * send a second one when the webview becomes visible.
 */
function capturePageviewIfHiddenInMetaBrowser() {
  if (typeof document === "undefined" || document.visibilityState === "visible") {
    return;
  }
  if (!isMetaInAppBrowser()) return;

  const captured = posthog.capture(
    "$pageview",
    { title: document.title },
    { send_instantly: true },
  );
  if (!captured) return;
  (posthog as typeof posthog & { _initialPageviewCaptured?: boolean })._initialPageviewCaptured =
    true;
}

const local = isLocalHostname(window.location.hostname);
const credentials = local
  ? postHogDevCredentials()
  : postHogProductionCredentials();

if (!credentials) {
  if (local && process.env.NODE_ENV === "development") {
    console.info(
      "PostHog is off on localhost. Set NEXT_PUBLIC_POSTHOG_DEV_PROJECT_TOKEN to send events to a dev project.",
    );
  } else if (process.env.NODE_ENV === "development") {
    throw new Error(
      "PostHog project token or host is missing. Set NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NEXT_PUBLIC_POSTHOG_HOST.",
    );
  }
} else if (!posthog.__loaded) {
  posthog.init(credentials.token, {
    api_host: credentials.host,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    tracing_headers: [window.location.hostname],
    loaded() {
      capturePageviewIfHiddenInMetaBrowser();
    },
  });
}
