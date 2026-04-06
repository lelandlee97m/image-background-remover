'use client'

import { useState } from 'react'
import UploadZone from '@/components/UploadZone'
import ImagePreview from '@/components/ImagePreview'
import DownloadButton from '@/components/DownloadButton'
import LanguageSelector from '@/components/LanguageSelector'
import GoogleAuth from '@/components/GoogleAuth'
import { Lang, translations } from '@/lib/i18n'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function Home() {
  const [status, setStatus] = useState<Status>('idle')
  const [lang, setLang] = useState<Lang>('zh-CN')
  const [originalUrl, setOriginalUrl] = useState<string>('')
  const [resultUrl, setResultUrl] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const t = translations[lang]

  const handleFileSelect = async (file: File) => {
    setStatus('loading')
    setErrorMsg('')
    setOriginalUrl(URL.createObjectURL(file))
    setResultUrl('')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || '/api/remove-bg'
      const res = await fetch(workerUrl, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errMsg = '处理失败'
        try {
          const data = await res.json()
          errMsg = data.error || errMsg
        } catch {
          errMsg = `请求失败 (${res.status})`
        }
        throw new Error(errMsg)
      }

      const blob = await res.blob()
      setResultUrl(URL.createObjectURL(blob))
      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '未知错误')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setOriginalUrl('')
    setResultUrl('')
    setErrorMsg('')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center py-16 px-4">
      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8">
        <div className="text-left">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector lang={lang} onChange={setLang} />
          <GoogleAuth />
        </div>
      </div>

      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-8">
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
            <ImagePreview original={originalUrl} result={resultUrl} />
            <div className="flex justify-center gap-4">
              <DownloadButton resultUrl={resultUrl} />
              <button
                onClick={handleReset}
                className="px-6 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                {t.reupload}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-8">{t.poweredBy}</p>
    </main>
  )
}
