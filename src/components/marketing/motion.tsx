import { useReducedMotion } from '@/lib/motion-preference'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { useRouteEntryReady } from './route-stage'

export function splitDisplayWords(text: string, locale: string) {
  const parts =
    typeof Intl.Segmenter === 'function'
      ? [
          ...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
        ].map((part) => part.segment)
      : text.split(/(\s+)/)
  return parts.reduce<string[]>((words, part) => {
    // Keep punctuation with its word so Chinese line endings cannot wrap on their own.
    if (words.length && /^[，。！？、；：,.!?;:）】》”’\])}]+$/.test(part))
      words[words.length - 1] += part
    else words.push(part)
    return words
  }, [])
}

export function RevealText({
  lines,
  as: Tag = 'h2',
  className = '',
  intro = false,
  delay = 0,
  locale,
}: {
  lines: string[]
  as?: 'h1' | 'h2' | 'p'
  className?: string
  intro?: boolean
  delay?: number
  locale: string
}) {
  const element = useRef<HTMLElement>(null)
  const visible = useInView(element, { once: true, margin: '0px 0px -8% 0px' })
  const ready = useRouteEntryReady()
  const reduced = useReducedMotion()
  const text = lines.join('\n')
  useLayoutEffect(() => {
    const words = element.current?.querySelectorAll<HTMLElement>('[data-word]')
    if (!words || reduced) return
    if (!ready || (!intro && !visible)) {
      for (const word of words) word.style.transform = 'translateY(120%)'
      return () => {
        for (const word of words) word.style.transform = ''
      }
    }
    const controls = animate(
      [...words],
      { y: ['120%', '0%'] },
      {
        duration: 1.7,
        ease: [0.16, 1, 0.3, 1],
        delay: (index) => delay + index * Math.min(0.045, 0.6 / words.length),
      },
    )
    return () => {
      controls.stop()
      for (const word of words) word.style.transform = ''
    }
  }, [text, ready, visible, reduced, intro, delay])
  return (
    <Tag
      ref={element as React.Ref<HTMLHeadingElement & HTMLParagraphElement>}
      aria-label={lines.join(' ')}
      className={className}
    >
      {lines.map((line, index) => (
        <span key={index} className="block" aria-hidden="true">
          {splitDisplayWords(line, locale).map((word, wordIndex) => (
            <span
              key={wordIndex}
              className="inline-block overflow-hidden align-top leading-[1.15] whitespace-pre"
            >
              <span data-word className="inline-block pb-[.08em]">
                {word}
              </span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  )
}

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { once: true, margin: '0px 0px -5% 0px' })
  const reduced = useReducedMotion()
  const ready = useRouteEntryReady()
  useLayoutEffect(() => {
    if (!ref.current || reduced) return
    if (!visible || !ready) {
      ref.current.style.opacity = '0'
      ref.current.style.transform = 'translateY(60px)'
      return () => {
        if (ref.current) {
          ref.current.style.opacity = ''
          ref.current.style.transform = ''
        }
      }
    }
    const controls = animate(
      ref.current,
      { opacity: [0, 1], y: [60, 0] },
      { duration: 1.5, delay, ease: [0.16, 1, 0.3, 1] },
    )
    return () => controls.stop()
  }, [visible, reduced, delay, ready])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export function ElasticRule() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const bend = useMotionValue(50)
  const point = useMotionValue(50)
  const path = useTransform(() => `M0 50 Q${point.get()} ${bend.get()} 100 50`)
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative h-10"
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== 'mouse' || !ref.current) return
        const bounds = ref.current.getBoundingClientRect()
        point.set(((event.clientX - bounds.left) / bounds.width) * 100)
        bend.set(50 + ((event.clientY - bounds.top) / bounds.height - 0.5) * 65)
      }}
      onPointerLeave={() => {
        animate(bend, 50, {
          type: 'spring',
          stiffness: 160,
          damping: 7,
          mass: 1.2,
        })
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <motion.path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function ContextCursor() {
  const reduced = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState('')
  const [visible, setVisible] = useState(false)
  const x = useMotionValue(-100),
    y = useMotionValue(-100)
  const smoothX = useSpring(x, { stiffness: 190, damping: 25 })
  const smoothY = useSpring(y, { stiffness: 190, damping: 25 })
  useEffect(() => {
    const media = matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setEnabled(media.matches && !reduced)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [reduced])
  useEffect(() => {
    if (!enabled) return
    let lastLabel = ''
    let showing = false
    const hide = () => {
      if (showing) {
        showing = false
        setVisible(false)
      }
    }
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') {
        hide()
        return
      }
      x.set(event.clientX)
      y.set(event.clientY)
      if (!showing) {
        showing = true
        setVisible(true)
      }
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '[data-cursor-label],a,button,summary',
            )
          : null
      const value = target?.dataset.cursorLabel ?? ''
      if (value !== lastLabel) {
        setLabel(value)
        lastLabel = value
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('blur', hide)
    document.addEventListener('pointerleave', hide)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', hide)
      document.removeEventListener('pointerleave', hide)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [enabled])
  if (!enabled) return null
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-40"
      style={{ x: smoothX, y: smoothY }}
    >
      <motion.span
        animate={{
          width: label ? 84 : 8,
          height: label ? 84 : 8,
          opacity: visible ? 1 : 0,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex -translate-1/2 items-center justify-center rounded-full bg-primary text-xs font-medium text-white"
      >
        {label}
      </motion.span>
    </motion.div>
  )
}
