'use client'

import { Lang, langNames } from '@/lib/i18n'

interface Props {
  lang: Lang
  onChange: (lang: Lang) => void
}

export default function LanguageSelector({ lang, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value as Lang)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
      >
        {(Object.keys(langNames) as Lang[]).map((l) => (
          <option key={l} value={l}>
            {langNames[l]}
          </option>
        ))}
      </select>
    </div>
  )
}
