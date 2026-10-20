import { env } from 'cloudflare:workers'
import { z } from 'zod'
import {
  profileSchema,
  progressSchema,
  goalSchema,
  reviewSchema,
  workspaceSchema,
  questionContentSchema,
  type Profile,
  type Workspace,
} from '@/lib/contracts'
import { HttpError } from './http'

export async function rows<T>(
  sql: string,
  ...params: (string | number | null)[]
): Promise<T[]> {
  const result = await env.DB.prepare(sql)
    .bind(...params)
    .all<T>()
  return result.results
}
export async function run(sql: string, ...params: (string | number | null)[]) {
  return env.DB.prepare(sql)
    .bind(...params)
    .run()
}
export const profileColumns =
  'id,nickname,age,daily_minutes AS dailyMinutes,color,created_at AS createdAt'

export async function ownChild(
  userId: string,
  childId: string,
): Promise<Profile> {
  z.string().uuid().parse(childId)
  const profile = await env.DB.prepare(
    `SELECT ${profileColumns} FROM children WHERE id=? AND user_id=?`,
  )
    .bind(childId, userId)
    .first()
  if (!profile)
    throw new HttpError(404, 'CHILD_NOT_FOUND', '未找到这个学习档案')
  return profileSchema.parse(profile)
}

export async function workspace(
  userId: string,
  childId: string,
): Promise<Workspace> {
  const profile = await ownChild(userId, childId)
  const [progress, goals, reviews, attempts, totals, activity] =
    await Promise.all([
      rows(
        'SELECT topic_id AS topicId,status,score,evidence_count AS evidenceCount,source,note,updated_at AS updatedAt FROM progress WHERE child_id=?',
        childId,
      ),
      rows(
        'SELECT id,child_id AS childId,topic_id AS topicId,created_at AS createdAt FROM goals WHERE child_id=? ORDER BY created_at DESC',
        childId,
      ),
      rows(
        'SELECT topic_id AS topicId,due_at AS dueAt,stage FROM reviews WHERE child_id=? ORDER BY due_at',
        childId,
      ),
      rows<{
        id: string
        topicId: string
        content: string
        optionIndex: number
        score: number
        source: string
        mode: string
        createdAt: string
      }>(
        'SELECT a.id,a.topic_id AS topicId,q.content,a.option_index AS optionIndex,a.score,q.source,q.mode,a.created_at AS createdAt FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.child_id=? ORDER BY a.created_at DESC LIMIT 100',
        childId,
      ),
      rows(
        "SELECT COUNT(*) AS attempts,COALESCE(SUM(score),0) AS correct,COUNT(DISTINCT date(created_at,'+8 hours')) AS studyDays FROM attempts WHERE child_id=?",
        childId,
      ),
      rows(
        "SELECT date(created_at,'+8 hours') AS date,COUNT(*) AS count,COALESCE(SUM(score),0) AS correct FROM attempts WHERE child_id=? AND created_at>=? GROUP BY date(created_at,'+8 hours') ORDER BY date",
        childId,
        new Date(Date.now() - 31 * 86_400_000).toISOString(),
      ),
    ])
  return workspaceSchema.parse({
    profile,
    progress: z.array(progressSchema).parse(progress),
    goals: z.array(goalSchema).parse(goals),
    reviews: z.array(reviewSchema).parse(reviews),
    attempts: attempts.map((item) => {
      const { content, ...attempt } = item
      return { ...attempt, ...questionContentSchema.parse(JSON.parse(content)) }
    }),
    totals: totals[0],
    activity,
  })
}

export async function recordAnswer(
  quizId: string,
  childId: string,
  topicId: string,
  questionKey: string,
  optionIndex: number,
  score: number,
) {
  const now = new Date().toISOString()
  const attemptId = crypto.randomUUID()
  // The batch reads its own insert, so retries cannot count an answer twice or overwrite newer evidence.
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO attempts (id,quiz_id,child_id,topic_id,question_key,option_index,score,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(quiz_id) DO NOTHING',
    ).bind(
      attemptId,
      quizId,
      childId,
      topicId,
      questionKey,
      optionIndex,
      score,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO progress (child_id,topic_id,status,score,evidence_count,source,note,updated_at)
      SELECT ?,?,CASE WHEN COUNT(DISTINCT question_key)>=3 AND AVG(score)>=0.8 THEN 'mastered' ELSE 'learning' END,
      CAST(ROUND(AVG(score)*100) AS INTEGER),COUNT(DISTINCT question_key),'quiz',NULL,?
      FROM (SELECT question_key,score FROM attempts WHERE child_id=? AND topic_id=? ORDER BY created_at DESC,rowid DESC LIMIT 5) WHERE true
      HAVING EXISTS (SELECT 1 FROM attempts WHERE id=?)
      ON CONFLICT(child_id,topic_id) DO UPDATE SET status=excluded.status,score=excluded.score,evidence_count=excluded.evidence_count,source=excluded.source,note=NULL,updated_at=excluded.updated_at`,
    ).bind(childId, topicId, now, childId, topicId, attemptId),
    env.DB.prepare(
      `INSERT INTO reviews (child_id,topic_id,stage,due_at)
      SELECT ?,?,0,strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 day') WHERE EXISTS (SELECT 1 FROM attempts WHERE id=?)
      ON CONFLICT(child_id,topic_id) DO UPDATE SET
      due_at=strftime('%Y-%m-%dT%H:%M:%fZ','now',CASE WHEN ?<0.8 THEN '+1 day' WHEN stage=0 THEN '+3 days' WHEN stage=1 THEN '+7 days' WHEN stage=2 THEN '+14 days' ELSE '+30 days' END),
      stage=CASE WHEN ?<0.8 THEN 0 ELSE MIN(stage+1,4) END`,
    ).bind(childId, topicId, attemptId, score, score),
  ])
  const progress = await env.DB.prepare(
    'SELECT topic_id AS topicId,status,score,evidence_count AS evidenceCount,source,note,updated_at AS updatedAt FROM progress WHERE child_id=? AND topic_id=?',
  )
    .bind(childId, topicId)
    .first()
  return progressSchema.parse(progress)
}
