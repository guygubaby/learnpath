import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { providerModelsInputSchema } from '../src/lib/contracts'
import { sealKey } from '../src/lib/provider-security'

const fixture = vi.hoisted(() => ({
  stored: undefined as { encrypted_key: string } | undefined,
  owners: [] as string[],
  writes: 0,
}))
const secret = btoa('x'.repeat(32))
vi.mock('cloudflare:workers', () => ({
  env: { APP_ENCRYPTION_KEY: btoa('x'.repeat(32)) },
}))
vi.mock('../src/server/repository', () => ({
  rows: async (_sql: string, owner: string) => {
    fixture.owners.push(owner)
    return fixture.stored ? [fixture.stored] : []
  },
  run: async () => {
    fixture.writes++
  },
}))
vi.mock('../src/server/taxonomy', () => ({
  getResearch: async () => null,
  getTaxonomy: async () => {
    throw new Error('Model discovery must not load taxonomy')
  },
}))
const { listProviderModels } = await import('../src/server/ai')
const input = {
  protocol: 'openai' as const,
  baseUrl: 'https://proxy.example.net/custom/v1/',
  apiKey: 'synthetic-new-key',
}
const request = () => new Request('https://app.test/api/settings/ai/models')
beforeEach(() => {
  fixture.stored = undefined
  fixture.owners = []
  fixture.writes = 0
})
afterEach(() => vi.unstubAllGlobals())

it('loads models before a model name is known, preserves custom base paths and returns only unique public model fields', async () => {
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    const upstream = new Request(url, init)
    calls.push(upstream)
    expect(upstream.url).toBe('https://proxy.example.net/custom/v1/models')
    expect(upstream.method).toBe('GET')
    expect(upstream.headers.get('authorization')).toBe(
      'Bearer synthetic-new-key',
    )
    expect(upstream.headers.get('x-api-key')).toBeNull()
    expect(upstream.headers.get('x-opencode-session')).toBeNull()
    expect(init?.redirect).toBe('manual')
    return Response.json({
      data: [
        { id: 'model-b', secret: 'must-not-be-returned' },
        { id: 'model-a', name: 'Model A' },
        { id: 'model-b' },
      ],
    })
  })
  const result = await listProviderModels(
    'owner-a',
    providerModelsInputSchema.parse(input),
    request(),
  )
  expect(result).toEqual({
    models: [
      { id: 'model-b', name: 'model-b' },
      { id: 'model-a', name: 'Model A' },
    ],
  })
  expect(calls).toHaveLength(1)
  expect(fixture.owners).toEqual([])
  expect(fixture.writes).toBe(0)
})

it('uses only the signed-in owner’s saved key, follows Anthropic cursors and strips provider metadata', async () => {
  fixture.stored = {
    encrypted_key: await sealKey('synthetic-saved-key', secret, 'owner-a'),
  }
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    const upstream = new Request(url, init)
    calls.push(upstream)
    expect(upstream.headers.get('x-api-key')).toBe('synthetic-saved-key')
    expect(upstream.headers.get('anthropic-version')).toBe('2023-06-01')
    expect(upstream.headers.get('authorization')).toBeNull()
    if (calls.length === 1) {
      expect(new URL(upstream.url).searchParams.get('limit')).toBe('100')
      return Response.json({
        data: [{ id: 'model-a', display_name: 'Model A', capabilities: {} }],
        has_more: true,
        last_id: 'model-a',
      })
    }
    expect(new URL(upstream.url).searchParams.get('after_id')).toBe('model-a')
    return Response.json({
      data: [{ id: 'model-b', display_name: 'Model B' }],
      has_more: false,
    })
  })
  expect(
    await listProviderModels(
      'owner-a',
      { protocol: 'anthropic', baseUrl: 'https://api.example.com/v1' },
      request(),
    ),
  ).toEqual({
    models: [
      { id: 'model-a', name: 'Model A' },
      { id: 'model-b', name: 'Model B' },
    ],
  })
  expect(calls).toHaveLength(2)
  expect(fixture.owners).toEqual(['owner-a'])
  expect(fixture.writes).toBe(0)
})

it('preserves OpenCode routing headers for discovery and accepts public HTTP endpoints', async () => {
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    const upstream = new Request(url, init)
    expect(upstream.url).toBe('http://opencode.ai/zen/go/v1/models')
    expect(upstream.headers.get('x-opencode-session')).toMatch(/^[a-f0-9]{64}$/)
    expect(upstream.headers.get('user-agent')).toBe('LearnPath/0.1.0')
    return Response.json({ data: [] })
  })
  expect(
    await listProviderModels(
      'owner-a',
      { ...input, baseUrl: 'http://opencode.ai/zen/go/v1' },
      request(),
    ),
  ).toEqual({ models: [] })
})

it.each([307, 401, 404, 503])(
  'reports HTTP %s without exposing the key or response body or following redirects',
  async (status) => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.redirect).toBe('manual')
        return new Response('synthetic-new-key upstream secret', {
          status,
          headers: { Location: 'https://other.example.com/v1/models' },
        })
      },
    )
    vi.stubGlobal('fetch', fetcher)
    const error = await listProviderModels('owner-a', input, request()).catch(
      (error: unknown) => error,
    )
    expect(error).toMatchObject({ status: 502, code: 'MODELS_UNAVAILABLE' })
    expect(String(error)).toContain(`HTTP ${status}`)
    expect(String(error)).not.toContain(input.apiKey)
    expect(String(error)).not.toContain('upstream secret')
    expect(fetcher).toHaveBeenCalledTimes(1)
  },
)

it.each([
  ['missing key', { ...input, apiKey: '' }, 'KEY_REQUIRED'],
  [
    'private address',
    { ...input, baseUrl: 'http://127.0.0.1/v1' },
    'INVALID_API_URL',
  ],
])(
  'rejects %s before making an upstream request',
  async (_label, value, code) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(
      listProviderModels('owner-a', value, request()),
    ).rejects.toMatchObject({
      status: 400,
      code,
    })
    expect(fetcher).not.toHaveBeenCalled()
  },
)

it('rejects malformed lists, excessive responses and stalled pagination', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ data: [{ name: 'No ID' }] }),
  )
  await expect(
    listProviderModels('owner-a', input, request()),
  ).rejects.toMatchObject({
    code: 'MODELS_UNAVAILABLE',
  })
  vi.stubGlobal(
    'fetch',
    async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)),
  )
  await expect(
    listProviderModels('owner-a', input, request()),
  ).rejects.toMatchObject({
    code: 'MODELS_TOO_LARGE',
  })
  const fetcher = vi.fn(async () =>
    Response.json({
      data: [{ id: 'model-a' }],
      has_more: true,
      last_id: 'model-a',
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  await expect(
    listProviderModels('owner-a', input, request()),
  ).rejects.toMatchObject({
    code: 'MODELS_UNAVAILABLE',
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('propagates request cancellation to the upstream model request', async () => {
  const controller = new AbortController()
  let signal: AbortSignal | undefined
  vi.stubGlobal(
    'fetch',
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise((_resolve, reject) => {
        signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    },
  )
  const pending = listProviderModels(
    'owner-a',
    input,
    new Request('https://app.test/api/settings/ai/models', {
      signal: controller.signal,
    }),
  )
  controller.abort()
  await expect(pending).rejects.toMatchObject({ code: 'MODELS_UNAVAILABLE' })
  expect(signal?.aborted).toBe(true)
})
