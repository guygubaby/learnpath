import { access, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'

try {
  await access('.dev.vars')
  process.stdout.write('Existing development secrets retained.\n')
} catch {
  await writeFile(
    '.dev.vars',
    `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nAPP_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\nAPP_URL=http://127.0.0.1:3000\n`,
    { mode: 0o600, flag: 'wx' },
  )
  process.stdout.write(
    'Development secrets created in ignored .dev.vars; values not displayed.\n',
  )
}
execFileSync('pnpm', ['exec', 'cf', 'workers', 'types'], { stdio: 'inherit' })
process.stdout.write('Run pnpm dev, then pnpm db:local in another terminal.\n')
