"use client"

import { Building2, Crown, Users } from "lucide-react"

import { formatBRL, installmentAmounts } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import { Separator } from "@/components/ui/separator"
import type { PublicCheckoutBillingType, PublicCheckoutDetails } from "./publicCheckoutTypes"

function iconFor(icon: PublicCheckoutDetails["invoiceItems"][number]["icon"]) {
  if (icon === "master") return Crown
  if (icon === "team") return Building2
  return Users
}

/** Fase Resumo: o plano, os itens e as datas. O total e a forma de pagamento ficam na lateral. */
export function PublicCheckoutSummaryStep({ details }: { details: PublicCheckoutDetails }) {
  return (
    <section aria-labelledby="public-checkout-summary-title" className="flex flex-col gap-6">
      <h2
        id="public-checkout-summary-title"
        className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground"
      >
        Seu plano
      </h2>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-foreground">{details.includedTitle}</span>
          <span className="text-xs text-muted-foreground">{details.includedSubtitle}</span>
          {details.includedBadges?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {details.includedBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {details.invoiceItems.map((item) => {
          const Icon = iconFor(item.icon)
          return (
            <div key={`${item.title}:${item.description}`} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-primary">
                  <Icon aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {item.quantity}x {item.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatBRL(item.unitAmountMonthly)} &times; {item.quantity} = {formatBRL(item.totalAmountMonthly)}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                {formatBRL(item.totalAmountMonthly)}
              </span>
            </div>
          )
        })}
      </div>

      <Separator />
      <dl className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{details.startLabel}</dt>
          <dd className="font-medium text-foreground">{details.startValue}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{details.dueLabel}</dt>
          <dd className="font-medium text-foreground">{details.dueValue}</dd>
        </div>
      </dl>
    </section>
  )
}

function TotalsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * Total da forma escolhida, dentro do Resumo do pedido da lateral. O total vem do servidor; aqui
 * só se mostra a parcela e o equivalente mensal quando o contrato tem mais de um mês.
 */
export function PublicCheckoutTotals({
  details,
  billingType,
  installments,
}: {
  details: PublicCheckoutDetails
  billingType: PublicCheckoutBillingType
  installments: number
}) {
  const price = details.billingTypePrices[billingType]
  const cycleMonths = details.invoiceSummary.cycleMonths ?? 1
  const isCard = billingType === "CREDIT_CARD"
  const installmentValue = installments > 1 ? formatBRL(installmentAmounts(price.total, installments)[0]) : null

  return (
    <div className="flex flex-col gap-4">
      {cycleMonths > 1 ? (
        <dl className="flex flex-col gap-2.5">
          <TotalsLine label="Equivale a" value={`${formatBRL(price.monthly)} por mês`} />
        </dl>
      ) : null}
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <div className="flex items-end justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums">
            {formatBRL(price.total)}
          </span>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {isCard
            ? installmentValue
              ? `em ${installments}x de ${installmentValue} no cartão`
              : "no cartão de crédito"
            : "à vista no PIX"}
        </p>
      </div>
    </div>
  )
}
