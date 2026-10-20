export const locales = ['zh-CN', 'en'] as const
export type Locale = (typeof locales)[number]
export const LOCALE_COOKIE = 'xuejing.locale'

export function normalizeLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN'
}
export function cookieLocale(cookie: string): Locale | undefined {
  const value = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1]
  return value === 'en' || value === 'zh-CN' ? value : undefined
}
export function browserLocale(): Locale {
  return typeof document === 'undefined'
    ? 'zh-CN'
    : (cookieLocale(document.cookie) ?? 'zh-CN')
}
export function requestLocale(request: Request): Locale {
  return normalizeLocale(
    request.headers.get('x-app-locale') ??
      cookieLocale(request.headers.get('cookie') ?? '') ??
      'zh-CN',
  )
}
