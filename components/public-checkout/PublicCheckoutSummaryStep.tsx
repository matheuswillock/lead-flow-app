"use client"

import { ArrowRight, Building2, Crown, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { PublicCheckoutDetails } from "./publicCheckoutTypes"

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={cn("text-sm text-muted-foreground", emphasize && "font-medium text-foreground")}
      >
        {label}
      </span>
      <span className={cn("text-sm text-foreground", emphasize && "font-semibold")}>{value}</span>
    </div>
  )
}

export function PublicCheckoutSummaryStep({
  details,
  onFinalize,
  isLocked,
}: {
  details: PublicCheckoutDetails
  onFinalize: () => void
  isLocked: boolean
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const iconFor = (icon: PublicCheckoutDetails["invoiceItems"][number]["icon"]) => {
    if (icon === "master") return Crown
    if (icon === "team") return Building2
    return Users
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold tracking-[0.3em] text-primary">SEU PLANO</div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{details.title}</h1>
          <p className="text-sm text-muted-foreground">{details.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{details.includedTitle}</span>
          <span className="text-xs text-muted-foreground">{details.includedSubtitle}</span>
          {details.includedBadges?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {details.includedBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[11px] font-semibold tracking-[0.3em] text-primary">
          {details.compositionTitle}
        </div>
        <div className="flex flex-col gap-3">
          {details.invoiceItems.map((item) => {
            const Icon = iconFor(item.icon)
            const unit = formatCurrency(item.unitAmountMonthly)
            const total = formatCurrency(item.totalAmountMonthly)
            return (
              <div key={`${item.title}:${item.description}`} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40 text-primary">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {item.quantity}x {item.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {unit} &times; {item.quantity} = {total}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right text-sm font-semibold text-foreground">{total}</div>
              </div>
            )
          })}

          <Separator />
          <SummaryRow
            label={details.monthlyTotalLabel}
            value={details.monthlyTotalValue}
            emphasize
          />
        </div>
      </div>

      <div className="rounded-2xl bg-muted px-5 py-4 text-foreground">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.35em] text-muted-foreground">
              {details.totalTitle}
            </span>
            <span className="text-sm text-muted-foreground">{details.totalSubtitle}</span>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-3xl font-bold leading-none text-primary">{details.totalValue}</span>
            <span className="text-xs text-muted-foreground">{details.totalHint}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 text-xs text-muted-foreground">
        <span>
          {details.startLabel}: <span className="text-foreground">{details.startValue}</span>
        </span>
        <span>
          {details.dueLabel}: <span className="text-foreground">{details.dueValue}</span>
        </span>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={onFinalize}
        disabled={isLocked}
      >
        Finalizar Pagamento <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
    </div>
  )
}
