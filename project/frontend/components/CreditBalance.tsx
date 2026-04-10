'use client'

import { useEffect, useState } from 'react'
import { getCreditBalance } from '@/lib/auth'

interface CreditBalanceProps {
  onChange?: (balance: number) => void
}

export default function CreditBalance({ onChange }: CreditBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    getCreditBalance().then((b) => {
      setBalance(b)
      onChange?.(b)
    })
  }, [onChange])

  if (balance === null) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
        <div className="w-4 h-4 rounded bg-gray-200 animate-pulse" />
        <span className="text-sm text-gray-400">...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
      <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M8 10l4-4 4 4" />
      </svg>
      <span className="text-sm font-medium text-blue-700">
        {balance === -1 ? '∞' : balance}
      </span>
    </div>
  )
}
