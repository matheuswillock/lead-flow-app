"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatBRL } from "../utils/selfCheckoutForm"

/**
 * Barra fixa do celular: total e botão de pagar sempre à vista, sem rolar até o fim da página.
 * Fica dentro do formulário, então o botão envia o mesmo pedido que o do resumo.
 */
export function SelfCheckoutMobilePayBar({
  total,
  caption,
  label,
  isBusy,
  disabled,
}: {
  total: number
  caption: string
  label: string
  isBusy: boolean
  disabled: boolean
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_var(--foreground)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-xl leading-none font-extrabold tracking-[-0.02em] text-foreground tabular-nums">
            {formatBRL(total)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{caption}</span>
        </div>
        <Button type="submit" size="lg" className="min-h-11 shrink-0" disabled={disabled} aria-busy={isBusy}>
          {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {label}
        </Button>
      </div>
    </div>
  )
}
