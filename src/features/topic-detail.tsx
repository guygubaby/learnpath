import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  Flag,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Topic, TeachingResearch } from '@/lib/contracts'
import { observationSchema, researchSchema } from '@/lib/contracts'
import type { Graph } from '@/lib/graph'
import { subjectMeta, topicName, domainName, ageLabel } from '@/lib/labels'
import { request } from '@/lib/api-client'
import { useLearning, useRefreshLearning } from '@/lib/queries'
import { useUi } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Textarea, Field } from '@/components/ui/fields'
import { TopicIcon } from '@/components/shared'

export function SetGoalButton({
  topic,
  small = false,
}: {
  topic: Topic
  small?: boolean
}) {
  const { t, locale } = useI18n()

  const { profile, session } = useLearning()
  const setAuthOpen = useUi((state) => state.setAuthOpen)
  const setProfileOpen = useUi((state) => state.setProfileOpen)
  const refresh = useRefreshLearning()
  const mutation = useMutation({
    mutationFn: () =>
      request('/api/goals', 'POST', {
        childId: profile!.id,
        topicId: topic.id,
      }),
    onSuccess: async () => {
      await refresh()
      toast.success(t('已加入学习目标，可以在学习计划中查看路线'))
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <Button
      variant="outline"
      size={small ? 'sm' : 'default'}
      disabled={mutation.isPending}
      onClick={() => {
        if (!session.data) setAuthOpen(true)
        else if (!profile) setProfileOpen(true)
        else mutation.mutate()
      }}
    >
      {mutation.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Flag />
      )}
      {t('设为目标')}
    </Button>
  )
}

export function TopicDetail({
  topic,
  graph,
  showRelated = true,
}: {
  topic: Topic
  graph: Graph
  showRelated?: boolean
}) {
  const { t, locale } = useI18n()

  const { profile, workspace } = useLearning()
  const [observationOpen, setObservationOpen] = useState(false)
  const meta = subjectMeta[topic.subject]
  const progress = workspace.data?.progress.find(
    (item) => item.topicId === topic.id,
  )
  const prerequisites = graph.prerequisites.get(topic.id) ?? []
  const content =
    locale === 'zh-CN' ? (topic.translations?.['zh-CN'] ?? topic) : topic
  return (
    <div className="space-y-6">
      {topic.retired && (
        <p className="rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
          {t('知识点已由上游移除，保留历史记录供查看。')}
        </p>
      )}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <TopicIcon topic={topic} />
          <span
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: meta.soft }}
          >
            {t(meta.name)}
          </span>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          {domainName(topic.domain)} · {ageLabel(topic)}
        </p>
        <h2 className="text-xl leading-snug font-semibold">
          {topicName(topic)}
        </h2>
        {topicName(topic) !== topic.name && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {topic.name}
          </p>
        )}
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {content.description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/learn" search={{ topic: topic.id, mode: 'learn' }}>
            <Sparkles />
            {t('一起学一学')}
          </Link>
        </Button>
        <SetGoalButton topic={topic} />
      </div>
      {progress && (
        <div className="rounded-xl bg-success-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-4" />
            {progress.status === 'mastered' ? t('已掌握') : t('正在学习')}
            {progress.source === 'parent'
              ? t(' · 家长观察')
              : t(' · {{v0}} 道不同练习', { v0: progress.evidenceCount })}
          </p>
          {progress.note && (
            <p className="mt-2 leading-6 text-muted-foreground">
              {progress.note}
            </p>
          )}
        </div>
      )}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('怎样判断学会了')}</h3>
        <ul className="space-y-3">
          {content.evidence.map((evidence, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 text-xs leading-6 text-muted-foreground"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/45" />
              {evidence}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('掌握标准来自原始资料；AI 会围绕这些标准提供练习。')}
        </p>
        {profile && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 px-0 text-primary"
            onClick={() => setObservationOpen(true)}
          >
            {t('记录孩子的具体表现')}
            <ChevronRight />
          </Button>
        )}
      </div>
      {showRelated && (
        <div className="border-t pt-5">
          <h3 className="mb-3 text-sm font-semibold">
            {t('先把这些基础连起来')}
          </h3>
          {prerequisites.length ? (
            <div className="space-y-1">
              {prerequisites.map((edge) => {
                const prerequisite = graph.byId.get(edge.prerequisiteId)!
                return (
                  <Link
                    key={edge.prerequisiteId}
                    to="/map"
                    search={{
                      topic: prerequisite.id,
                      subject: prerequisite.subject,
                      view: 'focus',
                    }}
                    className="flex items-center justify-between gap-3 rounded-lg py-2.5 text-xs hover:bg-muted"
                  >
                    <span>{topicName(prerequisite)}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {edge.strength === 'hard' ? t('必要基础') : t('学习建议')}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-xs leading-6 text-muted-foreground">
              {t('这是一个适合开始探索的基础知识点。')}
            </p>
          )}
        </div>
      )}
      {!!topic.standards.length && (
        <details className="border-t pt-4">
          <summary className="text-xs text-muted-foreground">
            {t('课程标准与检查问题')}
          </summary>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {content.assessmentPrompt?.replaceAll('{{name}}', t('学习者'))}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {topic.standards.map((standard) => (
              <li key={standard} className="break-all">
                {standard}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Dialog
        open={observationOpen}
        onOpenChange={setObservationOpen}
        title={t('记录一次真实的理解')}
        description={t('请根据掌握标准，记录孩子能够独立完成的表现。')}
      >
        {profile && observationOpen && (
          <ObservationForm
            childId={profile.id}
            topic={topic}
            onSuccess={() => setObservationOpen(false)}
          />
        )}
      </Dialog>
    </div>
  )
}

function ObservationForm({
  childId,
  topic,
  onSuccess,
}: {
  childId: string
  topic: Topic
  onSuccess: () => void
}) {
  const { t, locale } = useI18n()

  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'learning' | 'mastered'>('learning')
  const [error, setError] = useState('')
  const refresh = useRefreshLearning()
  const mutation = useMutation({
    mutationFn: () =>
      request(
        `/api/profiles/${childId}/observations`,
        'POST',
        observationSchema.parse({ topicId: topic.id, status, note }),
      ),
    onSuccess: async () => {
      await refresh()
      toast.success(t('观察已记录'))
      onSuccess()
    },
    onError: (error) => setError(error.message),
  })
  return (
    <form
      method="post"
      action={`/api/profiles/${childId}/observations`}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <fieldset>
        <legend className="mb-3 text-sm font-medium">{t('这次的表现')}</legend>
        <div className="flex flex-wrap gap-3">
          {(['learning', 'mastered'] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-12 items-center gap-2 rounded-lg border px-4 text-sm"
            >
              <input
                type="radio"
                name="status"
                checked={status === value}
                onChange={() => setStatus(value)}
              />
              {value === 'learning' ? t('还在练习') : t('可以独立完成')}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        id="observation-note"
        label={t('具体表现')}
        hint={t(
          '至少 8 个字。例如：能独立把 12 颗葡萄平均分成 4 份，并解释每份是整体的四分之一。',
        )}
      >
        <Textarea
          id="observation-note"
          name="note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value)
            setError('')
          }}
          required
          minLength={8}
          maxLength={1000}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {t('保存观察')}
      </Button>
    </form>
  )
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}
function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
export function TeachingGuidance({ topic }: { topic: Topic }) {
  const { t, locale } = useI18n()

  const { catalog } = useLearning()
  const revision = catalog.data?.catalog.source?.commit
  const query = useQuery({
    queryKey: ['research', revision, topic.id],
    staleTime: Infinity,
    queryFn: async () =>
      researchSchema
        .nullable()
        .parse(
          await request<TeachingResearch | null>(
            `/api/topics/${topic.id}/research`,
          ),
        ),
  })
  if (query.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('正在加载教学参考…')}
      </p>
    )
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {t('教学参考暂时无法加载。')}
        <button
          onClick={() => query.refetch()}
          className="ml-2 text-primary underline"
        >
          {t('重试')}
        </button>
      </p>
    )
  if (!query.data)
    return (
      <p className="text-sm text-muted-foreground">
        {t('这个知识点暂未附教学研究。')}
      </p>
    )
  const learn = object(query.data.learn)
  const pedagogy = object(query.data.pedagogy)
  const activities = Array.isArray(learn.activities)
    ? learn.activities.map(object)
    : []
  return (
    <div className="space-y-5 text-sm leading-7 text-muted-foreground">
      <p className="rounded-xl bg-warning-soft p-4 text-xs leading-6 text-warning">
        {t(
          '以下是英文原始教学研究，由 Agent 编写，活动尚未经实证验证。请结合孩子的反应使用，可让 AI 用中文解释。',
        )}
      </p>
      {typeof learn.summary === 'string' && <p>{learn.summary}</p>}
      {activities.slice(0, 3).map((activity, index) => (
        <details key={index} className="rounded-xl border p-4">
          <summary className="font-medium text-foreground">
            {typeof activity.title === 'string'
              ? activity.title
              : t('参考活动 {{v0}}', { v0: index + 1 })}
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {strings(activity.learnerActions).map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </details>
      ))}
      {!!strings(pedagogy.commonMisconceptions).length && (
        <div>
          <h3 className="mb-2 font-medium text-foreground">
            {t('常见理解误区（原文）')}
          </h3>
          <ul className="list-disc space-y-2 pl-5">
            {strings(pedagogy.commonMisconceptions).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <a
        href={`/api/topics/${topic.id}/research`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-primary underline underline-offset-4"
      >
        {t('查看完整研究、来源与审阅说明')}
      </a>
    </div>
  )
}
