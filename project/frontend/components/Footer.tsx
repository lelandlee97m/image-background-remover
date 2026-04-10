'use client'

import Link from 'next/link'
import { Lang, translations } from '@/lib/i18n'

interface FooterProps {
  lang: Lang
}

export default function Footer({ lang }: FooterProps) {
  const t = translations[lang]

  return (
    <footer className="w-full border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold text-gray-900 mb-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M9 9h6v6H9z" fill="currentColor" opacity="0.3" />
              </svg>
              BG Remover
            </div>
            <p className="text-sm text-gray-500">{t.footerTagline}</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.footerProduct}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  {t.footerPricing}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.footerCompany}</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-gray-400">{t.footerTerms}</span>
              </li>
              <li>
                <span className="text-sm text-gray-400">{t.footerPrivacy}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">{t.poweredBy}</p>
        </div>
      </div>
    </footer>
  )
}
