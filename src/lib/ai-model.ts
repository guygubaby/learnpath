import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'
import { validateProviderUrl } from './provider-security'

export const MAX_OUTPUT_TOKENS = 128 * 1024

export function configuredModel(
  settings: {
    protocol: 'openai' | 'anthropic'
    baseUrl: string
    model: string
    apiKey: string
    sessionId?: string
  },
  fetcher: typeof fetch = fetch,
) {
  const baseURL = validateProviderUrl(settings.baseUrl)
  const isOpenCode = new URL(baseURL).hostname === 'opencode.ai'
  const sessionId = settings.sessionId ?? crypto.randomUUID()
  const safeFetch: typeof fetch = (input, init) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    )
    if (isOpenCode) {
      // Apply after AI SDK merges its own User-Agent over provider headers.
      headers.set('user-agent', 'LearnPath/0.1.0')
      headers.set('x-opencode-session', sessionId)
    }
    return fetcher(input, { ...init, headers, redirect: 'manual' })
  }
  const options = {
    baseURL,
    apiKey: settings.apiKey,
    fetch: safeFetch,
  }
  return settings.protocol === 'anthropic'
    ? createAnthropic(options)(settings.model)
    : createOpenAICompatible({ ...options, name: 'learnpath-custom' })(
        settings.model,
      )
}
