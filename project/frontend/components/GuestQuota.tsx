'use client'

import { useEffect, useState } from 'react'
import { getGuestQuota, getDeviceFingerprint } from '@/lib/auth'

interface GuestQuotaProps {
  onChange?: (remaining: number) => void
}

export default function GuestQuota({ onChange }: GuestQuotaProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const fp = getDeviceFingerprint()
    if (!fp) return
    getGuestQuota(fp).then((data) => {
      setRemaining(data.remaining)
      onChange?.(data.remaining)
    })
  }, [onChange])

  if (remaining === null) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
        <div className="w-4 h-4 rounded bg-gray-200 animate-pulse" />
        <span className="text-sm text-gray-400">...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${remaining <= 1 ? 'bg-red-50' : 'bg-amber-50'}`}>
      <svg className={`w-4 h-4 ${remaining <= 1 ? 'text-red-500' : 'text-amber-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      <span className={`text-sm font-medium ${remaining <= 1 ? 'text-red-700' : 'text-amber-700'}`}>
        {remaining}/3
      </span>
    </div>
  )
}
