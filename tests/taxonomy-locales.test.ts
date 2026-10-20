import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { z } from 'zod'
import data from '../public/data/catalog.json'
import source from '../src/data/source.json'
import { catalogSchema, topicTranslationSchema } from '../src/lib/contracts'
import { topicFingerprint } from '../src/server/translation'

it('ships a complete Chinese translation matched to every upstream topic and template variable', () => {
  const resource = z
    .object({
      revision: z.string(),
      translations: z.record(z.string(), topicTranslationSchema),
    })
    .parse(
      JSON.parse(
        readFileSync(
          new URL('../public/data/locales/zh-CN.json', import.meta.url),
          'utf8',
        ),
      ),
    )
  expect(resource.revision).toBe(source.commit)
  const topics = catalogSchema.parse(data).topics
  expect(Object.keys(resource.translations)).toHaveLength(topics.length)
  for (const topic of topics) {
    const value = resource.translations[topic.id]
    expect(value, topic.id).toBeDefined()
    expect(value.sourceHash, topic.id).toBe(topicFingerprint(topic))
    expect(value.name, topic.id).toMatch(/\p{Script=Han}/u)
    expect(value.description.trim(), topic.id).not.toBe('')
    expect(value.evidence, topic.id).toHaveLength(topic.evidence.length)
    expect(
      value.evidence.every((item) => item.trim().length > 0),
      topic.id,
    ).toBe(true)
    if (topic.assessmentPrompt !== null)
      expect(value.assessmentPrompt?.trim(), topic.id).toBeTruthy()
    for (const placeholder of topic.assessmentPrompt?.match(/\{\{[^}]+\}\}/g) ??
      [])
      expect(value.assessmentPrompt, topic.id).toContain(placeholder)
  }
})
