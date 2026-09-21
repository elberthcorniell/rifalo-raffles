'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchaseDetailRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/purchases')
  }, [router])
  return null
}
