import { z } from 'zod'
import pino from 'pino'
import { requestLocale } from '@/lib/locale'
import { translateText } from '@/lib/i18n-core'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const logger = pino({
  level: 'info',
  redact: [
    'password',
    'apiKey',
    'token',
    'encrypted_key',
    'authorization',
    'cookie',
    'headers',
  ],
})

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}

export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'JSON_REQUIRED', '请使用 JSON 提交数据')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'BODY_REQUIRED', '缺少请求内容')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 32_768) {
      await reader.cancel()
      throw new HttpError(413, 'BODY_TOO_LARGE', '提交内容过长，请缩短后重试')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new HttpError(400, 'INVALID_JSON', '提交的数据格式不正确')
  }
  return schema.parse(value)
}

export function assertOrigin(request: Request) {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    throw new HttpError(
      403,
      'ORIGIN_REJECTED',
      '请求来源验证失败，请从本站页面重试',
    )
}

export async function withErrors(
  request: Request,
  handler: () => Promise<Response>,
) {
  const requestId = crypto.randomUUID()
  const t = (message: string) => translateText(message, requestLocale(request))
  let response: Response
  try {
    response = await handler()
  } catch (error) {
    if (error instanceof z.ZodError)
      response = json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: t(error.issues[0]?.message ?? '请检查输入内容'),
            details: z.flattenError(error),
            requestId,
          },
        },
        400,
      )
    else if (error instanceof HttpError)
      response = json(
        { error: { code: error.code, message: t(error.message), requestId } },
        error.status,
      )
    else {
      logger.error(
        {
          requestId,
          path: new URL(request.url).pathname,
          errorType: error instanceof Error ? error.name : 'Unknown',
        },
        'Request failed',
      )
      response = json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: t('服务暂时不可用，请稍后重试'),
            requestId,
          },
        },
        500,
      )
    }
  }
  const headers = new Headers(response.headers)
  headers.set('X-Request-Id', requestId)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
