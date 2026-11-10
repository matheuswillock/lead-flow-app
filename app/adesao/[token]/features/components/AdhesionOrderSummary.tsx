"use client"

import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDocumentInput } from "@/lib/masks"
import { formatBRL, installmentAmounts, type AdhesionPaymentSummary } from "../utils/adhesionPayment"

function Line({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "muted" | "success"
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "success"
            ? "font-semibold text-semantic-success tabular-nums"
            : tone === "muted"
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
 * Resumo do pedido da contratação: empresa, plano, adicionais e total na forma escolhida.
 * Os botões e o QR Code entram como `children`, logo abaixo do total.
 */
export function AdhesionOrderSummary({
  companyName,
  cnpj,
  cycleLabel,
  months,
  summary,
  installments,
  children,
}: {
  companyName: string | null
  cnpj: string | null
  cycleLabel: string
  months: number
  summary: AdhesionPaymentSummary
  installments: number
  children: ReactNode
}) {
  const isCard = summary.billingType === "CREDIT_CARD"
  const perInstallment = isCard && installments > 1 ? installmentAmounts(summary.total, installments)[0] : null
  const cnpjDigits = cnpj?.replace(/\D/g, "") ?? ""

  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="gap-1 border-b border-border px-6 py-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Resumo do pedido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6 py-5">
        {companyName || cnpjDigits.length === 14 ? (
          <div className="flex flex-col gap-0.5">
            {companyName ? (
              <span className="break-words font-display text-lg font-bold text-foreground">{companyName}</span>
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
            <Line label="Plano" value={months > 1 ? `${cycleLabel} (${months} meses)` : cycleLabel} />
            {months > 1 ? (
              <Line label="Equivale a" value={`${formatBRL(summary.monthlyEquivalent)} por mês`} tone="muted" />
            ) : null}
            <Line label="Valor do plano" value={formatBRL(summary.planTotal)} />
            {summary.extrasTotal > 0 ? (
              <Line label="Adicionais" value={`+ ${formatBRL(summary.extrasTotal)}`} />
            ) : null}
            {!isCard && summary.pixSavings > 0 ? (
              <Line label="Economia no PIX" value={formatBRL(summary.pixSavings)} tone="success" />
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
              {isCard
                ? perInstallment
                  ? `em ${installments}x de ${formatBRL(perInstallment)} no cartão`
                  : "no cartão de crédito"
                : "à vista no PIX"}
            </p>
          </div>
        </div>

        {children}
      </CardContent>
    </Card>
  )
}
