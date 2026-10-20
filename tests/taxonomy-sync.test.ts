import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  gitMainRevision,
  limitedText,
  retainHistoricalTopics,
  streamResearch,
  validateCatalog,
  verifiedBytes,
} from '../src/lib/taxonomy-sync'
import data from '../public/data/catalog.json'
import { catalogSchema } from '../src/lib/contracts'

const catalog = catalogSchema.parse(data)
const topic = (id: string) => ({ ...catalog.topics[0], id })
const edge = (topicId: string, prerequisiteId: string) => ({
  topicId,
  prerequisiteId,
  strength: 'hard' as const,
  reason: '',
})
const integrity = (bytes: Uint8Array) => ({
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
})
function chunks(value: string, size = 7) {
  const bytes = new TextEncoder().encode(value)
  return {
    bytes,
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (let offset = 0; offset < bytes.length; offset += size)
            controller.enqueue(bytes.slice(offset, offset + size))
          controller.close()
        },
      }),
    ),
  }
}

describe('taxonomy snapshot validation', () => {
  it('keeps four writes in flight across small network chunks and awaits failures before returning', async () => {
    const records = Array.from({ length: 8 }, (_, index) => ({
      topicId: `mt_${index}`,
    }))
    const input = chunks(JSON.stringify({ records }), 1)
    let active = 0
    let maxActive = 0
    let waiting: (() => void)[] = []
    const ids = await streamResearch(
      input.response,
      integrity(input.bytes),
      new Set(records.map((record) => record.topicId)),
      async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => {
          waiting.push(resolve)
          if (waiting.length === 4) {
            const batch = waiting
            waiting = []
            batch.forEach((done) => done())
          }
        })
        active--
      },
    )
    expect(ids).toHaveLength(8)
    expect(maxActive).toBe(4)
    expect(active).toBe(0)
    const failed = chunks(JSON.stringify({ records }))
    await expect(
      streamResearch(
        failed.response,
        integrity(failed.bytes),
        new Set(records.map((record) => record.topicId)),
        async () => {
          throw new Error('Synthetic write failure')
        },
      ),
    ).rejects.toThrow('Synthetic write failure')
  }, 1000)
  it('resolves the exact main reference from Git packets and rejects malformed or unrelated refs', () => {
    const packet = (value: string) =>
      (Buffer.byteLength(value) + 4).toString(16).padStart(4, '0') + value
    const header = packet('# service=git-upload-pack\n') + '0000'
    const text =
      header +
      packet('2'.repeat(40) + ' HEAD\0symref=HEAD:refs/heads/other\n') +
      packet('3'.repeat(40) + ' refs/heads/中文分支\n') +
      packet('1'.repeat(40) + ' refs/heads/main\n') +
      '0000'
    expect(gitMainRevision(new TextEncoder().encode(text))).toBe('1'.repeat(40))
    expect(() =>
      gitMainRevision(new TextEncoder().encode(header + 'ffffincomplete')),
    ).toThrow('INVALID_GIT_REFERENCE')
    expect(() =>
      gitMainRevision(
        new TextEncoder().encode(
          header + packet('1'.repeat(40) + ' refs/heads/main-other\n') + '0000',
        ),
      ),
    ).toThrow('MAIN_REFERENCE_NOT_FOUND')
  })
  it('validates the entire real graph, rejects duplicates, dangling references and cycles', () => {
    expect(validateCatalog(catalog).topics).toHaveLength(1591)
    expect(() =>
      validateCatalog({
        ...catalog,
        topics: [...catalog.topics, catalog.topics[0]],
      }),
    ).toThrow('DUPLICATE_TOPIC')
    expect(() =>
      validateCatalog({
        version: 'test',
        topics: [topic('mt_a'), topic('mt_b')],
        dependencies: [edge('mt_a', 'mt_b'), edge('mt_b', 'mt_a')],
      }),
    ).toThrow('CYCLIC_DEPENDENCY')
    expect(() =>
      validateCatalog({
        version: 'test',
        topics: [topic('mt_a')],
        dependencies: [edge('mt_a', 'mt_missing')],
      }),
    ).toThrow()
  })
  it('keeps removed topic IDs and prerequisites available to historical goals and records', () => {
    const previous = {
      version: 'old',
      topics: [topic('mt_a'), topic('mt_b')],
      dependencies: [edge('mt_b', 'mt_a')],
    }
    const result = retainHistoricalTopics(
      { version: 'new', topics: [topic('mt_a')], dependencies: [] },
      previous,
    )
    expect(result.topics.find((item) => item.id === 'mt_b')?.retired).toBe(true)
    expect(result.dependencies).toEqual(previous.dependencies)
    expect(
      result.topics.find((item) => item.id === 'mt_a')?.retired,
    ).toBeUndefined()
  })
  it('rejects corrupted, oversized, and incomplete downloads before publishing them', async () => {
    const { response, bytes } = chunks('{"topics":[]}')
    expect(await verifiedBytes(response, integrity(bytes))).toEqual(bytes)
    await expect(
      verifiedBytes(new Response('bad'), integrity(bytes)),
    ).rejects.toThrow('CHECKSUM_MISMATCH')
    await expect(
      verifiedBytes(new Response(bytes), {
        ...integrity(bytes),
        sha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('CHECKSUM_MISMATCH')
    await expect(limitedText(new Response('12345'), 4)).rejects.toThrow(
      'FILE_TOO_LARGE',
    )
  })
  it('streams research records across split UTF-8 chunks without buffering the whole dataset', async () => {
    const records = [
      { topicId: 'mt_a', learn: { summary: '体积与容量' } },
      { topicId: 'mt_b', learn: { summary: '单位换算' } },
    ]
    const { response, bytes } = chunks(
      JSON.stringify({ records, metadata: 'ignored' }),
    )
    const written: unknown[] = []
    const ids = await streamResearch(
      response,
      integrity(bytes),
      new Set(['mt_a', 'mt_b']),
      async (record) => {
        written.push(record)
      },
    )
    expect(ids).toEqual(['mt_a', 'mt_b'])
    expect(written).toEqual(records)
    const duplicate = chunks(
      JSON.stringify({ records: [records[0], records[0]] }),
    )
    await expect(
      streamResearch(
        duplicate.response,
        integrity(duplicate.bytes),
        new Set(['mt_a']),
        async () => {},
      ),
    ).rejects.toThrow()
    const truncated = chunks('{"records":[{"topicId":"mt_a"}')
    await expect(
      streamResearch(
        truncated.response,
        integrity(truncated.bytes),
        new Set(['mt_a']),
        async () => {},
      ),
    ).rejects.toThrow('INVALID_RESEARCH_JSON')
  })
})
