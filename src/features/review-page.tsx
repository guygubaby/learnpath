import { useI18n } from '@/lib/i18n'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, CheckCircle2, RotateCcw } from 'lucide-react'
import { Route } from '@/routes/review'
import { useLearning } from '@/lib/queries'
import { localDate } from '@/lib/learning'
import { topicName } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  Loading,
  NeedsProfile,
  PageHeading,
  Panel,
  TopicIcon,
} from '@/components/shared'

export function ReviewPage() {
  const { t, locale } = useI18n()

  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { catalog, profile, workspace } = useLearning()
  if (catalog.isPending) return <Loading />
  if (catalog.error)
    return <ErrorState error={catalog.error} retry={() => catalog.refetch()} />
  const graph = catalog.data.graph
  const data = workspace.data
  const due =
    data?.reviews.filter(
      (item) => new Date(item.dueAt).getTime() <= Date.now(),
    ) ?? []
  const mistakes = data?.attempts.filter((item) => item.score < 1) ?? []
  const upcoming =
    data?.reviews.filter(
      (item) => new Date(item.dueAt).getTime() > Date.now(),
    ) ?? []
  return (
    <>
      <PageHeading
        title={t('再遇见一次，让理解更牢一点')}
        description={t('把错题变成新的线索，在合适的时候回看已经学过的内容。')}
      >
        <Button variant="outline" asChild>
          <Link to="/map">
            {t('探索新知识')}
            <ArrowRight />
          </Link>
        </Button>
      </PageHeading>
      {!profile ? (
        <NeedsProfile />
      ) : workspace.isPending ? (
        <Loading />
      ) : workspace.error ? (
        <ErrorState error={workspace.error} retry={() => workspace.refetch()} />
      ) : (
        <>
          <div
            className="mb-6 flex flex-wrap gap-2"
            role="group"
            aria-label={t('复习内容')}
          >
            <Button
              variant={tab === 'due' ? 'default' : 'outline'}
              aria-pressed={tab === 'due'}
              onClick={() =>
                navigate({ search: { tab: 'due' }, replace: true })
              }
            >
              <RotateCcw />
              {t('到期复习 ')}
              {due.length ? `(${due.length})` : ''}
            </Button>
            <Button
              variant={tab === 'mistakes' ? 'default' : 'outline'}
              aria-pressed={tab === 'mistakes'}
              onClick={() =>
                navigate({ search: { tab: 'mistakes' }, replace: true })
              }
            >
              {t('错题回顾 ')}
              {mistakes.length ? `(${mistakes.length})` : ''}
            </Button>
          </div>
          {tab === 'due' ? (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
              <Panel>
                {due.length ? (
                  <div className="divide-y">
                    {due.map((review) => {
                      const topic = graph.byId.get(review.topicId)
                      return (
                        topic && (
                          <div
                            key={topic.id}
                            className="flex items-center gap-3 py-5 first:pt-0 last:pb-0"
                          >
                            <TopicIcon topic={topic} />
                            <div className="min-w-0 flex-1">
                              <h2 className="text-sm font-medium">
                                {topicName(topic)}
                              </h2>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('适合再巩固一下 ·')}{' '}
                                {localDate(review.dueAt).format(t('M 月 D 日'))}
                              </p>
                            </div>
                            <Button size="sm" asChild>
                              <Link
                                to="/learn"
                                search={{ topic: topic.id, mode: 'review' }}
                              >
                                {t('开始复习')}
                                <ArrowRight />
                              </Link>
                            </Button>
                          </div>
                        )
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-14 text-center">
                    <CheckCircle2 className="mx-auto mb-4 size-12 text-success/70" />
                    <h2 className="text-lg font-semibold">
                      {t('今天还没有到期的复习')}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {t(
                        '完成练习后，学径会按作答表现安排 1、3、7、14、30 天的复习间隔。',
                      )}
                    </p>
                    <Button variant="secondary" className="mt-5" asChild>
                      <Link to="/plan">{t('看看今天的学习计划')}</Link>
                    </Button>
                  </div>
                )}
              </Panel>
              <Panel>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-primary" />
                  {t('接下来的复习')}
                </h2>
                {upcoming.length ? (
                  upcoming.slice(0, 8).map((review) => {
                    const topic = graph.byId.get(review.topicId)
                    return (
                      topic && (
                        <div
                          key={topic.id}
                          className="border-b py-3 last:border-0"
                        >
                          <p className="text-sm">{topicName(topic)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {localDate(review.dueAt).format(
                              t('M 月 D 日 HH:mm'),
                            )}
                          </p>
                        </div>
                      )
                    )
                  })
                ) : (
                  <p className="text-xs leading-7 text-muted-foreground">
                    {t('学习过的内容，会在这里等你回来。')}
                  </p>
                )}
              </Panel>
            </div>
          ) : (
            <Panel>
              {mistakes.length ? (
                <div className="space-y-4">
                  {mistakes.map((attempt) => {
                    const topic = graph.byId.get(attempt.topicId)
                    return (
                      topic && (
                        <details
                          key={attempt.id}
                          className="rounded-xl border p-5"
                        >
                          <summary className="text-sm leading-7 font-medium">
                            {attempt.question}
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {topicName(topic)} ·{' '}
                              {localDate(attempt.createdAt).format('M/D HH:mm')}
                            </span>
                          </summary>
                          <div className="mt-4 space-y-3 text-sm">
                            <p className="rounded-lg bg-destructive/5 p-3 text-destructive">
                              {t('你的答案：')}
                              {attempt.options[attempt.optionIndex]}
                            </p>
                            <p className="rounded-lg bg-success-soft p-3 text-success">
                              {t('正确答案：')}
                              {attempt.options[attempt.correctIndex]}
                            </p>
                            <p className="leading-7 text-muted-foreground">
                              {attempt.explanation}
                            </p>
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                to="/learn"
                                search={{ topic: topic.id, mode: 'practice' }}
                              >
                                {t('再试一道类似的题')}
                                <ArrowRight />
                              </Link>
                            </Button>
                          </div>
                        </details>
                      )
                    )
                  })}
                  <p className="text-xs text-muted-foreground">
                    {t('显示最近 100 次作答中的错题，全部作答计入学习报告。')}
                  </p>
                </div>
              ) : (
                <div className="py-14 text-center">
                  <CheckCircle2 className="mx-auto mb-4 size-12 text-success/70" />
                  <h2 className="text-lg font-semibold">
                    {t('还没有需要回顾的错题')}
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t('不用害怕出错，每次作答都会帮我们找到下一步。')}
                  </p>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </>
  )
}
