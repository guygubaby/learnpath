import { describe, expect, it } from 'vitest'
import { generateText, streamText } from 'ai'
import { configuredModel, MAX_OUTPUT_TOKENS } from '../src/lib/ai-model'
import {
  openKey,
  sealKey,
  validateProviderUrl,
} from '../src/lib/provider-security'

describe('provider safety', () => {
  it.each([
    'ftp://api.example.com/v1',
    'http://127.0.0.1/v1',
    'http://user:pass@api.example.com/v1',
    'http://api.example.com/v1?key=secret',
    'http://api.example.com/v1#fragment',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://2130706433/v1',
    'https://10.0.0.1/v1',
    'https://172.16.1.1/v1',
    'https://169.254.169.254/v1',
    'https://user:pass@api.example.com/v1',
    'https://api.example.com/v1?key=secret',
  ])('rejects unsafe endpoint %s', (value) =>
    expect(() => validateProviderUrl(value)).toThrow(),
  )
  it.each(['http', 'https'])(
    'accepts public %s endpoints with a custom port and base path',
    (scheme) => {
      expect(
        validateProviderUrl(`${scheme}://proxy.example.net:8080/custom/v1/`),
      ).toBe(`${scheme}://proxy.example.net:8080/custom/v1`)
    },
  )
  it('binds encrypted keys to their owner', async () => {
    const secret = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    )
    const encrypted = await sealKey('synthetic-test-key', secret, 'parent-a')
    expect(encrypted).not.toContain('synthetic-test-key')
    expect(await openKey(encrypted, secret, 'parent-a')).toBe(
      'synthetic-test-key',
    )
    await expect(openKey(encrypted, secret, 'parent-b')).rejects.toThrow()
  })
})

