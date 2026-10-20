import { env } from 'cloudflare:workers'
import { z } from 'zod'
import rawCatalog from '../../public/data/catalog.json'
import bundledSource from '@/data/source.json'
import {
  catalogSchema,
  researchSchema,
  topicTranslationSchema,
  type Catalog,
} from '@/lib/contracts'
import { createGraph } from '@/lib/graph'
import { HttpError } from './http'

export type TaxonomyState = {
  revision: string | null
  checked_revision: string | null
  status: string
  last_attempt: string | null
  last_success: string | null
  error_code: string | null
}
export async function taxonomyState() {
  return env.DB.prepare(
    'SELECT revision,checked_revision,status,last_attempt,last_success,error_code FROM taxonomy_state WHERE id=1',
  ).first<TaxonomyState>()
}
let cached:
  | {
      revision: string
      catalog: Catalog
      graph: ReturnType<typeof createGraph>
    }
  | undefined

export async function getTaxonomy() {
  const state = await taxonomyState()
  const revision = state?.revision ?? 'bundled'
  if (cached?.revision === revision) return cached
  let catalog: Catalog
  let cacheable = true
  if (revision === 'bundled') {
    const response = await env.ASSETS.fetch(
      new Request(new URL('/data/locales/zh-CN.json', env.APP_URL)),
    )
    const translations =
      response.ok &&
      response.headers.get('content-type')?.includes('application/json')
        ? z
            .object({
              translations: z.record(z.string(), topicTranslationSchema),
            })
            .parse(await response.json()).translations
        : {}
    cacheable = Object.keys(translations).length === rawCatalog.topics.length
    catalog = catalogSchema.parse({
      ...rawCatalog,
      source: { ...bundledSource, researchRevision: 'bundled' },
      topics: rawCatalog.topics.map((topic) => ({
        ...topic,
        ...(translations[topic.id]
          ? { translations: { 'zh-CN': translations[topic.id] } }
          : {}),
      })),
    })
  } else {
    const object = await env.TAXONOMY.get(`snapshots/${revision}/catalog.json`)
    if (!object)
      throw new HttpError(503, 'TAXONOMY_UNAVAILABLE', '知识图谱暂时无法加载')
    catalog = catalogSchema.parse(await object.json())
  }
  // Cache plain, immutable public data only; never share in-flight I/O between Worker requests.
  const snapshot = { revision, catalog, graph: createGraph(catalog) }
  if (cacheable) cached = snapshot
  return snapshot
}
export async function getTopic(id: string) {
  const { graph } = await getTaxonomy()
  const topic = graph.byId.get(id)
  if (!topic) throw new HttpError(404, 'TOPIC_NOT_FOUND', '未找到这个知识点')
  return topic
}
export async function getResearch(
  topicId: string,
  snapshot?: Awaited<ReturnType<typeof getTaxonomy>>,
) {
  const { catalog, graph } = snapshot ?? (await getTaxonomy())
  const topic = graph.byId.get(topicId)
  if (!topic) throw new HttpError(404, 'TOPIC_NOT_FOUND', '未找到这个知识点')
  const revision = catalog.source?.researchRevision ?? 'bundled'
  if (revision !== 'bundled' && !topic.retired) {
    const record = await env.TAXONOMY.get(
      `research/${revision}/${topicId}.json`,
    )
    return record ? researchSchema.parse(await record.json()) : null
  }
  const response = await env.ASSETS.fetch(
    new Request(new URL(`/data/research/${topicId}.json`, env.APP_URL)),
  )
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    return null
  return researchSchema.parse(await response.json())
}
