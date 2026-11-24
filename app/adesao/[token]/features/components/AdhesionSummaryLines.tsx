"use client"

import { formatDocumentInput } from "@/lib/masks"
import {
  formatBRL,
  installmentAmounts,
  type AdhesionPaymentSummary,
} from "../utils/adhesionPayment"

function SummaryLine({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          muted
            ? "text-muted-foreground tabular-nums"
            : "font-semibold text-foreground tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Linhas do resumo dentro do CheckoutOrderSummary: empresa, plano, valor na forma escolhida, adicionais
 * e o total. A economia do PIX fica só no badge da forma de pagamento.
 */
export function AdhesionSummaryLines({
  companyName,
  cnpj,
  cycleLabel,
  months,
  summary,
  installments,
}: {
  companyName: string | null
  cnpj: string | null
  cycleLabel: string
  months: number
  summary: AdhesionPaymentSummary
  installments: number
}) {
  const isCard = summary.billingType === "CREDIT_CARD"
  const perInstallment =
    isCard && installments > 1 ? installmentAmounts(summary.total, installments)[0] : null
  const cnpjDigits = cnpj?.replace(/\D/g, "") ?? ""

  return (
    <>
      {companyName || cnpjDigits.length === 14 ? (
        <div className="flex flex-col gap-0.5">
          {companyName ? (
            <span className="break-words font-display text-lg font-bold text-foreground">
              {companyName}
            </span>
          ) : null}
          {cnpjDigits.length === 14 ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              CNPJ {formatDocumentInput(cnpjDigits)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4">
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryLine
            label="Plano"
            value={months > 1 ? `${cycleLabel} (${months} meses)` : cycleLabel}
          />
          {months > 1 ? (
            <SummaryLine
              label="Equivale a"
              value={`${formatBRL(summary.monthlyEquivalent)} por mês`}
              muted
            />
          ) : null}
          <SummaryLine
            label={isCard ? "Valor no cartão" : "Valor no PIX"}
            value={formatBRL(summary.planTotal)}
          />
          {summary.extrasTotal > 0 ? (
            <SummaryLine label="Adicionais" value={`+ ${formatBRL(summary.extrasTotal)}`} />
          ) : null}
        </dl>
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums">
              {formatBRL(summary.total)}
            </span>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {perInstallment
              ? `em ${installments}x de ${formatBRL(perInstallment)} no cartão`
              : isCard
                ? "no cartão de crédito"
                : "à vista no PIX"}
          </p>
        </div>
      </div>
    </>
  )
}
