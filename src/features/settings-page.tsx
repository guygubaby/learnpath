import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plug,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import {
  providerSchema,
  providerModelsInputSchema,
  providerModelsResponseSchema,
  type ProviderInput,
  type ProviderPublic,
} from '@/lib/contracts'
import { request } from '@/lib/api-client'
import { useLearning, useRefreshLearning } from '@/lib/queries'
import { useUi } from '@/lib/store'
import { AuthForm, ProfileForm } from '@/components/account-forms'
import { Button, cn } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/fields'
import { Dialog } from '@/components/ui/dialog'
import {
  ErrorState,
  Loading,
  PageHeading,
  Panel,
  SectionTitle,
} from '@/components/shared'

export type AiSettingsResponse = {
  settings: ProviderPublic | null
}
export function SettingsPage() {
  const { t, locale } = useI18n()

  const { session, userId, profile } = useLearning()
  const query = useQuery({
    queryKey: ['private', userId, 'ai-settings'],
    enabled: Boolean(userId),
    queryFn: () => request<AiSettingsResponse>('/api/settings/ai'),
  })
  const [deleteProfile, setDeleteProfile] = useState(false)
  const [deleteKey, setDeleteKey] = useState(false)
  const queryClient = useQueryClient()
  const selectChild = useUi((state) => state.selectChild)
  const setProfileOpen = useUi((state) => state.setProfileOpen)
  const refresh = useRefreshLearning()
  const removeProfile = useMutation({
    mutationFn: () => request(`/api/profiles/${profile!.id}`, 'DELETE'),
    onSuccess: async () => {
      selectChild(null)
      await refresh()
      setDeleteProfile(false)
      toast.success(t('学习档案及其记录已删除'))
    },
    onError: (error) => toast.error(error.message),
  })
  const removeKey = useMutation({
    mutationFn: () => request('/api/settings/ai', 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['private', userId, 'ai-settings'],
      })
      setDeleteKey(false)
      toast.success(t('AI 配置和密钥已删除'))
    },
    onError: (error) => toast.error(error.message),
  })
  if (session.isPending) return <Loading />
  return (
    <>
      <PageHeading
        title={t('让学习工具，适合你的方式')}
        description={t('连接你信任的模型服务，管理账号与学习档案。')}
      />
      {!session.data ? (
        <Panel className="mx-auto max-w-lg">
          <h2 className="mb-5 text-lg font-semibold">
            {t('先登录，安全保存你的配置')}
          </h2>
          <AuthForm />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Panel>
              <SectionTitle
                title={t('连接你的 AI 模型')}
                description={t(
                  '支持 OpenAI 和 Anthropic 风格的兼容接口，可获取模型列表或手动填写模型名称。',
                )}
              />
              {query.isPending ? (
                <Loading />
              ) : query.error ? (
                <ErrorState error={query.error} retry={() => query.refetch()} />
              ) : (
                <ProviderForm
                  key={query.data.settings?.updatedAt ?? 'new'}
                  settings={query.data.settings}
                  userId={userId!}
                />
              )}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="size-3.5" />
                  {t('密钥在后端加密保存，不会返回给浏览器')}
                </span>
                {query.data?.settings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteKey(true)}
                  >
                    <Trash2 />
                    {t('删除 AI 配置')}
                  </Button>
                )}
              </div>
            </Panel>
            <Panel>
              <SectionTitle
                title={t('当前学习档案')}
                description={t('调整年龄与每日时间，学习安排会随之更新。')}
              />
              {profile ? (
                <>
                  <ProfileForm key={profile.id} profile={profile} />
                  <div className="mt-6 border-t pt-5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteProfile(true)}
                    >
                      <Trash2 />
                      {t('删除这个档案及学习记录')}
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" onClick={() => setProfileOpen(true)}>
                  {t('创建学习档案')}
                </Button>
              )}
            </Panel>
            <Panel>
              <SectionTitle
                title={t('账号安全')}
                description={session.data.user.email}
              />
              <PasswordForm />
            </Panel>
          </div>
          <aside className="space-y-6">
            <Panel>
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <KeyRound className="size-5" />
              </div>
              <h2 className="text-sm font-semibold">{t('API 配置小提示')}</h2>
              <ol className="mt-4 list-decimal space-y-3 pl-4 text-xs leading-7 text-muted-foreground">
                <li>{t('选择服务商使用的接口协议。')}</li>
                <li>
                  {t('填写接口根地址，通常包含')}{' '}
                  <code className="rounded bg-muted px-1">/v1</code>
                  {t('，不包含 chat/completions 或 messages。')}
                </li>
                <li>{t('填写接口密钥，再获取模型列表或手动填写模型名称。')}</li>
                <li>{t('点击“保存并测试”，成功后就能开始对话与练习。')}</li>
              </ol>
            </Panel>
            <p className="px-1 text-xs leading-7 text-muted-foreground">
              {t(
                '支持公网 HTTP 和 HTTPS 地址。不同兼容服务的功能与响应速度可能不同，可先使用连接测试确认。',
              )}
            </p>
          </aside>
        </div>
      )}
      <Dialog
        open={deleteProfile}
        onOpenChange={setDeleteProfile}
        title={t('删除「{{v0}}」的学习档案？', { v0: profile?.nickname ?? '' })}
        description={t(
          '这个档案的目标、对话、练习、掌握记录和导出文件都会删除，无法在应用内撤销。',
        )}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteProfile(false)}>
            {t('保留档案')}
          </Button>
          <Button
            variant="destructive"
            disabled={removeProfile.isPending}
            onClick={() => removeProfile.mutate()}
          >
            {t('删除档案')}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={deleteKey}
        onOpenChange={setDeleteKey}
        title={t('删除 AI 配置？')}
        description={t(
          '已保存的模型地址、模型名称和 API 密钥将被删除。现有学习记录与对话会保留。',
        )}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteKey(false)}>
            {t('保留配置')}
          </Button>
          <Button
            variant="destructive"
            disabled={removeKey.isPending}
            onClick={() => removeKey.mutate()}
          >
            {t('删除配置')}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

