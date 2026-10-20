import { useReducedMotion } from '@/lib/motion-preference'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { animate, motion, useMotionValueEvent, useScroll } from 'motion/react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Menu,
  Orbit,
  Pause,
  Play,
  Plus,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Select } from '@/components/ui/select'
import { cn } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ElasticRule, Reveal } from './motion'
import { useRouteEntryReady } from './route-stage'

export function StartLink({
  inverse = false,
  small = false,
  children,
}: {
  inverse?: boolean
  small?: boolean
  children?: React.ReactNode
}) {
  const { t } = useI18n()
  const label = children ?? t('开始使用')
  return (
    <Link
      to="/app"
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn(
        'group relative isolate inline-flex shrink-0 items-center justify-center gap-5 overflow-hidden rounded-full border px-7 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-primary/50',
        inverse
          ? 'border-white/40 text-white'
          : 'border-site-ink text-site-ink',
        small && 'px-5 py-3',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 translate-y-full rounded-t-[50%] transition-[transform,border-radius] duration-500 ease-site group-hover:translate-y-0 group-hover:rounded-none group-focus-visible:translate-y-0 group-focus-visible:rounded-none motion-reduce:transition-none',
          inverse ? 'bg-white' : 'bg-site-ink',
        )}
      />
      <span
        className={cn(
          'relative block overflow-hidden leading-6 transition-colors duration-300',
          inverse
            ? 'group-hover:text-site-ink group-focus-visible:text-site-ink'
            : 'group-hover:text-white group-focus-visible:text-white',
        )}
      >
        <span className="block transition-transform duration-500 ease-site group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-full block transition-transform duration-500 ease-site group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none"
        >
          {label}
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        className={cn(
          'size-4 transition-[transform,color] duration-500 ease-site group-hover:rotate-45 group-focus-visible:rotate-45 motion-reduce:transform-none motion-reduce:transition-none',
          inverse
            ? 'group-hover:text-site-ink group-focus-visible:text-site-ink'
            : 'group-hover:text-white group-focus-visible:text-white',
        )}
      />
    </Link>
  )
}

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const header = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const previous = useRef(0)
  const reduced = useReducedMotion()
  const ready = useRouteEntryReady()
  const { scrollY } = useScroll()
  const links = [
    { href: '#how', text: t('如何开始') },
    { href: '#explore', text: t('探索学科') },
    { href: '#questions', text: t('常见问题') },
  ]
  useLayoutEffect(() => {
    const items =
      header.current?.querySelectorAll<HTMLElement>('[data-site-nav]')
    if (!items || reduced) return
    if (!ready) {
      for (const item of items) item.style.opacity = '0'
      return () => {
        for (const item of items) item.style.opacity = ''
      }
    }
    const controls = animate(
      [...items],
      { y: [20, 0], opacity: [0, 1] },
      {
        duration: 0.8,
        delay: (index) => index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      },
    )
    return () => {
      controls.stop()
      for (const item of items) {
        item.style.opacity = ''
        item.style.transform = ''
      }
    }
  }, [ready, reduced])
  useMotionValueEvent(scrollY, 'change', (value) => {
    const isScrolled = value > 50
    if (isScrolled !== scrolled) setScrolled(isScrolled)
    if (Math.abs(value - previous.current) > 8) {
      setHidden(
        value > previous.current &&
          value > 180 &&
          !open &&
          !header.current?.contains(document.activeElement),
      )
      previous.current = value
    }
  })
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    const media = matchMedia('(min-width: 768px)')
    const resize = () => {
      if (media.matches) setOpen(false)
    }
    window.addEventListener('keydown', close)
    media.addEventListener('change', resize)
    return () => {
      window.removeEventListener('keydown', close)
      media.removeEventListener('change', resize)
    }
  }, [open])
  return (
    <motion.header
      ref={header}
      animate={{ y: hidden && !open ? '-130%' : '0%' }}
      transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        'fixed inset-x-4 top-3 z-30 mx-auto max-w-site rounded-2xl px-4 text-site-ink md:inset-x-8 md:top-4 md:px-6',
        scrolled || open
          ? 'bg-white/95 shadow-panel backdrop-blur-md'
          : 'bg-white/80 backdrop-blur-sm',
      )}
    >
      <div className="flex h-17 items-center justify-between gap-3">
        <a
          data-site-nav
          href="#top"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
          aria-label={t('学径官网')}
        >
          <Orbit className="size-8 text-primary" aria-hidden="true" />
          学径
          <span className="ml-1 hidden text-xs font-normal tracking-normal text-site-muted lg:inline">
            {t('让好奇，有路可走。')}
          </span>
        </a>
        <nav
          aria-label={t('官网导航')}
          className="hidden items-center gap-8 md:flex"
        >
          {links.map((link) => (
            <a
              data-site-nav
              key={link.href}
              href={link.href}
              className="py-3 text-xs underline-offset-4 hover:underline"
            >
              {link.text}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 md:gap-4">
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
            className="min-h-10 rounded-full border-transparent bg-transparent px-2 text-xs"
          />
          <span className="hidden sm:block">
            <StartLink small />
          </span>
          <button
            ref={toggle}
            type="button"
            aria-label={open ? t('关闭菜单') : t('打开菜单')}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => {
              setOpen(!open)
              setHidden(false)
            }}
            className="flex size-11 items-center justify-center rounded-full border md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <motion.nav
        id="site-menu"
        aria-label={t('移动官网导航')}
        initial={false}
        inert={!open}
        aria-hidden={!open}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{
          duration: reduced ? 0 : 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="overflow-hidden md:hidden"
      >
        <div className="flex flex-col gap-1 pt-4 pb-7">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="py-3 text-2xl font-medium"
            >
              {link.text}
            </a>
          ))}
          <div className="mt-5">
            <StartLink />
          </div>
        </div>
      </motion.nav>
    </motion.header>
  )
}

