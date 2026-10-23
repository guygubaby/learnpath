import { expect, it } from 'vitest'
import data from '../public/data/catalog.json'
import { catalogSchema, subjects } from '../src/lib/contracts'
import { subjectMeta, domainName } from '../src/lib/labels'
import { translateText } from '../src/lib/i18n-core'
import {
  taxonomySummary,
  bundledTaxonomySummary,
} from '../src/lib/taxonomy-summary'

it('counts the active snapshot instead of hardcoded subjects or retained historical topics', () => {
  const topic = catalogSchema.parse(data).topics[0]
  const catalog = catalogSchema.parse({
    version: 'v1',
    topics: [
      { ...topic, id: 'mt_current', subject: 'Mathematics' },
      { ...topic, id: 'mt_geography', subject: 'Geography' },
      { ...topic, id: 'mt_retired', subject: 'Science', retired: true },
    ],
    dependencies: [
      {
        topicId: 'mt_geography',
        prerequisiteId: 'mt_current',
        strength: 'hard',
        reason: '',
      },
      {
        topicId: 'mt_retired',
        prerequisiteId: 'mt_current',
        strength: 'hard',
        reason: '',
      },
    ],
  })
  expect(taxonomySummary(catalog)).toEqual({
    topics: 2,
    dependencies: 1,
    subjects: 2,
  })
  expect(taxonomySummary(catalogSchema.parse(data))).toEqual(
    bundledTaxonomySummary,
  )
  for (const subject of subjects) {
    expect(subjectMeta[subject].name).toMatch(/\p{Script=Han}/u)
    expect(subjectMeta[subject].icon).toBeDefined()
  }
  expect(translateText(subjectMeta.Geography.name, 'en')).toBe('Geography')
  expect(domainName('Maps & Spatial Skills', 'zh-CN')).toBe('地图与空间技能')
})
