import { createFileRoute } from '@tanstack/react-router'
import { api } from '@/server/api'

const handler = ({ request }: { request: Request }) => api(request)
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
    },
  },
})
