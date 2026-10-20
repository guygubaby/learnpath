import { useI18n } from '@/lib/i18n'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Download, Printer, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { subjects } from '@/lib/contracts'
import { localDate, weeklyActivity } from '@/lib/learning'
import { useLearning } from '@/lib/queries'
import { subjectMeta, topicName } from '@/lib/labels'
import { request } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  Loading,
  NeedsProfile,
  PageHeading,
  Panel,
  SectionTitle,
} from '@/components/shared'

export function ReportsPage() {
  const { t, locale } = useI18n()

  const { catalog, profile, workspace } = useLearning()
  const exportReport = useMutation({
    mutationFn: () =>
      request<{ downloadUrl: string }>('/api/reports/exports', 'POST', {
        childId: profile!.id,
      }),
    onSuccess: (data) => {
      window.location.assign(data.downloadUrl)
      toast.success(t('报告已生成，正在下载'))
    },
    onError: (error) => toast.error(error.message),
  })
  if (catalog.isPending) return <Loading />
  if (catalog.error)
    return <ErrorState error={catalog.error} retry={() => catalog.refetch()} />
  const { graph } = catalog.data
  const data = workspace.data
  const activity = weeklyActivity(data)
  const max = Math.max(...activity.map((item) => item.count), 1)
  const accuracy = data?.totals.attempts
    ? Math.round((data.totals.correct / data.totals.attempts) * 100)
    : null
  return (
    <>
      <PageHeading
        title={
          profile
            ? t('{{v0}}的成长，有迹可循', { v0: profile.nickname })
            : t('学习报告')
        }
        description={t('看见已经连接的知识，也找到值得再练一练的地方。')}
      >
        {profile && (
          <div data-no-print className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              {t('打印')}
            </Button>
            <Button
              variant="outline"
              disabled={exportReport.isPending}
              onClick={() => exportReport.mutate()}
            >
              <Download />
              {t('导出记录')}
            </Button>
          </div>
        )}
      </PageHeading>
      {!profile ? (
        <NeedsProfile />
      ) : workspace.isPending ? (
        <Loading />
      ) : workspace.error ? (
        <ErrorState error={workspace.error} retry={() => workspace.refetch()} />
      ) : (
        data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                {
                  label: t('已掌握知识点'),
                  value: data.progress.filter(
                    (item) => item.status === 'mastered',
                  ).length,
                },
                { label: t('累计完成练习'), value: data.totals.attempts },
                {
                  label: t('累计正确率'),
                  value: accuracy === null ? '—' : `${accuracy}%`,
                },
                {
                  label: t('有学习记录的日子'),
                  value: t('{{v0}} 天', { v0: data.totals.studyDays }),
                },
              ].map((item) => (
                <Panel key={t(item.label)} className="print-break-avoid">
                  <p className="text-xs text-muted-foreground">
                    {t(item.label)}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums">
                    {item.value}
                  </p>
                </Panel>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="print-break-avoid">
                <SectionTitle
                  title={t('最近七天，理解在慢慢生长')}
                  description={t('每根柱子代表当天完成的练习数量。')}
                />
                <div className="flex h-48 items-end justify-around gap-4 pt-6">
                  {activity.map((day) => (
                    <div
                      key={day.date}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {day.count}
                      </span>
                      <span
                        className="w-full max-w-10 rounded-t-lg bg-primary/60"
                        style={{ height: Math.max(4, (day.count / max) * 110) }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel className="print-break-avoid">
                <SectionTitle
                  title={t('知识地图中的足迹')}
                  description={t(
                    '按全部知识点统计，年龄范围与国内年级并非一一对应。',
                  )}
                />
                <div className="space-y-4">
                  {subjects.map((subject) => {
                    const meta = subjectMeta[subject]
                    const total = catalog.data.catalog.topics.filter(
                      (topic) => topic.subject === subject,
                    ).length
                    const count = data.progress.filter(
                      (item) =>
                        item.status === 'mastered' &&
                        graph.byId.get(item.topicId)?.subject === subject,
                    ).length
                    return (
                      <div key={subject} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs">
                          {t(meta.name)}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: meta.color,
                              width: `${(count / total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                          {count}/{total}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>
            <Panel>
              <SectionTitle title={t('接下来，可以多关注这些内容')} />
              {data.progress
                .filter(
                  (item) =>
                    item.status === 'learning' && item.source === 'quiz',
                )
                .sort((a, b) => a.score - b.score)
                .slice(0, 4).length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.progress
                    .filter(
                      (item) =>
                        item.status === 'learning' && item.source === 'quiz',
                    )
                    .sort((a, b) => a.score - b.score)
                    .slice(0, 4)
                    .map((item) => {
                      const topic = graph.byId.get(item.topicId)
                      return (
                        topic && (
                          <Link
                            key={topic.id}
                            to="/learn"
                            search={{ topic: topic.id, mode: 'learn' }}
                            className="rounded-xl border p-4 hover:bg-muted"
                          >
                            <p className="text-sm font-medium">
                              {topicName(topic)}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-muted-foreground">
                              {t('最近练习正确率 ')}
                              {item.score}
                              {t('%，覆盖')} {item.evidenceCount}{' '}
                              {t(
                                '道不同题目。建议回到具体例子，听听孩子怎样解释。',
                              )}
                            </p>
                          </Link>
                        )
                      )
                    })}
                </div>
              ) : (
                <p className="flex items-center gap-3 text-sm leading-7 text-muted-foreground">
                  <Sparkles className="size-5 shrink-0 text-primary" />
                  {t('继续积累练习，报告会依据真实作答提供复习建议。')}
                </p>
              )}
            </Panel>
            <Panel>
              <SectionTitle title={t('最近更新的掌握记录')} />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    {t('当前学习档案最近更新的知识点、状态、证据和日期')}
                  </caption>
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-3 pr-4 font-medium">
                        {t('知识点')}
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        {t('状态')}
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">
                        {t('依据')}
                      </th>
                      <th
                        scope="col"
                        className="py-3 pl-3 text-right font-medium"
                      >
                        {t('日期')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.progress]
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                      .slice(0, 12)
                      .map((item) => (
                        <tr
                          key={item.topicId}
                          className="border-b last:border-0"
                        >
                          <td className="min-w-44 py-4 pr-4">
                            {graph.byId.has(item.topicId)
                              ? topicName(graph.byId.get(item.topicId)!)
                              : item.topicId}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {item.status === 'mastered'
                              ? t('已掌握')
                              : t('学习中')}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-muted-foreground">
                            {item.source === 'parent'
                              ? t('家长观察')
                              : t('{{v0}} 道不同题目', {
                                  v0: item.evidenceCount,
                                })}
                          </td>
                          <td className="py-4 pl-3 text-right whitespace-nowrap text-muted-foreground">
                            {localDate(item.updatedAt).format('M/D HH:mm')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!data.progress.length && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t('完成一次练习或记录一次观察，这里就会出现第一份记录。')}
                  </p>
                )}
              </div>
            </Panel>
          </div>
        )
      )}
    </>
  )
}
