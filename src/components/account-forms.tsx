import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, LoaderCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import {
  profileInputSchema,
  type Profile,
  type ProfileInput,
} from '@/lib/contracts'
import { request } from '@/lib/api-client'
import { useLearning, useRefreshLearning } from '@/lib/queries'
import { useUi } from '@/lib/store'
import { Button, cn } from './ui/button'
import { Field, Input } from './ui/fields'
import { Dialog } from './ui/dialog'

const authSchema = z.object({
  name: z.string().trim().max(40),
  email: z.email('请输入有效的邮箱地址'),
  password: z.string().min(10, '密码至少需要 10 位').max(128),
})
type AuthInput = z.infer<typeof authSchema>
const authErrors: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码不正确',
  USER_ALREADY_EXISTS: '这个邮箱已注册，请直接登录',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '这个邮箱已注册，请直接登录',
  PASSWORD_TOO_SHORT: '密码至少需要 10 位',
  FAILED_TO_CREATE_USER: '暂时无法注册，请稍后重试',
}

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useI18n()

  const [signup, setSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: '', email: '', password: '' },
  })
  const submit = form.handleSubmit(async (input) => {
    if (signup && !input.name.trim()) {
      form.setError('name', { message: t('请填写你的称呼') })
      return
    }
    const result = signup
      ? await authClient.signUp.email({
          name: input.name,
          email: input.email,
          password: input.password,
        })
      : await authClient.signIn.email({
          email: input.email,
          password: input.password,
        })
    if (result.error) {
      form.setError('root', {
        message:
          authErrors[result.error.code ?? ''] ??
          t('暂时无法登录，请检查输入或稍后重试'),
      })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['private'] })
    toast.success(signup ? t('账号已创建，欢迎来到学径') : t('欢迎回来'))
    onSuccess?.()
  })
  return (
    <>
      <div
        className="mb-6 flex rounded-lg bg-muted p-1"
        role="group"
        aria-label={t('账号操作')}
      >
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={signup === value}
            onClick={() => {
              setSignup(value)
              form.clearErrors()
            }}
            className={cn(
              'min-h-11 flex-1 rounded-md text-sm font-medium transition-colors',
              signup === value
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {value ? t('创建账号') : t('登录账号')}
          </button>
        ))}
      </div>
      <form
        method="post"
        action="/api/auth/sign-in/email"
        onSubmit={submit}
        className="space-y-5"
      >
        {signup && (
          <Field
            id="account-name"
            label={t('你的称呼')}
            error={form.formState.errors.name?.message}
          >
            <Input
              id="account-name"
              autoComplete="name"
              required
              maxLength={40}
              {...form.register('name')}
            />
          </Field>
        )}
        <Field
          id="account-email"
          label={t('邮箱')}
          error={form.formState.errors.email?.message}
        >
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email ? 'account-email-error' : undefined
            }
            {...form.register('email')}
          />
        </Field>
        <Field
          id="account-password"
          label={t('密码')}
          hint={t('至少 10 位，建议混合字母、数字和符号。')}
          error={form.formState.errors.password?.message}
        >
          <div className="relative">
            <Input
              id="account-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={10}
              maxLength={128}
              className="pr-12"
              {...form.register('password')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
              aria-label={showPassword ? t('隐藏密码') : t('显示密码')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </Field>
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {t(form.formState.errors.root.message ?? '')}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <LoaderCircle className="animate-spin" />
          ) : null}
          {signup ? t('创建账号，开启学习') : t('登录学径')}
          <ArrowRight />
        </Button>
      </form>
      <p className="mt-5 text-center text-xs leading-6 text-muted-foreground">
        {t('请由家长或老师管理账号。孩子只需一个昵称，就能开始学习。')}
      </p>
    </>
  )
}

export function AuthDialog() {
  const { t, locale } = useI18n()

  const open = useUi((state) => state.authOpen)
  const setOpen = useUi((state) => state.setAuthOpen)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('每一份好奇，都值得被认真对待')}
      description={t('保存学习路线，记录一点一滴的成长。')}
    >
      <AuthForm onSuccess={() => setOpen(false)} />
    </Dialog>
  )
}

export function ProfileDialog() {
  const { t, locale } = useI18n()

  const open = useUi((state) => state.profileOpen)
  const setOpen = useUi((state) => state.setProfileOpen)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('创建学习档案')}
      description={t('不需要真实姓名或出生日期。年龄只用于推荐适合的内容。')}
    >
      {open && <ProfileForm onSuccess={() => setOpen(false)} />}
    </Dialog>
  )
}

export function ProfileForm({
  profile,
  onSuccess,
}: {
  profile?: Profile
  onSuccess?: () => void
}) {
  const { t, locale } = useI18n()

  const refresh = useRefreshLearning()
  const selectChild = useUi((state) => state.selectChild)
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: profile ?? {
      nickname: '',
      age: 7,
      dailyMinutes: 20,
      color: 'violet',
    },
  })
  const mutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      request<Profile>(
        profile ? `/api/profiles/${profile.id}` : '/api/profiles',
        profile ? 'PATCH' : 'POST',
        input,
      ),
    onSuccess: async (data) => {
      selectChild(data.id)
      await refresh()
      toast.success(profile ? t('学习档案已更新') : t('学习档案已创建'))
      onSuccess?.()
    },
  })
  return (
    <form
      method="post"
      action="/api/profiles"
      className="space-y-5"
      onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
    >
      <Field
        id="profile-nickname"
        label={t('孩子的昵称')}
        error={form.formState.errors.nickname?.message}
      >
        <Input
          id="profile-nickname"
          placeholder={t('例如：小星')}
          required
          maxLength={24}
          autoComplete="off"
          {...form.register('nickname')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="profile-age"
          label={t('年龄')}
          error={form.formState.errors.age?.message}
        >
          <Input
            id="profile-age"
            type="number"
            required
            min={4}
            max={14}
            {...form.register('age', { valueAsNumber: true })}
          />
        </Field>
        <Field
          id="profile-minutes"
          label={t('每日学习（分钟）')}
          error={form.formState.errors.dailyMinutes?.message}
        >
          <Input
            id="profile-minutes"
            type="number"
            required
            min={5}
            max={120}
            step={5}
            {...form.register('dailyMinutes', { valueAsNumber: true })}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">{t('档案颜色')}</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              { value: 'violet', label: t('紫色'), color: '#8774d9' },
              { value: 'blue', label: t('蓝色'), color: '#6399d7' },
              { value: 'sage', label: t('绿色'), color: '#62a78b' },
              { value: 'amber', label: t('金色'), color: '#d1a052' },
            ] as const
          ).map((item) => (
            <label
              key={item.value}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <input
                type="radio"
                value={item.value}
                {...form.register('color')}
              />
              <span
                className="size-3 rounded-full"
                style={{ background: item.color }}
              />
              {t(item.label)}
            </label>
          ))}
        </div>
      </fieldset>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {t(mutation.error.message)}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <LoaderCircle className="animate-spin" />}
        {profile ? t('保存档案') : t('开启学习小径')}
      </Button>
    </form>
  )
}
