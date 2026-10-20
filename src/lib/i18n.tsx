import { createInstance } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { i18nOptions, translateText } from './i18n-core'
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './locale'

export function createAppI18n(locale: Locale) {
  const instance = createInstance()
  void instance
    .use(initReactI18next)
    .init({ ...i18nOptions, lng: locale, react: { useSuspense: false } })
  return instance
}
export function useI18n() {
  const { i18n } = useTranslation()
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
  const t = (key: string, variables?: Record<string, unknown>) =>
    translateText(key, locale, variables)
  const setLocale = async (value: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    await i18n.changeLanguage(value)
  }
  return { t, locale, setLocale }
}
export function LocaleDocument() {
  const { locale, t } = useI18n()
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('学径 · 让每一步学习都有方向')
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        t('从知识之间的连接出发，探索、理解、练习，让每一步学习都有方向。'),
      )
  }, [locale])
  return null
}
