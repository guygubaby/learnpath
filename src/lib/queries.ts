import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  catalogSchema,
  profileSchema,
  workspaceSchema,
  type Profile,
} from './contracts'
import { z } from 'zod'
import { createGraph } from './graph'
import { request, withQuery } from './api-client'
import { authClient } from './auth-client'
import { useUi } from './store'

export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  staleTime: 60_000,
  refetchInterval: 300_000,
  queryFn: async () => {
    const catalog = catalogSchema.parse(await request('/api/catalog'))
    return { catalog, graph: createGraph(catalog) }
  },
})

export function useLearning() {
  const session = authClient.useSession()
  const userId = session.data?.user.id
  const selectedChildId = useUi((state) => state.selectedChildId)
  const catalog = useQuery(catalogQuery)
  const profiles = useQuery({
    queryKey: ['private', userId, 'profiles'],
    enabled: Boolean(userId),
    queryFn: async () =>
      z.array(profileSchema).parse(await request<Profile[]>('/api/profiles')),
  })
  const profile =
    profiles.data?.find((item) => item.id === selectedChildId) ??
    profiles.data?.[0]
  const workspace = useQuery({
    queryKey: ['private', userId, 'workspace', profile?.id],
    enabled: Boolean(userId && profile),
    queryFn: async () =>
      workspaceSchema.parse(
        await request(withQuery('/api/workspace', { childId: profile!.id })),
      ),
  })
  return { session, userId, catalog, profiles, profile, workspace }
}
export function useRefreshLearning() {
  const queryClient = useQueryClient()
  const { data } = authClient.useSession()
  return () =>
    queryClient.invalidateQueries({ queryKey: ['private', data?.user.id] })
}
