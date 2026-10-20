import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = 'withmarbleapp/os-taxonomy'
const sourcePath = resolve(root, 'src/data/source.json')
const cache = resolve(root, '.data/upstream')
let source
try {
  source = JSON.parse(await readFile(sourcePath, 'utf8'))
} catch {}
if (!source || process.argv.includes('--refresh')) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/commits/main`,
  )
  assert(response.ok, `Unable to resolve source revision: ${response.status}`)
  source = {
    repository: `https://github.com/${repo}`,
    commit: (await response.json()).sha,
  }
}
async function save(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value)
}
await mkdir(cache, { recursive: true })
const archive = resolve(root, '.data/taxonomy.tar.gz')
execFileSync(
  'curl',
  [
    '--fail',
    '--location',
    '--retry',
    '2',
    '--connect-timeout',
    '15',
    '--max-time',
    '120',
    '--silent',
    '--show-error',
    '--output',
    archive,
    `https://codeload.github.com/${repo}/tar.gz/${source.commit}`,
  ],
  { stdio: 'inherit' },
)
execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', cache])
const manifestBytes = await readFile(resolve(cache, 'data/manifest.json'))
const manifest = JSON.parse(manifestBytes)
const files = new Map()
await Promise.all(
  Object.entries(manifest.files).map(async ([name, meta]) => {
    const bytes = await readFile(resolve(cache, 'data', name))
    assert.equal(bytes.length, meta.bytes, `${name}: byte count mismatch`)
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      meta.sha256,
      `${name}: checksum mismatch`,
    )
    files.set(name, JSON.parse(bytes))
    await save(resolve(cache, 'data', name), bytes)
  }),
)
execFileSync(process.execPath, [resolve(cache, 'scripts/validate.mjs')], {
  stdio: 'inherit',
})

const topics = files.get('topics.json').topics
const dependencies = files.get('dependencies.json').dependencies
const ids = new Set(topics.map((topic) => topic.id))
assert.equal(ids.size, topics.length, 'Duplicate topic ids')
const degree = new Map([...ids].map((id) => [id, 0]))
const next = new Map([...ids].map((id) => [id, []]))
for (const edge of dependencies) {
  assert(
    ids.has(edge.topicId) && ids.has(edge.prerequisiteId),
    'Dangling prerequisite',
  )
  degree.set(edge.topicId, degree.get(edge.topicId) + 1)
  next.get(edge.prerequisiteId).push(edge.topicId)
}
const queue = [...ids].filter((id) => degree.get(id) === 0)
let visited = 0
for (let index = 0; index < queue.length; index++) {
  visited++
  for (const id of next.get(queue[index])) {
    degree.set(id, degree.get(id) - 1)
    if (degree.get(id) === 0) queue.push(id)
  }
}
assert.equal(visited, ids.size, 'Prerequisite graph must be acyclic')

const catalog = { version: manifest.taxonomyVersion, topics, dependencies }
await save(resolve(root, 'public/data/catalog.json'), JSON.stringify(catalog))
await save(
  resolve(root, 'public/data/manifest.json'),
  JSON.stringify(manifest, null, 2),
)
await save(
  resolve(root, 'public/data/clusters.json'),
  JSON.stringify(files.get('clusters.json')),
)
const research = files.get('teaching-research.json')
await Promise.all(
  research.records.map((record) =>
    save(
      resolve(root, 'public/data/research', `${record.topicId}.json`),
      JSON.stringify(record),
    ),
  ),
)
const curricula = files.get('curriculum-standards.json').curricula
await save(
  resolve(root, 'public/data/standards.json'),
  JSON.stringify(
    curricula.map((curriculum) => ({
      slug: curriculum.slug,
      name: curriculum.name,
      topics: curriculum.topics.map((topic) => ({
        key: topic.key,
        code: topic.code,
      })),
    })),
  ),
)
await save(
  sourcePath,
  JSON.stringify(
    {
      ...source,
      taxonomyVersion: manifest.taxonomyVersion,
      generatedAt: manifest.generatedAt,
      topics: topics.length,
      dependencies: dependencies.length,
      research: research.records.length,
    },
    null,
    2,
  ) + '\n',
)
for (const name of [
  'LICENSE',
  'LICENSE-CONTENT',
  'PROVENANCE.md',
  'CITATION.cff',
]) {
  await save(
    resolve(root, 'public/licenses', name),
    await readFile(resolve(cache, name)),
  )
}
process.stdout.write(
  `Imported ${topics.length} topics, ${dependencies.length} dependencies and ${research.records.length} research records at ${source.commit.slice(0, 12)}.\n`,
)
