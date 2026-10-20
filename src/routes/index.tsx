import { useI18n } from '@/lib/i18n'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flag,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react'
import { useLearning } from '@/lib/queries'
import { dailyPlan, localDate, weeklyActivity } from '@/lib/learning'
import { subjectMeta, topicName } from '@/lib/labels'
import { subjects } from '@/lib/contracts'
import { useUi } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  Loading,
  Panel,
  SectionTitle,
  TopicIcon,
} from '@/components/shared'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { t, locale } = useI18n()

  const { catalog: query, profile, workspace, session } = useLearning()
  const setProfileOpen = useUi((state) => state.setProfileOpen)
  const setAuthOpen = useUi((state) => state.setAuthOpen)
  if (query.isPending) return <Loading label={t('正在打开学习空间')} />
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />
  const { catalog, graph } = query.data
  const data = workspace.data
  const mastered =
    data?.progress.filter((item) => item.status === 'mastered').length ?? 0
  const plan = data ? dailyPlan(graph, data) : []
  const activity = weeklyActivity(data)
  const maxActivity = Math.max(...activity.map((day) => day.count), 1)
  const hour = localDate().hour()
  const greeting =
    hour < 11
      ? t('早上好')
      : hour < 14
        ? t('中午好')
        : hour < 18
          ? t('下午好')
          : t('晚上好')
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            {profile
              ? t('{{v0}}，{{v1}}', { v0: greeting, v1: profile.nickname })
              : t('欢迎来到学径')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
            {t('今天，让好奇心再往前一步。')}
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link to="/plan">
            <Compass />
            {t('查看学习计划')}
          </Link>
        </Button>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <section className="relative flex min-h-64 items-center justify-between gap-5 overflow-hidden rounded-2xl bg-primary-soft px-7 py-8 sm:px-9">
            <div className="relative z-10 max-w-md">
              <h2 className="text-[1.65rem] leading-relaxed font-semibold tracking-tight sm:text-3xl">
                {t('从一个小小的发现，')}
                <br />
                {t('走向更大的世界。')}
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">
                {t('知识之间的每一次连接，')}
                <br className="hidden sm:block" />
                {t('都让下一步学习更有方向。')}
              </p>
              <Button className="mt-6" asChild>
                <Link to="/map">
                  {t('探索知识地图')}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div
              aria-hidden="true"
              className="relative hidden w-44 shrink-0 items-center justify-center self-stretch sm:flex"
            >
              <div className="absolute top-2 right-1 rotate-8 rounded-xl border border-white/80 bg-card/85 px-5 py-3 shadow-panel">
                <span className="text-xs text-muted-foreground">
                  {t('小小的部分，也能连成整体')}
                </span>
              </div>
              <div
                className="relative mt-6 flex size-32 items-center justify-center rounded-full border-8 border-white/80"
                style={{
                  background:
                    'conic-gradient(#b6a6e8 0deg 270deg, #e5def8 270deg 360deg)',
                }}
              >
                <span className="absolute h-full border-l-3 border-white/90" />
                <span className="absolute w-full border-t-3 border-white/90" />
                <span className="z-10 flex size-12 items-center justify-center rounded-full bg-white text-lg font-semibold text-primary">
                  ¾
                </span>
              </div>
              <span className="absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-xl bg-card shadow-panel">
                <Sparkles className="size-5 text-warning" />
              </span>
            </div>
          </section>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                label: t('已掌握知识'),
                value: mastered,
                unit: '个',
                icon: CheckCircle2,
                color: 'text-success bg-success-soft',
              },
              {
                label: t('累计练习'),
                value: data?.totals.attempts ?? 0,
                unit: '题',
                icon: BookOpen,
                color: 'text-primary bg-primary-soft',
              },
              {
                label: t('学习的日子'),
                value: data?.totals.studyDays ?? 0,
                unit: '天',
                icon: Flag,
                color: 'text-warning bg-warning-soft',
              },
            ].map((item) => (
              <div
                key={t(item.label)}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-5 sm:px-5"
              >
                <span
                  className={`hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex ${item.color}`}
                >
                  <item.icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t(item.label)}
                  </p>
                  <p className="mt-2 text-2xl leading-none font-semibold tabular-nums">
                    {item.value}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {t(item.unit, { count: item.value })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Panel>
            <SectionTitle
              title={t('今天，沿着这条小径出发')}
              description={
                profile
                  ? t('每天 {{v0}} 分钟，给理解留一点时间', {
                      v0: profile.dailyMinutes,
                    })
                  : t('设一个目标，学习路线就会从你的基础出发')
              }
            >
              <Button variant="ghost" size="sm" asChild>
                <Link to="/plan">
                  {t('全部计划')}
                  <ChevronRight />
                </Link>
              </Button>
            </SectionTitle>
            {workspace.error ? (
              <ErrorState
                error={workspace.error}
                retry={() => workspace.refetch()}
              />
            ) : plan.length ? (
              <ol className="space-y-1">
                {plan.map((entry, index) => {
                  const topic = graph.byId.get(entry.topicId)!
                  return (
                    <li
                      key={entry.topicId}
                      className="flex flex-wrap items-center gap-3 rounded-xl py-3 sm:gap-4"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <TopicIcon topic={topic} small />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {topicName(topic)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(entry.reason)}
                          {t(' · 约 10 分钟')}
                        </p>
                      </div>
                      <Button
                        variant={index === 0 ? 'default' : 'outline'}
                        size="sm"
                        asChild
                      >
                        <Link
                          to="/learn"
                          search={{
                            topic: topic.id,
                            mode: entry.kind === 'review' ? 'review' : 'learn',
                          }}
                        >
                          {index === 0 ? t('开始学习') : t('去看看')}
                          <ArrowRight />
                        </Link>
                      </Button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/60 px-4 py-8 text-center">
                <Target className="size-8 text-primary/60" />
                <p className="text-sm font-medium">
                  {data?.goals.length
                    ? t('当前目标已完成，试着探索下一个目标')
                    : t('下一段小径，由一个目标开始')}
                </p>
                <p className="max-w-xs text-xs leading-6 text-muted-foreground">
                  {t(
                    '选择想理解的知识点，学径会沿着必要先修关系，为你找到适合开始的地方。',
                  )}
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/map">
                    <Plus />
                    {t('寻找一个学习目标')}
                  </Link>
                </Button>
              </div>
            )}
          </Panel>
          <Panel>
            <SectionTitle
              title={t('世界很大，好奇心可以去很多地方')}
              description={t('探索八个学科，找到今天想问的问题。')}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {subjects.slice(0, 4).map((subject) => {
                const meta = subjectMeta[subject]
                const Icon = meta.icon
                const count = catalog.topics.filter(
                  (topic) => topic.subject === subject,
                ).length
                return (
                  <Link
                    key={subject}
                    to="/map"
                    search={{
                      subject,
                      view: 'subject',
                      topic: catalog.topics.find(
                        (topic) => topic.subject === subject,
                      )!.id,
                    }}
                    className="group rounded-xl border p-4 transition-colors hover:border-primary/35"
                    style={{ background: meta.soft }}
                  >
                    <Icon
                      className="mb-4 size-6"
                      style={{ color: meta.color }}
                    />
                    <p className="text-sm font-semibold">{t(meta.name)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {count}
                      {t(' 个知识点')}
                    </p>
                  </Link>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{t('还有计算机、生活技能、个人与社会发展、学会学习')}</span>
              <Link
                to="/map"
                search={{ subject: 'all', view: 'subject' }}
                className="inline-flex items-center gap-1 text-primary"
              >
                {t('探索全部学科')}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('学习档案')}</h2>
              {session.data && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('新建学习档案')}
                  onClick={() => setProfileOpen(true)}
                >
                  <Plus />
                </Button>
              )}
            </div>
            {profile ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-xl font-medium text-primary">
                    {profile.nickname.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold">{profile.nickname}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('{{v0}} 岁 · 每天 {{v1}} 分钟', {
                        v0: profile.age,
                        v1: profile.dailyMinutes,
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {t('正在走向的目标')}
                  </p>
                  {data?.goals.length ? (
                    data.goals.slice(0, 2).map((goal) => (
                      <Link
                        key={goal.id}
                        to="/learn"
                        search={{ topic: goal.topicId, mode: 'learn' }}
                        className="mt-3 flex items-center gap-2 text-sm"
                      >
                        <Flag className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">
                          {graph.byId.has(goal.topicId)
                            ? topicName(graph.byId.get(goal.topicId)!)
                            : t('学习目标')}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('还没有设定目标')}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Compass className="size-7" />
                </div>
                <p className="text-sm font-medium">
                  {t('每个孩子，都有自己的节奏')}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {t('创建一个档案，让成长有迹可循。')}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() =>
                    session.data ? setProfileOpen(true) : setAuthOpen(true)
                  }
                >
                  <Plus />
                  {t('创建学习档案')}
                </Button>
              </div>
            )}
          </Panel>
          <Panel>
            <SectionTitle title={t('这一周的小小积累')} />
            <div
              className="flex h-28 items-end justify-between gap-2"
              role="img"
              aria-label={activity
                .map((day) =>
                  t('{{v0}} 完成 {{v1}} 题', { v0: day.label, v1: day.count }),
                )
                .join('；')}
            >
              {activity.map((day, index) => (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-[10px] text-muted-foreground">
                    {day.count || ''}
                  </span>
                  <span
                    className="w-full max-w-5 rounded-t-md bg-primary/20"
                    style={{
                      height: Math.max(4, (day.count / maxActivity) * 62),
                      backgroundColor:
                        index === 6 && day.count ? '#8774d9' : undefined,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t pt-4 text-xs leading-6 text-muted-foreground">
              {activity.some((day) => day.count)
                ? t('每一次认真思考，都让理解更进一步。')
                : t('第一份积累，从今天的一次练习开始。')}
            </p>
          </Panel>
          <section className="rounded-2xl border border-success/15 bg-success-soft/70 p-6">
            <span className="flex size-9 items-center justify-center rounded-lg bg-card/70 text-success">
              <Sparkles className="size-4" />
            </span>
            <h2 className="mt-4 text-sm font-semibold">
              {t('给家长的一点小建议')}
            </h2>
            <p className="mt-3 text-xs leading-7 text-muted-foreground">
              {t(
                '问一句“你是怎么想的”，往往比马上告诉孩子答案，更能帮助你看见他的理解。',
              )}
            </p>
            <Link
              to="/about"
              className="mt-4 inline-flex items-center gap-1 text-xs text-success"
            >
              {t('了解掌握标准')}
              <ChevronRight className="size-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </>
  )
}
