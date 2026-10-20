import { betterAuth } from 'better-auth'
import { env } from 'cloudflare:workers'
import { HttpError } from './http'

export function getAuth() {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new HttpError(
      503,
      'AUTH_NOT_CONFIGURED',
      '登录服务尚未配置，请设置 BETTER_AUTH_SECRET',
    )
  return betterAuth({
    appName: '学径',
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    user: { deleteUser: { enabled: true } },
    databaseHooks: {
      user: {
        delete: {
          before: async (user) => {
            const files = await env.DB.prepare(
              'SELECT object_key FROM exports WHERE user_id=?',
            )
              .bind(user.id)
              .all<{ object_key: string }>()
            for (
              let offset = 0;
              offset < files.results.length;
              offset += 1000
            ) {
              await env.REPORTS.delete(
                files.results
                  .slice(offset, offset + 1000)
                  .map((file) => file.object_key),
              )
            }
          },
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    advanced: {
      cookiePrefix: 'learnpath',
      useSecureCookies: env.APP_URL.startsWith('https:'),
    },
    logger: { level: 'error', disabled: true },
  })
}
