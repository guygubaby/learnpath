import ky, { HTTPError } from 'ky'
import { withQuery } from 'ufo'
import { browserLocale } from './locale'
import { translateText } from './i18n-core'

export const http = ky.create({
  credentials: 'same-origin',
  retry: 0,
  timeout: 95_000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set('X-App-Locale', browserLocale())
      },
    ],
  },
})

export async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  try {
    return await http(path, {
      method,
      ...(body === undefined ? {} : { json: body }),
    }).json<T>()
  } catch (error) {
    throw new Error(await errorMessage(error))
  }
}
export async function errorMessage(error: unknown) {
  if (error instanceof HTTPError) {
    const value: unknown = error.data
    if (typeof value === 'object' && value && 'error' in value) {
      const detail = value.error
      if (
        typeof detail === 'object' &&
        detail &&
        'message' in detail &&
        typeof detail.message === 'string'
      )
        return translateText(detail.message)
    }
  }
  if (error instanceof Error && error.name === 'TimeoutError')
    return translateText('请求超时，请检查网络或模型服务后重试')
  return translateText(
    error instanceof Error ? error.message : '操作失败，请重试',
  )
}
export { withQuery }
