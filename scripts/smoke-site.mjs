import assert from 'node:assert/strict'
const origin = process.env.APP_SMOKE_URL ?? 'http://127.0.0.1:3000'
for (const preference of [undefined, 'zh-CN', 'en']) {
  const locale = preference ?? 'zh-CN'
  const response = await fetch(new URL('/', origin), {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      ...(preference ? { Cookie: `xuejing.locale=${preference}` } : {}),
    },
  })
  assert.equal(response.status, 200, 'Homepage must be public')
  const html = await response.text()
  assert(html.includes('id="site-main"'), 'Expected the marketing homepage')
  assert(html.includes('href="/app"'), 'Expected a real workspace link')
  assert(
    !html.includes('aria-label="主要导航"'),
    'The homepage must not render the workspace sidebar',
  )
  assert(
    html.includes(locale === 'en' ? 'Small questions.' : '让每一份好奇，'),
    'Localized hero must be server rendered',
  )
  assert(
    html.includes(`lang="${locale}"`),
    'HTML language must match the preference',
  )
}
const workspace = await fetch(new URL('/app', origin))
assert.equal(workspace.status, 200, 'Workspace route must remain available')
const video = await fetch(new URL('/media/product-tour.mp4', origin), {
  headers: { Range: 'bytes=0-63' },
})
assert([200, 206].includes(video.status), 'Product tour must be available')
assert(
  video.headers.get('content-type')?.includes('video/'),
  'Expected video content',
)
await video.body?.cancel()
console.log(
  'Chinese default, explicit Chinese/English SSR, workspace entry and product video passed.',
)
