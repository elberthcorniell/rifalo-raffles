'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth-errors'
import { Loader2 } from 'lucide-react'

export default function AuthHandoffPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      const next = new URLSearchParams(window.location.search).get('next') || '/admin'

      if (!access_token || !refresh_token) {
        window.location.replace('/admin/login')
        return
      }

      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (sessionError) {
        setError(authErrorMessage(sessionError, 'No se pudo completar el inicio de sesión'))
        return
      }

      window.location.replace(next.startsWith('/') ? next : '/admin')
    }

    void run()
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-[#1976D2]" />
      )}
    </div>
  )
}
