import { createFileRoute } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { LandingPage } from '@/features/landing-page'
import { request } from '@/lib/api-client'
import { taxonomySummarySchema } from '@/lib/contracts'
import { bundledTaxonomySummary, taxonomySummary } from '@/lib/taxonomy-summary'

const loadSummary = createIsomorphicFn()
  .server(async () => {
    try {
      const { getTaxonomy } = await import('@/server/taxonomy')
      return taxonomySummary((await getTaxonomy()).catalog)
    } catch {
      return bundledTaxonomySummary
    }
  })
  .client(async () => {
    try {
      return taxonomySummarySchema.parse(await request('/api/health'))
    } catch {
      return bundledTaxonomySummary
    }
  })

export const Route = createFileRoute('/')({
  component: LandingPage,
  ssr: true,
  loader: () => loadSummary(),
})
