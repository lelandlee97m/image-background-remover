'use client'

import { useState, useEffect, useCallback } from 'react'
import UploadZone from '@/components/UploadZone'
import ImagePreview from '@/components/ImagePreview'
import DownloadButton from '@/components/DownloadButton'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CreditBalance from '@/components/CreditBalance'
import GuestQuota from '@/components/GuestQuota'
import UsageModal from '@/components/UsageModal'
import WatermarkOverlay from '@/components/WatermarkOverlay'
import { Lang, translations } from '@/lib/i18n'
import { getUser, deductCredit, trackGuestUsage, getDeviceFingerprint, claimSignupGift } from '@/lib/auth'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function Home() {
  const [status, setStatus] = useState<Status>('idle')
  const [lang, setLang] = useState<Lang>('en')
  const [originalUrl, setOriginalUrl] = useState<string>('')
  const [resultUrl, setResultUrl] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [guestRemaining, setGuestRemaining] = useState<number | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [needsWatermark, setNeedsWatermark] = useState(false)

  const t = translations[lang]

  // Check login status on mount
  useEffect(() => {
    getUser().then((u) => {
      setIsLoggedIn(!!u)
      if (u) {
        // Try to claim signup gift (idempotent)
        claimSignupGift().catch(() => {})
      }
    })
    if (!isLoggedIn) {
      const fp = getDeviceFingerprint()
      if (fp) {
        import('@/lib/auth').then(({ getGuestQuota }) => {
          getGuestQuota(fp).then((data) => setGuestRemaining(data.remaining))
        })
      }
    }
  }, [isLoggedIn])

  const handleFileSelect = async (file: File) => {
    // Check quota before processing
    if (isLoggedIn) {
      if (credits !== null && credits !== -1 && credits <= 0) {
        setShowModal(true)
        return
      }
    } else {
      if (guestRemaining !== null && guestRemaining <= 0) {
        setShowModal(true)
        return
      }
    }

    setStatus('loading')
    setErrorMsg('')
    setOriginalUrl(URL.createObjectURL(file))
    setResultUrl('')
    setNeedsWatermark(false)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || '/api'
      const res = await fetch(workerUrl, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errMsg = 'Processing failed'
        try {
          const data = await res.json()
          errMsg = data.error || errMsg
        } catch {
          errMsg = `Request failed (${res.status})`
        }
        throw new Error(errMsg)
      }

      // Check watermark header
      const watermark = res.headers.get('X-Watermark')
      setNeedsWatermark(watermark === 'true')

      const blob = await res.blob()
      setResultUrl(URL.createObjectURL(blob))

      // Deduct credit / track guest usage
      if (isLoggedIn) {
        const result = await deductCredit()
        if (result.success) setCredits(result.balance)
      } else {
        const fp = getDeviceFingerprint()
        if (fp) {
          const result = await trackGuestUsage(fp)
          if (result.success) setGuestRemaining(result.remaining)
        }
      }

      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setOriginalUrl('')
    setResultUrl('')
    setErrorMsg('')
    setNeedsWatermark(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar lang={lang} setLang={setLang} showDashboard={isLoggedIn} />

      <main className="flex-1 flex flex-col items-center py-12 px-4">
        {/* Header */}
        <div className="w-full max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="text-left">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">{t.title}</h1>
            <p className="text-gray-500 text-base sm:text-lg">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <CreditBalance
                  onChange={(b) => {
                    setCredits(b)
                    if (b !== -1 && b <= 0) setShowModal(true)
                  }}
                />
              </>
            ) : (
              <GuestQuota
                onChange={(r) => {
                  setGuestRemaining(r)
                  if (r <= 0) setShowModal(true)
                }}
              />
            )}
          </div>
        </div>

        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 sm:p-8 flex flex-col gap-8">
          {/* Upload */}
          <UploadZone onFileSelect={handleFileSelect} disabled={status === 'loading'} lang={lang} />

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">{t.loading}</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg || t.error}</span>
              <button onClick={handleReset} className="ml-auto text-sm underline">{t.retry}</button>
            </div>
          )}

          {/* Success Preview */}
          {status === 'success' && resultUrl && (
            <>
              <div className="relative">
                <ImagePreview original={originalUrl} result={resultUrl} />
                <WatermarkOverlay show={needsWatermark} />
              </div>
              <div className="flex justify-center gap-4">
                <DownloadButton resultUrl={resultUrl} />
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  {t.reupload}
                </button>
              </div>
              {needsWatermark && (
                <p className="text-center text-xs text-gray-400">
                  💧 {t.signupForMore}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <Footer lang={lang} />

      <UsageModal
        lang={lang}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isLoggedIn={isLoggedIn}
      />
    </div>
  )
}
