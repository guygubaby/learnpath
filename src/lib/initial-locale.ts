import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { browserLocale, LOCALE_COOKIE, normalizeLocale } from './locale'

export const initialLocale = createIsomorphicFn()
  .server(() => normalizeLocale(getCookie(LOCALE_COOKIE)))
  .client(() => browserLocale())
