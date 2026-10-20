import { useReducedMotion } from '@/lib/motion-preference'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useBlocker, useRouter, useRouterState } from '@tanstack/react-router'
import { useI18n } from '@/lib/i18n'

const EntryContext = createContext(true)
export const useRouteEntryReady = () => useContext(EntryContext)

type Transition = {
  animations: Animation[]
  scroll: string
  cancelled: boolean
  covered: boolean
  timer?: ReturnType<typeof setTimeout>
}

export function RouteStage({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const reduce = useReducedMotion()
  const page = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const active = useRef<Transition | null>(null)
  const mounted = useRef(true)
  const [phase, setPhase] = useState<
    'idle' | 'covering' | 'covered' | 'revealing'
  >('idle')

  function release() {
    const job = active.current
    if (!job) return
    active.current = null
    clearTimeout(job.timer)
    for (const animation of job.animations) animation.cancel()
    document.documentElement.style.overflow = job.scroll
    if (page.current) {
      page.current.inert = false
      page.current.style.transform = ''
    }
    if (fill.current) {
      fill.current.style.opacity = '0'
      fill.current.style.transform = 'scaleY(0)'
    }
    if (mounted.current) setPhase('idle')
  }

  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: async ({ current, next }) => {
      if (active.current) {
        active.current.cancelled = true
        release()
      }
      if (
        current.pathname === next.pathname ||
        (current.pathname !== '/' && next.pathname !== '/') ||
        reduce
      )
        return false
      if (!page.current || !fill.current || !shade.current) return false
      const job: Transition = {
        animations: [],
        scroll: document.documentElement.style.overflow,
        cancelled: false,
        covered: false,
      }
      active.current = job
      document.documentElement.style.overflow = 'hidden'
      page.current.inert = true
      setPhase('covering')
      fill.current.style.opacity = '1'
      const cover = fill.current.animate(
        { transform: ['scaleY(0)', 'scaleY(1)'] },
        {
          duration: 700,
          easing: 'cubic-bezier(.76,0,.24,1)',
          fill: 'forwards',
        },
      )
      job.animations.push(
        cover,
        shade.current.animate(
          { opacity: [0, 0.3] },
          { duration: 500, fill: 'forwards' },
        ),
        page.current.animate(
          {
            transform: [
              'translateY(0)',
              `translateY(${innerWidth > innerHeight ? '-10vh' : '-5vh'})`,
            ],
          },
          {
            duration: 900,
            easing: 'cubic-bezier(.76,0,.2,1)',
            fill: 'forwards',
          },
        ),
      )
      // A failed route must never leave an opaque cover or an inert page behind.
      job.timer = setTimeout(release, 12_000)
      try {
        await cover.finished
      } catch {
        return job.cancelled
      }
      if (active.current !== job) return job.cancelled
      job.covered = true
      setPhase('covered')
      return false
    },
  })

  useEffect(
    () =>
      router.subscribe('onResolved', () => {
        const job = active.current
        if (!job || !fill.current) return
        if (!job.covered) {
          job.cancelled = true
          release()
          return
        }
        requestAnimationFrame(() => {
          if (active.current !== job || !fill.current || !page.current) return
          for (const animation of job.animations)
            if (
              !(animation.effect instanceof KeyframeEffect) ||
              animation.effect.target !== fill.current
            )
              animation.cancel()
          page.current.inert = false
          setPhase('revealing')
          const fade = fill.current.animate(
            { opacity: [1, 0] },
            { duration: 400, fill: 'forwards' },
          )
          job.animations.push(fade)
          fade.finished
            .then(() => {
              if (active.current !== job) return
              release()
              page.current
                ?.querySelector<HTMLElement>('main')
                ?.focus({ preventScroll: true })
            })
            .catch(() => {})
        })
      }),
    [router],
  )
  useEffect(() => {
    if (reduce) release()
  }, [reduce])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      release()
    }
  }, [])
  return (
    <EntryContext value={phase === 'idle' || phase === 'revealing'}>
      <div ref={page} data-route-stage>
        {children}
      </div>
      <div
        aria-hidden="true"
        data-route-cover
        data-phase={phase}
        className={`fixed inset-0 z-100 ${phase === 'idle' ? 'pointer-events-none invisible' : phase === 'revealing' ? 'pointer-events-none' : 'pointer-events-auto'}`}
      >
        <div ref={shade} className="absolute inset-0 bg-black opacity-0" />
        <div
          ref={fill}
          className="absolute inset-0 origin-bottom scale-y-0 bg-white"
        />
      </div>
      <p className="sr-only" role="status">
        {phase !== 'idle'
          ? t('正在打开页面')
          : pathname === '/'
            ? t('学径官网')
            : t('学习工作台')}
      </p>
    </EntryContext>
  )
}
