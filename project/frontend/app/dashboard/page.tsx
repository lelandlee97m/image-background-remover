'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CreditBalance from '@/components/CreditBalance'
import { Lang, translations } from '@/lib/i18n'
import { getUser, getUsageHistory, type User, type UsageRecord } from '@/lib/auth'

export default function DashboardPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [user, setUser] = useState<User | null>(null)
  const [history, setHistory] = useState<UsageRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const t = translations[lang]

  useEffect(() => {
    Promise.all([
      getUser(),
      getUsageHistory(1, 20),
    ]).then(([u, histData]) => {
      setUser(u)
      setHistory(histData.history)
      setTotal(histData.pagination.total)
      setLoading(false)
    })
  }, [])

  const loadMore = async () => {
    const nextPage = page + 1
    const data = await getUsageHistory(nextPage, 20)
    setHistory((prev) => [...prev, ...data.history])
    setPage(nextPage)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar lang={lang} setLang={setLang} showDashboard />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar lang={lang} setLang={setLang} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-gray-500">Please sign in to view your dashboard.</p>
            <Link href="/" className="text-blue-600 hover:underline">← Go Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar lang={lang} setLang={setLang} showDashboard />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.dashTitle}</h1>
            <p className="text-gray-500">{t.dashWelcome}, {user.name}</p>
          </div>
          <CreditBalance />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/pricing"
            className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M8 10l4-4 4 4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">{t.dashBuyCredits}</p>
              <p className="text-xs text-gray-500">Starting from $2.99</p>
            </div>
          </Link>

          <Link
            href="/pricing"
            className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">{t.dashUpgrade}</p>
              <p className="text-xs text-gray-500">$9.99/mo · 300 credits</p>
            </div>
          </Link>
        </div>

        {/* Usage History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t.dashHistory}</h2>
          </div>

          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm">{t.dashNoHistory}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3">{t.dashDate}</th>
                      <th className="px-5 py-3">{t.dashAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-gray-600">
                          {new Date(record.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Background Removal
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {history.length < total && (
                <div className="px-5 py-3 border-t border-gray-100 text-center">
                  <button
                    onClick={loadMore}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
