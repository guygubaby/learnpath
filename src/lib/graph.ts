import type { Catalog, Dependency, Progress, Topic } from './contracts'

export function createGraph(catalog: Catalog) {
  const byId = new Map(catalog.topics.map((topic) => [topic.id, topic]))
  const prerequisites = new Map<string, Dependency[]>()
  const unlocked = new Map<string, Dependency[]>()
  for (const edge of catalog.dependencies) {
    if (!byId.has(edge.topicId) || !byId.has(edge.prerequisiteId))
      throw new Error('知识图谱包含无效引用')
    prerequisites.set(edge.topicId, [
      ...(prerequisites.get(edge.topicId) ?? []),
      edge,
    ])
    unlocked.set(edge.prerequisiteId, [
      ...(unlocked.get(edge.prerequisiteId) ?? []),
      edge,
    ])
  }
  return { byId, prerequisites, unlocked }
}
export type Graph = ReturnType<typeof createGraph>

export function localGraphPositions(
  ids: string[],
  prerequisiteIds: Set<string>,
  selectedId: string,
  width: number,
  height: number,
) {
  const positions: Record<string, { x: number; y: number }> = {
    [selectedId]: { x: width / 2, y: height / 2 },
  }
  const columns = Math.max(1, Math.min(4, Math.floor((width - 40) / 110)))
  function place(group: string[], top: number, bottom: number) {
    const rowCount = Math.ceil(group.length / columns)
    group.forEach((id, index) => {
      const row = Math.floor(index / columns)
      const inRow = Math.min(columns, group.length - row * columns)
      positions[id] = {
        x: (((index % columns) + 1) * width) / (inRow + 1),
        y: top + ((row + 0.5) * (bottom - top)) / rowCount,
      }
    })
  }
  place(
    ids.filter((id) => id !== selectedId && prerequisiteIds.has(id)),
    40,
    height / 2 - 80,
  )
  place(
    ids.filter((id) => id !== selectedId && !prerequisiteIds.has(id)),
    height / 2 + 80,
    height - 60,
  )
  return positions
}

export function prerequisitePath(
  graph: Graph,
  targetId: string,
  progress: Progress[] = [],
) {
  if (!graph.byId.has(targetId)) throw new Error('知识点不存在')
  const mastered = new Set(
    progress
      .filter((item) => item.status === 'mastered')
      .map((item) => item.topicId),
  )
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const result: Topic[] = []
  function visit(id: string) {
    if (mastered.has(id) || visited.has(id)) return
    if (visiting.has(id)) throw new Error('知识图谱包含循环先修关系')
    visiting.add(id)
    for (const edge of graph.prerequisites.get(id) ?? []) {
      if (edge.strength === 'hard') visit(edge.prerequisiteId)
    }
    visiting.delete(id)
    visited.add(id)
    result.push(graph.byId.get(id)!)
  }
  visit(targetId)
  return result
}

export function isReady(graph: Graph, topicId: string, progress: Progress[]) {
  const mastered = new Set(
    progress
      .filter((item) => item.status === 'mastered')
      .map((item) => item.topicId),
  )
  return (graph.prerequisites.get(topicId) ?? [])
    .filter((edge) => edge.strength === 'hard')
    .every((edge) => mastered.has(edge.prerequisiteId))
}

export function neighborhood(graph: Graph, topicId: string, depth = 2) {
  const ids = new Set([topicId])
  let frontier = [topicId]
  for (let level = 0; level < depth; level++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const edge of [
        ...(graph.prerequisites.get(id) ?? []),
        ...(graph.unlocked.get(id) ?? []),
      ]) {
        for (const neighbor of [edge.topicId, edge.prerequisiteId]) {
          if (!ids.has(neighbor)) {
            ids.add(neighbor)
            next.push(neighbor)
          }
        }
      }
    }
    frontier = next
  }
  return ids
}
