import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ReviewPage } from '@/features/review-page'

export const Route = createFileRoute('/review')({
  validateSearch: z.object({ tab: z.enum(['due', 'mistakes']).default('due') }),
  component: ReviewPage,
})
