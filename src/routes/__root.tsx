import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/app-shell'
import styles from '@/styles.css?url'
import { I18nextProvider } from 'react-i18next'
import type { i18n } from 'i18next'
import { LocaleDocument } from '@/lib/i18n'
import { initialLocale } from '@/lib/initial-locale'
import { translateText } from '@/lib/i18n-core'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  i18n: i18n
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: translateText('学径 · 让每一步学习都有方向', initialLocale()) },
      {
        name: 'description',
        content: translateText(
          '从知识之间的连接出发，探索、理解、练习，让每一步学习都有方向。',
          initialLocale(),
        ),
      },
      { name: 'theme-color', content: '#7161c8' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: Document,
  component: Root,
  notFoundComponent: () => (
    <div className="p-12">
      <h1 className="text-2xl font-semibold">
        {translateText('这条小径还没有开通', initialLocale())}
      </h1>
      <a className="mt-4 inline-block text-primary underline" href="/">
        {translateText('回到学习概览', initialLocale())}
      </a>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="p-12">
      <h1 className="text-2xl font-semibold">
        {translateText('暂时无法打开页面', initialLocale())}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {translateText(
          '请检查连接后重试。学习记录仍保存在账号中。',
          initialLocale(),
        )}
      </p>
      <button className="mt-4 text-primary underline" onClick={reset}>
        {translateText('重新加载', initialLocale())}
      </button>
    </div>
  ),
})

function Root() {
  const { queryClient, i18n } = Route.useRouteContext()
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleDocument />
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <Outlet />
        </AppShell>
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

function Document({ children }: { children: React.ReactNode }) {
  const { i18n } = Route.useRouteContext()
  return (
    <html lang={i18n.language}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
