"use client"

import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { SelfCheckoutBillingType, SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { cn } from "@/lib/utils"
import { formatBRL } from "../utils/selfCheckoutForm"

/** Quanto o PIX economiza em relação ao cartão no plano inteiro; zero quando não há diferença. */
export function pixSavingsAmount(option: SelfCheckoutCycleOption): number {
  if (!option.creditCardTotal) return 0
  const saving = Math.round((option.creditCardTotal - option.pixTotal) * 100) / 100
  return saving > 0 ? saving : 0
}

/** Valor de cada parcela do cartão, arredondado para centavos. */
export function cardInstallmentAmount(option: SelfCheckoutCycleOption): number | null {
  if (!option.creditCardTotal) return null
  const installments = Math.max(1, option.maxInstallments ?? option.months)
  return Math.round((option.creditCardTotal / installments) * 100) / 100
}

function MethodRow({
  value,
  label,
  detail,
  price,
  badge,
  selected,
  disabled,
}: {
  value: SelfCheckoutBillingType
  label: string
  detail: string
  price: string
  badge?: string
  selected: boolean
  disabled: boolean
}) {
  const labelId = `self-checkout-method-${value}-label`
  const detailId = `self-checkout-method-${value}-detail`

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-colors duration-[var(--motion-duration-base)]",
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

/** Forma de pagamento: só aparece quando o servidor informa o preço no cartão para o plano. */
export function SelfCheckoutPaymentMethod({
  option,
  value,
  onChange,
  disabled,
}: {
  option: SelfCheckoutCycleOption
  value: SelfCheckoutBillingType
  onChange: (billingType: SelfCheckoutBillingType) => void
  disabled: boolean
}) {
  if (!option.creditCardTotal) return null

  const saving = pixSavingsAmount(option)
  const installments = Math.max(1, option.maxInstallments ?? option.months)
  const installmentAmount = cardInstallmentAmount(option)
  const cardDetail =
    installments > 1 && installmentAmount
      ? `Em até ${installments}x de ${formatBRL(installmentAmount)}`
      : "Pagamento em 1x"

  return (
    <div className="flex flex-col gap-2.5">
      <h3 id="self-checkout-method-title" className="text-sm font-semibold text-foreground">
        Forma de pagamento
      </h3>
      <RadioGroup
        aria-labelledby="self-checkout-method-title"
        value={value}
        onValueChange={(next) => onChange(next as SelfCheckoutBillingType)}
        disabled={disabled}
        className="grid-cols-1 gap-2"
      >
        <MethodRow
          value="PIX"
          label="PIX"
          detail="À vista, com desconto"
          price={formatBRL(option.pixTotal)}
          badge={saving > 0 ? `Economize ${formatBRL(saving)}` : undefined}
          selected={value === "PIX"}
          disabled={disabled}
        />
        <MethodRow
          value="CREDIT_CARD"
          label="Cartão de crédito"
          detail={cardDetail}
          price={formatBRL(option.creditCardTotal)}
          selected={value === "CREDIT_CARD"}
          disabled={disabled}
        />
      </RadioGroup>
    </div>
  )
}
