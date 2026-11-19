/** Fire-and-forget. A mail failure must not affect signup. */
export function requestWelcomeEmail(): void {
  try {
    if (typeof window === 'undefined') return
    void fetch('/api/emails/welcome', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {
      // Signup already succeeded.
    })
  } catch {
    // Signup already succeeded.
  }
}
