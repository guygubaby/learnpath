import assert from 'node:assert/strict'
import { access, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

let exists = false
try {
  await access('.env.production')
  exists = true
} catch {}
assert(
  !exists,
  '.env.production already exists; keep its encryption and session secrets unchanged',
)
await writeFile(
  '.env.production',
  `APP_URL=\nCLOUDFLARE_D1_DATABASE_ID=\nTAXONOMY_OWNER_ID=\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nAPP_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`,
  { mode: 0o600, flag: 'wx' },
)
process.stdout.write(
  'Production secrets created in ignored .env.production. Fill APP_URL and CLOUDFLARE_D1_DATABASE_ID before deploying.\n',
)
