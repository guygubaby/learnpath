import { describe, expect, it } from 'vitest'
import { createAppI18n } from '../src/lib/i18n'
import { translateText, translations } from '../src/lib/i18n-core'
import { cookieLocale, requestLocale } from '../src/lib/locale'
import { ageLabel, topicName } from '../src/lib/labels'
import { starterQuestion } from '../src/lib/starter-questions'
import { catalogSchema } from '../src/lib/contracts'
import data from '../public/data/catalog.json'

const topic = {
  ...catalogSchema.parse(data).topics[0],
  name: 'Estimating volume',
  translations: {
    'zh-CN': {
      name: '估算体积',
      description: '估算盒子能容纳多少个单位立方体。',
      evidence: ['用单位立方体估算体积'],
      assessmentPrompt: null,
      sourceHash: 'fixture',
    },
  },
}
describe('Chinese and English localization', () => {
  it('keeps language state isolated between app instances and interpolates real values', async () => {
    const chinese = createAppI18n('zh-CN')
    const english = createAppI18n('en')
    expect(chinese.t('知识地图')).toBe('知识地图')
    expect(english.t('知识地图')).not.toMatch(/\p{Script=Han}/u)
    await english.changeLanguage('zh-CN')
    expect(chinese.language).toBe('zh-CN')
    expect(translateText('{{v0}} 岁', 'en', { v0: 9 })).toBe('Age 9')
    expect(translateText('个', 'zh-CN', { count: 1 })).toBe('个')
    expect(translateText('天', 'en', { count: 1 })).toBe('day')
    expect(translateText('天', 'en', { count: 2 })).toBe('days')
    expect(topicName(topic, 'zh-CN')).toBe('估算体积')
    expect(topicName(topic, 'en')).toBe('Estimating volume')
    expect(
      ageLabel({ ...topic, ageRangeStart: 8, ageRangeEnd: 10 }, 'en'),
    ).not.toMatch(/岁/)
  })
  it('persists an explicit preference and prioritizes the app locale over browser headers', () => {
    expect(cookieLocale('other=value; xuejing.locale=en')).toBe('en')
    expect(cookieLocale('xuejing.locale=invalid')).toBeUndefined()
    expect(
      requestLocale(
        new Request('https://app.test', {
          headers: { cookie: 'xuejing.locale=zh-CN', 'accept-language': 'en' },
        }),
      ),
    ).toBe('zh-CN')
    expect(
      requestLocale(
        new Request('https://app.test', {
          headers: { 'X-App-Locale': 'en', cookie: 'xuejing.locale=zh-CN' },
        }),
      ),
    ).toBe('en')
  })
  it('retains every interpolation placeholder and keeps 学径 as the visible brand', () => {
    const placeholders = (value: string) =>
      (value.match(/\{\{[^}]+\}\}/g) ?? []).sort()
    for (const [source, value] of Object.entries(translations))
      expect(placeholders(value), source).toEqual(placeholders(source))
    expect(translateText('学径', 'en')).toBe('学径')
    expect(
      Object.values(translations).some((value) => /LearnPath/i.test(value)),
    ).toBe(false)
  })
  it('generates starter questions and answer explanations in the selected language', () => {
    for (const id of ['mt_cFltwUQi-d', 'mt_Qkewo5M3_c']) {
      const english = starterQuestion(id, 'en')!
      const chinese = starterQuestion(id, 'zh-CN')!
      expect(english.question + english.explanation).not.toMatch(
        /\p{Script=Han}/u,
      )
      expect(chinese.question).toMatch(/\p{Script=Han}/u)
      expect(english.options).toHaveLength(4)
    }
  })
})
