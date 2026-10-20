import { z } from 'zod'

export const subjects = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Computing',
  'Life Skills',
  'Personal & Social Development',
  'Learning to Learn',
] as const
export const subjectSchema = z.enum(subjects)
export const topicTranslationSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(12000),
  evidence: z.array(z.string().max(6000)),
  assessmentPrompt: z.string().nullable(),
  sourceHash: z.string(),
})
export type TopicTranslation = z.infer<typeof topicTranslationSchema>
export const topicSchema = z.object({
  id: z.string().startsWith('mt_'),
  type: z.string(),
  subject: subjectSchema,
  domain: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  ageRangeStart: z.number().nullable(),
  ageRangeEnd: z.number().nullable(),
  centrality: z.number().nullable(),
  evidence: z.array(z.string()),
  assessmentPrompt: z.string().nullable(),
  standards: z.array(z.string()),
  translations: z.object({ 'zh-CN': topicTranslationSchema }).optional(),
  retired: z.boolean().optional(),
})
export const dependencySchema = z.object({
  topicId: z.string(),
  prerequisiteId: z.string(),
  strength: z.enum(['hard', 'soft']),
  reason: z.string(),
})
export const taxonomySourceSchema = z.object({
  repository: z.string().url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  taxonomyVersion: z.string(),
  generatedAt: z.string(),
  topics: z.number().int(),
  dependencies: z.number().int(),
  research: z.number().int(),
  syncedAt: z.string().optional(),
  researchRevision: z.string().optional(),
})
export const catalogSchema = z.object({
  version: z.string(),
  topics: z.array(topicSchema),
  dependencies: z.array(dependencySchema),
  source: taxonomySourceSchema.optional(),
})
export type Topic = z.infer<typeof topicSchema>
export type Dependency = z.infer<typeof dependencySchema>
export type Catalog = z.infer<typeof catalogSchema>

export const profileInputSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '请填写昵称')
    .max(24, '昵称不能超过 24 个字'),
  age: z.number().int().min(4).max(14),
  dailyMinutes: z.number().int().min(5).max(120),
  color: z.enum(['violet', 'blue', 'sage', 'amber']),
})
export const profileSchema = profileInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
})
export type Profile = z.infer<typeof profileSchema>
export type ProfileInput = z.infer<typeof profileInputSchema>

export const progressSchema = z.object({
  topicId: z.string(),
  status: z.enum(['learning', 'mastered']),
  score: z.number(),
  evidenceCount: z.number(),
  source: z.enum(['quiz', 'parent']),
  note: z.string().nullable(),
  updatedAt: z.string(),
})
export type Progress = z.infer<typeof progressSchema>
export const observationSchema = z.object({
  topicId: z.string().startsWith('mt_'),
  status: z.enum(['learning', 'mastered']),
  note: z.string().trim().min(8, '请用至少 8 个字记录孩子的具体表现').max(1000),
})
export const goalSchema = z.object({
  id: z.string(),
  childId: z.string(),
  topicId: z.string(),
  createdAt: z.string(),
})
export type Goal = z.infer<typeof goalSchema>
export const goalInputSchema = z.object({
  childId: z.string().uuid(),
  topicId: z.string().startsWith('mt_'),
})

export const providerSchema = z.object({
  protocol: z.enum(['openai', 'anthropic']),
  baseUrl: z.string().trim().url('请填写完整 API 地址').max(2048),
  model: z.string().trim().min(1, '请填写模型名称').max(200),
  apiKey: z
    .string()
    .trim()
    .max(4096)
    .refine((value) => !/[\r\n\0]/.test(value), '密钥包含无效字符')
    .optional(),
})
export type ProviderInput = z.infer<typeof providerSchema>
export const providerModelsInputSchema = providerSchema.omit({ model: true })
export type ProviderModelsInput = z.infer<typeof providerModelsInputSchema>
export const providerModelsResponseSchema = z.object({
  models: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        name: z.string().trim().min(1).max(500),
      }),
    )
    .max(5000),
})
export type ProviderModelsResponse = z.infer<
  typeof providerModelsResponseSchema
>
export const providerPublicSchema = providerSchema
  .omit({ apiKey: true })
  .extend({ hasKey: z.boolean(), updatedAt: z.string() })
export type ProviderPublic = z.infer<typeof providerPublicSchema>

export const questionContentSchema = z
  .object({
    question: z.string().min(5).max(3000),
    options: z.array(z.string().min(1).max(1000)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(5).max(3000),
  })
  .refine((value) => new Set(value.options).size === 4, '选项必须互不相同')
export type QuestionContent = z.infer<typeof questionContentSchema>
export const quizPublicSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  source: z.enum(['starter', 'ai']),
  mode: z.enum(['practice', 'diagnose', 'review']),
})
export type Quiz = z.infer<typeof quizPublicSchema>
export const quizRequestSchema = z.object({
  childId: z.string().uuid(),
  topicId: z.string().startsWith('mt_'),
  mode: z.enum(['practice', 'diagnose', 'review']).default('practice'),
})
export const quizAnswerSchema = z.object({
  optionIndex: z.number().int().min(0).max(3),
})
export const quizResultSchema = z.object({
  quizId: z.string(),
  correct: z.boolean(),
  correctIndex: z.number(),
  explanation: z.string(),
  score: z.number(),
  progress: progressSchema,
})
export type QuizResult = z.infer<typeof quizResultSchema>

export const reviewSchema = z.object({
  topicId: z.string(),
  dueAt: z.string(),
  stage: z.number(),
})
export type Review = z.infer<typeof reviewSchema>
export const attemptSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  optionIndex: z.number(),
  correctIndex: z.number(),
  explanation: z.string(),
  score: z.number(),
  source: z.string(),
  mode: z.string(),
  createdAt: z.string(),
})
export type Attempt = z.infer<typeof attemptSchema>
export const workspaceSchema = z.object({
  profile: profileSchema,
  progress: z.array(progressSchema),
  goals: z.array(goalSchema),
  reviews: z.array(reviewSchema),
  attempts: z.array(attemptSchema),
  totals: z.object({
    attempts: z.number(),
    correct: z.number(),
    studyDays: z.number(),
  }),
  activity: z.array(
    z.object({ date: z.string(), count: z.number(), correct: z.number() }),
  ),
})
export type Workspace = z.infer<typeof workspaceSchema>
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>
export const chatInputSchema = z.object({
  childId: z.string().uuid(),
  topicId: z.string().startsWith('mt_'),
  message: z.string().trim().min(1).max(4000),
})
export const researchSchema = z
  .object({
    topicId: z.string(),
    learn: z.unknown().optional(),
    pedagogy: z.unknown().optional(),
    assess: z.unknown().optional(),
    sources: z.array(z.unknown()).optional(),
    publicationNotes: z.unknown().optional(),
  })
  .passthrough()
export type TeachingResearch = z.infer<typeof researchSchema>
