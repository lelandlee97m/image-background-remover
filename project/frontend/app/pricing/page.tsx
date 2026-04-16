'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Lang, translations } from '@/lib/i18n'
import { getUser, getDeviceFingerprint, getGuestQuota } from '@/lib/auth'
import {
  loadPayPalSDK,
  getPayPalConfig,
  createOrder,
  captureOrder,
  createSubscription,
} from '@/lib/paypal'

const creditPacks = [
  { name: 'starter', credits: 50, price: 2.99, perCredit: 0.06 },
  { name: 'popular', credits: 200, price: 9.99, perCredit: 0.05, badge: true },
  { name: 'value', credits: 500, price: 19.99, perCredit: 0.04 },
  { name: 'bulk', credits: 2000, price: 59.99, perCredit: 0.03 },
]

const subscriptions = [
  { name: 'proLite', credits: 100, price: 4.99, period: 'month' as const },
  { name: 'pro', credits: 300, price: 9.99, period: 'month' as const, popular: true },
  { name: 'proAnnual', credits: 300, price: 79, period: 'year' as const, save: true },
]

const comparisonRows = [
  { feature: 'compStartingCredits', guest: '3', free: '3 + 3 signup', paid: '100–300/mo' },
  { feature: 'compMaxFileSize', guest: '2 MB', free: '5 MB', paid: '25 MB' },
  { feature: 'compOutput', guest: 'Preview + watermark', free: 'Original + watermark', paid: 'Original, no watermark' },
  { feature: 'compFormat', guest: 'PNG', free: 'PNG', paid: 'PNG / PSD' },
  { feature: 'compBatch', guest: false, free: false, paid: true },
  { feature: 'compHistory', guest: false, free: '7 days', paid: 'Permanent' },
  { feature: 'compApi', guest: false, free: false, paid: true },
]

