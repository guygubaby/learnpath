import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  Flag,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLearning, useRefreshLearning } from '@/lib/queries'
import { isReady, prerequisitePath } from '@/lib/graph'
import { dailyPlan } from '@/lib/learning'
import { ageLabel, domainName, featuredTopicIds, topicName } from '@/lib/labels'
import type { Topic } from '@/lib/contracts'
import { request } from '@/lib/api-client'
import { Button, cn } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  ErrorState,
  Loading,
  NeedsProfile,
  PageHeading,
  Panel,
  SectionTitle,
  TopicIcon,
} from '@/components/shared'

export function PlanPage() {
  const { t, locale } = useI18n()

  const { catalog: query, profile, workspace } = useLearning()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const refresh = useRefreshLearning()
  const remove = useMutation({
    mutationFn: (id: string) => request(`/api/goals/${id}`, 'DELETE'),
    onSuccess: async () => {
      await refresh()
      setRemoving(null)
      toast.success(t('学习目标已移除，练习记录会保留'))
    },
    onError: (error) => toast.error(error.message),
  })
  if (query.isPending) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />
  const { graph, catalog } = query.data
  const data = workspace.data
  return (
    <>
      <PageHeading
        title={t('把想学的，变成走得通的路')}
        description={t(
          '从现有基础出发，必要先修决定顺序，学习建议提供更多可能。',
        )}
      >
        {profile && (
          <Button onClick={() => setPickerOpen(true)}>
            <Plus />
            {t('添加学习目标')}
          </Button>
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
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              {!data.goals.length && (
                <Panel>
                  <div className="mx-auto max-w-md py-8 text-center">
                    <Flag className="mx-auto mb-4 size-10 text-primary/60" />
                    <h2 className="text-lg font-semibold">
                      {t('先选一个想理解的目标')}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {t(
                        '不必一次走很远。选一个知识点，我们一起找到它需要的基础。',
                      )}
                    </p>
                    <Button
                      className="mt-5"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus />
                      {t('选择我的第一个目标')}
                    </Button>
                  </div>
                  <div className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                    {featuredTopicIds
                      .map((id) => graph.byId.get(id))
                      .filter((item): item is Topic => Boolean(item))
                      .map((topic) => (
                        <button
                          key={topic.id}
                          className="flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted"
                          onClick={() => setPickerOpen(true)}
                        >
                          <TopicIcon topic={topic} small />
                          <span>
                            <span className="block text-sm font-medium">
                              {topicName(topic)}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {ageLabel(topic)}
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                </Panel>
              )}
              {data.goals.map((goal) => {
                const target = graph.byId.get(goal.topicId)
                if (!target) return null
                const remaining = prerequisitePath(
                  graph,
                  target.id,
                  data.progress,
                )
                const fullPath = prerequisitePath(graph, target.id)
                const total = fullPath.length
                const mastered = new Set(
                  data.progress
                    .filter((item) => item.status === 'mastered')
                    .map((item) => item.topicId),
                )
                const done = fullPath.filter((item) =>
                  mastered.has(item.id),
                ).length
                return (
                  <Panel key={goal.id}>
                    <div className="flex items-start gap-3">
                      <TopicIcon topic={target} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {t('我的学习目标')}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">
                          {topicName(target)}
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {domainName(target.domain)} · {ageLabel(target)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('移除目标：{{v0}}', {
                          v0: topicName(target),
                        })}
                        onClick={() => setRemoving(goal.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/65"
                          style={{
                            width: `${total ? (done / total) * 100 : 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t('已确认掌握 ')}
                        {done} / {total}
                      </span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          to="/learn"
                          search={{ topic: target.id, mode: 'diagnose' }}
                        >
                          {t('检查已有基础')}
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/map"
                          search={{
                            topic: target.id,
                            subject: target.subject,
                            view: 'focus',
                          }}
                        >
                          {t('在地图中查看')}
                          <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                    {!remaining.length ? (
                      <p className="mt-6 flex items-center gap-2 rounded-xl bg-success-soft p-4 text-sm text-success">
                        <Check className="size-4" />
                        {t('这个目标已完成，可以复习巩固或探索新的目标。')}
                      </p>
                    ) : (
                      <ol className="mt-6 space-y-0">
                        {remaining.map((topic, index) => {
                          const ready = isReady(graph, topic.id, data.progress)
                          return (
                            <li
                              key={topic.id}
                              className="relative flex items-center gap-3 py-3.5"
                            >
                              <span
                                className={cn(
                                  'z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs',
                                  ready
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {index + 1}
                              </span>
                              {index < remaining.length - 1 && (
                                <span className="absolute top-10 bottom-0 left-3.5 border-l" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                  {topicName(topic)}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  {ready ? (
                                    t('必要基础已具备，可以开始')
                                  ) : (
                                    <>
                                      <LockKeyhole className="size-3" />
                                      {t('先学习前面的必要基础')}
                                    </>
                                  )}
                                </p>
                              </div>
                              <Button
                                variant={ready ? 'outline' : 'ghost'}
                                size="sm"
                                asChild
                              >
                                <Link
                                  to="/learn"
                                  search={{ topic: topic.id, mode: 'learn' }}
                                >
                                  {ready ? t('开始') : t('预览')}
                                  <ArrowRight />
                                </Link>
                              </Button>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </Panel>
                )
              })}
            </div>
            <aside className="space-y-6">
              <Panel>
                <SectionTitle title={t('今天的安排')} />
                <p className="mb-4 text-xs leading-6 text-muted-foreground">
                  {t('按每日 ')}
                  {profile.dailyMinutes}{' '}
                  {t('分钟的计划，优先安排到期复习和可以开始的基础知识点。')}
                </p>
                {dailyPlan(graph, data).map((item) => (
                  <Link
                    key={item.topicId}
                    to="/learn"
                    search={{
                      topic: item.topicId,
                      mode: item.kind === 'review' ? 'review' : 'learn',
                    }}
                    className="mb-3 block rounded-xl bg-muted p-3"
                  >
                    <span className="block text-sm font-medium">
                      {topicName(graph.byId.get(item.topicId)!)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(item.reason)}
                    </span>
                  </Link>
                ))}
                {!dailyPlan(graph, data).length && (
                  <p className="text-sm text-muted-foreground">
                    {t('添加目标后，这里会出现今天适合学习的内容。')}
                  </p>
                )}
              </Panel>
              <div className="px-2 text-xs leading-7 text-muted-foreground">
                <p>{t('必要先修用于安排学习顺序；建议先修不阻止开始学习。')}</p>
                <p className="mt-3">
                  {t(
                    '掌握记录只属于当前知识点，不会自动传递给前置或后续知识点。',
                  )}
                </p>
              </div>
            </aside>
          </div>
        )
      )}
      <Dialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('这次，想弄懂什么？')}
        description={t('可以用中文或英文搜索，也可以从地图里慢慢探索。')}
      >
        {profile && (
          <GoalPicker
            topics={catalog.topics}
            childId={profile.id}
            onSuccess={() => setPickerOpen(false)}
          />
        )}
      </Dialog>
      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('移除这个学习目标？')}
        description={t(
          '已保存的练习和掌握记录会保留，也可以随时重新添加目标。',
        )}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRemoving(null)}>
            {t('保留目标')}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => removing && remove.mutate(removing)}
          >
            {t('移除目标')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
function GoalPicker({
  topics,
  childId,
  onSuccess,
}: {
  topics: Topic[]
  childId: string
  onSuccess: () => void
}) {
  const { t, locale } = useI18n()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const refresh = useRefreshLearning()
  const results = (
    search.trim()
      ? topics.filter((topic) =>
          `${topicName(topic)} ${topic.name} ${domainName(topic.domain)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      : featuredTopicIds
          .map((id) => topics.find((topic) => topic.id === id))
          .filter((topic): topic is Topic => Boolean(topic))
  ).slice(0, 20)
  const mutation = useMutation({
    mutationFn: () =>
      request('/api/goals', 'POST', { childId, topicId: selected }),
    onSuccess: async () => {
      await refresh()
      toast.success(t('目标已添加'))
      onSuccess()
    },
  })
  return (
    <form
      action="/api/goals"
      method="post"
      onSubmit={(event) => {
        event.preventDefault()
        if (selected) mutation.mutate()
      }}
    >
      <label htmlFor="goal-search" className="sr-only">
        {t('搜索学习目标')}
      </label>
      <div className="relative">
        <Search className="absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <input
          id="goal-search"
          name="search"
          className="h-12 w-full rounded-lg border bg-card pr-3 pl-10 text-sm"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setSelected(null)
          }}
          placeholder={t('搜索知识点或领域')}
          autoComplete="off"
        />
      </div>
      <fieldset className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        <legend className="sr-only">{t('选择一个知识点')}</legend>
        {results.map((topic) => (
          <label
            key={topic.id}
            className={cn(
              'flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border p-3',
              selected === topic.id
                ? 'border-primary bg-primary-soft'
                : 'hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="topicId"
              value={topic.id}
              checked={selected === topic.id}
              required
              onChange={() => setSelected(topic.id)}
            />
            <div>
              <span className="block text-sm font-medium">
                {topicName(topic)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {domainName(topic.domain)} · {ageLabel(topic)}
              </span>
            </div>
          </label>
        ))}
        {!results.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('没有找到，试试领域名或英文关键词。')}
          </p>
        )}
      </fieldset>
      {mutation.error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t(mutation.error.message)}
        </p>
      )}
      <Button
        type="submit"
        className="mt-5 w-full"
        disabled={mutation.isPending}
      >
        {t('生成我的学习路线')}
        <ArrowRight />
      </Button>
    </form>
  )
}
