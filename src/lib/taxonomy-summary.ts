import { counts } from '../../public/data/manifest.json'
import type { Catalog } from './contracts'

export const bundledTaxonomySummary = {
  topics: counts.topics,
  dependencies: counts.dependencies,
  subjects: Object.keys(counts.topicsBySubject).length,
}

export function taxonomySummary(catalog: Catalog) {
  const topics = catalog.topics.filter((topic) => !topic.retired)
  const ids = new Set(topics.map((topic) => topic.id))
  return {
    topics: topics.length,
    dependencies: catalog.dependencies.filter(
      (edge) => ids.has(edge.topicId) && ids.has(edge.prerequisiteId),
    ).length,
    subjects: new Set(topics.map((topic) => topic.subject)).size,
  }
}
