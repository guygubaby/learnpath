import { expect, it, vi } from 'vitest'
import { configuredModel } from '../src/lib/ai-model'
import { topicFingerprint, translateTopics } from '../src/server/translation'
import { catalogSchema } from '../src/lib/contracts'
import data from '../public/data/catalog.json'
const fixture = vi.hoisted(() => ({ text: '', prompt: '' }))
vi.mock('ai', () => ({
  generateText: async ({ prompt }: { prompt: string }) => {
    fixture.prompt = prompt
    return { text: fixture.text }
  },
}))
const model = configuredModel({
  protocol: 'openai',
  baseUrl: 'https://api.example.com/v1',
  model: 'synthetic-model',
  apiKey: 'synthetic-key',
})
const topic = {
  ...catalogSchema.parse(data).topics[0],
  assessmentPrompt: 'Can {{name}} explain volume to {{name}}?',
  evidence: ['Explain volume'],
}
it('preserves learner placeholders, original IDs and complete evidence before accepting a translation', async () => {
  const record = {
    id: topic.id,
    name: '估算体积',
    description: '通过单位立方体估算体积。',
    evidence: ['解释体积'],
    assessmentPrompt: '__XUEJING_VAR_0__ 能向 __XUEJING_VAR_0__ 解释体积吗？',
  }
  fixture.text = JSON.stringify([record])
  const result = await translateTopics([topic], model)
  expect(fixture.prompt).not.toContain('{{name}}')
  expect(result[topic.id].assessmentPrompt).toBe(
    '{{name}} 能向 {{name}} 解释体积吗？',
  )
  expect(result[topic.id].sourceHash).toBe(topicFingerprint(topic))
  fixture.text = JSON.stringify([{ ...record, evidence: [] }])
  await expect(translateTopics([topic], model)).rejects.toThrow(
    'Incomplete translation',
  )
  fixture.text = JSON.stringify([{ ...record, assessmentPrompt: '能解释吗？' }])
  await expect(translateTopics([topic], model)).rejects.toThrow(
    'Missing placeholder',
  )
  fixture.text = JSON.stringify([record, record])
  await expect(translateTopics([topic], model)).rejects.toThrow('duplicated')
})