describe('AI SDK wire compatibility', () => {
  it('rejects redirected endpoints without forwarding the API key to another address', async () => {
    const requests: string[] = []
    const fetcher: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init).url)
      expect(init?.redirect).toBe('manual')
      return new Response(null, {
        status: 307,
        headers: { Location: 'https://other.example.com/v1' },
      })
    }
    await expect(
      generateText({
        model: configuredModel(
          {
            protocol: 'openai',
            baseUrl: 'https://api.example.com/v1',
            model: 'custom-model',
            apiKey: 'synthetic-test-key',
          },
          fetcher,
        ),
        prompt: 'test',
        maxRetries: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 307 })
    expect(requests).toEqual(['https://api.example.com/v1/chat/completions'])
  })
  it.each(['openai', 'anthropic'] as const)(
    'preserves OpenCode routing sessions for %s requests',
    async (protocol) => {
      const sessions: string[] = []
      const fetcher: typeof fetch = async (input, init) => {
        const request = new Request(input, init)
        const session = request.headers.get('x-opencode-session')
        if (!session)
          return Response.json(
            {
              error: {
                type: 'MissingSessionID',
                message: 'Missing session ID',
              },
            },
            { status: 400 },
          )
        expect(request.headers.get('user-agent')).toBe('LearnPath/0.1.0')
        expect(
          ((await request.json()) as { max_tokens: number }).max_tokens,
        ).toBe(131_072)
        sessions.push(session)
        return Response.json(
          protocol === 'anthropic'
            ? {
                id: 'msg_test',
                type: 'message',
                role: 'assistant',
                model: 'custom-model',
                content: [{ type: 'text', text: '连接成功' }],
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 4 },
              }
            : {
                id: 'test',
                object: 'chat.completion',
                created: 1,
                model: 'custom-model',
                choices: [
                  {
                    index: 0,
                    message: { role: 'assistant', content: '连接成功' },
                    finish_reason: 'stop',
                  },
                ],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 4,
                  total_tokens: 14,
                },
              },
        )
      }
      for (const sessionId of [
        'conversation-a',
        'conversation-a',
        'conversation-b',
      ]) {
        const result = await generateText({
          model: configuredModel(
            {
              protocol,
              baseUrl: 'https://opencode.ai/zen/go/v1',
              model: 'custom-model',
              apiKey: 'synthetic-test-key',
              sessionId,
            },
            fetcher,
          ),
          prompt: 'test',
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 0,
        })
        expect(result.text).toBe('连接成功')
      }
      expect(sessions).toEqual([
        'conversation-a',
        'conversation-a',
        'conversation-b',
      ])
    },
  )
  it('parses Anthropic streaming events from a custom endpoint', async () => {
    const events = [
      [
        'message_start',
        {
          type: 'message_start',
          message: {
            id: 'msg_stream',
            type: 'message',
            role: 'assistant',
            model: 'custom-model',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 8, output_tokens: 0 },
          },
        },
      ],
      [
        'content_block_start',
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
      ],
      [
        'content_block_delta',
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: '我们一起想一想' },
        },
      ],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      [
        'message_delta',
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 8 },
        },
      ],
      ['message_stop', { type: 'message_stop' }],
    ]
    const fetcher: typeof fetch = async () =>
      new Response(
        events
          .map(
            ([event, data]) =>
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          )
          .join(''),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    const result = streamText({
      model: configuredModel(
        {
          protocol: 'anthropic',
          baseUrl: 'https://proxy.example.net/v1',
          model: 'custom-model',
          apiKey: 'synthetic-test-key',
        },
        fetcher,
      ),
      prompt: 'test',
      maxRetries: 0,
    })
    let text = ''
    for await (const chunk of result.textStream) text += chunk
    expect(text).toBe('我们一起想一想')
  })
  it('parses OpenAI non-streaming quiz JSON without requiring structured-output extensions', async () => {
    const content =
      '{"question":"2 + 3 等于几？","options":["4","5","6","7"],"correctIndex":1,"explanation":"2 和 3 合起来是 5。"}'
    const fetcher: typeof fetch = async () =>
      Response.json({
        id: 'quiz_test',
        object: 'chat.completion',
        created: 1,
        model: 'custom-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40 },
      })
    const result = await generateText({
      model: configuredModel(
        {
          protocol: 'openai',
          baseUrl: 'https://proxy.example.net/v1',
          model: 'custom-model',
          apiKey: 'synthetic-test-key',
        },
        fetcher,
      ),
      prompt: 'quiz',
      maxRetries: 0,
    })
    expect(JSON.parse(result.text).correctIndex).toBe(1)
  })
  it('uses a custom OpenAI endpoint, model and key for streaming', async () => {
    const fetcher: typeof fetch = async (input, init) => {
      const req = new Request(input, init)
      expect(req.url).toBe(
        'https://proxy.example.net/custom/v1/chat/completions',
      )
      expect(req.headers.get('authorization')).toBe('Bearer synthetic-test-key')
      const body = (await req.json()) as { model: string; stream: boolean }
      expect(body.model).toBe('custom-model')
      expect(body.stream).toBe(true)
      expect(init?.redirect).toBe('manual')
      expect(req.headers.get('x-opencode-session')).toBeNull()
      const data = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'custom-model',
        choices: [
          { index: 0, delta: { content: '连接成功' }, finish_reason: null },
        ],
      }
      return new Response(`data: ${JSON.stringify(data)}\n\ndata: [DONE]\n\n`, {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }
    const result = streamText({
      model: configuredModel(
        {
          protocol: 'openai',
          baseUrl: 'https://proxy.example.net/custom/v1',
          model: 'custom-model',
          apiKey: 'synthetic-test-key',
        },
        fetcher,
      ),
      prompt: 'test',
      maxRetries: 0,
    })
    let text = ''
    for await (const chunk of result.textStream) text += chunk
    expect(text).toBe('连接成功')
  })
  it('uses Anthropic message format and returns generated text without Workers AI', async () => {
    const fetcher: typeof fetch = async (input, init) => {
      const req = new Request(input, init)
      expect(req.url).toBe('https://proxy.example.net/v1/messages')
      expect(req.headers.get('x-api-key')).toBe('synthetic-test-key')
      const body = (await req.json()) as { model: string; max_tokens: number }
      expect(body.model).toBe('custom-anthropic-model')
      expect(body.max_tokens).toBe(64)
      return Response.json({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'custom-anthropic-model',
        content: [{ type: 'text', text: '连接成功' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 4 },
      })
    }
    const result = await generateText({
      model: configuredModel(
        {
          protocol: 'anthropic',
          baseUrl: 'https://proxy.example.net/v1',
          model: 'custom-anthropic-model',
          apiKey: 'synthetic-test-key',
        },
        fetcher,
      ),
      prompt: 'test',
      maxOutputTokens: 64,
      maxRetries: 0,
    })
    expect(result.text).toBe('连接成功')
  })
})
