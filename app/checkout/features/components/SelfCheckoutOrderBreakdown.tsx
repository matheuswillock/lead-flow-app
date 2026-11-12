"use client"

import type { SelfCheckoutBillingType, SelfCheckoutCouponQuote, SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { computeOrderAmounts, formatBRL } from "../utils/selfCheckoutForm"

function Line({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "success" | "muted"
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-right [overflow-wrap:anywhere] ${
          tone === "success"
            ? "font-semibold text-semantic-success tabular-nums"
            : tone === "muted"
              ? "text-muted-foreground tabular-nums"
              : "font-semibold text-foreground tabular-nums"
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Demonstrativo do pedido em ordem de leitura: plano, valor, adicionais, cupom e total.
 */
export function SelfCheckoutOrderBreakdown({
  option,
  billingType,
  couponQuote,
  extraUsers = 0,
  extraTeams = 0,
  installments: chosenInstallments,
}: {
  /** Parcelas escolhidas no cartão; sem elas, mostra o máximo que o plano permite. */
  installments?: number
  option: SelfCheckoutCycleOption
  billingType: SelfCheckoutBillingType
  couponQuote: SelfCheckoutCouponQuote | null
  extraUsers?: number
  extraTeams?: number
}) {
  const amounts = computeOrderAmounts(option, billingType, { extraUsers, extraTeams })
  const { isCard, planTotal: baseTotal } = amounts
  const monthly = amounts.monthlyEquivalent
  const extrasTotal = amounts.extrasTotal
  // O cupom incide só sobre o plano; os adicionais entram por cima do total já descontado.
  const total = couponQuote ? couponQuote.totalAfterDiscount + extrasTotal : amounts.total
  const installments = Math.max(1, chosenInstallments ?? option.maxInstallments ?? option.months)
  // Com cupom o total muda, então a parcela também é recalculada sobre o total final.
  const finalInstallment =
    isCard && installments > 1 ? Math.round((total / installments) * 100) / 100 : null

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4">
      <dl className="flex flex-col gap-2.5 text-sm">
        <Line
          label="Plano"
          value={option.months > 1 ? `${option.label} (${option.months} meses)` : option.label}
        />
        {option.months > 1 ? (
          <Line label="Equivale a" value={`${formatBRL(monthly)} por mês`} tone="muted" />
        ) : null}

        {/* A economia do PIX já aparece no selo da forma de pagamento; aqui fica só o valor. */}
        <Line label={isCard ? "Valor no cartão" : "Valor no PIX"} value={formatBRL(baseTotal)} />

        {amounts.extraUsersTotal > 0 ? (
          <Line
            label={`${extraUsers} ${extraUsers === 1 ? "usuário adicional" : "usuários adicionais"}`}
            value={`+ ${formatBRL(amounts.extraUsersTotal)}`}
          />
        ) : null}
        {extraTeams > 0 ? (
          <Line
            label={`${extraTeams} ${extraTeams === 1 ? "time adicional" : "times adicionais"}`}
            value={`+ ${formatBRL(amounts.extraTeamsTotal)}`}
          />
        ) : null}

        {couponQuote ? (
          <Line
            label={`Cupom ${couponQuote.code}`}
            value={`- ${formatBRL(couponQuote.discountAmount)}`}
            tone="success"
          />
        ) : null}
      </dl>

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <div className="flex items-end justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums">
            {formatBRL(total)}
          </span>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {isCard
            ? finalInstallment
              ? `${chosenInstallments ? "em" : "em até"} ${installments}x de ${formatBRL(finalInstallment)} no cartão`
              : "no cartão de crédito"
            : "à vista no PIX"}
        </p>
      </div>
    </div>
  )
}