function ProviderForm({
  settings,
  userId,
}: {
  settings: ProviderPublic | null
  userId: string
}) {
  const { t, locale } = useI18n()

  const [visible, setVisible] = useState(false)
  // Separate draft credentials in the cache without putting API keys in query keys.
  const [keyRevision, setKeyRevision] = useState(() => crypto.randomUUID())
  const queryClient = useQueryClient()
  const form = useForm<ProviderInput>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      protocol: settings?.protocol ?? 'openai',
      baseUrl: settings?.baseUrl ?? '',
      model: settings?.model ?? '',
      apiKey: '',
    },
  })
  const [protocol, baseUrl, apiKey, model] = form.watch([
    'protocol',
    'baseUrl',
    'apiKey',
    'model',
  ])
  const models = useQuery({
    queryKey: [
      'private',
      userId,
      'provider-models',
      protocol,
      baseUrl.trim(),
      apiKey ? keyRevision : (settings?.updatedAt ?? 'new'),
    ],
    enabled: Boolean(
      settings?.hasKey &&
      !apiKey &&
      protocol === settings.protocol &&
      baseUrl.trim() === settings.baseUrl,
    ),
    staleTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) =>
      providerModelsResponseSchema.parse(
        await request(
          '/api/settings/ai/models',
          'POST',
          providerModelsInputSchema.parse(form.getValues()),
          signal,
        ),
      ),
  })
  async function loadModels() {
    if (
      !(await form.trigger(['protocol', 'baseUrl', 'apiKey'], {
        shouldFocus: true,
      }))
    )
      return
    if (!apiKey?.trim() && !settings?.hasKey) {
      form.setError(
        'apiKey',
        { message: t('首次配置需要填写 API Key') },
        { shouldFocus: true },
      )
      return
    }
    await models.refetch()
  }
  const mutation = useMutation({
    mutationFn: async ({
      input,
      test,
    }: {
      input: ProviderInput
      test: boolean
    }) => {
      await request('/api/settings/ai', 'PUT', input)
      if (test)
        return request<{ ok: boolean; message: string }>(
          '/api/ai/test',
          'POST',
          {},
        )
      return { ok: true, message: t('模型配置已安全保存') }
    },
    onSuccess: async (result) => {
      toast.success(result.message)
      await queryClient.invalidateQueries({
        queryKey: ['private', userId, 'ai-settings'],
      })
    },
    onError: async (error) => {
      toast.error(error.message)
      await queryClient.invalidateQueries({
        queryKey: ['private', userId, 'ai-settings'],
      })
    },
  })
  return (
    <form
      method="post"
      action="/api/settings/ai"
      className="space-y-5"
      onSubmit={form.handleSubmit((input) =>
        mutation.mutate({ input, test: false }),
      )}
    >
      <fieldset>
        <legend className="mb-3 text-sm font-medium">{t('接口协议')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: 'openai',
                label: t('OpenAI 兼容'),
                description: t('Chat Completions 风格接口'),
              },
              {
                value: 'anthropic',
                label: t('Anthropic 兼容'),
                description: t('Messages 风格接口'),
              },
            ] as const
          ).map((item) => (
            <label
              key={item.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-4',
                form.watch('protocol') === item.value
                  ? 'border-primary/50 bg-primary-soft/55'
                  : 'hover:bg-muted',
              )}
            >
              <input
                type="radio"
                className="mt-1"
                value={item.value}
                {...form.register('protocol')}
              />
              <span>
                <span className="block text-sm font-medium">
                  {t(item.label)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(item.description)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        id="ai-base-url"
        label={t('接口地址')}
        error={form.formState.errors.baseUrl?.message}
        hint={t(
          '填写完整的 HTTP 或 HTTPS 根地址，例如 http://api.example.com/v1',
        )}
      >
        <Input
          id="ai-base-url"
          type="url"
          placeholder="https://api.example.com/v1"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={Boolean(form.formState.errors.baseUrl)}
          {...form.register('baseUrl')}
        />
      </Field>
      <Field
        id="ai-key"
        label={t('接口密钥')}
        error={form.formState.errors.apiKey?.message}
        hint={
          settings?.hasKey
            ? t('密钥已安全保存。留空会保留当前密钥，填写新值则替换。')
            : t('密钥只用于后端调用你的模型服务，不保存在浏览器存储中。')
        }
      >
        <div className="relative">
          <Input
            id="ai-key"
            type={visible ? 'text' : 'password'}
            placeholder={
              settings?.hasKey ? t('已保存，留空保留') : t('填写 API Key')
            }
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            required={!settings?.hasKey}
            onInput={() => setKeyRevision(crypto.randomUUID())}
            className="pr-12"
            {...form.register('apiKey')}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
            aria-label={visible ? t('隐藏 API 密钥') : t('显示 API 密钥')}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </Field>
      <Field
        id="ai-model"
        label={t('模型名称')}
        error={form.formState.errors.model?.message}
        hint={t('可从列表选择，也可手动填写；切换后点击“保存配置”生效。')}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              id="ai-model"
              placeholder={t('填写服务商的模型 ID')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={200}
              className="min-w-48 flex-1"
              aria-describedby="ai-model-hint"
              {...form.register('model')}
            />
            <Button
              variant="outline"
              disabled={models.isFetching || mutation.isPending}
              onClick={() => void loadModels()}
            >
              {models.isFetching ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              {models.data ? t('刷新模型列表') : t('获取模型列表')}
            </Button>
          </div>
          {models.isFetching ? (
            <p role="status" className="text-xs text-muted-foreground">
              {t('正在获取模型列表…')}
            </p>
          ) : models.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t(models.error.message)}
            </p>
          ) : models.data?.models.length ? (
            <>
              <Select
                aria-label={t('从列表选择模型')}
                placeholder={t('选择一个可用模型')}
                value={
                  models.data.models.some((item) => item.id === model)
                    ? model
                    : ''
                }
                onValueChange={(value) =>
                  form.setValue('model', value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                options={models.data.models.map((item) => ({
                  value: item.id,
                  label:
                    item.name === item.id
                      ? item.id
                      : `${item.name} (${item.id})`,
                }))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {t('可用模型：{{v0}}', { v0: models.data.models.length })}
              </p>
            </>
          ) : models.data ? (
            <p role="status" className="text-xs text-muted-foreground">
              {t('服务商未返回可用模型，仍可手动填写模型名称。')}
            </p>
          ) : null}
        </div>
      </Field>
      {mutation.error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {t(mutation.error.message)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Save />
          )}
          {t('保存配置')}
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={form.handleSubmit((input) =>
            mutation.mutate({ input, test: true }),
          )}
        >
          <Plug />
          {t('保存并测试')}
        </Button>
      </div>
    </form>
  )
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请填写当前密码'),
  newPassword: z.string().min(10, '新密码至少 10 位').max(128),
})
function PasswordForm() {
  const { t, locale } = useI18n()

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })
  return (
    <form
      method="post"
      action="/api/auth/change-password"
      className="space-y-5"
      onSubmit={form.handleSubmit(async (input) => {
        const result = await authClient.changePassword({
          ...input,
          revokeOtherSessions: true,
        })
        if (result.error) {
          form.setError('root', {
            message: t('修改失败，请检查当前密码或重新登录后重试'),
          })
          return
        }
        form.reset()
        toast.success(t('密码已修改，其他设备的登录已撤销'))
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="current-password"
          label={t('当前密码')}
          error={form.formState.errors.currentPassword?.message}
        >
          <Input
            id="current-password"
            type="password"
            required
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </Field>
        <Field
          id="new-password"
          label={t('新密码')}
          error={form.formState.errors.newPassword?.message}
        >
          <Input
            id="new-password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            {...form.register('newPassword')}
          />
        </Field>
      </div>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {t(form.formState.errors.root.message ?? '')}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={form.formState.isSubmitting}
      >
        {t('修改密码并撤销其他设备登录')}
      </Button>
    </form>
  )
}
