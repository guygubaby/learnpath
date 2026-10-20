import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { subjectSchema } from '@/lib/contracts'
import { defaultTopicId } from '@/lib/labels'
import { catalogQuery } from '@/lib/queries'
import { MapPage } from '@/features/map-page'

export const mapSearchSchema = z.object({
  subject: subjectSchema
    .or(z.literal('all'))
    .catch('Mathematics')
    .default('Mathematics'),
  q: z.string().max(100).catch('').default(''),
  age: z.number().int().min(4).max(14).optional().catch(undefined),
  topic: z.string().catch(defaultTopicId).default(defaultTopicId),
  view: z.enum(['focus', 'subject', 'list']).catch('focus').default('focus'),
})
export const Route = createFileRoute('/map')({
  validateSearch: mapSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: MapPage,
})
