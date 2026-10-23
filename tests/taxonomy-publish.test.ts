import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import data from '../public/data/catalog.json'
import manifestData from '../public/data/manifest.json'
import standards from '../public/data/standards.json'
import clusters from '../public/data/clusters.json'
import {
  catalogSchema,
  type Topic,
  type TopicTranslation,
} from '../src/lib/contracts'
import { createGraph } from '../src/lib/graph'
import { topicFingerprint } from '../src/server/translation'

const mocks = vi.hoisted(() => ({
  bindings: {} as Record<string, unknown>,
  snapshot: {} as Record<string, unknown>,
  translate: undefined as
    | ((topics: Topic[]) => Promise<Record<string, TopicTranslation>>)
    | undefined,
}))
vi.mock('cloudflare:workers', () => ({ env: mocks.bindings }))
vi.mock('../src/server/taxonomy', () => ({
  getTaxonomy: async () => mocks.snapshot,
  taxonomyState: async () => ({ checked_revision: '0'.repeat(40) }),
}))
vi.mock('../src/server/ai', () => ({
  languageModel: () => {
    if (mocks.translate) return {}
    throw new Error('Unchanged translations must not call a model')
  },
}))
vi.mock('../src/server/translation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/translation')>()),
  translateTopics: (topics: Topic[]) => {
    if (!mocks.translate) throw new Error('Unexpected translation request')
    return mocks.translate(topics)
  },
}))
const { syncTaxonomy } = await import('../src/server/taxonomy-sync')

const previous = catalogSchema.parse(data)
for (const topic of previous.topics)
  topic.translations = {
    'zh-CN': {
      name: '测试知识点',
      description: '说明',
      evidence: topic.evidence.map(() => '掌握标准'),
      assessmentPrompt: null,
      sourceHash: topicFingerprint(topic),
    },
  }
let db: DatabaseSync
let objects: Map<string, string>
let failCatalogWrite = false
const bodies: Record<string, string> = {
  'topics.json': JSON.stringify({ topics: data.topics }),
  'dependencies.json': JSON.stringify({ dependencies: data.dependencies }),
  'curriculum-standards.json': JSON.stringify({ curricula: standards }),
  'clusters.json': JSON.stringify(clusters),
  'teaching-research.json': JSON.stringify({
    records: data.topics
      .filter(
        (topic) =>
          !new Set(manifestData.teachingResearch.coverage.missingTopicIds).has(
            topic.id,
          ),
      )
      .map((topic) => ({
        topicId: topic.id,
        learn: { summary: 'Synthetic research fixture' },
      })),
  }),
}
const manifest = structuredClone(manifestData)
for (const name of Object.keys(bodies)) {
  const bytes = Buffer.from(bodies[name])
  manifest.files[name as keyof typeof manifest.files] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}
const originalTopicsBody = bodies['topics.json']
const originalTopicsIntegrity = manifest.files['topics.json']

