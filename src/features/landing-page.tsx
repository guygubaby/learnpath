import { useReducedMotion } from '@/lib/motion-preference'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react'
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Compass,
  Code2,
  Orbit,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Route } from '@/routes/index'
import { cn } from '@/components/ui/button'
import {
  ContextCursor,
  ElasticRule,
  Reveal,
  RevealText,
} from '@/components/marketing/motion'
import {
  FaqRow,
  LearningArtwork,
  ProductReel,
  SiteHeader,
  StartLink,
} from '@/components/marketing/site-parts'

function ServiceCard({
  index,
  title,
  description,
  detail,
}: {
  index: number
  title: string
  description: string
  detail: string
}) {
  const row = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(270)
  const [desktop, setDesktop] = useState(false)
  const [open, setOpen] = useState(index === 0)
  const [manual, setManual] = useState(false)
  const [expanded, setExpanded] = useState(index === 0)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: row,
    offset: ['start 85%', 'start 45%'],
  })
  const revealHeight = useTransform(scrollYProgress, [0, 0.85], [96, height])
  const background = useTransform(
    scrollYProgress,
    [0, 0.65],
    ['#f2f2f0', '#171719'],
  )
  const foreground = useTransform(
    scrollYProgress,
    [0, 0.65],
    ['#171719', '#ffffff'],
  )
  const detailsOpacity = useTransform(scrollYProgress, [0.25, 0.75], [0, 1])
  const id = `site-step-${index}`
  useMotionValueEvent(scrollYProgress, 'change', (value) =>
    setExpanded(value > 0.5 || index === 0),
  )
  useEffect(() => {
    const media = matchMedia(
      '(min-width: 768px) and (hover: hover) and (pointer: fine)',
    )
    const update = () => setDesktop(media.matches && !reduced)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [reduced])
  useEffect(() => {
    if (!content.current) return
    const measure = () => setHeight(content.current!.scrollHeight + 96)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [description, detail])
  const scrub = desktop && index > 0 && !manual
  return (
    <div ref={row} style={{ minHeight: desktop ? height : undefined }}>
      <motion.article
        data-service-card
        style={
          scrub
            ? {
                height: revealHeight,
                backgroundColor: background,
                color: foreground,
              }
            : undefined
        }
        className={cn(
          'overflow-hidden rounded-site-card',
          scrub
            ? ''
            : open || desktop
              ? 'bg-site-ink text-white'
              : 'bg-site-soft text-site-ink',
        )}
      >
        <h3>
          <button
            type="button"
            aria-expanded={scrub ? expanded : open || desktop}
            aria-controls={id}
            onClick={() => {
              setManual(true)
              setOpen(scrub ? !expanded : !open)
              setDesktop(false)
            }}
            className="flex min-h-24 w-full items-center gap-5 px-6 py-5 text-left md:px-9"
          >
            <span className="text-xs tabular-nums opacity-50">
              0{index + 1}
            </span>
            <span className="flex-1 text-2xl font-medium tracking-tight md:text-3xl">
              {title}
            </span>
            <Plus
              className={cn(
                'size-5 shrink-0 transition-transform duration-500',
                (scrub ? expanded : open || desktop) && 'rotate-45',
              )}
            />
          </button>
        </h3>
        <motion.div
          id={id}
          initial={false}
          animate={
            scrub || desktop
              ? undefined
              : { height: open ? 'auto' : 0, opacity: open ? 1 : 0 }
          }
          style={scrub ? { opacity: detailsOpacity } : undefined}
          transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
          inert={!desktop && !open}
          aria-hidden={!desktop && !open}
        >
          <div
            ref={content}
            className="grid gap-6 px-6 pb-9 md:grid-cols-[1fr_1.3fr] md:gap-16 md:px-9 md:pb-10"
          >
            <p className="text-xl leading-relaxed tracking-tight md:text-2xl">
              {description}
            </p>
            <p className="max-w-md text-sm leading-8 opacity-65">{detail}</p>
          </div>
        </motion.div>
      </motion.article>
    </div>
  )
}

export function LandingPage() {
  const { t, locale } = useI18n()
  const summary = Route.useLoaderData()
  const heroSize = locale === 'en' ? 'text-site-hero-en' : 'text-site-hero'
  const cards = [
    {
      variant: 'map' as const,
      eyebrow: t('知识有连接'),
      title: t('看到知识的来路，\n也看到它能去的地方。'),
      copy: t('不只是知识点的清单。沿着先修关系，找到理解一个问题需要的基础。'),
      color: 'bg-site-purple',
      ratio: 'aspect-[4/5]',
    },
    {
      variant: 'fractions' as const,
      eyebrow: t('理解有方法'),
      title: t('把抽象的概念，\n变成身边的小发现。'),
      copy: t('用熟悉的例子、动手活动和追问，把“记住了”慢慢变成“理解了”。'),
      color: 'bg-site-lilac',
      ratio: 'aspect-square',
    },
    {
      variant: 'path' as const,
      eyebrow: t('每一步有方向'),
      title: t('目标可以很远，\n下一步可以很小。'),
      copy: t('从当前基础出发，把想理解的知识拆成能一步步走完的学习路线。'),
      color: 'bg-site-sage',
      ratio: 'aspect-square',
    },
    {
      variant: 'growth' as const,
      eyebrow: t('成长有迹可循'),
      title: t('认真思考的过程，\n也值得被看见。'),
      copy: t('练习、复习和家长观察留下真实记录，让下一次学习更有依据。'),
      color: 'bg-site-peach',
      ratio: 'aspect-[4/5]',
    },
  ]
  const faqs = [
    [
      t('需要先注册，才能开始吗？'),
      t(
        '不用。进入工作台后，知识地图可以直接探索。需要保存学习目标、练习和进度时，再创建家长账号与孩子的学习档案；档案只需要昵称、参考年龄和每日学习时间。',
      ),
    ],
    [
      t('AI 家教需要额外购买订阅吗？'),
      t(
        '学径支持你自己的 OpenAI 或 Anthropic 兼容接口。填写 API 地址、模型和密钥后即可使用，实际模型费用由你选择的服务商收取。学径不设每日 AI 使用次数上限。',
      ),
    ],
    [
      t('内容适合中国小学的教材吗？'),
      t(
        '图谱覆盖小学阶段的多个学科，并提供简体中文翻译，但来源包含英美等课程标准，尚未逐一对应中国教材与年级。年龄只作参考，可以根据孩子的实际理解选择内容。',
      ),
    ],
    [
      t('一次答对，就代表学会了吗？'),
      t(
        '不会。练习记录会结合多道不同题目的表现来判断，也支持家长记录具体观察。这些记录用于安排下一步学习，不是标准化能力测验。AI 可能出错，有疑问时请和孩子一起核对。',
      ),
    ],
  ]
  return (
    <div
      id="top"
      className="min-h-dvh bg-white font-sans text-site-ink selection:bg-site-lilac"
    >
      <a
        href="#site-main"
        className="sr-only rounded-full bg-site-ink px-5 py-3 text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-5 focus:z-50"
      >
        {t('跳到主要内容')}
      </a>
      <SiteHeader />
      <ContextCursor />
      <main id="site-main" tabIndex={-1} className="outline-none">
        <section className="px-site-gutter pt-38 pb-16 md:pt-49 md:pb-24">
          <div className="mx-auto max-w-site">
            <p className="mb-7 flex items-center gap-2 text-xs tracking-wider text-site-muted md:justify-center">
              <span className="size-1.5 rounded-full bg-primary" />
              {t('给好奇心，一张可以出发的地图。')}
            </p>
            <RevealText
              as="h1"
              locale={locale}
              intro
              lines={[t('让每一份好奇，'), t('都有下一步。')]}
              className={cn(
                heroSize,
                'font-medium tracking-[-.055em] text-balance md:text-center',
              )}
            />
            <RevealText
              as="p"
              locale={locale}
              intro
              delay={0.1}
              lines={[
                t('把知识连成地图，把目标变成小径。'),
                t('和孩子一起，找到适合今天的那一步。'),
              ]}
              className="mt-7 max-w-xl text-base leading-relaxed tracking-tight text-site-muted md:mx-auto md:text-center md:text-xl"
            />
            <Reveal
              className="mt-9 flex items-center gap-6 md:justify-center"
              delay={0.4}
            >
              <StartLink />
              <a
                href="#film"
                className="group flex items-center gap-2 py-3 text-xs"
              >
                <span className="border-b border-site-ink/30 pb-0.5">
                  {t('先看看学径')}
                </span>
                <ArrowDown className="size-4 transition-transform duration-300 group-hover:translate-y-1 motion-reduce:transform-none" />
              </a>
            </Reveal>
            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-site-muted md:mt-15 md:justify-center">
              <span>
                {t('{{v0}} 个学科，一张地图', { v0: summary.subjects })}
              </span>
              <span className="h-3 border-l" />
              <span>{t('中文 / English')}</span>
              <span className="h-3 border-l" />
              <a
                href="https://github.com/guygubaby/learnpath"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-site-ink"
              >
                <Code2 className="size-3.5" />
                {t('开放源代码')}
              </a>
            </div>
          </div>
        </section>
        <section
          id="film"
          aria-label={t('学径产品演示')}
          className="scroll-mt-28 px-site-gutter"
        >
          <div className="mx-auto max-w-site">
            <ProductReel />
          </div>
        </section>
        <section
          id="how"
          className="scroll-mt-25 px-site-gutter py-site-section"
        >
          <div className="mx-auto max-w-site">
            <div className="grid gap-9 md:grid-cols-[1fr_2fr] md:gap-20">
              <p className="flex items-start gap-3 text-xs tracking-widest text-site-muted uppercase">
                <span className="mt-1 size-1.5 rounded-full bg-site-ink" />
                {t('学习，从连接开始')}
              </p>
              <RevealText
                locale={locale}
                lines={[
                  t('不是再多学一点，'),
                  t('而是把每一步，'),
                  t('真正连起来。'),
                ]}
                className="text-site-heading font-medium tracking-tight"
              />
            </div>
            <Reveal className="mt-10 grid gap-6 md:ml-[33.333%] md:grid-cols-2 md:pl-7">
              <p className="text-sm leading-8 text-site-muted">
                {t(
                  '孩子卡住的时候，缺的有时不是努力，而是一块尚未接上的基础。学径把知识之间的关系变得可见，让你知道可以从哪里重新开始。',
                )}
              </p>
              <p className="text-sm leading-8 text-site-muted">
                {t(
                  '选一个想理解的问题，看看它的先修知识。再通过 AI 讲解、动手练习与定期复习，一起把理解慢慢建立起来。',
                )}
              </p>
            </Reveal>
            <div className="mt-16 space-y-4 md:mt-24">
              <ServiceCard
                index={0}
                title={t('先看见，再出发。')}
                description={t('从一个好奇的问题，找到学习的起点。')}
                detail={t(
                  '按学科、年龄或中英文关键词探索知识。每个知识点都写明了内容、参考年龄、先修关系和可以观察的掌握表现。',
                )}
              />
              <ServiceCard
                index={1}
                title={t('有方向，也有陪伴。')}
                description={t('让 AI 帮着解释，让孩子自己想明白。')}
                detail={t(
                  '连接你自己的模型接口，用具体例子讲解，围绕当前知识点练习。遇到困难时回到基础，让提问、思考和尝试都有空间。',
                )}
              />
              <ServiceCard
                index={2}
                title={t('把小小的进步，留下来。')}
                description={t('用真实的学习记录，安排下一次出发。')}
                detail={t(
                  '目标路线、练习表现、复习时间和家长观察都保存在学习档案中。既看见已掌握的部分，也知道哪些内容值得再练一次。',
                )}
              />
            </div>
            <Reveal className="mt-16 grid grid-cols-3 gap-4 border-t pt-9 md:mt-22">
              {[
                {
                  value: summary.topics.toLocaleString(locale),
                  label: t('真实知识点'),
                },
                {
                  value: summary.dependencies.toLocaleString(locale),
                  label: t('先修连接'),
                },
                {
                  value: String(summary.subjects).padStart(2, '0'),
                  label: t('值得探索的学科'),
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-site-metric font-medium tracking-[-.06em] tabular-nums">
                    {item.value}
                  </p>
                  <p className="mt-3 text-xs text-site-muted">{item.label}</p>
                </div>
              ))}
            </Reveal>
            <p className="mt-5 text-xs text-site-muted">
              {t('基于 Marble 开源知识图谱 · 数据每日同步')}
            </p>
          </div>
        </section>
        <section
          id="explore"
          className="scroll-mt-20 rounded-t-site-surface bg-site-ink px-site-gutter py-site-section text-white"
        >
          <div className="mx-auto max-w-site">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <RevealText
                locale={locale}
                lines={[t('世界很大，'), t('从一个小问题开始。')]}
                className="text-site-heading font-medium tracking-tight"
              />
              <p className="max-w-xs text-sm leading-7 text-white/55">
                {t(
                  '数学、科学、英语、历史、地理、计算机、生活技能、个人与社会发展、学会学习。好奇心有很多种方向。',
                )}
              </p>
            </div>
            <div className="mt-16 grid items-start gap-14 md:mt-22 md:grid-cols-2 md:gap-16">
              {[
                cards.filter((_, index) => index % 2 === 0),
                cards.filter((_, index) => index % 2 === 1),
              ].map((column, columnIndex) => (
                <div
                  key={columnIndex}
                  className={cn(
                    'grid min-w-0 gap-14 md:gap-22',
                    columnIndex === 1 && 'md:mt-28',
                  )}
                >
                  {column.map((card) => (
                    <Reveal key={card.variant} delay={columnIndex * 0.1}>
                      <Link
                        to="/map"
                        data-cursor-label={t('探索')}
                        className="group block outline-none focus-visible:rounded-site-card focus-visible:ring-3 focus-visible:ring-primary"
                      >
                        <div
                          className={cn(
                            'overflow-hidden rounded-site-card transition-transform duration-1000 ease-site group-hover:scale-[.98] group-focus-visible:scale-[.98] motion-reduce:transform-none',
                            card.color,
                            card.ratio,
                          )}
                        >
                          <div className="h-full transition-transform duration-1000 ease-site group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transform-none">
                            <LearningArtwork variant={card.variant} />
                          </div>
                        </div>
                        <p className="mt-6 text-xs tracking-wider text-white/40">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-3 text-2xl leading-snug font-medium tracking-tight whitespace-pre-line md:text-3xl">
                          {card.title}
                        </h3>
                        <p className="mt-3 max-w-sm text-sm leading-7 text-white/50">
                          {card.copy}
                        </p>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-18 text-center md:mt-48">
              <StartLink inverse>{t('找到我的第一步')}</StartLink>
            </div>
          </div>
        </section>
        <section className="bg-site-soft px-site-gutter py-site-section">
          <div className="mx-auto grid max-w-site gap-12 md:grid-cols-2 md:gap-22">
            <div>
              <p className="mb-6 text-xs tracking-widest text-site-muted">
                {t('为孩子，也为陪伴他们的人')}
              </p>
              <RevealText
                locale={locale}
                lines={[t('把“你会了吗”，'), t('换成“你怎么想”。')]}
                className="text-site-heading font-medium tracking-tight"
              />
              <p className="mt-7 max-w-md text-sm leading-8 text-site-muted">
                {t(
                  '不是替孩子给出所有答案。我们希望把更多时间留给提问、动手和表达，也让家长更容易看见孩子正在怎样理解。',
                )}
              </p>
            </div>
            <div className="grid content-center gap-5 sm:grid-cols-2">
              {[
                {
                  icon: Compass,
                  title: t('路线有依据'),
                  body: t('必要先修与学习建议分开呈现，能看到推荐背后的连接。'),
                  surface: 'bg-white',
                },
                {
                  icon: BookOpen,
                  title: t('内容有出处'),
                  body: t(
                    '保留英文原文、课程标准与来源许可，中文翻译清楚标注。',
                  ),
                  surface: 'bg-site-lilac',
                },
                {
                  icon: Sparkles,
                  title: t('AI 由你选择'),
                  body: t(
                    '兼容 OpenAI / Anthropic 风格接口，使用自己的模型与密钥。',
                  ),
                  surface: 'bg-site-sage',
                },
                {
                  icon: Orbit,
                  title: t('成长属于你'),
                  body: t('学习记录按账号保存，支持多个档案与报告导出。'),
                  surface: 'bg-white',
                },
              ].map((item, index) => (
                <Reveal key={item.title} delay={index * 0.06}>
                  <div
                    className={cn('h-full rounded-site-card p-6', item.surface)}
                  >
                    <item.icon className="mb-9 size-6 stroke-[1.5]" />
                    <h3 className="text-lg font-medium">{item.title}</h3>
                    <p className="mt-3 text-xs leading-7 text-site-muted">
                      {item.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section
          id="questions"
          className="scroll-mt-20 rounded-t-site-surface bg-site-ink px-site-gutter pt-site-section text-white"
        >
          <div className="mx-auto max-w-site">
            <div className="grid gap-12 md:grid-cols-[1fr_1.6fr] md:gap-20">
              <div>
                <p className="mb-6 text-xs tracking-widest text-white/40">
                  {t('开始之前')}
                </p>
                <RevealText
                  locale={locale}
                  lines={[t('你可能想问。')]}
                  className="text-site-heading font-medium tracking-tight"
                />
              </div>
              <div>
                {faqs.map(([question, answer]) => (
                  <FaqRow key={question} question={question} answer={answer} />
                ))}
              </div>
            </div>
            <div className="mt-site-section text-white/25">
              <ElasticRule />
            </div>
            <div className="py-site-section md:text-center">
              <p className="mb-7 text-xs tracking-widest text-white/40">
                {t('下一步，从这里开始')}
              </p>
              <RevealText
                locale={locale}
                lines={[t('留一点时间，'), t('给好奇心。')]}
                className={cn(heroSize, 'font-medium tracking-[-.055em]')}
              />
              <Reveal className="mt-8">
                <p className="max-w-lg text-sm leading-8 text-white/55 md:mx-auto">
                  {t(
                    '不必一口气走很远。找到一个想理解的问题，今天，就从这一小步出发。',
                  )}
                </p>
                <div className="mt-9">
                  <StartLink inverse />
                </div>
              </Reveal>
            </div>
            <footer className="flex flex-wrap items-end justify-between gap-8 border-t border-white/20 py-9">
              <div>
                <a
                  href="#top"
                  className="flex items-center gap-2 text-xl font-medium"
                >
                  <Orbit className="size-7" />
                  学径
                </a>
                <p className="mt-3 text-xs text-white/40">
                  {t('让每一步学习，都有方向。')}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/55">
                <a
                  href="https://github.com/guygubaby/learnpath"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-white"
                >
                  GitHub
                  <ArrowUpRight className="size-3" />
                </a>
                <Link to="/about" className="hover:text-white">
                  {t('数据与许可')}
                </Link>
                <a
                  href="https://github.com/withmarbleapp/os-taxonomy"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                >
                  Marble Taxonomy ↗
                </a>
                <span>© {new Date().getUTCFullYear()} 学径</span>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  )
}
