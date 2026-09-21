'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EditRaffleRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/raffles')
  }, [router])
  return null
}
