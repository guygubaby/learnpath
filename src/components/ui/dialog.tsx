import { useI18n } from '@/lib/i18n'
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  const { t, locale } = useI18n()

  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      {...{ closedby: 'any' }}
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (
          'closedBy' in HTMLDialogElement.prototype ||
          event.target !== event.currentTarget
        )
          return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          event.currentTarget.close()
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 text-foreground shadow-xl sm:p-8"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 id={id} className="text-xl font-semibold">
            {title}
          </h2>
          {description && (
            <p
              id={`${id}-description`}
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('关闭窗口')}
          onClick={() => ref.current?.close()}
        >
          <X />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
