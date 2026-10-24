'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import i18n, {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getStoredLanguage,
  type LanguageCode,
} from '@/i18n'

type LanguageContextValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
})

export function useLanguage() {
  return useContext(LanguageContext)
}

export function I18nProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [language, setLanguageState] =
    useState<LanguageCode>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const initial = getStoredLanguage()

    if (i18n.language !== initial) {
      i18n.changeLanguage(initial)
    }

    setLanguageState(initial)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = useCallback((next: LanguageCode) => {
    i18n.changeLanguage(next)
    setLanguageState(next)

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // Ignore storage failures (e.g. private browsing).
    }
  }, [])

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
