import { createFileRoute } from '@tanstack/react-router'
import { PlanPage } from '@/features/plan-page'

export const Route = createFileRoute('/plan')({ component: PlanPage })
