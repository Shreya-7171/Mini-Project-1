'use client'

import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LANGUAGES, type LanguageCode } from '@/i18n'
import { useLanguage } from '@/components/i18n-provider'

export function LanguageSwitcher({
  className = '',
}: {
  className?: string
}) {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()

  const label = t('common.selectLanguage')

  return (
    <label className={`lang-switcher ${className}`.trim()}>
      <Globe
        className="lang-switcher-icon"
        size={16}
        aria-hidden="true"
      />

      <select
        className="lang-switcher-select"
        aria-label={label}
        title={label}
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value as LanguageCode)
        }
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
