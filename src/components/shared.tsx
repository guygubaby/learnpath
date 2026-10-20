import { useI18n } from '@/lib/i18n'
import { ArrowRight, LoaderCircle, Sparkles, AlertCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { Topic } from '@/lib/contracts'
import { ageLabel, domainName, subjectMeta, topicName } from '@/lib/labels'
import { Button, cn } from './ui/button'
import { useUi } from '@/lib/store'
import { authClient } from '@/lib/auth-client'
import { translateText } from '@/lib/i18n-core'

export function Loading({ label = '正在加载' }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-5 animate-spin" />
      {t(label)}
    </div>
  )
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error
  retry?: () => void
}) {
  const { t, locale } = useI18n()

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-6"
    >
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="size-5" />
        {t('暂时无法加载')}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {translateText(error.message, locale)}
      </p>
      {retry && (
        <Button variant="outline" className="mt-4" onClick={retry}>
          {t('重新加载')}
        </Button>
      )}
    </div>
  )
}
export function SectionTitle({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-2xl border bg-card p-6 shadow-panel', className)}
    >
      {children}
    </section>
  )
}
export function TopicIcon({ topic, small }: { topic: Topic; small?: boolean }) {
  const meta = subjectMeta[topic.subject]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        small ? 'size-9' : 'size-12',
      )}
      style={{ background: meta.soft, color: meta.color }}
    >
      <Icon className={small ? 'size-4' : 'size-5'} />
    </span>
  )
}
export function TopicLink({
  topic,
  subtitle = true,
}: {
  topic: Topic
  subtitle?: boolean
}) {
  return (
    <Link
      to="/learn"
      search={{ topic: topic.id, mode: 'learn' }}
      className="group flex min-w-0 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
    >
      <TopicIcon topic={topic} small />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-primary">
          {topicName(topic)}
        </p>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {domainName(topic.domain)} · {ageLabel(topic)}
          </p>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  )
}
export function NeedsProfile({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n()

  const { data, isPending } = authClient.useSession()
  const setAuthOpen = useUi((state) => state.setAuthOpen)
  const setProfileOpen = useUi((state) => state.setProfileOpen)
  if (isPending) return <Loading />
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed bg-card text-center',
        compact ? 'p-6' : 'px-6 py-14',
      )}
    >
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Sparkles className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">
        {data ? t('为孩子开启一条学习小径') : t('让每一步成长，都被看见')}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
        {data
          ? t(
              '只需昵称、年龄和每天的学习时间，就能保存学习目标、练习记录与进度。',
            )
          : t(
              '登录后创建学习档案，保存目标路线，与 AI 一起理解和练习。知识地图始终可以自由探索。',
            )}
      </p>
      <Button
        className="mt-5"
        onClick={() => (data ? setProfileOpen(true) : setAuthOpen(true))}
      >
        {data ? t('创建学习档案') : t('登录，开始记录')}
        <ArrowRight />
      </Button>
    </div>
  )
}