export function ProductReel() {
  const { t } = useI18n()
  const video = useRef<HTMLVideoElement>(null)
  const region = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(true)
  const [failed, setFailed] = useState(false)
  const [player, setPlayer] = useState(false)
  const desired = useRef(false)
  useEffect(() => {
    const element = video.current
    const frame = region.current
    if (!element || !frame) return
    let alive = true
    let inView = false
    function play() {
      if (!alive || !desired.current || !inView || reduced || document.hidden)
        return
      element!
        .play()
        .then(() => {
          if (!alive || !desired.current) element!.pause()
        })
        .catch(() => {
          if (alive) setPaused(true)
        })
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!(inView = entry.isIntersecting) || document.hidden || reduced)
          element.pause()
        else play()
      },
      { threshold: 0.15 },
    )
    const visibility = () => {
      if (document.hidden) element.pause()
      else play()
    }
    if (!reduced) {
      desired.current = true
      play()
    } else {
      desired.current = false
      element.pause()
    }
    observer.observe(frame)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive = false
      desired.current = false
      element.pause()
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [reduced])
  return (
    <>
      <Reveal>
        <div
          ref={region}
          className="site-reel relative isolate aspect-[355/400] overflow-hidden rounded-site-card bg-site-lilac md:aspect-video"
          data-cursor-label={t('看看')}
        >
          <div className="site-reel-media absolute inset-x-0 -inset-y-[6%]">
            <video
              ref={video}
              src={failed ? undefined : '/media/product-tour.mp4'}
              poster="/media/product-tour-poster.jpg"
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={t('学径产品演示：学习概览、知识地图与学习报告')}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onError={() => {
                setFailed(true)
                setPaused(true)
              }}
              className="h-full w-full object-cover object-center md:object-contain"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/65 to-transparent p-5 pt-20 text-white md:p-8 md:pt-24">
            <div>
              <p className="text-xs tracking-widest uppercase">
                {t('一条学习路线的诞生')}
              </p>
              <p className="mt-2 text-sm text-white/75">
                {t('真实产品演示 · 11 秒')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!failed && (
                <button
                  type="button"
                  aria-label={paused ? t('播放演示') : t('暂停演示')}
                  onClick={() => {
                    desired.current = paused
                    if (paused)
                      video.current?.play().catch(() => setPaused(true))
                    else video.current?.pause()
                  }}
                  className="flex size-11 items-center justify-center rounded-full border border-white/45 bg-black/20 backdrop-blur-sm"
                >
                  {paused ? (
                    <Play className="size-4" />
                  ) : (
                    <Pause className="size-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                aria-label={t('展开产品演示')}
                onClick={() => {
                  desired.current = false
                  video.current?.pause()
                  setPlayer(true)
                }}
                className="flex size-11 items-center justify-center rounded-full bg-white text-site-ink"
              >
                <ArrowUpRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </Reveal>
      <Dialog
        open={player}
        onOpenChange={setPlayer}
        title={t('从一个问题，到下一步学习')}
        description={t(
          '演示使用虚构学习档案；你自己的学习记录仅在账号内可见。',
        )}
      >
        {player && (
          <video
            src="/media/product-tour.mp4"
            poster="/media/product-tour-poster.jpg"
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl"
            aria-label={t('学径产品演示')}
          />
        )}
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {t(
            '演示依次展示学习概览、知识点之间的先修联系和学习报告。进入工作台后，可以选择目标、探索基础知识并记录学习过程。',
          )}
        </p>
      </Dialog>
    </>
  )
}

export function FaqRow({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  return (
    <div className="border-b border-white/20">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-6 py-7 text-left text-lg font-medium md:text-xl"
        >
          {question}
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: reduced ? 0 : 0.4 }}
            className="shrink-0"
          >
            <Plus className="size-5" />
          </motion.span>
        </button>
      </h3>
      <motion.div
        id={id}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        inert={!open}
        aria-hidden={!open}
        className="overflow-hidden"
      >
        <p className="max-w-2xl pb-7 text-sm leading-8 text-white/60 md:text-base">
          {answer}
        </p>
      </motion.div>
    </div>
  )
}

export function LearningArtwork({
  variant,
}: {
  variant: 'map' | 'fractions' | 'path' | 'growth'
}) {
  const { t } = useI18n()
  if (variant === 'map')
    return (
      <div
        aria-hidden="true"
        className="relative flex h-full items-center justify-center p-5"
      >
        <svg
          viewBox="0 0 400 400"
          className="h-full max-h-100 w-full overflow-visible"
        >
          <g fill="none" stroke="#ffffff88" strokeWidth="1.5">
            <path d="M200 200 85 95M200 200 320 85M200 200 325 280M200 200 120 335M85 95 45 200M320 85 360 170M120 335 45 200" />
          </g>
          {[
            [200, 200, 34],
            [85, 95, 18],
            [320, 85, 22],
            [325, 280, 18],
            [120, 335, 25],
            [45, 200, 12],
            [360, 170, 12],
          ].map(([x, y, r], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={i === 0 ? '#ffffff' : i % 2 ? '#c6bce9' : '#e8dfbd'}
            />
          ))}
          <g fill="#ffffff" fontSize="15" textAnchor="middle">
            <text x="200" y="265">
              {t('好奇心')}
            </text>
            <text x="85" y="58">
              {t('数学')}
            </text>
            <text x="320" y="43">
              {t('科学')}
            </text>
            <text x="120" y="385">
              {t('生活技能')}
            </text>
          </g>
          <circle
            cx="200"
            cy="200"
            r="46"
            fill="none"
            stroke="#ffffff40"
            strokeWidth="12"
          />
        </svg>
      </div>
    )
  if (variant === 'fractions')
    return (
      <div
        aria-hidden="true"
        className="flex h-full flex-col items-center justify-center gap-8 px-8"
      >
        <div className="relative flex size-48 items-center justify-center rounded-full border-8 border-white/70 bg-[conic-gradient(#b6a4e6_0deg_270deg,#e9e4f4_270deg_360deg)] shadow-xl md:size-60">
          <span className="absolute h-full border-l-3 border-white/90" />
          <span className="absolute w-full border-t-3 border-white/90" />
          <span className="z-10 flex size-20 items-center justify-center rounded-full bg-white text-3xl font-medium text-site-ink">
            ¾
          </span>
        </div>
        <div className="rotate-[-4deg] rounded-2xl bg-white px-6 py-4 shadow-panel">
          <p className="text-center text-lg font-medium text-site-ink">
            {t('小小的部分，也能连成整体。')}
          </p>
        </div>
      </div>
    )
  if (variant === 'path')
    return (
      <div
        aria-hidden="true"
        className="relative flex h-full flex-col justify-center gap-4 p-8 md:p-12"
      >
        {[t('认识整体与部分'), t('理解分数'), t('探索等值分数')].map(
          (label, index) => (
            <div
              key={label}
              className={cn(
                'flex items-center gap-4 rounded-2xl bg-white p-5 text-sm text-site-ink shadow-panel',
                index === 1 ? 'ml-5' : 'mr-5',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  index === 0
                    ? 'bg-success-soft text-success'
                    : 'bg-primary-soft text-primary',
                )}
              >
                {index === 0 ? (
                  <Check className="size-4" />
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </span>
              {label}
            </div>
          ),
        )}
        <span className="absolute right-6 bottom-7 flex size-11 items-center justify-center rounded-full bg-site-ink text-white">
          <ArrowDown className="size-5" />
        </span>
      </div>
    )
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col justify-center gap-6 p-8 md:p-12"
    >
      <div className="flex h-44 items-end justify-between gap-3">
        {[24, 42, 34, 58, 51, 76, 92].map((height, index) => (
          <div
            key={index}
            style={{ height: `${height}%` }}
            className={cn(
              'flex-1 rounded-t-xl',
              index === 6 ? 'bg-site-ink' : 'bg-white/75',
            )}
          />
        ))}
      </div>
      <div className="border-t border-site-ink/15 pt-5">
        <p className="text-xl font-medium text-site-ink">
          {t('理解，正在一点点发生。')}
        </p>
        <p className="mt-2 text-xs text-site-muted">
          {t('记录过程，而不只是分数。')}
        </p>
      </div>
    </div>
  )
}
