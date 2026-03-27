'use client'

import { useCallback, useState } from 'react'
import { Lang, translations } from '@/lib/i18n'

interface UploadZoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  lang: Lang
}

export default function UploadZone({ onFileSelect, disabled, lang }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const t = translations[lang]

  const handleFile = useCallback(
    (file: File) => {
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        alert('仅支持 PNG / JPEG 格式')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过 5MB')
        return
      }
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <label
      className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p className="text-gray-600 font-medium">{t.dragDrop}</p>
      <p className="text-sm text-gray-400 mt-1">{t.supported}</p>
      <input
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
    </label>
  )
}
