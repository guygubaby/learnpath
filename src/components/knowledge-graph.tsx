import { useI18n } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import type { Core } from 'cytoscape'
import { Minus, Plus, Scan } from 'lucide-react'
import type { Catalog, Progress, Topic } from '@/lib/contracts'
import { subjectMeta, topicName } from '@/lib/labels'
import { localGraphPositions } from '@/lib/graph'
import { Button } from './ui/button'

export function KnowledgeGraph({
  catalog,
  topics,
  selectedId,
  progress = [],
  onSelect,
  focused = false,
}: {
  catalog: Catalog
  topics: Topic[]
  selectedId: string
  progress?: Progress[]
  onSelect: (id: string) => void
  focused?: boolean
}) {
  const { t, locale } = useI18n()

  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<Core | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const signature =
    (focused ? selectedId : '') +
    topics.map((topic) => topic.id).join(',') +
    progress.map((item) => `${item.topicId}:${item.status}`).join(',')
  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    setLoading(true)
    setFailed(false)
    import('cytoscape')
      .then(({ default: cytoscape }) => {
        if (disposed || !container.current) return
        const ids = new Set(topics.map((topic) => topic.id))
        const compact = focused && topics.length <= 18
        const prerequisiteIds = new Set(
          catalog.dependencies
            .filter((edge) => edge.topicId === selectedId)
            .map((edge) => edge.prerequisiteId),
        )
        const positions = () =>
          localGraphPositions(
            [...ids],
            prerequisiteIds,
            selectedId,
            container.current!.clientWidth,
            container.current!.clientHeight,
          )
        const mastered = new Set(
          progress
            .filter((item) => item.status === 'mastered')
            .map((item) => item.topicId),
        )
        const cy = cytoscape({
          container: container.current,
          elements: [
            ...topics.map((topic) => ({
              data: {
                id: topic.id,
                label: topicName(topic),
                color: subjectMeta[topic.subject].color,
              },
              classes: mastered.has(topic.id) ? 'mastered' : '',
            })),
            ...catalog.dependencies
              .filter(
                (edge) => ids.has(edge.topicId) && ids.has(edge.prerequisiteId),
              )
              .map((edge, index) => ({
                data: {
                  id: `edge-${index}`,
                  source: edge.prerequisiteId,
                  target: edge.topicId,
                },
                classes: edge.strength === 'soft' ? 'soft' : '',
              })),
          ],
          style: [
            {
              selector: 'node',
              style: {
                width: 22,
                height: 22,
                'background-color': 'data(color)',
                'border-width': 4,
                'border-color': '#ffffff',
                label: topics.length <= 15 ? 'data(label)' : '',
                'font-family': 'sans-serif',
                'font-size': 13,
                color: '#50566c',
                'text-valign': 'bottom',
                'text-margin-y': 9,
                'text-wrap': 'wrap',
                'text-overflow-wrap': 'anywhere',
                'text-max-width': '95px',
                'overlay-opacity': 0,
              },
            },
            {
              selector: 'edge',
              style: {
                width: 1.5,
                'line-color': '#c9c6df',
                'target-arrow-color': '#c9c6df',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.65,
                'curve-style': 'bezier',
                opacity: 0.65,
              },
            },
            {
              selector: '.soft',
              style: { 'line-style': 'dashed', opacity: 0.35 },
            },
            {
              selector: '.mastered',
              style: { 'border-color': '#62a78b', 'border-width': 3 },
            },
            {
              selector: '.focus',
              style: {
                width: 34,
                height: 34,
                'border-width': 7,
                'border-color': '#e8e1fb',
                'font-weight': 'bold',
                label: 'data(label)',
                'font-size': 14,
                color: '#51458b',
                'z-index': 10,
              },
            },
          ],
          layout: compact
            ? { name: 'preset', positions: positions(), fit: false }
            : {
                name: 'breadthfirst',
                directed: true,
                spacingFactor: 1.65,
                padding: 55,
                animate: false,
                avoidOverlap: true,
                nodeDimensionsIncludeLabels: topics.length <= 15,
              },
          minZoom: 0.08,
          maxZoom: 3,
        })
        instance.current = cy
        cy.getElementById(selectedId).addClass('focus')
        cy.on('tap', 'node', (event) => onSelectRef.current(event.target.id()))
        cy.on('mouseover', 'node', (event) => {
          event.target.style('label', event.target.data('label'))
          if (container.current) container.current.style.cursor = 'pointer'
        })
        cy.on('mouseout', 'node', (event) => {
          event.target.removeStyle('label')
          if (container.current) container.current.style.cursor = 'default'
        })
        observer = new ResizeObserver(() => {
          cy.resize()
          if (compact) {
            const points = positions()
            cy.nodes().positions((node) => points[node.id()])
          }
        })
        observer.observe(container.current)
        setLoading(false)
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true)
          setLoading(false)
        }
      })
    return () => {
      disposed = true
      observer?.disconnect()
      instance.current?.destroy()
      instance.current = null
    }
    // Membership and mastery rebuild the graph; selecting a node only updates its highlight.
  }, [signature, catalog])
  useEffect(() => {
    const cy = instance.current
    if (!cy) return
    cy.nodes().removeClass('focus')
    cy.getElementById(selectedId).addClass('focus')
  }, [selectedId])
  useEffect(() => {
    const cy = instance.current
    if (!cy) return
    cy.batch(() => {
      for (const topic of topics)
        cy.getElementById(topic.id).data('label', topicName(topic, locale))
    })
  }, [locale, loading, catalog])
  return (
    <div
      className="relative h-full min-h-96 overflow-hidden rounded-xl bg-card"
      style={{
        backgroundImage: 'radial-gradient(#e0e2ed 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div
        ref={container}
        role="img"
        aria-label={t(
          '知识关系图，共 {{v0}} 个知识点。下方知识点列表提供相同内容的键盘入口。',
          { v0: topics.length },
        )}
        className="h-full w-full"
      />
      {(loading || failed) && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-card/75 px-6 text-center text-sm text-muted-foreground"
        >
          {failed
            ? t('图谱暂时无法绘制，请使用下方知识点列表。')
            : t('正在连接知识点…')}
        </p>
      )}
      <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-xl border bg-card p-1 shadow-panel">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('放大知识地图')}
          onClick={() => {
            const cy = instance.current
            if (cy)
              cy.zoom({
                level: cy.zoom() * 1.3,
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
              })
          }}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('缩小知识地图')}
          onClick={() => {
            const cy = instance.current
            if (cy)
              cy.zoom({
                level: cy.zoom() / 1.3,
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
              })
          }}
        >
          <Minus />
        </Button>
        <span className="h-5 border-l" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('适应全部知识点')}
          onClick={() => instance.current?.fit(undefined, 55)}
        >
          <Scan />
        </Button>
      </div>
      <p className="pointer-events-none absolute top-4 left-4 rounded-lg border bg-card/90 px-3 py-2 text-xs text-muted-foreground">
        {t('点击知识点探索联系，滚轮缩放，拖动平移')}
      </p>
    </div>
  )
}
