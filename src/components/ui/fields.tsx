import { cn } from './button'
import { useI18n } from '@/lib/i18n'
import { translateText } from '@/lib/i18n-core'

const fieldClasses =
  'min-h-12 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive'
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(fieldClasses, className)}
      {...props}
    />
  )
}
export function Textarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, 'min-h-28 resize-y', className)}
      {...props}
    />
  )
}
export { Select } from './select'
export function Field({
  label,
  id,
  error,
  children,
  hint,
}: {
  label: string
  id: string
  error?: string
  children: React.ReactNode
  hint?: string
}) {
  const { t, locale } = useI18n()
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {t(label)}
      </label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {t(hint)}
        </p>
      )}
      {error && (
        <p role="alert" id={`${id}-error`} className="text-sm text-destructive">
          {translateText(error, locale)}
        </p>
      )}
    </div>
  )
}
