"use client"

import { useId } from "react"

import type { PublicAdhesionBillingType } from "@/app/adesao/[token]/features/context/PublicAdhesionTypes"
import { formatBRL, installmentAmounts } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

function MethodRow({
  idPrefix,
  value,
  label,
  detail,
  price,
  badge,
  selected,
  disabled,
}: {
  idPrefix: string
  value: PublicAdhesionBillingType
  label: string
  detail: string
  price: string
  badge?: string
  selected: boolean
  disabled: boolean
}) {
  const labelId = `${idPrefix}-${value}-label`
  const detailId = `${idPrefix}-${value}-detail`

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 max-lg:min-h-11 transition-colors duration-[var(--motion-duration-base)]",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40",
        disabled && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-input",
        )}
      >
        {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span id={labelId} className="text-sm font-semibold text-foreground">
            {label}
          </span>
          {badge ? (
            <Badge
              variant="outline"
              className="border-semantic-success-border bg-semantic-success-surface px-1.5 py-0 text-[11px] font-semibold text-semantic-success"
            >
              {badge}
            </Badge>
          ) : null}
        </span>
        <span id={detailId} className="text-xs text-muted-foreground">
          {detail}
        </span>
      </div>
      <span
        aria-hidden="true"
        className="shrink-0 font-display text-base font-bold tracking-[-0.01em] text-foreground tabular-nums"
      >
        {price}
      </span>
      <RadioGroupItem
        value={value}
        aria-labelledby={labelId}
        aria-describedby={detailId}
        className="absolute inset-0 aspect-auto size-full rounded-xl border-0 text-transparent disabled:cursor-not-allowed"
      />
    </div>
  )
}

/**
 * Forma de pagamento do kit: PIX com a economia em destaque e cartão com a parcela máxima.
 * Forma de pagamento: título e cards de rádio, com a mesma API usada pelo adesão antes da migração.
 */
export function CheckoutPaymentMethod({
  methods,
  value,
  pixTotal,
  cardTotal,
  pixSavings,
  maxInstallments,
  disabled,
  onChange,
}: {
  methods: readonly PublicAdhesionBillingType[]
  value: PublicAdhesionBillingType
  pixTotal: number
  cardTotal: number
  pixSavings: number
  maxInstallments: number
  disabled: boolean
  onChange: (billingType: PublicAdhesionBillingType) => void
}) {
  const idPrefix = useId()
  const titleId = `${idPrefix}-title`

  if (methods.length === 0) return null

  const cardDetail =
    maxInstallments > 1
      ? `Em até ${maxInstallments}x de ${formatBRL(installmentAmounts(cardTotal, maxInstallments)[0])}`
      : "Pagamento em 1x"

  return (
    <div className="flex flex-col gap-2.5">
      <h3 id={titleId} className="text-sm font-semibold text-foreground">
        Forma de pagamento
      </h3>
      <RadioGroup
        aria-labelledby={titleId}
        value={value}
        onValueChange={(next) => onChange(next as PublicAdhesionBillingType)}
        disabled={disabled}
        className="grid-cols-1 gap-2"
      >
        {methods.includes("PIX") ? (
          <MethodRow
            idPrefix={idPrefix}
            value="PIX"
            label="PIX"
            detail="À vista, com desconto"
            price={formatBRL(pixTotal)}
            badge={pixSavings > 0 ? `Economize ${formatBRL(pixSavings)}` : undefined}
            selected={value === "PIX"}
            disabled={disabled}
          />
        ) : null}
        {methods.includes("CREDIT_CARD") ? (
          <MethodRow
            idPrefix={idPrefix}
            value="CREDIT_CARD"
            label="Cartão de crédito"
            detail={cardDetail}
            price={formatBRL(cardTotal)}
            selected={value === "CREDIT_CARD"}
            disabled={disabled}
          />
        ) : null}
      </RadioGroup>
    </div>
  )
}
