import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'

it('deploys a prebuilt Worker in CI without duplicating its existing runtime secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'learnpath-ci-check-'))
  const log = join(directory, 'calls.txt')
  try {
    await writeFile(
      join(directory, 'pnpm'),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DEPLOY_TEST_LOG"\n',
      { mode: 0o700 },
    )
    const env = {
      ...process.env,
      PATH: directory + ':' + process.env.PATH,
      DEPLOY_TEST_LOG: log,
      APP_URL: 'https://learning.example.test',
      CLOUDFLARE_D1_DATABASE_ID: '00000000-0000-4000-8000-000000000000',
      BETTER_AUTH_SECRET: '',
      APP_ENCRYPTION_KEY: '',
    }
    const script = fileURLToPath(
      new URL('../scripts/deploy.mjs', import.meta.url),
    )
    execFileSync(process.execPath, [script, '--ci'], { cwd: directory, env })
    expect((await readFile(log, 'utf8')).trim().split('\n')).toEqual([
      'db:remote',
      'exec cf deploy --prebuilt',
    ])
    await writeFile(log, '')
    expect(() =>
      execFileSync(process.execPath, [script, '--ci'], {
        cwd: directory,
        env: { ...env, APP_URL: 'http://localhost' },
        stdio: 'pipe',
      }),
    ).toThrow()
    expect(await readFile(log, 'utf8')).toBe('')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
