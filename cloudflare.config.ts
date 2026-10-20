import { bindings, defineConfig, triggers } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'learnpath',
    entrypoint: './src/server.ts',
    compatibilityDate: '2026-10-20',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    domains: ['learnpath.guygubaby.top'],
    triggers: [triggers.scheduled({ schedule: '0 16 * * *' })],
    observability: {
      enabled: true,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
    env: {
      DB: bindings.d1({
        name: 'learnpath-db',
        id: process.env.CLOUDFLARE_D1_DATABASE_ID,
      }),
      ASSETS: bindings.assets(),
      REPORTS: bindings.r2({ name: 'learnpath-reports' }),
      TAXONOMY: bindings.r2({ name: 'learnpath-taxonomy' }),
      TAXONOMY_OWNER_ID: bindings.text(process.env.TAXONOMY_OWNER_ID ?? ''),
      API_RATE_LIMITER: bindings.rateLimit({
        namespace: '1001',
        simple: { limit: 120, period: 60 },
      }),
      AI_RATE_LIMITER: bindings.rateLimit({
        namespace: '1002',
        simple: { limit: 12, period: 60 },
      }),
      BETTER_AUTH_SECRET: bindings.secret(),
      APP_ENCRYPTION_KEY: bindings.secret(),
      APP_URL: bindings.text(process.env.APP_URL ?? 'http://127.0.0.1:3000'),
    },
  },
})
