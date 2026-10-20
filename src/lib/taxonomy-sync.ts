import { createHash } from 'node:crypto'
import { JSONParser } from '@streamparser/json'
import { z } from 'zod'
import {
  catalogSchema,
  researchSchema,
  type Catalog,
  type TeachingResearch,
} from './contracts'
import { createGraph } from './graph'

export const upstreamFiles = [
  'topics.json',
  'dependencies.json',
  'curriculum-standards.json',
  'clusters.json',
  'teaching-research.json',
] as const
export const fileIntegritySchema = z.object({
  bytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})
export const manifestSchema = z
  .object({
    taxonomyVersion: z.string(),
    generatedAt: z.string(),
    counts: z.object({
      topics: z.number().int().positive(),
      dependencies: z.number().int().nonnegative(),
      teachingResearch: z.number().int().nonnegative(),
    }),
    files: z.record(z.string(), fileIntegritySchema),
  })
  .refine(
    (value) => upstreamFiles.every((name) => value.files[name]),
    'Missing dataset file',
  )
export type FileIntegrity = z.infer<typeof fileIntegritySchema>

export class SyncError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

export async function limitedBytes(response: Response, maxBytes: number) {
  if (!response.ok || !response.body)
    throw new SyncError('UPSTREAM_UNAVAILABLE')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxBytes) throw new SyncError('FILE_TOO_LARGE')
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

export async function limitedText(response: Response, maxBytes: number) {
  return new TextDecoder().decode(await limitedBytes(response, maxBytes))
}

export function gitMainRevision(bytes: Uint8Array) {
  const decoder = new TextDecoder()
  let offset = 0
  let revision: string | undefined
  let advertised = false
  while (offset < bytes.length) {
    const header = decoder.decode(bytes.subarray(offset, offset + 4))
    if (!/^[0-9a-f]{4}$/i.test(header))
      throw new SyncError('INVALID_GIT_REFERENCE')
    const size = Number.parseInt(header, 16)
    if (size === 0) {
      offset += 4
      continue
    }
    if (size < 4 || offset + size > bytes.length)
      throw new SyncError('INVALID_GIT_REFERENCE')
    const line = decoder.decode(bytes.subarray(offset + 4, offset + size))
    if (offset === 0) {
      if (line !== '# service=git-upload-pack\n')
        throw new SyncError('INVALID_GIT_REFERENCE')
      advertised = true
    }
    const match = line.match(/^([0-9a-f]{40}) refs\/heads\/main(?:\0|\n|$)/)
    if (match) revision = match[1]
    offset += size
  }
  if (!advertised || !revision) throw new SyncError('MAIN_REFERENCE_NOT_FOUND')
  return revision
}

export function validateCatalog(value: unknown) {
  const catalog = catalogSchema.parse(value)
  const graph = createGraph(catalog)
  if (graph.byId.size !== catalog.topics.length)
    throw new SyncError('DUPLICATE_TOPIC')
  const degree = new Map(catalog.topics.map((topic) => [topic.id, 0]))
  const edges = new Set<string>()
  for (const edge of catalog.dependencies) {
    const key = `${edge.prerequisiteId}:${edge.topicId}`
    if (edges.has(key)) throw new SyncError('DUPLICATE_DEPENDENCY')
    edges.add(key)
    degree.set(edge.topicId, degree.get(edge.topicId)! + 1)
  }
  const queue = [...degree].filter(([, count]) => !count).map(([id]) => id)
  for (let index = 0; index < queue.length; index++) {
    for (const edge of graph.unlocked.get(queue[index]) ?? []) {
      const count = degree.get(edge.topicId)! - 1
      degree.set(edge.topicId, count)
      if (!count) queue.push(edge.topicId)
    }
  }
  if (queue.length !== catalog.topics.length)
    throw new SyncError('CYCLIC_DEPENDENCY')
  return catalog
}

export function retainHistoricalTopics(next: Catalog, previous: Catalog) {
  const activeIds = new Set(next.topics.map((topic) => topic.id))
  const retired = previous.topics.filter((topic) => !activeIds.has(topic.id))
  return validateCatalog({
    ...next,
    topics: [
      ...next.topics,
      ...retired.map((topic) => ({ ...topic, retired: true })),
    ],
    dependencies: [
      ...next.dependencies,
      ...previous.dependencies.filter((edge) => !activeIds.has(edge.topicId)),
    ],
  })
}

export async function verifiedBytes(
  response: Response,
  expected: FileIntegrity,
  maxBytes = 8 * 1024 * 1024,
) {
  if (!response.ok || !response.body)
    throw new SyncError('UPSTREAM_UNAVAILABLE')
  if (expected.bytes > maxBytes) throw new SyncError('FILE_TOO_LARGE')
  const bytes = new Uint8Array(expected.bytes)
  const hash = createHash('sha256')
  let offset = 0
  for await (const chunk of response.body) {
    if (offset + chunk.length > expected.bytes)
      throw new SyncError('BYTE_COUNT_MISMATCH')
    bytes.set(chunk, offset)
    offset += chunk.length
    hash.update(chunk)
  }
  if (offset !== expected.bytes || hash.digest('hex') !== expected.sha256)
    throw new SyncError('CHECKSUM_MISMATCH')
  return bytes
}

export async function streamResearch(
  response: Response,
  expected: FileIntegrity,
  topicIds: Set<string>,
  write: (record: TeachingResearch) => Promise<unknown>,
) {
  if (!response.ok || !response.body)
    throw new SyncError('UPSTREAM_UNAVAILABLE')
  const parser = new JSONParser({ paths: ['$.records.*'], keepStack: false })
  const ids = new Set<string>()
  let pending: TeachingResearch[] = []
  let size = 0
  let writes: Promise<void>[] = []
  let writeError: unknown
  const flush = async () => {
    await Promise.all(writes)
    writes = []
    if (writeError) throw writeError
  }
  const hash = createHash('sha256')
  parser.onValue = ({ value }) => {
    const record = researchSchema.parse(value)
    if (!topicIds.has(record.topicId) || ids.has(record.topicId))
      throw new SyncError('INVALID_RESEARCH_REFERENCE')
    ids.add(record.topicId)
    pending.push(record)
  }
  parser.onError = () => {
    throw new SyncError('INVALID_RESEARCH_JSON')
  }
  try {
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > expected.bytes) throw new SyncError('BYTE_COUNT_MISMATCH')
      hash.update(chunk)
      parser.write(chunk)
      const records = pending
      pending = []
      // Fill bounded batches across network chunks, which may each contain less than one record.
      for (const record of records) {
        writes.push(
          Promise.resolve()
            .then(() => write(record))
            .then(
              () => {},
              (error: unknown) => {
                writeError ??= error
              },
            ),
        )
        if (writes.length === 4) await flush()
      }
    }
    if (!parser.isEnded) parser.end()
    await flush()
    if (size !== expected.bytes || hash.digest('hex') !== expected.sha256)
      throw new SyncError('CHECKSUM_MISMATCH')
    return [...ids]
  } finally {
    await Promise.all(writes)
  }
}
