import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const origin = process.env.LOCAL_APP_URL ?? 'http://127.0.0.1:3000'
let lastQuiz
assert(
  ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'This test only runs against local development',
)
function client() {
  const cookies = new Map()
  return async function call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        Cookie: [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    for (const value of response.headers.getSetCookie()) {
      const part = value.split(';')[0]
      const index = part.indexOf('=')
      cookies.set(part.slice(0, index), part.slice(index + 1))
    }
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    return { status: response.status, data }
  }
}
const parentA = client(),
  parentB = client(),
  anonymous = client()
const stamp = Date.now()
const password = 'Learnpath-local-test-42!'
const email = `learnpath-${stamp}@example.test`
assert.equal((await anonymous('/api/profiles')).status, 401)
assert.equal(
  (
    await anonymous('/api/settings/ai/models', 'POST', {
      protocol: 'openai',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'synthetic-test-key',
    })
  ).status,
  401,
  'Model discovery must require authentication',
)
assert.equal(
  (
    await parentA('/api/auth/sign-up/email', 'POST', {
      name: '本地测试家长',
      email,
      password,
    })
  ).status,
  200,
  'Parent A registration failed',
)
assert.equal(
  (
    await parentB('/api/auth/sign-up/email', 'POST', {
      name: '另一位测试家长',
      email: `learnpath-other-${stamp}@example.test`,
      password,
    })
  ).status,
  200,
  'Parent B registration failed',
)
const profile = (
  await parentA('/api/profiles', 'POST', {
    nickname: '小星',
    age: 7,
    dailyMinutes: 20,
    color: 'violet',
  })
).data
assert(profile.id, 'Profile creation failed')
assert.equal(
  (await parentB(`/api/workspace?childId=${profile.id}`)).status,
  404,
  'Cross-account access must fail',
)
assert.equal(
  (
    await parentA('/api/goals', 'POST', {
      childId: profile.id,
      topicId: 'mt_yJmvUCCym7',
    })
  ).status,
  201,
)
assert.equal(
  (
    await parentB('/api/goals', 'POST', {
      childId: profile.id,
      topicId: 'mt_yJmvUCCym7',
    })
  ).status,
  404,
)
assert.equal(
  (
    await parentA('/api/settings/ai', 'PUT', {
      protocol: 'openai',
      baseUrl: 'https://127.0.0.1/v1',
      model: 'test',
      apiKey: 'synthetic-test-key',
    })
  ).status,
  400,
)
assert.equal(
  (
    await parentA('/api/settings/ai', 'PUT', {
      protocol: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'custom-model',
      apiKey: 'synthetic-test-key',
    })
  ).status,
  200,
)
const settings = (await parentA('/api/settings/ai')).data
assert.equal(settings.settings.hasKey, true)
assert(
  !JSON.stringify(settings).includes('synthetic-test-key'),
  'API key leaked to client',
)
assert.equal((await parentB('/api/settings/ai')).data.settings, null)
const otherModels = await parentB('/api/settings/ai/models', 'POST', {
  protocol: 'openai',
  baseUrl: 'https://api.example.com/v1',
})
assert.equal(otherModels.status, 400)
assert.equal(
  otherModels.data.error.code,
  'KEY_REQUIRED',
  'Model discovery must not reuse another account’s stored key',
)
const privateModels = await parentA('/api/settings/ai/models', 'POST', {
  protocol: 'openai',
  baseUrl: 'http://127.0.0.1/v1',
})
assert.equal(privateModels.status, 400)
assert.equal(privateModels.data.error.code, 'INVALID_API_URL')
assert.equal((await parentA('/api/settings/ai', 'DELETE')).status, 200)
for (let index = 0; index < 3; index++) {
  const quizResponse = await parentA('/api/quizzes', 'POST', {
    childId: profile.id,
    topicId: 'mt_yJmvUCCym7',
    mode: 'practice',
  })
  assert.equal(quizResponse.status, 201, JSON.stringify(quizResponse.data))
  const quiz = quizResponse.data
  lastQuiz = quiz
  assert(!('correctIndex' in quiz), 'Answer leaked before submission')
  const numbers = [...quiz.question.matchAll(/\d+/g)].map((match) =>
    Number(match[0]),
  )
  const optionIndex = quiz.options.indexOf(String(numbers[0] + numbers[1]))
  assert(optionIndex >= 0)
  const answer = await parentA(`/api/quizzes/${quiz.id}/answers`, 'POST', {
    optionIndex,
  })
  assert.equal(answer.status, 200, JSON.stringify(answer.data))
  assert.equal(answer.data.correct, true)
  const before = (await parentA(`/api/workspace?childId=${profile.id}`)).data
  await parentA(`/api/quizzes/${quiz.id}/answers`, 'POST', {
    optionIndex: (optionIndex + 1) % 4,
  })
  const after = (await parentA(`/api/workspace?childId=${profile.id}`)).data
  assert.equal(
    after.totals.attempts,
    index + 1,
    'Repeated submission counted twice',
  )
  assert.equal(
    after.reviews[0].stage,
    before.reviews[0].stage,
    'Repeated submission postponed review',
  )
}
const state = (await parentA(`/api/workspace?childId=${profile.id}`)).data
assert.equal(state.totals.attempts, 3)
assert.equal(state.totals.correct, 3)
assert.equal(state.goals.length, 1)
const note = '本地集成测试：能独立演示并解释数量合并的过程。'
assert.equal(
  (
    await parentA(`/api/profiles/${profile.id}/observations`, 'POST', {
      topicId: 'mt_yJmvUCCym7',
      status: 'mastered',
      note,
    })
  ).status,
  200,
)
await parentA(`/api/quizzes/${lastQuiz.id}/answers`, 'POST', { optionIndex: 0 })
const preserved = (await parentA(`/api/workspace?childId=${profile.id}`)).data
  .progress[0]
assert.equal(
  preserved.source,
  'parent',
  'Retry overwrote newer parent evidence',
)
assert.equal(preserved.note, note)
const exported = await parentA('/api/reports/exports', 'POST', {
  childId: profile.id,
})
assert.equal(exported.status, 201, JSON.stringify(exported.data))
assert.equal(
  (await parentB(exported.data.downloadUrl)).status,
  404,
  'Export leaked across accounts',
)
assert.equal(
  (await parentA(exported.data.downloadUrl)).data.profile.id,
  profile.id,
  'R2 report does not match owner',
)
assert.equal(
  (
    await parentA(
      '/api/goals',
      'POST',
      { childId: profile.id, topicId: 'mt_yJmvUCCym7' },
      { Origin: 'https://attacker.example' },
    )
  ).status,
  403,
  'Cross-origin mutation accepted',
)
assert.equal(
  (
    await parentA('/api/profiles', 'POST', {
      nickname: 'x',
      age: 99,
      dailyMinutes: 20,
      color: 'violet',
    })
  ).status,
  400,
)
await mkdir(resolve('.data'), { recursive: true })
await writeFile(
  resolve('.data/browser-test-account.json'),
  JSON.stringify({ email, password, profileId: profile.id }),
  { mode: 0o600 },
)
process.stdout.write(
  'PASS: registration, opaque-cookie authentication, profiles, tenant isolation, goals, protected AI settings, quiz grading, idempotent answers, review persistence, CSRF and private R2 report export.\n',
)
