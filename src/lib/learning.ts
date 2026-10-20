import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Progress, Workspace } from './contracts'
import { isReady, prerequisitePath, type Graph } from './graph'

dayjs.extend(utc)
dayjs.extend(timezone)
export const learningTimezone = 'Asia/Shanghai'
export const localDate = (date?: string | Date) =>
  dayjs(date).tz(learningTimezone)

export function evidenceStatus(
  evidence: { questionKey: string; score: number }[],
) {
  const recent = evidence.slice(-5)
  if (!recent.length)
    return { status: 'learning' as const, score: 0, evidenceCount: 0 }
  const score = Math.round(
    (recent.reduce((sum, item) => sum + item.score, 0) / recent.length) * 100,
  )
  const evidenceCount = new Set(recent.map((item) => item.questionKey)).size
  return {
    status:
      evidenceCount >= 3 && score >= 80
        ? ('mastered' as const)
        : ('learning' as const),
    score,
    evidenceCount,
  }
}

export function nextReview(
  score: number,
  previousStage = -1,
  now = new Date(),
) {
  const stage = score >= 0.8 ? Math.min(previousStage + 1, 4) : 0
  const days = [1, 3, 7, 14, 30][stage]
  return { stage, dueAt: dayjs(now).add(days, 'day').toISOString() }
}

export function dailyPlan(graph: Graph, workspace: Workspace) {
  const mastered = new Set(
    workspace.progress
      .filter((item) => item.status === 'mastered')
      .map((item) => item.topicId),
  )
  const seen = new Set<string>()
  const entries: {
    topicId: string
    reason: string
    kind: 'review' | 'goal'
  }[] = []
  for (const review of workspace.reviews.filter((item) =>
    dayjs(item.dueAt).isBefore(dayjs()),
  )) {
    if (!graph.byId.has(review.topicId)) continue
    seen.add(review.topicId)
    entries.push({
      topicId: review.topicId,
      reason: '到了巩固的时间',
      kind: 'review',
    })
  }
  for (const goal of workspace.goals) {
    if (!graph.byId.has(goal.topicId)) continue
    for (const topic of prerequisitePath(
      graph,
      goal.topicId,
      workspace.progress,
    )) {
      if (
        seen.has(topic.id) ||
        mastered.has(topic.id) ||
        !isReady(graph, topic.id, workspace.progress)
      )
        continue
      seen.add(topic.id)
      entries.push({
        topicId: topic.id,
        reason:
          topic.id === goal.topicId ? '向学习目标迈进一步' : '先打好这块基础',
        kind: 'goal',
      })
    }
  }
  return entries.slice(
    0,
    Math.max(1, Math.floor(workspace.profile.dailyMinutes / 10)),
  )
}

export function weeklyActivity(
  workspace: Workspace | undefined,
  now = new Date(),
) {
  const today = localDate(now)
  return Array.from({ length: 7 }, (_, index) => {
    const date = today.subtract(6 - index, 'day')
    const key = date.format('YYYY-MM-DD')
    return {
      date: key,
      label: date.format('M/D'),
      count: workspace?.activity.find((item) => item.date === key)?.count ?? 0,
    }
  })
}

export function progressById(progress: Progress[] = []) {
  return new Map(progress.map((item) => [item.topicId, item]))
}
