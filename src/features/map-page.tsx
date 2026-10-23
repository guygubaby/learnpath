import { useI18n } from '@/lib/i18n'
import { Search, SlidersHorizontal, ChevronRight } from 'lucide-react'
import { Route } from '@/routes/map'
import { useLearning } from '@/lib/queries'
import { subjects, type Topic } from '@/lib/contracts'
import { ageLabel, domainName, subjectMeta, topicName } from '@/lib/labels'
import { neighborhood } from '@/lib/graph'
import { taxonomySummary } from '@/lib/taxonomy-summary'
import { KnowledgeGraph } from '@/components/knowledge-graph'
import { Button, cn } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  ErrorState,
  Loading,
  PageHeading,
  TopicIcon,
} from '@/components/shared'
import { TopicDetail } from './topic-detail'

export function MapPage() {
  const { t, locale } = useI18n()

  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { catalog: query, workspace } = useLearning()
  if (query.isPending) return <Loading label={t('正在打开知识地图')} />
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />
  const { catalog, graph } = query.data
  const summary = taxonomySummary(catalog)
  const q = search.q.toLowerCase().trim()
  const filtered = catalog.topics.filter(
    (topic) =>
      (!topic.retired || topic.id === search.topic) &&
      (search.subject === 'all' || topic.subject === search.subject) &&
      (!search.age ||
        ((topic.ageRangeStart ?? 4) <= search.age &&
          (topic.ageRangeEnd ?? 14) >= search.age)) &&
      (!q ||
        `${topic.name} ${topicName(topic, 'zh-CN')} ${topic.description} ${topic.translations?.['zh-CN'].description ?? ''} ${domainName(topic.domain, 'zh-CN')} ${topic.domain}`
          .toLowerCase()
          .includes(q)),
  )
  const selected =
    filtered.find((topic) => topic.id === search.topic) ?? filtered[0]
  const ids =
    selected && search.view === 'focus'
      ? neighborhood(graph, selected.id, 1)
      : new Set(filtered.map((topic) => topic.id))
  const displayed =
    search.view === 'focus'
      ? catalog.topics.filter((topic) => ids.has(topic.id))
      : filtered
  const choose = (id: string) => {
    const topic = graph.byId.get(id)!
    navigate({
      search: (previous) => ({
        ...previous,
        topic: id,
        subject: previous.view === 'focus' ? topic.subject : previous.subject,
        q: '',
      }),
      replace: true,
    })
  }
  return (
    <>
      <PageHeading
        title={t('知识不是孤岛，每一步都有连接')}
        description={t(
          '从一个好奇的问题出发，看看它从哪里来，又能带你去哪里。',
        )}
      >
        <span className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
          {t('{{v0}} 个知识点 · {{v1}} 个学科', {
            v0: summary.topics.toLocaleString(locale),
            v1: summary.subjects,
          })}
        </span>
      </PageHeading>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-4 size-4 text-muted-foreground" />
          <input
            type="search"
            aria-label={t('搜索知识点')}
            name="q"
            value={search.q}
            onChange={(event) =>
              navigate({
                search: (previous) => ({ ...previous, q: event.target.value }),
                replace: true,
              })
            }
            placeholder={t('搜索一个知识点，比如：分数、植物、fractions')}
            maxLength={100}
            className="h-12 w-full rounded-xl border bg-card pr-4 pl-11 text-sm outline-none focus:border-primary"
          />
        </div>
        <Select
          aria-label={t('按年龄筛选')}
          value={search.age ? String(search.age) : 'all'}
          icon={
            <SlidersHorizontal
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          }
          options={[
            { value: 'all', label: t('所有年龄') },
            ...Array.from({ length: 11 }, (_, i) => i + 4).map((age) => ({
              value: String(age),
              label: t('{{v0}} 岁', { v0: age }),
            })),
          ]}
          onValueChange={(value) =>
            navigate({
              search: (previous) => ({
                ...previous,
                age: value === 'all' ? undefined : Number(value),
              }),
              replace: true,
            })
          }
        />
        <div
          className="flex rounded-xl border bg-card p-1"
          role="group"
          aria-label={t('地图显示方式')}
        >
          {(
            [
              { value: 'focus', label: t('目标周边') },
              { value: 'subject', label: t('学科全景') },
              { value: 'list', label: t('知识列表') },
            ] as const
          ).map((item) => (
            <Button
              key={item.value}
              variant={search.view === item.value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={search.view === item.value}
              onClick={() =>
                navigate({
                  search: (previous) => ({ ...previous, view: item.value }),
                  replace: true,
                })
              }
            >
              {t(item.label)}
            </Button>
          ))}
        </div>
      </div>
      <div
        className="mb-6 flex flex-wrap gap-2"
        role="group"
        aria-label={t('按学科筛选')}
      >
        <button
          type="button"
          aria-pressed={search.subject === 'all'}
          className={cn(
            'min-h-10 rounded-lg border px-3 text-xs',
            search.subject === 'all'
              ? 'border-primary bg-primary-soft text-primary'
              : 'bg-card text-muted-foreground',
          )}
          onClick={() =>
            navigate({
              search: (previous) => ({
                ...previous,
                subject: 'all',
                q: '',
                view: 'subject',
              }),
              replace: true,
            })
          }
        >
          {t('全部学科')}
        </button>
        {subjects.map((subject) => {
          const meta = subjectMeta[subject]
          return (
            <button
              key={subject}
              type="button"
              aria-pressed={search.subject === subject}
              className={cn(
                'flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs',
                search.subject === subject
                  ? 'border-primary/40 bg-primary-soft text-primary'
                  : 'bg-card text-muted-foreground hover:border-primary/30',
              )}
              onClick={() => {
                const first = catalog.topics.find(
                  (topic) => topic.subject === subject,
                )!
                navigate({
                  search: (previous) => ({
                    ...previous,
                    subject,
                    q: '',
                    topic: first.id,
                    view: 'subject',
                  }),
                  replace: true,
                })
              }}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: meta.color }}
              />
              {t(meta.name)}
            </button>
          )
        })}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-panel">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-sm font-medium">
                {search.view === 'focus'
                  ? t('围绕目标，找到学习的来路')
                  : search.view === 'subject'
                    ? t('看看知识之间的连接')
                    : t('逐个探索知识点')}
              </h2>
              <span className="text-xs text-muted-foreground">
                {search.view === 'focus' ? displayed.length : filtered.length}{' '}
                {t('个知识点')}
              </span>
            </div>
            {!filtered.length ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-center">
                <Search className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t('没有找到符合条件的知识点')}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate({
                      search: (previous) => ({
                        ...previous,
                        q: '',
                        age: undefined,
                      }),
                      replace: true,
                    })
                  }
                >
                  {t('清除搜索和年龄筛选')}
                </Button>
              </div>
            ) : search.view === 'list' ? (
              <div className="max-h-[38rem] overflow-y-auto p-3">
                <TopicList
                  topics={filtered}
                  selectedId={selected?.id}
                  onSelect={choose}
                />
              </div>
            ) : (
              <div className="h-[34rem] sm:h-[38rem]">
                <KnowledgeGraph
                  catalog={catalog}
                  focused={search.view === 'focus'}
                  topics={displayed}
                  selectedId={selected!.id}
                  progress={workspace.data?.progress}
                  onSelect={choose}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="w-5 border-t-2 border-primary/40" />
                {t('必要先修')}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 border-t-2 border-dashed border-primary/40" />
                {t('学习建议')}
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full border-2 border-success" />
                {t('已掌握')}
              </span>
            </div>
          </section>
          {search.view !== 'list' && !!filtered.length && (
            <details className="mt-4 rounded-xl border bg-card px-5 py-4">
              <summary className="text-sm text-muted-foreground">
                {t('用列表探索知识点（键盘可访问）')}
              </summary>
              <div className="mt-3 max-h-80 overflow-y-auto">
                <TopicList
                  topics={search.view === 'focus' ? displayed : filtered}
                  selectedId={selected?.id}
                  onSelect={choose}
                />
              </div>
            </details>
          )}
        </div>
        <aside className="rounded-2xl border bg-card p-6 shadow-panel">
          {selected ? (
            <TopicDetail key={selected.id} topic={selected} graph={graph} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('选择一个知识点，查看它的内容与先修关系。')}
            </p>
          )}
        </aside>
      </div>
    </>
  )
}
function TopicList({
  topics,
  selectedId,
  onSelect,
}: {
  topics: Topic[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  return (
    <ul className="divide-y">
      {topics.map((topic) => (
        <li key={topic.id}>
          <button
            type="button"
            onClick={() => onSelect(topic.id)}
            aria-pressed={topic.id === selectedId}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted',
              topic.id === selectedId && 'bg-primary-soft',
            )}
          >
            <TopicIcon topic={topic} small />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {topicName(topic)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {domainName(topic.domain)} · {ageLabel(topic)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  )
}
