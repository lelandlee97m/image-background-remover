'use client'

import Link from 'next/link'
import { useState } from 'react'
import GoogleAuth from './GoogleAuth'
import LanguageSelector from './LanguageSelector'
import { Lang } from '@/lib/i18n'

interface NavbarProps {
  lang: Lang
  setLang: (lang: Lang) => void
  showDashboard?: boolean
}

export default function Navbar({ lang, setLang, showDashboard }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 hover:text-blue-600 transition-colors">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 9h6v6H9z" fill="currentColor" opacity="0.3" />
          </svg>
          <span className="text-sm sm:text-base">BG Remover</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
          {showDashboard && (
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Dashboard</Link>
          )}
          <div className="flex items-center gap-2">
            <LanguageSelector lang={lang} onChange={setLang} />
            <GoogleAuth />
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-gray-900">Home</Link>
          <Link href="/pricing" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
          {showDashboard && (
            <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <LanguageSelector lang={lang} onChange={setLang} />
            <GoogleAuth />
          </div>
        </div>
      )}
    </nav>
  )
}
