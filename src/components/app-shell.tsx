import { useI18n } from '@/lib/i18n'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChartNoAxesCombined,
  CircleHelp,
  Compass,
  House,
  LogOut,
  Map,
  Orbit,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Languages,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { localDate } from '@/lib/learning'
import { useLearning } from '@/lib/queries'
import { useUi } from '@/lib/store'
import { Button, cn } from './ui/button'
import { Select } from './ui/select'
import { AuthDialog, ProfileDialog } from './account-forms'

const navigation = [
  { to: '/app', label: '学习概览', icon: House },
  { to: '/map', label: '知识地图', icon: Map },
  { to: '/plan', label: '学习计划', icon: Compass },
  { to: '/review', label: '练习与复习', icon: RotateCcw },
  { to: '/reports', label: '学习报告', icon: ChartNoAxesCombined },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useI18n()

  const path = useRouterState({ select: (state) => state.location.pathname })
  const { session, profiles, profile, workspace } = useLearning()
  const setAuthOpen = useUi((state) => state.setAuthOpen)
  const setProfileOpen = useUi((state) => state.setProfileOpen)
  const selectChild = useUi((state) => state.selectChild)
  const queryClient = useQueryClient()
  const today = localDate()
  const dueCount =
    workspace.data?.reviews.filter(
      (item) => new Date(item.dueAt).getTime() <= Date.now(),
    ).length ?? 0
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary p-3 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('跳到主要内容')}
      </a>
      <aside
        data-no-print
        className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r bg-card px-5 py-8 lg:flex"
      >
        <Link to="/" className="mb-10 flex items-center gap-3 px-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <Orbit className="size-6" />
          </span>
          <span className="text-xl font-bold tracking-wider">{t('学径')}</span>
        </Link>
        <p className="mb-3 px-4 text-xs text-muted-foreground">
          {t('一起，把好奇变成成长')}
        </p>
        <nav aria-label={t('主要导航')} className="space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm transition-colors',
                path === item.to
                  ? 'bg-primary-soft font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4.5" />
              {t(item.label)}
              {item.to === '/review' && dueCount > 0 && (
                <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {dueCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-10">
          <div className="mb-5 rounded-xl bg-primary-soft/65 p-4">
            <Sparkles className="mb-2 size-5 text-primary" />
            <p className="text-sm font-medium">{t('跟着理解的节奏走')}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {t('每一个小小的发现，都在连接更大的世界。')}
            </p>
          </div>
          <Link
            to="/settings"
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm',
              path === '/settings'
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Settings2 className="size-4" />
            {t('AI 与账号设置')}
          </Link>
          <Link
            to="/about"
            className="flex min-h-11 items-center gap-3 px-4 text-sm text-muted-foreground hover:text-primary"
          >
            <CircleHelp className="size-4" />
            {t('数据与使用说明')}
          </Link>
        </div>
      </aside>
      <div className="lg:ml-sidebar">
        <header
          data-no-print
          className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur-sm"
        >
          <div className="mx-auto flex min-h-20 max-w-screen-2xl items-center justify-between gap-3 px-5 sm:px-8 xl:px-10">
            <div className="flex shrink-0 items-center gap-3">
              <Link
                to="/"
                aria-label={t('学径首页')}
                className="flex items-center gap-2 font-semibold lg:hidden"
              >
                <Orbit className="size-7 text-primary" />
                <span className="hidden sm:inline">{t('学径')}</span>
              </Link>
              <span className="hidden text-sm text-muted-foreground lg:inline">
                {t('学习空间')}
                <span className="mx-3 text-border">/</span>
                <span className="text-foreground">
                  {t(
                    navigation.find((item) => item.to === path)?.label ??
                      (path === '/learn'
                        ? t('一起学习')
                        : path === '/settings'
                          ? t('AI 与账号设置')
                          : t('关于学径')),
                  )}
                </span>
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-5">
              <Select
                aria-label={t('切换语言')}
                value={locale}
                onValueChange={(value) =>
                  void setLocale(value === 'en' ? 'en' : 'zh-CN')
                }
                options={[
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'en', label: 'English' },
                ]}
                icon={
                  <Languages
                    className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                    aria-hidden="true"
                  />
                }
                className="min-h-11 max-w-28 text-xs sm:max-w-none"
              />
              <span className="hidden text-xs text-muted-foreground xl:inline">
                {today.format(t('M 月 D 日'))}
                {locale === 'en' ? ', ' : '，'}
                {
                  [
                    t('星期日'),
                    t('星期一'),
                    t('星期二'),
                    t('星期三'),
                    t('星期四'),
                    t('星期五'),
                    t('星期六'),
                  ][today.day()]
                }
              </span>
              {session.data ? (
                <>
                  <Select
                    aria-label={t('当前学习档案')}
                    value={profile?.id ?? ''}
                    placeholder={t('创建学习档案')}
                    onValueChange={(value) =>
                      value === '__new'
                        ? setProfileOpen(true)
                        : selectChild(value)
                    }
                    options={[
                      ...(profiles.data ?? []).map((item) => ({
                        value: item.id,
                        label: t('{{v0}} · {{v1}} 岁', {
                          v0: item.nickname,
                          v1: item.age,
                        }),
                      })),
                      { value: '__new', label: t('＋ 新建学习档案') },
                    ]}
                    icon={
                      <span className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary sm:flex">
                        {profile?.nickname.slice(0, 1) ?? t('学')}
                      </span>
                    }
                    className="min-h-11 max-w-32 bg-muted/65 px-2.5 font-medium sm:max-w-44"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('退出登录')}
                    title={t('退出登录')}
                    onClick={async () => {
                      await authClient.signOut()
                      queryClient.clear()
                      selectChild(null)
                    }}
                  >
                    <LogOut />
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setAuthOpen(true)}>
                  {t('登录 / 注册')}
                </Button>
              )}
            </div>
          </div>
          <nav
            aria-label={t('移动导航')}
            className="flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden"
          >
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs',
                  path === item.to
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-4" />
                {t(item.label)}
              </Link>
            ))}
            <Link
              to="/settings"
              className="flex shrink-0 items-center gap-2 px-3 text-xs text-muted-foreground"
            >
              <Settings2 className="size-4" />
              {t('设置')}
            </Link>
          </nav>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-screen-2xl px-5 py-7 sm:px-8 sm:py-9 xl:px-10"
        >
          {children}
        </main>
        <footer
          data-no-print
          className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:px-8 xl:px-10"
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3.5" />
            {t('学径，让每一步学习都有方向。')}
          </span>
          <Link to="/about" className="hover:text-primary">
            {t('基于 Marble Skill Taxonomy · 来源与许可')}
          </Link>
        </footer>
      </div>
      <AuthDialog />
      <ProfileDialog />
    </div>
  )
}
