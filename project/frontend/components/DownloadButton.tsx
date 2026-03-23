'use client'

interface DownloadButtonProps {
  resultUrl: string
  filename?: string
}

export default function DownloadButton({ resultUrl, filename = 'removed-bg.png' }: DownloadButtonProps) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = filename
    a.click()
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow transition-all active:scale-95"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      下载 PNG
    </button>
  )
}
