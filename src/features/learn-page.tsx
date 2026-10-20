import { useI18n } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import Markdown from 'react-markdown'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  Send,
  Sparkles,
  Square,
  Target,
} from 'lucide-react'
import { Route } from '@/routes/learn'
import {
  chatMessageSchema,
  quizPublicSchema,
  quizResultSchema,
  type Quiz,
  type QuizResult,
  type Topic,
} from '@/lib/contracts'
import { errorMessage, http, request, withQuery } from '@/lib/api-client'
import { ageLabel, domainName, topicName } from '@/lib/labels'
import { prerequisitePath } from '@/lib/graph'
import { useLearning, useRefreshLearning } from '@/lib/queries'
import { Button, cn } from '@/components/ui/button'
import { Textarea } from '@/components/ui/fields'
import {
  ErrorState,
  Loading,
  NeedsProfile,
  Panel,
  TopicIcon,
} from '@/components/shared'
import { TeachingGuidance, TopicDetail } from './topic-detail'
import type { AiSettingsResponse } from './settings-page'

export function LearnPage() {
  const { t, locale } = useI18n()

  const { topic: topicId, mode } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { catalog, profile, workspace } = useLearning()
  if (catalog.isPending) return <Loading />
  if (catalog.error)
    return <ErrorState error={catalog.error} retry={() => catalog.refetch()} />
  const { graph } = catalog.data
  const topic = graph.byId.get(topicId)
  if (!topic)
    return (
      <ErrorState
        error={new Error(t('未找到这个知识点，请从知识地图重新选择。'))}
      />
    )
  const diagnostics = prerequisitePath(
    graph,
    topic.id,
    workspace.data?.progress,
  ).slice(0, 5)
  return (
    <>
      <Link
        to="/map"
        search={{ topic: topic.id, subject: topic.subject, view: 'focus' }}
        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        {t('回到知识地图')}
      </Link>
      <div className="mb-7 flex items-start gap-4">
        <TopicIcon topic={topic} />
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-muted-foreground">
            {domainName(topic.domain)} · {ageLabel(topic)}
          </p>
          <h1 className="text-2xl leading-snug font-semibold">
            {topicName(topic)}
          </h1>
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('学习方式')}
          >
            {(
              [
                { value: 'learn', label: t('AI 一起学'), icon: Sparkles },
                { value: 'practice', label: t('动手练一练'), icon: BookOpen },
                { value: 'diagnose', label: t('检查基础'), icon: Target },
              ] as const
            ).map((item) => (
              <Button
                key={item.value}
                variant={
                  mode === item.value ||
                  (mode === 'review' && item.value === 'practice')
                    ? 'default'
                    : 'outline'
                }
                aria-pressed={
                  mode === item.value ||
                  (mode === 'review' && item.value === 'practice')
                }
                onClick={() =>
                  navigate({
                    search: { topic: topic.id, mode: item.value },
                    replace: true,
                  })
                }
              >
                <item.icon />
                {t(item.label)}
              </Button>
            ))}
          </div>
          {!profile ? (
            <NeedsProfile />
          ) : mode === 'learn' ? (
            <Tutor
              key={`${profile.id}-${topic.id}`}
              childId={profile.id}
              topic={topic}
            />
          ) : (
            <Practice
              key={`${profile.id}-${topic.id}-${mode}`}
              childId={profile.id}
              topics={mode === 'diagnose' ? diagnostics : [topic]}
              target={topic}
              mode={mode}
            />
          )}
          <Panel>
            <details>
              <summary className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4 text-primary" />
                {t('给家长和老师的教学参考')}
              </summary>
              <div className="mt-5">
                <TeachingGuidance topic={topic} />
              </div>
            </details>
          </Panel>
        </div>
        <aside className="rounded-2xl border bg-card p-6 shadow-panel">
          <TopicDetail key={topic.id} topic={topic} graph={graph} />
        </aside>
      </div>
    </>
  )
}