function PricingContent() {
  const [lang, setLang] = useState<Lang>('en')
  const t = translations[lang]
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  const [processingPack, setProcessingPack] = useState<string | null>(null)
  const [processingSub, setProcessingSub] = useState<string | null>(null)
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'cancelled'; message: string } | null>(null)

  // Check login status and payment result on mount
  useEffect(() => {
    getUser().then(u => setIsLoggedIn(!!u))

    const status = searchParams.get('payment')
    if (status === 'success') {
      setPaymentMessage({ type: 'success', message: t.paymentSuccess })
      // Clean URL
      router.replace('/pricing', { scroll: false })
    } else if (status === 'cancelled') {
      setPaymentMessage({ type: 'cancelled', message: t.paymentCancelled })
      router.replace('/pricing', { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load PayPal SDK
  useEffect(() => {
    if (!isLoggedIn) return
    getPayPalConfig().then(async (config) => {
      if (!config.clientId) {
        setSdkError(true)
        return
      }
      try {
        await loadPayPalSDK(config.clientId, config.currency)
        setSdkLoaded(true)
      } catch {
        setSdkError(true)
      }
    })
  }, [isLoggedIn])

  const handleBuyCredits = useCallback(async (packType: string) => {
    if (!isLoggedIn) {
      router.push(`/api/auth/login?redirect=${encodeURIComponent(window.location.origin + '/pricing')}`)
      return
    }
    if (!sdkLoaded) return

    setProcessingPack(packType)
    try {
      const { orderId } = await createOrder(packType)
      // Get PayPal mode from config for checkout redirect
      const config = await getPayPalConfig()
      const checkoutHost = config.mode === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com'
      window.location.href = `https://${checkoutHost}/checkoutnow?token=${orderId}`
    } catch (err: any) {
      setPaymentMessage({ type: 'cancelled', message: err.message || t.paymentFailed })
      setProcessingPack(null)
    }
  }, [isLoggedIn, sdkLoaded, t, router])

  const handleSubscribe = useCallback(async (plan: string) => {
    if (!isLoggedIn) {
      router.push(`/api/auth/login?redirect=${encodeURIComponent(window.location.origin + '/pricing')}`)
      return
    }

    setProcessingSub(plan)
    try {
      const { approveLink } = await createSubscription(plan)
      // Redirect to PayPal subscription approval
      window.location.href = approveLink
    } catch (err: any) {
      setPaymentMessage({ type: 'cancelled', message: err.message || t.paymentFailed })
      setProcessingSub(null)
    }
  }, [isLoggedIn, t, router])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar lang={lang} setLang={setLang} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-12 space-y-16">
        {/* Payment Status Banner */}
        {paymentMessage && (
          <div className={`max-w-md mx-auto px-4 py-3 rounded-xl text-center text-sm font-medium ${
            paymentMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {paymentMessage.message}
            <button
              onClick={() => setPaymentMessage(null)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{t.priceTitle}</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">{t.priceSubtitle}</p>
        </div>

        {/* Credit Packs */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">{t.creditPacks}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.creditPacksDesc}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPacks.map((pack) => (
              <div
                key={pack.name}
                className={`relative bg-white rounded-2xl shadow-sm border p-6 flex flex-col ${
                  pack.badge ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' : 'border-gray-100'
                }`}
              >
                {pack.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    {t.popular}
                  </span>
                )}

                <div className="text-center space-y-2 mb-4">
                  <h3 className="font-semibold text-gray-900">{t[pack.name as keyof typeof t] as string}</h3>
                  <div>
                    <span className="text-3xl font-bold text-gray-900">${pack.price}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {pack.credits} {t.credits}
                  </p>
                  <p className="text-xs text-gray-400">
                    ${pack.perCredit.toFixed(2)} {t.perCredit}
                  </p>
                </div>

                <div className="mt-auto">
                  {processingPack === pack.name ? (
                    <div className="w-full py-3 rounded-xl font-medium text-sm bg-blue-50 text-blue-600 text-center animate-pulse">
                      {t.processing}
                    </div>
                  ) : sdkError ? (
                    <div className="w-full py-3 rounded-xl font-medium text-sm bg-red-50 text-red-400 text-center">
                      {t.sdkLoadError}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyCredits(pack.name)}
                      disabled={!sdkLoaded}
                      className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                        sdkLoaded
                          ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm hover:shadow'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoggedIn ? (sdkLoaded ? t.buyNow : 'Loading...') : t.signInToBuy}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Subscriptions */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">{t.subscriptions}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.subscriptionsDesc}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {subscriptions.map((sub) => (
              <div
                key={sub.name}
                className={`relative bg-white rounded-2xl shadow-sm border p-6 flex flex-col ${
                  sub.popular ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-md' : 'border-gray-100'
                }`}
              >
                {sub.save && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                    {t.saveBadge}
                  </span>
                )}

                <div className="text-center space-y-2 mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {t[sub.name as keyof typeof t] as string}
                  </h3>
                  <div>
                    <span className="text-3xl font-bold text-gray-900">${sub.price}</span>
                    <span className="text-sm text-gray-500 ml-1">
                      /{sub.period === 'month' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {sub.credits} {t.credits}/{sub.period === 'month' ? t.perMonth : t.perYear}
                  </p>
                </div>

                <div className="mt-auto">
                  {processingSub === sub.name ? (
                    <div className="w-full py-3 rounded-xl font-medium text-sm bg-purple-50 text-purple-600 text-center animate-pulse">
                      {t.processing}
                    </div>
                  ) : sdkError ? (
                    <div className="w-full py-3 rounded-xl font-medium text-sm bg-red-50 text-red-400 text-center">
                      {t.sdkLoadError}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(sub.name)}
                      disabled={!isLoggedIn}
                      className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                        isLoggedIn
                          ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-sm hover:shadow'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoggedIn ? t.subscribeNow : t.signInToBuy}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 text-center">{t.comparison}</h2>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-5 py-3 text-left font-semibold text-gray-900">{t.feature}</th>
                    <th className="px-5 py-3 text-center font-semibold text-gray-900">{t.guest}</th>
                    <th className="px-5 py-3 text-center font-semibold text-gray-900">{t.free}</th>
                    <th className="px-5 py-3 text-center font-semibold text-blue-600">{t.paid}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-700 font-medium">
                        {t[row.feature as keyof typeof t] as string}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">
                        {typeof row.guest === 'boolean' ? (
                          row.guest ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-300">✗</span>
                          )
                        ) : (
                          row.guest
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">
                        {typeof row.free === 'boolean' ? (
                          row.free ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-300">✗</span>
                          )
                        ) : (
                          row.free
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-700 font-medium">
                        {typeof row.paid === 'boolean' ? (
                          row.paid ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-300">✗</span>
                          )
                        ) : (
                          row.paid
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PayPal hint */}
        <div className="text-center space-y-2 pb-8">
          <p className="text-gray-500 text-sm">
            🔒 {t.paypalSecure}
          </p>
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline">
            ← {t.backToHome}
          </Link>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}
