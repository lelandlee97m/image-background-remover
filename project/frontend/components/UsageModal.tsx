'use client'

import Link from 'next/link'
import { Lang, translations } from '@/lib/i18n'
import { loginUrl } from '@/lib/auth'

interface UsageModalProps {
  lang: Lang
  isOpen: boolean
  onClose: () => void
  isLoggedIn: boolean
}

export default function UsageModal({ lang, isOpen, onClose, isLoggedIn }: UsageModalProps) {
  const t = translations[lang]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center">{t.quotaExhausted}</h3>
        <p className="text-sm text-gray-500 text-center">{t.quotaExhaustedDesc}</p>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Link
            href="/pricing"
            onClick={onClose}
            className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {t.viewPricing}
          </Link>

          {!isLoggedIn && (
            <a
              href={loginUrl()}
              className="block w-full text-center px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              {t.signIn}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
