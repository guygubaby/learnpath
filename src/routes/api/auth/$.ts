import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@/server/auth'
import { withErrors } from '@/server/http'

const handler = ({ request }: { request: Request }) =>
  withErrors(request, () => getAuth().handler(request))
export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: { GET: handler, POST: handler } },
})
