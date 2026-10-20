import { createInstance } from 'i18next'
import english from '@/locales/en.json'
import { browserLocale, type Locale } from './locale'

export const translations: Record<string, string> = english
const chinese = Object.fromEntries(
  Object.keys(translations)
    .filter((key) => !/_(one|other)$/.test(key))
    .map((key) => [key, key]),
)
export const i18nResources = {
  'zh-CN': { translation: chinese },
  en: { translation: translations },
}
export const i18nOptions = {
  resources: i18nResources,
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en'],
  keySeparator: false as const,
  nsSeparator: false as const,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
}
const lookup = createInstance()
void lookup.init({ ...i18nOptions, lng: 'zh-CN' })
const originalByEnglish = new Map(
  Object.entries(translations).map(([source, value]) => [value, source]),
)
export function translateText(
  value: string,
  locale: Locale = browserLocale(),
  variables?: Record<string, unknown>,
) {
  const key = originalByEnglish.get(value) ?? value
  return String(lookup.t(key, { lng: locale, defaultValue: key, ...variables }))
}
