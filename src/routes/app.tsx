import { createFileRoute } from '@tanstack/react-router'
import { catalogQuery } from '@/lib/queries'
import { Dashboard } from '@/features/dashboard'

export const Route = createFileRoute('/app')({
  component: Dashboard,
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
})