function Tutor({ childId, topic }: { childId: string; topic: Topic }) {
  const { t, locale } = useI18n()

  const { userId } = useLearning()
  const queryClient = useQueryClient()
  const messageKey = ['private', userId, 'messages', childId, topic.id]
  const messages = useQuery({
    queryKey: messageKey,
    queryFn: async () =>
      z
        .array(chatMessageSchema)
        .parse(
          await request(
            withQuery('/api/messages', { childId, topicId: topic.id }),
          ),
        ),
  })
  const settings = useQuery({
    queryKey: ['private', userId, 'ai-settings'],
    queryFn: () => request<AiSettingsResponse>('/api/settings/ai'),
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{
    message: string
    response: string
  } | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (follow.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight
  }, [pending?.response, messages.data?.length])
  async function send(value: string) {
    const message = value.trim()
    if (!message || busy) return
    setError('')
    setBusy(true)
    setInput('')
    setPending({ message, response: '' })
    follow.current = true
    const abort = new AbortController()
    controller.current = abort
    try {
      const response = await http.post('/api/ai/chat', {
        json: { childId, topicId: topic.id, message },
        signal: abort.signal,
        timeout: false,
      })
      const reader = response.body
        ?.pipeThrough(new TextDecoderStream())
        .getReader()
      if (!reader) throw new Error(t('模型未返回可读的回答，请重试'))
      let text = ''
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        text += chunk.value
        setPending({ message, response: text })
      }
      await queryClient.invalidateQueries({ queryKey: messageKey })
    } catch (error) {
      if (abort.signal.aborted)
        setError(t('已停止生成，尚未完成的回答不计入学习证据。'))
      else {
        setError(await errorMessage(error))
        setInput(message)
      }
      await queryClient.invalidateQueries({ queryKey: messageKey })
    } finally {
      setPending(null)
      setBusy(false)
      controller.current = null
      await queryClient.invalidateQueries({
        queryKey: ['private', userId, 'ai-settings'],
      })
    }
  }
  const quickQuestions = [
    t('用身边的例子解释这个知识点'),
    t('一步一步引导我思考，不要直接给答案'),
    t('有哪些容易混淆的地方？'),
  ]
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Sparkles className="size-4" />
          </span>
          {t('一起把它想明白')}
        </h2>
        <Link
          to="/settings"
          className="max-w-40 truncate text-xs text-muted-foreground hover:text-primary"
        >
          {settings.data?.settings?.model ?? t('连接你的模型')}
        </Link>
      </div>
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget
          follow.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100
        }}
        role="log"
        aria-label={t('学习对话')}
        aria-live="polite"
        aria-busy={busy}
        className="h-[28rem] space-y-5 overflow-y-auto p-5 sm:h-[32rem] sm:p-6"
      >
        {messages.isPending ? (
          <Loading label={t('正在加载对话')} />
        ) : messages.error ? (
          <ErrorState error={messages.error} retry={() => messages.refetch()} />
        ) : !messages.data.length && !pending ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Sparkles className="size-8" />
            </span>
            <h3 className="text-lg font-semibold">
              {t('关于「')}
              {topicName(topic)}
              {t('」，你想问什么？')}
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              {t(
                '可以从一个例子开始，也可以把不明白的地方说出来。我们慢慢来。',
              )}
            </p>
            {settings.data && !settings.data.settings && (
              <Link
                to="/settings"
                className="mt-5 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary"
              >
                {t('先连接你的 AI 模型')}
                <ArrowRight className="ml-2 inline size-4" />
              </Link>
            )}
          </div>
        ) : (
          messages.data.map((message) => (
            <Message
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))
        )}
        {pending && (
          <>
            <Message role="user" content={pending.message} />
            {pending.response ? (
              <Message role="assistant" content={pending.response} />
            ) : (
              <p
                role="status"
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" />
                {t('正在想一个适合你的例子…')}
              </p>
            )}
          </>
        )}
      </div>
      <div className="border-t p-4 sm:p-5">
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-warning-soft p-3 text-xs leading-6 text-warning"
          >
            {error}
            <Link to="/settings" className="ml-2 underline">
              {t('查看模型设置')}
            </Link>
          </p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={busy}
              onClick={() => {
                void send(question)
                document.getElementById('tutor-message')?.focus()
              }}
              className="min-h-9 rounded-lg border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
        <form
          action="/api/ai/chat"
          method="post"
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
        >
          <label htmlFor="tutor-message" className="sr-only">
            {t('向 AI 提问')}
          </label>
          <Textarea
            id="tutor-message"
            name="message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return
              event.preventDefault()
              if (
                event.nativeEvent.isComposing ||
                // Safari may end composition before the confirming Enter arrives.
                event.nativeEvent.keyCode === 229 ||
                event.repeat ||
                busy
              )
                return
              event.currentTarget.form?.requestSubmit()
            }}
            enterKeyHint="send"
            aria-describedby="tutor-message-hint"
            placeholder={t('把你的想法或问题写在这里…')}
            required
            maxLength={4000}
            className="min-h-24 text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p
              id="tutor-message-hint"
              className="text-[11px] leading-5 text-muted-foreground"
            >
              {t('Enter 发送，Shift + Enter 换行。')}
              <br />
              {t('AI 可能出错，有疑问时请和家长一起核对。')}
            </p>
            {busy ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => controller.current?.abort()}
              >
                <Square />
                {t('停止生成')}
              </Button>
            ) : (
              <Button type="submit" size="sm">
                <Send />
                {t('发送')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}

function Message({
  role,
  content,
}: {
  role: 'user' | 'assistant'
  content: string
}) {
  const { t, locale } = useI18n()

  return (
    <div className={cn('flex gap-3', role === 'user' && 'justify-end')}>
      {role === 'assistant' && (
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Sparkles className="size-3.5" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7',
          role === 'user'
            ? 'rounded-tr-sm bg-primary-soft'
            : 'min-w-0 rounded-tl-sm bg-muted/65',
        )}
      >
        <div className="break-words [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-primary/5 [&_code]:px-1 [&_h1]:mb-3 [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5">
          <Markdown
            skipHtml
            components={{
              img: ({ alt }) => (
                <span className="text-muted-foreground">
                  {alt
                    ? t('[图片说明：{{v0}}]', { v0: alt })
                    : t('[外部图片未自动加载]')}
                </span>
              ),
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </Markdown>
        </div>
      </div>
    </div>
  )
}

function Practice({
  childId,
  topics,
  target,
  mode,
}: {
  childId: string
  topics: Topic[]
  target: Topic
  mode: 'practice' | 'diagnose' | 'review'
}) {
  const { t, locale } = useI18n()

  const [index, setIndex] = useState(0)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answer, setAnswer] = useState<number | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const refresh = useRefreshLearning()
  const active = topics[index] ?? target
  const create = useMutation({
    mutationFn: async (topicId: string) => {
      try {
        return quizPublicSchema.parse(
          await http
            .post('/api/quizzes', {
              json: { childId, topicId, mode },
              timeout: false,
            })
            .json(),
        )
      } catch (error) {
        throw new Error(await errorMessage(error))
      }
    },
    onSuccess: (data) => {
      setQuiz(data)
      setAnswer(null)
      setResult(null)
    },
  })
  const submit = useMutation({
    mutationFn: async () =>
      quizResultSchema.parse(
        await request(`/api/quizzes/${quiz!.id}/answers`, 'POST', {
          optionIndex: answer,
        }),
      ),
    onSuccess: async (data) => {
      setResult(data)
      await refresh()
    },
  })
  if (mode === 'diagnose' && !topics.length)
    return (
      <Panel>
        <CheckCircle2 className="mb-4 size-9 text-success" />
        <h2 className="text-lg font-semibold">
          {t('这个目标的必要知识点已有掌握记录')}
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {t('可以继续练习巩固，或回到学习计划选择新的目标。')}
        </p>
        <Button variant="outline" className="mt-5" asChild>
          <Link to="/plan">{t('返回学习计划')}</Link>
        </Button>
      </Panel>
    )
  return (
    <Panel>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === 'diagnose'
              ? t('先检查这块基础：{{v0}}', { v0: topicName(active) })
              : mode === 'review'
                ? t('再遇见一次，看看还记得吗')
                : t('把理解，放进一道小题里')}
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {mode === 'diagnose'
              ? t(
                  '为「{{v0}}」检查必要基础 · {{v1}} / {{v2}}（每次最多 5 个）',
                  { v0: topicName(target), v1: index + 1, v2: topics.length },
                )
              : t('认真想一想，再选出你的答案。不确定时，也可以回到讲解。')}
          </p>
        </div>
        {quiz && (
          <span
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              quiz.source === 'ai'
                ? 'bg-primary-soft text-primary'
                : 'bg-success-soft text-success',
            )}
          >
            {quiz.source === 'ai'
              ? t('AI 生成练习，请家长复核')
              : t('入门练习')}
          </span>
        )}
      </div>
      {!quiz ? (
        <div className="rounded-xl border border-dashed px-5 py-12 text-center">
          <CircleHelp className="mx-auto mb-4 size-10 text-primary/55" />
          <h3 className="text-base font-medium">
            {t('准备好，从你的理解开始')}
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
            {t(
              '连接 AI 后，可以为任意知识点生成练习。部分数学和科学主题也提供入门练习。',
            )}
          </p>
          <Button
            className="mt-5"
            disabled={create.isPending}
            onClick={() => create.mutate(active.id)}
          >
            {create.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {create.isPending
              ? t('正在准备练习')
              : mode === 'diagnose'
                ? t('开始检查')
                : t('开始练习')}
          </Button>
        </div>
      ) : (
        <form
          action={`/api/quizzes/${quiz.id}/answers`}
          method="post"
          onSubmit={(event) => {
            event.preventDefault()
            if (answer !== null) submit.mutate()
          }}
        >
          <fieldset>
            <legend className="mb-5 text-base leading-8 font-medium">
              {quiz.question}
            </legend>
            <div className="space-y-3">
              {quiz.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 text-sm leading-6 transition-colors',
                    result && optionIndex === result.correctIndex
                      ? 'border-success/40 bg-success-soft'
                      : answer === optionIndex
                        ? 'border-primary/50 bg-primary-soft'
                        : 'hover:bg-muted',
                    result && 'cursor-default',
                  )}
                >
                  <input
                    type="radio"
                    name="answer"
                    className="mt-1"
                    required
                    value={optionIndex}
                    checked={answer === optionIndex}
                    disabled={Boolean(result)}
                    onChange={() => setAnswer(optionIndex)}
                  />
                  <span className="shrink-0 text-muted-foreground">
                    {String.fromCharCode(65 + optionIndex)}.
                  </span>
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!result && (
            <Button type="submit" className="mt-6" disabled={submit.isPending}>
              {submit.isPending && <LoaderCircle className="animate-spin" />}
              {t('检查答案')}
            </Button>
          )}
        </form>
      )}
      {(create.error || submit.error) && (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-warning-soft p-4 text-sm leading-7 text-warning"
        >
          {t((create.error ?? submit.error)?.message ?? '')}
          <Link to="/settings" className="ml-2 underline">
            {t('查看模型设置')}
          </Link>
        </div>
      )}
      {result && (
        <div role="status" className="mt-6 rounded-xl border bg-muted/50 p-5">
          <h3
            className={cn(
              'font-semibold',
              result.correct ? 'text-success' : 'text-warning',
            )}
          >
            {result.correct
              ? t('答对了，也试着说说你的理由')
              : t('再看一看，这里值得想一想')}
          </h3>
          <p className="mt-3 text-sm leading-8 text-muted-foreground">
            {result.explanation}
          </p>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {t('本次已记录。最近 ')}
            {result.progress.evidenceCount}
            {t(' 道不同题目，正确率')} {result.progress.score}
            {t(
              '%。至少 3 道不同题目、最近 5 次平均正确率达到 80%，才标记已掌握。',
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {mode === 'diagnose' && index < topics.length - 1 ? (
              <Button
                disabled={create.isPending}
                onClick={() => {
                  const next = index + 1
                  setIndex(next)
                  setQuiz(null)
                  setResult(null)
                  create.mutate(topics[next].id)
                }}
              >
                {t('继续检查下一步')}
                <ArrowRight />
              </Button>
            ) : mode === 'diagnose' ? (
              <Button asChild>
                <Link to="/plan">
                  {t('检查完成，查看学习路线')}
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button
                disabled={create.isPending}
                onClick={() => create.mutate(active.id)}
              >
                {create.isPending && <LoaderCircle className="animate-spin" />}
                {t('再练一道')}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/learn" search={{ topic: active.id, mode: 'learn' }}>
                {t('回到讲解')}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
