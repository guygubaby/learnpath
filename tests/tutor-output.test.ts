import { expect, it, vi } from 'vitest'
import { MAX_OUTPUT_TOKENS } from '../src/lib/ai-model'
import { catalogSchema } from '../src/lib/contracts'
import { createGraph } from '../src/lib/graph'
import data from '../public/data/catalog.json'
const fixture = vi.hoisted(() => ({
  text: '完整的中文回答。'.repeat(4000),
  reason: 'stop',
  writes: [] as unknown[][],
  limit: 0,
  signal: undefined as AbortSignal | undefined,
}))
vi.mock('cloudflare:workers', () => ({
  env: {
    APP_ENCRYPTION_KEY: 'synthetic-test-secret',
    AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
  },
}))
vi.mock('../src/server/repository', () => ({
  rows: async (sql: string) =>
    sql.includes('ai_settings')
      ? [
          {
            protocol: 'openai',
            base_url: 'https://api.example.com/v1',
            model: 'synthetic-model',
            encrypted_key: 'synthetic-key',
            updated_at: '2026-10-20',
          },
        ]
      : [],
  run: async (_sql: string, ...params: unknown[]) => {
    fixture.writes.push(params)
  },
}))
vi.mock('../src/lib/provider-security', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/provider-security')>()),
  openKey: async () => 'synthetic-api-key',
}))
vi.mock('../src/server/taxonomy', () => ({
  getTaxonomy: async () => {
    const catalog = catalogSchema.parse(data)
    return { catalog, graph: createGraph(catalog) }
  },
  getResearch: async () => null,
}))
vi.mock('ai', () => ({
  APICallError: { isInstance: () => false },
  generateText: async () => ({ text: '' }),
  streamText: (options: {
    maxOutputTokens: number
    abortSignal: AbortSignal
    onFinish: (value: { text: string; finishReason: string }) => Promise<void>
  }) => {
    fixture.limit = options.maxOutputTokens
    fixture.signal = options.abortSignal
    return {
      textStream: (async function* () {
        yield fixture.text
        await options.onFinish({
          text: fixture.text,
          finishReason: fixture.reason,
        })
      })(),
      finishReason: Promise.resolve(fixture.reason),
    }
  },
}))
const { tutorResponse } = await import('../src/server/ai')
it('streams and saves a reply longer than 16,000 characters with the 128K budget and no fixed duration cap', async () => {
  fixture.writes = []
  fixture.reason = 'stop'
  const request = new Request('https://app.test/api/ai/chat', {
    headers: { 'X-App-Locale': 'zh-CN' },
  })
  const response = await tutorResponse(
    'synthetic-user',
    'synthetic-child',
    data.topics[0].id,
    '请讲完整',
    8,
    request,
  )
  expect(await response.text()).toBe(fixture.text)
  const stored = fixture.writes.find((params) => params[3] === 'assistant')
  expect(stored?.[4]).toBe(fixture.text)
  expect(fixture.limit).toBe(131072)
  expect(fixture.limit).toBe(MAX_OUTPUT_TOKENS)
  expect(fixture.signal).toBe(request.signal)
})
it('makes an upstream output limit visible and saves the same completion notice as the streamed answer', async () => {
  fixture.writes = []
  fixture.reason = 'length'
  const response = await tutorResponse(
    'synthetic-user',
    'synthetic-child',
    data.topics[0].id,
    'Continue',
    8,
    new Request('https://app.test', { headers: { 'X-App-Locale': 'en' } }),
  )
  const text = await response.text()
  expect(text.startsWith(fixture.text)).toBe(true)
  expect(text).toContain('reached its output limit')
  expect(fixture.writes.find((params) => params[3] === 'assistant')?.[4]).toBe(
    text,
  )
})
