import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import {
  profileInputSchema,
  profileSchema,
  goalInputSchema,
  observationSchema,
  providerSchema,
  providerModelsInputSchema,
  quizRequestSchema,
  quizAnswerSchema,
  questionContentSchema,
  chatInputSchema,
  chatMessageSchema,
  type Quiz,
} from '@/lib/contracts'
import { starterQuestion } from '@/lib/starter-questions'
import { getAuth } from './auth'
import { assertOrigin, HttpError, json, readBody, withErrors } from './http'
import {
  ownChild,
  profileColumns,
  recordAnswer,
  rows,
  run,
  workspace,
} from './repository'
import { getTaxonomy, getResearch, getTopic, taxonomyState } from './taxonomy'
import { requestLocale } from '@/lib/locale'
import { syncTaxonomy } from './taxonomy-sync'
import {
  generateQuestion,
  listProviderModels,
  publicProvider,
  saveProvider,
  storedProvider,
  testProvider,
  tutorResponse,
} from './ai'

export function api(request: Request) {
  return withErrors(request, () => dispatch(request))
}

async function dispatch(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '')
  const method = request.method
  const locale = requestLocale(request)
  if (path === '/api/catalog' && method === 'GET') {
    const { catalog } = await getTaxonomy()
    return Response.json(catalog, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  if (path === '/api/taxonomy/status' && method === 'GET')
    return json(await taxonomyState())
  const licenseMatch = path.match(
    /^\/api\/taxonomy\/licenses\/(LICENSE|LICENSE-CONTENT|PROVENANCE\.md|CITATION\.cff)$/,
  )
  if (licenseMatch && method === 'GET') {
    const state = await taxonomyState()
    if (!state?.revision)
      return env.ASSETS.fetch(
        new Request(new URL(`/licenses/${licenseMatch[1]}`, env.APP_URL)),
      )
    const object = await env.TAXONOMY.get(
      `snapshots/${state.revision}/licenses/${licenseMatch[1]}`,
    )
    if (!object) throw new HttpError(404, 'LICENSE_NOT_FOUND', '未找到来源许可')
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  const publicResearch = path.match(
    /^\/api\/topics\/(mt_[A-Za-z0-9_-]+)\/research$/,
  )
  if (publicResearch && method === 'GET')
    return json(await getResearch(publicResearch[1]))
  if (path === '/api/health' && method === 'GET') {
    const { catalog } = await getTaxonomy()
    return json({
      ok: true,
      taxonomyVersion: catalog.version,
      topics: catalog.topics.filter((topic) => !topic.retired).length,
      revision: catalog.source?.commit,
    })
  }
  assertOrigin(request)
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) throw new HttpError(401, 'UNAUTHORIZED', '请先登录后继续')
  const userId = session.user.id
  const rateLimit = await env.API_RATE_LIMITER.limit({ key: userId })
  if (!rateLimit.success)
    throw new HttpError(429, 'RATE_LIMIT', '操作较频繁，请稍后重试')
  if (path === '/api/taxonomy/sync' && method === 'POST') {
    if (!env.TAXONOMY_OWNER_ID || userId !== env.TAXONOMY_OWNER_ID)
      throw new HttpError(403, 'FORBIDDEN', '你没有执行此操作的权限')
    const input = await readBody(
      request,
      z.object({ force: z.boolean().default(false) }),
    )
    return json(await syncTaxonomy(input.force))
  }

  if (path === '/api/profiles') {
    if (method === 'GET')
      return json(
        z
          .array(profileSchema)
          .parse(
            await rows(
              `SELECT ${profileColumns} FROM children WHERE user_id=? ORDER BY created_at`,
              userId,
            ),
          ),
      )
    if (method === 'POST') {
      const input = await readBody(request, profileInputSchema)
      const count = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM children WHERE user_id=?',
      )
        .bind(userId)
        .first<{ count: number }>()
      if ((count?.count ?? 0) >= 12)
        throw new HttpError(
          409,
          'PROFILE_LIMIT',
          '每个账号最多创建 12 个学习档案',
        )
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      await run(
        'INSERT INTO children (id,user_id,nickname,age,daily_minutes,color,created_at) VALUES (?,?,?,?,?,?,?)',
        id,
        userId,
        input.nickname,
        input.age,
        input.dailyMinutes,
        input.color,
        createdAt,
      )
      return json({ ...input, id, createdAt }, 201)
    }
  }
  const profileMatch = path.match(/^\/api\/profiles\/([^/]+)$/)
  if (profileMatch) {
    const id = profileMatch[1]
    await ownChild(userId, id)
    if (method === 'PATCH') {
      const input = await readBody(request, profileInputSchema)
      await run(
        'UPDATE children SET nickname=?,age=?,daily_minutes=?,color=? WHERE id=? AND user_id=?',
        input.nickname,
        input.age,
        input.dailyMinutes,
        input.color,
        id,
        userId,
      )
      return json(await ownChild(userId, id))
    }
    if (method === 'DELETE') {
      const files = await rows<{ object_key: string }>(
        'SELECT object_key FROM exports WHERE child_id=? AND user_id=?',
        id,
        userId,
      )
      if (files.length)
        await env.REPORTS.delete(files.map((file) => file.object_key))
      await run('DELETE FROM children WHERE id=? AND user_id=?', id, userId)
      return json({ ok: true })
    }
  }
  if (path === '/api/workspace' && method === 'GET')
    return json(await workspace(userId, url.searchParams.get('childId') ?? ''))
  if (path === '/api/goals' && method === 'POST') {
    const input = await readBody(request, goalInputSchema)
    await ownChild(userId, input.childId)
    await getTopic(input.topicId)
    await run(
      'INSERT INTO goals (id,child_id,topic_id,created_at) VALUES (?,?,?,?) ON CONFLICT(child_id,topic_id) DO NOTHING',
      crypto.randomUUID(),
      input.childId,
      input.topicId,
      new Date().toISOString(),
    )
    return json({ ok: true }, 201)
  }
  const goalMatch = path.match(/^\/api\/goals\/([^/]+)$/)
  if (goalMatch && method === 'DELETE') {
    const id = z.string().uuid().parse(goalMatch[1])
    const row = await env.DB.prepare(
      'SELECT g.child_id FROM goals g JOIN children c ON c.id=g.child_id WHERE g.id=? AND c.user_id=?',
    )
      .bind(id, userId)
      .first<{ child_id: string }>()
    if (!row) throw new HttpError(404, 'GOAL_NOT_FOUND', '未找到这个学习目标')
    await run('DELETE FROM goals WHERE id=?', id)
    return json({ ok: true })
  }
  const observationMatch = path.match(
    /^\/api\/profiles\/([^/]+)\/observations$/,
  )
  if (observationMatch && method === 'POST') {
    const childId = observationMatch[1]
    await ownChild(userId, childId)
    const input = await readBody(request, observationSchema)
    await getTopic(input.topicId)
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO progress (child_id,topic_id,status,score,evidence_count,source,note,updated_at) VALUES (?,?,?,?,1,'parent',?,?) ON CONFLICT(child_id,topic_id) DO UPDATE SET status=excluded.status,score=excluded.score,evidence_count=1,source='parent',note=excluded.note,updated_at=excluded.updated_at",
      ).bind(
        childId,
        input.topicId,
        input.status,
        input.status === 'mastered' ? 100 : 0,
        input.note,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO reviews (child_id,topic_id,stage,due_at) VALUES (?,?,0,?) ON CONFLICT(child_id,topic_id) DO UPDATE SET stage=0,due_at=excluded.due_at',
      ).bind(
        childId,
        input.topicId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ])
    return json({ ok: true })
  }
  if (path === '/api/settings/ai/models' && method === 'POST')
    return json(
      await listProviderModels(
        userId,
        await readBody(request, providerModelsInputSchema),
        request,
      ),
    )
  if (path === '/api/settings/ai') {
    if (method === 'GET')
      return json({ settings: publicProvider(await storedProvider(userId)) })
    if (method === 'PUT')
      return json(
        await saveProvider(userId, await readBody(request, providerSchema)),
      )
    if (method === 'DELETE') {
      await run('DELETE FROM ai_settings WHERE user_id=?', userId)
      return json({ ok: true })
    }
  }
  if (path === '/api/ai/test' && method === 'POST')
    return json(await testProvider(userId, locale))
  if (path === '/api/ai/chat' && method === 'POST') {
    const input = await readBody(request, chatInputSchema)
    const child = await ownChild(userId, input.childId)
    await getTopic(input.topicId)
    return tutorResponse(
      userId,
      input.childId,
      input.topicId,
      input.message,
      child.age,
      request,
    )
  }
  if (path === '/api/messages') {
    const childId = url.searchParams.get('childId') ?? ''
    const topicId = url.searchParams.get('topicId') ?? ''
    await ownChild(userId, childId)
    await getTopic(topicId)
    if (method === 'GET')
      return json(
        z
          .array(chatMessageSchema)
          .parse(
            await rows(
              'SELECT id,role,content,created_at AS createdAt FROM (SELECT rowid,* FROM messages WHERE child_id=? AND topic_id=? ORDER BY rowid DESC LIMIT 60) ORDER BY rowid',
              childId,
              topicId,
            ),
          ),
      )
    if (method === 'DELETE') {
      await run(
        'DELETE FROM messages WHERE child_id=? AND topic_id=?',
        childId,
        topicId,
      )
      return json({ ok: true })
    }
  }
  if (path === '/api/quizzes' && method === 'POST') {
    const input = await readBody(request, quizRequestSchema)
    const child = await ownChild(userId, input.childId)
    await getTopic(input.topicId)
    const settings = await storedProvider(userId)
    const starter = !settings ? starterQuestion(input.topicId, locale) : null
    const content = questionContentSchema.parse(
      starter ??
        (await generateQuestion(
          userId,
          input.topicId,
          child.age,
          request.signal,
          locale,
        )),
    )
    const id = crypto.randomUUID()
    const source = starter ? 'starter' : 'ai'
    const questionKey = createHash('sha256')
      .update(
        JSON.stringify({
          question: content.question,
          options: [...content.options].sort(),
        }),
      )
      .digest('hex')
    await run(
      'INSERT INTO quizzes (id,child_id,topic_id,content,question_key,source,mode,created_at) VALUES (?,?,?,?,?,?,?,?)',
      id,
      child.id,
      input.topicId,
      JSON.stringify(content),
      questionKey,
      source,
      input.mode,
      new Date().toISOString(),
    )
    const quiz: Quiz = {
      id,
      topicId: input.topicId,
      question: content.question,
      options: content.options,
      source,
      mode: input.mode,
    }
    return json(quiz, 201)
  }
  const answerMatch = path.match(/^\/api\/quizzes\/([^/]+)\/answers$/)
  if (answerMatch && method === 'POST') {
    const id = z.string().uuid().parse(answerMatch[1])
    const input = await readBody(request, quizAnswerSchema)
    const quiz = await env.DB.prepare(
      'SELECT q.* FROM quizzes q JOIN children c ON c.id=q.child_id WHERE q.id=? AND c.user_id=?',
    )
      .bind(id, userId)
      .first<{
        child_id: string
        topic_id: string
        content: string
        question_key: string
      }>()
    if (!quiz) throw new HttpError(404, 'QUIZ_NOT_FOUND', '未找到这道练习')
    const content = questionContentSchema.parse(JSON.parse(quiz.content))
    const progress = await recordAnswer(
      id,
      quiz.child_id,
      quiz.topic_id,
      quiz.question_key,
      input.optionIndex,
      input.optionIndex === content.correctIndex ? 1 : 0,
    )
    const attempt = await env.DB.prepare(
      'SELECT score FROM attempts WHERE quiz_id=?',
    )
      .bind(id)
      .first<{ score: number }>()
    return json({
      quizId: id,
      correct: attempt!.score === 1,
      correctIndex: content.correctIndex,
      explanation: content.explanation,
      score: attempt!.score,
      progress,
    })
  }
  if (path === '/api/reports/exports' && method === 'POST') {
    const input = await readBody(
      request,
      z.object({ childId: z.string().uuid() }),
    )
    const data = await workspace(userId, input.childId)
    const id = crypto.randomUUID()
    const objectKey = `exports/${userId}/${id}.json`
    const now = new Date().toISOString()
    const { catalog } = await getTaxonomy()
    await env.REPORTS.put(
      objectKey,
      JSON.stringify(
        { exportedAt: now, taxonomyVersion: catalog.version, ...data },
        null,
        2,
      ),
      { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
    )
    await run(
      'INSERT INTO exports (id,user_id,child_id,object_key,created_at) VALUES (?,?,?,?,?)',
      id,
      userId,
      input.childId,
      objectKey,
      now,
    )
    return json({ id, downloadUrl: `/api/reports/exports/${id}` }, 201)
  }
  const exportMatch = path.match(/^\/api\/reports\/exports\/([^/]+)$/)
  if (exportMatch && method === 'GET') {
    const id = z.string().uuid().parse(exportMatch[1])
    const record = await env.DB.prepare(
      'SELECT object_key FROM exports WHERE id=? AND user_id=?',
    )
      .bind(id, userId)
      .first<{ object_key: string }>()
    if (!record)
      throw new HttpError(404, 'EXPORT_NOT_FOUND', '未找到这个导出文件')
    const object = await env.REPORTS.get(record.object_key)
    if (!object)
      throw new HttpError(
        404,
        'EXPORT_NOT_FOUND',
        '导出文件已不可用，请重新生成',
      )
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="learnpath-report-${id}.json"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }
  throw new HttpError(404, 'NOT_FOUND', '未找到这个接口')
}
