import { describe, expect, it } from 'vitest'
import {
  catalogSchema,
  questionContentSchema,
  type Catalog,
  type Progress,
} from '../src/lib/contracts'
import {
  createGraph,
  isReady,
  prerequisitePath,
  localGraphPositions,
} from '../src/lib/graph'
import { evidenceStatus, nextReview, weeklyActivity } from '../src/lib/learning'
import { starterQuestion } from '../src/lib/starter-questions'
import data from '../public/data/catalog.json'

const catalog = catalogSchema.parse(data)
const graph = createGraph(catalog)
const sample = (id: string) => ({ ...catalog.topics[0], id, name: id })
const edge = (
  topicId: string,
  prerequisiteId: string,
  strength: 'hard' | 'soft' = 'hard',
) => ({ topicId, prerequisiteId, strength, reason: 'test' })
const mastered = (topicId: string): Progress => ({
  topicId,
  status: 'mastered',
  score: 100,
  evidenceCount: 3,
  source: 'quiz',
  note: null,
  updatedAt: new Date().toISOString(),
})

describe('real prerequisite graph', () => {
  it('keeps a focused graph centered and all related nodes inside phone and desktop canvases', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `mt_${index}`)
    for (const width of [320, 614, 1000]) {
      const points = localGraphPositions(
        ids,
        new Set(ids.slice(1, 5)),
        ids[0],
        width,
        480,
      )
      expect(points[ids[0]]).toEqual({ x: width / 2, y: 240 })
      expect(
        new Set(Object.values(points).map((point) => `${point.x},${point.y}`))
          .size,
      ).toBe(ids.length)
      for (const point of Object.values(points)) {
        expect(point.x).toBeGreaterThan(30)
        expect(point.x).toBeLessThan(width - 30)
        expect(point.y).toBeGreaterThan(30)
        expect(point.y).toBeLessThan(450)
      }
    }
  })
  it('imports all eight subjects and produces dependency-correct paths for every target', () => {
    expect(catalog.topics).toHaveLength(1591)
    expect(catalog.dependencies).toHaveLength(3225)
    expect(new Set(catalog.topics.map((topic) => topic.subject)).size).toBe(8)
    for (const topic of catalog.topics) {
      const path = prerequisitePath(graph, topic.id)
      const positions = new Map(path.map((item, index) => [item.id, index]))
      expect(positions.size).toBe(path.length)
      for (const item of path)
        for (const dependency of graph.prerequisites.get(item.id) ?? []) {
          if (dependency.strength === 'hard')
            expect(positions.get(dependency.prerequisiteId)!).toBeLessThan(
              positions.get(item.id)!,
            )
        }
    }
  })
  it('keeps both arms of a diamond, ignores advisory edges and never propagates mastery', () => {
    const fixture: Catalog = {
      version: 'test',
      topics: ['mt_a', 'mt_b', 'mt_c', 'mt_d', 'mt_soft'].map(sample),
      dependencies: [
        edge('mt_b', 'mt_a'),
        edge('mt_c', 'mt_a'),
        edge('mt_d', 'mt_b'),
        edge('mt_d', 'mt_c'),
        edge('mt_d', 'mt_soft', 'soft'),
      ],
    }
    const g = createGraph(fixture)
    expect(prerequisitePath(g, 'mt_d').map((item) => item.id)).toEqual([
      'mt_a',
      'mt_b',
      'mt_c',
      'mt_d',
    ])
    expect(isReady(g, 'mt_d', [mastered('mt_b')])).toBe(false)
    expect(isReady(g, 'mt_d', [mastered('mt_b'), mastered('mt_c')])).toBe(true)
    expect(prerequisitePath(g, 'mt_d', [mastered('mt_d')])).toEqual([])
    expect(isReady(g, 'mt_b', [mastered('mt_d')])).toBe(false)
  })
  it('rejects missing endpoints, cycles and unknown target ids', () => {
    expect(() =>
      createGraph({
        version: 'test',
        topics: [sample('mt_a')],
        dependencies: [edge('mt_a', 'mt_missing')],
      }),
    ).toThrow()
    const cycle = createGraph({
      version: 'test',
      topics: [sample('mt_a'), sample('mt_b')],
      dependencies: [edge('mt_a', 'mt_b'), edge('mt_b', 'mt_a')],
    })
    expect(() => prerequisitePath(cycle, 'mt_a')).toThrow('循环')
    expect(() => prerequisitePath(graph, 'mt_missing')).toThrow('不存在')
  })
})
describe('evidence and review', () => {
  it('does not mark one answer or repeated copies of the same question as mastery', () => {
    expect(evidenceStatus([{ questionKey: 'a', score: 1 }]).status).toBe(
      'learning',
    )
    expect(
      evidenceStatus(
        Array.from({ length: 5 }, () => ({ questionKey: 'a', score: 1 })),
      ).status,
    ).toBe('learning')
    expect(
      evidenceStatus(
        ['a', 'b', 'c'].map((questionKey) => ({ questionKey, score: 1 })),
      ).status,
    ).toBe('mastered')
    expect(
      evidenceStatus(
        [1, 0, 0, 1, 0].map((score, index) => ({
          questionKey: String(index),
          score,
        })),
      ).status,
    ).toBe('learning')
  })
  it('schedules actual elapsed days and resets the interval after a mistake', () => {
    const now = new Date('2026-10-20T16:00:00.000Z')
    expect(nextReview(1, -1, now)).toEqual({
      stage: 0,
      dueAt: '2026-10-21T16:00:00.000Z',
    })
    expect(nextReview(1, 0, now)).toEqual({
      stage: 1,
      dueAt: '2026-10-23T16:00:00.000Z',
    })
    expect(nextReview(0, 4, now).dueAt).toBe('2026-10-21T16:00:00.000Z')
    expect(nextReview(1, 4, now).stage).toBe(4)
    expect(weeklyActivity(undefined, now).at(-1)?.date).toBe('2026-10-21')
  })
  it('starter questions have four unique options and a correct answer in range', () => {
    const supported = catalog.topics.filter((topic) =>
      starterQuestion(topic.id),
    )
    expect(supported.length).toBeGreaterThan(15)
    for (const topic of supported)
      for (let i = 0; i < 30; i++)
        expect(
          questionContentSchema.safeParse(starterQuestion(topic.id)).success,
        ).toBe(true)
  })
})
