import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { defaultTopicId } from '@/lib/labels'
import { catalogQuery } from '@/lib/queries'
import { LearnPage } from '@/features/learn-page'

export const Route = createFileRoute('/learn')({
  validateSearch: z.object({
    topic: z.string().default(defaultTopicId),
    mode: z.enum(['learn', 'practice', 'diagnose', 'review']).default('learn'),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: LearnPage,
})
