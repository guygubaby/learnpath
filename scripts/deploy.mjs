import assert from 'node:assert/strict'
import { config } from 'dotenv'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

config({ path: '.env.production', quiet: true })
const origin = new URL(process.env.APP_URL ?? 'http://localhost')
assert(
  origin.protocol === 'https:' &&
    !origin.hostname.includes('your-subdomain') &&
    !origin.username &&
    !origin.password,
  'Set APP_URL to the actual public HTTPS origin',
)
assert(
  origin.pathname === '/' && !origin.search && !origin.hash,
  'APP_URL must be an origin, without a path or query',
)
assert(
  /^[0-9a-f-]{36}$/i.test(process.env.CLOUDFLARE_D1_DATABASE_ID ?? ''),
  'Set CLOUDFLARE_D1_DATABASE_ID',
)
assert(
  (process.env.BETTER_AUTH_SECRET ?? '').length >= 32,
  'Set a strong BETTER_AUTH_SECRET',
)
assert(
  Buffer.from(process.env.APP_ENCRYPTION_KEY ?? '', 'base64').length === 32,
  'Set APP_ENCRYPTION_KEY to Base64-encoded 32 random bytes',
)
const run = (args) =>
  execFileSync('pnpm', args, { stdio: 'inherit', env: process.env })
run(['exec', 'cf', 'workers', 'types'])
run(['check'])
run(['db:remote'])
const directory = await mkdtemp(join(tmpdir(), 'learnpath-secrets-'))
try {
  const path = join(directory, 'secrets.json')
  await writeFile(
    path,
    JSON.stringify({
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
    }),
    { mode: 0o600 },
  )
  run(['exec', 'cf', 'deploy', '--prebuilt', '--secrets-file', path])
} finally {
  await rm(directory, { recursive: true, force: true })
}
