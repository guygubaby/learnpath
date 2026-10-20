import { env } from 'cloudflare:workers'
import { z } from 'zod'
import {
  catalogSchema,
  topicTranslationSchema,
  type TopicTranslation,
} from '@/lib/contracts'
import {
  limitedText,
  limitedBytes,
  gitMainRevision,
  manifestSchema,
  retainHistoricalTopics,
  streamResearch,
  SyncError,
  upstreamFiles,
  validateCatalog,
  verifiedBytes,
} from '@/lib/taxonomy-sync'
import { languageModel } from './ai'
import { logger } from './http'
import { getTaxonomy, taxonomyState } from './taxonomy'
import { topicFingerprint, translateTopics } from './translation'

const repository = 'withmarbleapp/os-taxonomy'
const jsonOptions = {
  httpMetadata: { contentType: 'application/json; charset=utf-8' },
}

export async function syncTaxonomy(force = false) {
  const lease = crypto.randomUUID()
  const now = new Date().toISOString()
  const claimed = await env.DB.prepare(
    "UPDATE taxonomy_state SET status='running',last_attempt=?,error_code=NULL,lease_id=?,lease_until=? WHERE id=1 AND (lease_until IS NULL OR lease_until<?) RETURNING id",
  )
    .bind(now, lease, new Date(Date.now() + 16 * 60_000).toISOString(), now)
    .first()
  if (!claimed) return { status: 'running' }
  const deadline = AbortSignal.timeout(14 * 60_000)
  const fetchSource = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Xuejing-taxonomy-sync/0.1',
        Accept: '*/*',
      },
      signal: deadline,
      redirect: 'manual',
    })
    if (!response.ok) {
      logger.warn(
        { resource: new URL(url).pathname, status: response.status },
        'Public taxonomy source returned an error',
      )
      throw new SyncError(`UPSTREAM_HTTP_${response.status}`)
    }
    return response
  }
  try {
    // Read the public Git reference directly; the shared edge IP can exhaust GitHub's unauthenticated REST quota.
    const refs = await fetchSource(
      `https://github.com/${repository}.git/info/refs?service=git-upload-pack`,
    )
    const sha = gitMainRevision(await limitedBytes(refs, 1024 * 1024))
    const snapshotId = `${sha}-${lease}`
    const state = await taxonomyState()
    const previous = await getTaxonomy()
    if (
      !force &&
      sha === (state?.checked_revision ?? previous.catalog.source?.commit)
    ) {
      await env.DB.prepare(
        "UPDATE taxonomy_state SET status='unchanged',checked_revision=?,last_success=?,lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?",
      )
        .bind(sha, new Date().toISOString(), lease)
        .run()
      return { status: 'unchanged', revision: sha }
    }
    const rawUrl = (name: string) =>
      `https://raw.githubusercontent.com/${repository}/${sha}/${name}`
    const manifestResponse = await fetchSource(rawUrl('data/manifest.json'))
    if (!manifestResponse.ok) throw new SyncError('UPSTREAM_UNAVAILABLE')
    // The manifest is small; larger data files have explicit byte limits and checksums below.
    const manifestText = await limitedText(manifestResponse, 512_000)
    const manifest = manifestSchema.parse(JSON.parse(manifestText))
    const files = new Map<string, unknown>()
    for (const name of upstreamFiles.filter(
      (name) => name !== 'teaching-research.json',
    )) {
      deadline.throwIfAborted()
      const bytes = await verifiedBytes(
        await fetchSource(rawUrl(`data/${name}`)),
        manifest.files[name],
      )
      files.set(name, JSON.parse(new TextDecoder().decode(bytes)))
      await env.TAXONOMY.put(
        `snapshots/${snapshotId}/data/${name}`,
        bytes,
        jsonOptions,
      )
    }
    const topicsFile = z
      .object({ topics: catalogSchema.shape.topics })
      .parse(files.get('topics.json'))
    const dependenciesFile = z
      .object({ dependencies: catalogSchema.shape.dependencies })
      .parse(files.get('dependencies.json'))
    const current = validateCatalog({
      version: manifest.taxonomyVersion,
      ...topicsFile,
      ...dependenciesFile,
    })
    if (
      current.topics.length !== manifest.counts.topics ||
      current.dependencies.length !== manifest.counts.dependencies
    )
      throw new SyncError('CATALOG_COUNT_MISMATCH')
    z.object({
      curricula: z.array(
        z
          .object({
            slug: z.string(),
            name: z.string(),
            topics: z.array(z.object({ key: z.string() }).passthrough()),
          })
          .passthrough(),
      ),
    }).parse(files.get('curriculum-standards.json'))
    z.object({
      clusters: z.array(
        z
          .object({
            subject: z.string(),
            domain: z.string().nullable(),
            summary: z.string(),
          })
          .passthrough(),
      ),
    }).parse(files.get('clusters.json'))

    const translations = new Map<string, TopicTranslation>()
    for (const topic of previous.catalog.topics) {
      const translated = topic.translations?.['zh-CN']
      if (translated) translations.set(translated.sourceHash, translated)
    }
    const missing = []
    for (const topic of current.topics) {
      const hash = topicFingerprint(topic)
      let translated = translations.get(hash)
      if (!translated) {
        const cached = await env.TAXONOMY.get(`translations/zh-CN/${hash}.json`)
        if (cached)
          translated = topicTranslationSchema.parse(await cached.json())
      }
      if (translated?.sourceHash === hash)
        topic.translations = { 'zh-CN': translated }
      else missing.push(topic)
    }
    if (missing.length) {
      if (!env.TAXONOMY_OWNER_ID)
        throw new SyncError('TRANSLATION_PROVIDER_REQUIRED')
      const model = await languageModel(
        env.TAXONOMY_OWNER_ID,
        'taxonomy-translation',
      )
      for (let offset = 0; offset < missing.length; offset += 6) {
        deadline.throwIfAborted()
        const batch = missing.slice(offset, offset + 6)
        const translated = await translateTopics(batch, model, deadline)
        for (const topic of batch) {
          const value = translated[topic.id]
          topic.translations = { 'zh-CN': value }
          await env.TAXONOMY.put(
            `translations/zh-CN/${value.sourceHash}.json`,
            JSON.stringify(value),
            jsonOptions,
          )
        }
      }
    }

    const researchIntegrity = manifest.files['teaching-research.json']
    const topicIds = new Set(current.topics.map((topic) => topic.id))
    const researchRevision = researchIntegrity.sha256
    const marker = await env.TAXONOMY.get(
      `research/${researchRevision}/complete.json`,
    )
    const ready = marker
      ? z
          .object({
            count: z.number(),
            sha256: z.string(),
            ids: z.array(z.string()),
          })
          .parse(await marker.json())
      : null
    if (
      ready &&
      (ready.ids.length !== ready.count ||
        new Set(ready.ids).size !== ready.count ||
        ready.ids.some((id) => !topicIds.has(id)))
    )
      throw new SyncError('INVALID_RESEARCH_REFERENCE')
    if (
      ready?.sha256 !== researchRevision ||
      ready.count !== manifest.counts.teachingResearch
    ) {
      const ids = await streamResearch(
        await fetchSource(rawUrl('data/teaching-research.json')),
        researchIntegrity,
        topicIds,
        (record) =>
          env.TAXONOMY.put(
            `research/${researchRevision}/${record.topicId}.json`,
            JSON.stringify(record),
            jsonOptions,
          ),
      )
      if (ids.length !== manifest.counts.teachingResearch)
        throw new SyncError('RESEARCH_COUNT_MISMATCH')
      await env.TAXONOMY.put(
        `research/${researchRevision}/complete.json`,
        JSON.stringify({ count: ids.length, sha256: researchRevision, ids }),
        jsonOptions,
      )
    }
    for (const name of [
      'LICENSE',
      'LICENSE-CONTENT',
      'PROVENANCE.md',
      'CITATION.cff',
    ]) {
      const license = await fetchSource(rawUrl(name))
      if (!license.ok) throw new SyncError('LICENSE_UNAVAILABLE')
      const text = await limitedText(license, 256_000)
      await env.TAXONOMY.put(`snapshots/${snapshotId}/licenses/${name}`, text)
    }
    const syncedAt = new Date().toISOString()
    current.source = {
      repository: `https://github.com/${repository}`,
      commit: sha,
      taxonomyVersion: manifest.taxonomyVersion,
      generatedAt: manifest.generatedAt,
      topics: current.topics.length,
      dependencies: current.dependencies.length,
      research: manifest.counts.teachingResearch,
      syncedAt,
      researchRevision,
    }
    const catalog = retainHistoricalTopics(current, previous.catalog)
    await env.TAXONOMY.put(
      `snapshots/${snapshotId}/manifest.json`,
      JSON.stringify(manifest),
      jsonOptions,
    )
    await env.TAXONOMY.put(
      `snapshots/${snapshotId}/catalog.json`,
      JSON.stringify(catalog),
      jsonOptions,
    )
    deadline.throwIfAborted()
    // Publish only a complete, validated snapshot, and only while this run still owns the lease.
    const result = await env.DB.prepare(
      "UPDATE taxonomy_state SET revision=?,checked_revision=?,status='success',last_success=?,error_code=NULL,lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?",
    )
      .bind(snapshotId, sha, syncedAt, lease)
      .run()
    if (!result.meta.changes) throw new SyncError('LEASE_EXPIRED')
    logger.info(
      {
        revision: sha,
        topics: current.topics.length,
        translations: missing.length,
      },
      'Taxonomy synchronized',
    )
    return { status: 'success', revision: sha }
  } catch (error) {
    const code =
      error instanceof SyncError
        ? error.code
        : deadline.aborted
          ? 'SYNC_TIMEOUT'
          : error instanceof z.ZodError
            ? 'INVALID_UPSTREAM_DATA'
            : error instanceof Error &&
                /too many (subrequests|api requests)/i.test(error.message)
              ? 'SUBREQUEST_LIMIT'
              : error instanceof Error &&
                  ['AbortError', 'TimeoutError'].includes(error.name)
                ? 'UPSTREAM_TIMEOUT'
                : 'SYNC_FAILED'
    await env.DB.prepare(
      "UPDATE taxonomy_state SET status='failed',error_code=?,lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?",
    )
      .bind(code, lease)
      .run()
    logger.error(
      { code, errorType: error instanceof Error ? error.name : 'Unknown' },
      'Taxonomy synchronization failed; current snapshot retained',
    )
    throw new SyncError(code)
  }
}
