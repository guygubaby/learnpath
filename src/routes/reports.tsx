import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/reports-page'

export const Route = createFileRoute('/reports')({ component: ReportsPage })