function updateTopicFixtures(count: number) {
  bodies['topics.json'] = JSON.stringify({
    topics: data.topics.map((topic, index) =>
      index < count
        ? { ...topic, description: topic.description + ' Updated source.' }
        : topic,
    ),
  })
  const bytes = Buffer.from(bodies['topics.json'])
  manifest.files['topics.json'] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function translatedFixtures(topics: Topic[]) {
  return Object.fromEntries(
    topics.map((topic) => [
      topic.id,
      {
        name: '更新的知识点',
        description: '完整中文说明',
        evidence: topic.evidence.map(() => '可观察的掌握表现'),
        assessmentPrompt: topic.assessmentPrompt,
        sourceHash: topicFingerprint(topic),
      },
    ]),
  )
}

beforeEach(() => {
  bodies['topics.json'] = originalTopicsBody
  manifest.files['topics.json'] = originalTopicsIntegrity
  mocks.translate = undefined
  mocks.bindings.TAXONOMY_OWNER_ID = 'test-owner'
  db = new DatabaseSync(':memory:')
  db.exec(
    readFileSync(
      new URL('../migrations/0002_taxonomy_sync.sql', import.meta.url),
      'utf8',
    ),
  )
  db.prepare('UPDATE taxonomy_state SET revision=? WHERE id=1').run(
    'old-valid-snapshot',
  )
  mocks.bindings.DB = {
    prepare(sql: string) {
      return {
        bind(...params: (string | number | null)[]) {
          return {
            async first() {
              return db.prepare(sql).get(...params) ?? null
            },
            async run() {
              const result = db.prepare(sql).run(...params)
              return { meta: { changes: Number(result.changes) } }
            },
          }
        },
      }
    },
  }
  objects = new Map()
  failCatalogWrite = false
  mocks.bindings.TAXONOMY = {
    async get() {
      return null
    },
    async put(key: string, value: string | Uint8Array) {
      if (failCatalogWrite && key.endsWith('/catalog.json'))
        throw new Error('Synthetic R2 write failure')
      objects.set(
        key,
        typeof value === 'string' ? value : new TextDecoder().decode(value),
      )
    },
  }
  mocks.snapshot = { catalog: previous, graph: createGraph(previous) }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = url.split('/').at(-1)!
      if (url.includes('/info/refs?')) {
        const packet = (value: string) =>
          (Buffer.byteLength(value) + 4).toString(16).padStart(4, '0') + value
        return new Response(
          packet('# service=git-upload-pack\n') +
            '0000' +
            packet('1'.repeat(40) + ' refs/heads/main\n') +
            '0000',
        )
      }
      if (name === 'manifest.json') return Response.json(manifest)
      if (bodies[name]) return new Response(bodies[name])
      if (
        [
          'LICENSE',
          'LICENSE-CONTENT',
          'PROVENANCE.md',
          'CITATION.cff',
        ].includes(name)
      )
        return new Response('Public attribution fixture')
      throw new Error('Unexpected upstream request')
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  db.close()
})

it('publishes a complete immutable snapshot with a single lease-protected pointer update', async () => {
  await expect(syncTaxonomy(true)).resolves.toEqual({
    status: 'success',
    revision: '1'.repeat(40),
  })
  const state = db.prepare('SELECT * FROM taxonomy_state WHERE id=1').get()!
  expect(state.status).toBe('success')
  expect(state.lease_id).toBeNull()
  const key = `snapshots/${state.revision}/catalog.json`
  expect(objects.has(key)).toBe(true)
  const published = catalogSchema.parse(JSON.parse(objects.get(key)!))
  expect(published.topics).toHaveLength(1591)
  expect(published.source?.commit).toBe('1'.repeat(40))
})
it('retains the working snapshot and releases the lease if staging fails', async () => {
  failCatalogWrite = true
  await expect(syncTaxonomy(true)).rejects.toThrow('SYNC_FAILED')
  const state = db.prepare('SELECT * FROM taxonomy_state WHERE id=1').get()!
  expect(state.revision).toBe('old-valid-snapshot')
  expect(state.status).toBe('failed')
  expect(state.lease_id).toBeNull()
})
it('translates at most four independent batches together and caches every completed topic before publishing', async () => {
  updateTopicFixtures(25)
  let active = 0
  let maximum = 0
  const sizes: number[] = []
  mocks.translate = async (topics) => {
    active++
    maximum = Math.max(maximum, active)
    sizes.push(topics.length)
    await Promise.resolve()
    active--
    return translatedFixtures(topics)
  }
  await syncTaxonomy(true)
  expect(maximum).toBe(4)
  expect(sizes).toEqual([6, 6, 6, 6, 1])
  expect(
    [...objects.keys()].filter((key) => key.startsWith('translations/zh-CN/')),
  ).toHaveLength(25)
  expect(
    db.prepare('SELECT status FROM taxonomy_state WHERE id=1').get()?.status,
  ).toBe('success')
})
it('waits for sibling translations to settle before releasing a failed run’s lease', async () => {
  updateTopicFixtures(25)
  let calls = 0
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  mocks.translate = async (topics) => {
    calls++
    if (calls === 1) throw new Error('Synthetic translation failure')
    await gate
    return translatedFixtures(topics)
  }
  const syncing = expect(syncTaxonomy(true)).rejects.toThrow('SYNC_FAILED')
  try {
    await vi.waitFor(() => expect(calls).toBe(4))
    expect(
      db.prepare('SELECT status FROM taxonomy_state WHERE id=1').get()?.status,
    ).toBe('running')
  } finally {
    release()
    await syncing
  }
  const state = db.prepare('SELECT * FROM taxonomy_state WHERE id=1').get()!
  expect(state.revision).toBe('old-valid-snapshot')
  expect(state.lease_id).toBeNull()
  expect(calls).toBe(4)
  expect(
    [...objects.keys()].filter((key) => key.startsWith('translations/zh-CN/')),
  ).toHaveLength(18)
})
it('refuses a second concurrent run while an unexpired lease owns the sync', async () => {
  db.prepare(
    'UPDATE taxonomy_state SET lease_id=?,lease_until=? WHERE id=1',
  ).run('other-run', new Date(Date.now() + 60_000).toISOString())
  await expect(syncTaxonomy()).resolves.toEqual({ status: 'running' })
  expect(fetch).not.toHaveBeenCalled()
  expect(objects.size).toBe(0)
})
