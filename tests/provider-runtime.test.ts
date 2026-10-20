import { expect, it } from 'vitest'
import { generateText } from 'ai'
import { Miniflare } from 'miniflare'
import { configuredModel } from '../src/lib/ai-model'

it('calls models with a redirect mode accepted by the Workers runtime', async () => {
  const runtime = new Miniflare({
    cf: false,
    telemetry: { enabled: false },
    workers: [
      {
        config: {
          name: 'provider-runtime-test',
          // Match the latest date supported by the bundled workerd binary.
          compatibilityDate: '2026-10-19',
          manifest: {
            mainModule: 'index.js',
            modules: {
              'index.js': {
                type: 'esm',
                contents: `export default {
      async fetch(request) {
        const { redirect } = await request.json()
        try {
          new Request('https://api.example.com/v1/chat/completions', { redirect })
        } catch (error) {
          return Response.json({ error: { message: error.message } }, { status: 500 })
        }
        return Response.json({
          id: 'runtime-test', object: 'chat.completion', created: 1, model: 'custom-model',
          choices: [{ index: 0, message: { role: 'assistant', content: '连接成功' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }
        })
      }
    }`,
              },
            },
          },
        },
      },
    ],
  })
  try {
    const result = await generateText({
      model: configuredModel(
        {
          protocol: 'openai',
          baseUrl: 'https://api.example.com/v1',
          model: 'custom-model',
          apiKey: 'synthetic-test-key',
        },
        async (_input, init) => {
          const response = await runtime.dispatchFetch('http://runtime.test', {
            method: 'POST',
            body: JSON.stringify({ redirect: init?.redirect }),
          })
          return new Response(await response.text(), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      ),
      prompt: 'test',
      maxRetries: 0,
    })
    expect(result.text).toBe('连接成功')
  } finally {
    await runtime.dispose()
  }
})
