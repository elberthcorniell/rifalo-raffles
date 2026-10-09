'use client'

import { useEffect } from 'react'

/** Password-reset and invite emails land on the site root with the session in the hash. */
export function AuthRecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || window.location.pathname.startsWith('/auth/reset-password')) return

    const type = new URLSearchParams(hash.replace(/^#/, '')).get('type')
    if (type !== 'recovery' && type !== 'invite') return

    window.location.replace(`/auth/reset-password${hash}`)
  }, [])

  return null
}
