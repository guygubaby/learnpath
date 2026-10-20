import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const remote = process.argv.includes('--remote')
assert(
  remote || process.argv.includes('--local'),
  'Specify --local or --remote',
)
const origin = process.env.LOCAL_APP_URL ?? 'http://127.0.0.1:3000'
let databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
if (!remote) {
  const response = await fetch(
    `${origin}/cdn-cgi/local/explorer/api/d1/database`,
  )
  assert(response.ok, 'Start pnpm dev before applying local migrations')
  const databases = (await response.json()).result
  databaseId = databases.find((item) => item.name === 'DB')?.uuid
}
assert(databaseId, 'Set CLOUDFLARE_D1_DATABASE_ID for the remote database')
async function query(batch) {
  if (!remote) {
    const response = await fetch(
      `${origin}/cdn-cgi/local/explorer/api/d1/database/${encodeURIComponent(databaseId)}/raw`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      },
    )
    const result = await response.json()
    assert(
      response.ok && result.success,
      JSON.stringify(result.errors ?? result),
    )
    return result.result
  }
  const temporary = await mkdtemp(join(tmpdir(), 'learnpath-migrate-'))
  try {
    const file = join(temporary, 'queries.json')
    await writeFile(file, JSON.stringify(batch))
    const output = execFileSync(
      'pnpm',
      ['exec', 'cf', 'd1', 'query', databaseId, '--batch', `@${file}`],
      { cwd: root, encoding: 'utf8' },
    )
    const result = JSON.parse(output)
    assert(result.success !== false, 'Cloudflare rejected the migration')
    return result.result ?? result
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
await query([
  {
    sql: 'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)',
    params: [],
  },
])
const result = await query([
  { sql: 'SELECT name,checksum FROM _migrations', params: [] },
])
const first = Array.isArray(result) ? result[0] : result
const rows = first.results?.rows ?? first.results ?? first.rows ?? []
const applied = new Map(
  rows.map((row) =>
    Array.isArray(row) ? [row[0], row[1]] : [row.name, row.checksum],
  ),
)
for (const name of (await readdir(resolve(root, 'migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const sql = await readFile(resolve(root, 'migrations', name), 'utf8')
  const checksum = createHash('sha256').update(sql).digest('hex')
  if (applied.has(name)) {
    assert.equal(
      applied.get(name),
      checksum,
      `Applied migration changed: ${name}`,
    )
    continue
  }
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((sql) => ({ sql, params: [] }))
  await query([
    ...statements,
    {
      sql: 'INSERT INTO _migrations (name,checksum,applied_at) VALUES (?,?,?)',
      params: [name, checksum, new Date().toISOString()],
    },
  ])
  process.stdout.write(`Applied ${name} (${remote ? 'remote' : 'local'}).\n`)
}
process.stdout.write('Database migrations are up to date.\n')
