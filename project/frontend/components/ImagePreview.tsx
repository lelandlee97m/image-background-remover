'use client'

interface ImagePreviewProps {
  original: string
  result: string
}

export default function ImagePreview({ original, result }: ImagePreviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
      <div className="flex flex-col items-center">
        <p className="text-sm text-gray-500 mb-2 font-medium">Original</p>
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={original} alt="Original" className="w-full h-64 object-contain" />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-sm text-gray-500 mb-2 font-medium">Background Removed</p>
        <div
          className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23e5e7eb'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23e5e7eb'/%3E%3Crect x='8' width='8' height='8' fill='%23f9fafb'/%3E%3Crect y='8' width='8' height='8' fill='%23f9fafb'/%3E%3C/svg%3E")`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result} alt="Background Removed" className="w-full h-64 object-contain" />
        </div>
      </div>
    </div>
  )
}
