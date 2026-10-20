import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './button'

type Option = { value: string; label: string; disabled?: boolean }

export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  icon,
  className,
  ...props
}: {
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  icon?: React.ReactNode
} & Omit<
  React.ComponentProps<typeof SelectPrimitive.Trigger>,
  'value' | 'onChange'
>) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={props.disabled}
    >
      <SelectPrimitive.Trigger
        {...props}
        className={cn(
          'group flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-primary data-[state=open]:bg-primary-soft/40 [&>[data-slot=select-value]]:truncate',
          className,
        )}
      >
        {icon}
        <SelectPrimitive.Value
          data-slot="select-value"
          placeholder={placeholder}
        />
        <SelectPrimitive.Icon className="ml-auto shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180">
          <ChevronDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) max-w-(--radix-select-content-available-width) min-w-32 overflow-hidden rounded-xl border border-primary/15 bg-card p-1.5 shadow-panel"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-primary">
            <ChevronUp className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-11 cursor-default items-center rounded-lg py-2 pr-9 pl-3 text-sm wrap-anywhere outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary data-[state=checked]:font-medium data-[state=checked]:text-primary"
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center text-primary">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-primary">
            <ChevronDown className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
