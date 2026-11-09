"use client"

import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type {
  SelfCheckoutBillingType,
  SelfCheckoutCycle,
  SelfCheckoutCycleOption,
} from "@/lib/self-checkout/contracts"
import { cn } from "@/lib/utils"
import { formatBRL } from "../utils/selfCheckoutForm"

/** Valores do plano na forma de pagamento escolhida; cai para o PIX quando o plano não tem cartão. */
export function cyclePriceFor(option: SelfCheckoutCycleOption, billingType: SelfCheckoutBillingType) {
  const useCard = billingType === "CREDIT_CARD" && Boolean(option.creditCardTotal)
  return {
    isCard: useCard,
    total: useCard ? (option.creditCardTotal ?? option.pixTotal) : option.pixTotal,
    monthly: useCard
      ? (option.creditCardMonthlyEquivalent ?? option.monthlyEquivalent)
      : option.monthlyEquivalent,
  }
}

/**
 * Economia em relação ao plano mensal na mesma forma de pagamento, calculada só com os preços
 * exibidos. Arredonda para baixo e some quando a diferença é menor que 1%.
 */
export function savingsPercentVsMonthly(
  option: SelfCheckoutCycleOption,
  cycles: readonly SelfCheckoutCycleOption[],
  billingType: SelfCheckoutBillingType = "PIX",
): number | null {
  if (option.cycle === "monthly") return null
  const monthlyOption = cycles.find((candidate) => candidate.cycle === "monthly")
  if (!monthlyOption) return null
  const base = cyclePriceFor(monthlyOption, billingType).monthly
  if (base <= 0) return null
  const current = cyclePriceFor(option, billingType).monthly
  // A folga de 1e-9 evita que 10% apareça como 9% por causa de ponto flutuante (1 - 90/100 = 0,0999…).
  const percent = Math.floor((1 - current / base) * 100 + 1e-9)
  return percent >= 1 ? percent : null
}

function CycleCard({
  option,
  billingType,
  savingsPercent,
  selected,
  disabled,
}: {
  option: SelfCheckoutCycleOption
  billingType: SelfCheckoutBillingType
  savingsPercent: number | null
  selected: boolean
  disabled: boolean
}) {
  const labelId = `self-checkout-cycle-${option.cycle}-label`
  const detailId = `self-checkout-cycle-${option.cycle}-detail`
  const isMultiMonth = option.months > 1
  const { isCard, total, monthly } = cyclePriceFor(option, billingType)
  const maxInstallments = option.maxInstallments ?? option.months
  // A linha de baixo descreve só a forma de pagamento escolhida (PIX ou cartão).
  const totalText = isCard
    ? maxInstallments > 1
      ? `em até ${maxInstallments}x no cartão`
      : "no cartão"
    : isMultiMonth
      ? "à vista no PIX"
      : "no PIX"

  return (
    <div
      className={cn(
        "relative flex min-h-11 flex-col gap-3 rounded-2xl border bg-card p-5 transition-[border-color,box-shadow,background-color] duration-[var(--motion-duration-base)] max-sm:gap-2 max-sm:rounded-xl max-sm:p-4",
        // No celular o anual (o recomendado, já escolhido) vem primeiro, acima da dobra.
        option.cycle === "annual" && "max-sm:order-first",
        selected
          ? "border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary"
          : "border-border hover:border-primary/40",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
          >
            {selected ? <Check className="size-3" /> : null}
          </span>
          <span
            id={labelId}
            className="min-w-0 text-xs font-semibold uppercase tracking-[0.1em] [overflow-wrap:anywhere] text-muted-foreground"
          >
            {option.label}
          </span>
        </div>
        {savingsPercent ? (
          <Badge
            variant="outline"
            aria-hidden="true"
            className="border-semantic-success-border bg-semantic-success-surface font-semibold text-semantic-success"
          >
            Economize {savingsPercent}%
          </Badge>
        ) : null}
      </div>

      {/* Leitores de tela ouvem o total, a forma de pagamento e o equivalente mensal, nessa ordem. */}
      <span id={detailId} className="sr-only">
        {formatBRL(total)} {totalText}
        {isMultiMonth ? `. Equivale a ${formatBRL(monthly)} por mês` : ""}
      </span>

      <div
        aria-hidden="true"
        className="flex flex-col gap-2.5 max-sm:flex-row max-sm:flex-wrap max-sm:items-baseline max-sm:justify-between max-sm:gap-x-3 max-sm:gap-y-1"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[30px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums max-sm:text-2xl">
            {formatBRL(monthly)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">/mês</span>
        </div>
        <span className="whitespace-nowrap border-t border-border/70 pt-2.5 text-sm text-muted-foreground tabular-nums max-sm:border-0 max-sm:pt-0 max-sm:text-xs">
          {formatBRL(total)} {totalText}
        </span>
      </div>

      {/* O botão de rádio cobre o card inteiro: alvo de toque grande e foco visível. */}
      <RadioGroupItem
        value={option.cycle}
        aria-labelledby={labelId}
        aria-describedby={detailId}
        className="absolute inset-0 aspect-auto size-full rounded-xl border-0 text-transparent disabled:cursor-not-allowed"
      />
    </div>
  )
}

export function SelfCheckoutCycleSelector({
  cycles,
  value,
  billingType = "PIX",
  onChange,
  disabled,
  error,
}: {
  cycles: readonly SelfCheckoutCycleOption[]
  value: SelfCheckoutCycle | null
  /** Forma de pagamento escolhida: os preços dos planos mudam junto com ela. */
  billingType?: SelfCheckoutBillingType
  onChange: (cycle: SelfCheckoutCycle) => void
  disabled: boolean
  error?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary"
        >
          1
        </span>
        <h2
          id="self-checkout-cycles-title"
          className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-foreground"
        >
          Período do plano
        </h2>
      </div>
      <RadioGroup
        aria-labelledby="self-checkout-cycles-title"
        value={value ?? ""}
        onValueChange={(next) => onChange(next as SelfCheckoutCycle)}
        disabled={disabled}
        className="grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
      >
        {cycles.map((option) => (
          <CycleCard
            key={option.cycle}
            option={option}
            billingType={billingType}
            savingsPercent={savingsPercentVsMonthly(option, cycles, billingType)}
            selected={option.cycle === value}
            disabled={disabled}
          />
        ))}
      </RadioGroup>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
