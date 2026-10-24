"use client"

import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

/**
 * Interruptor com área de toque de 44px em telas pequenas (DESIGN.md §8):
 * o botão é o alvo, a trilha visual de 36x20 fica dentro dele.
 */
export function ProviderSwitch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        "group inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full outline-none max-lg:size-11 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <span className="inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent bg-input shadow-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background group-disabled:opacity-60 group-data-[state=checked]:bg-primary">
        <SwitchPrimitives.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-lg transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      </span>
    </SwitchPrimitives.Root>
  )
}
