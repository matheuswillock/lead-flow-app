"use client"

import { Check } from "lucide-react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { SelfCheckoutCycle, SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { cn } from "@/lib/utils"
import { formatBRL } from "../utils/selfCheckoutForm"

function CycleCard({
  option,
  selected,
  disabled,
}: {
  option: SelfCheckoutCycleOption
  selected: boolean
  disabled: boolean
}) {
  const labelId = `self-checkout-cycle-${option.cycle}-label`
  const detailId = `self-checkout-cycle-${option.cycle}-detail`

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors duration-[var(--motion-duration-base)]",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50",
        disabled && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span id={labelId} className="text-sm font-semibold text-foreground">
          {option.label}
        </span>
        <span id={detailId} className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-foreground">{formatBRL(option.pixTotal)}</span>
          <span className="text-xs text-muted-foreground">à vista no PIX</span>
          {option.months > 1 ? (
            <span className="text-xs text-muted-foreground">
              Equivale a {formatBRL(option.monthlyEquivalent)} por mês
            </span>
          ) : null}
        </span>
      </div>
      {/* O botão de rádio cobre o card inteiro: alvo de toque grande e foco visível. */}
      <RadioGroupItem
        value={option.cycle}
        aria-labelledby={labelId}
        aria-describedby={detailId}
        className="absolute inset-0 aspect-auto size-full rounded-lg border-0 text-transparent disabled:cursor-not-allowed"
      />
    </div>
  )
}

export function SelfCheckoutCycleSelector({
  cycles,
  value,
  onChange,
  disabled,
  error,
}: {
  cycles: readonly SelfCheckoutCycleOption[]
  value: SelfCheckoutCycle | null
  onChange: (cycle: SelfCheckoutCycle) => void
  disabled: boolean
  error?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 id="self-checkout-cycles-title" className="text-lg font-semibold text-foreground">
        Período do plano
      </h2>
      <RadioGroup
        aria-labelledby="self-checkout-cycles-title"
        value={value ?? ""}
        onValueChange={(next) => onChange(next as SelfCheckoutCycle)}
        disabled={disabled}
        className="grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {cycles.map((option) => (
          <CycleCard
            key={option.cycle}
            option={option}
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
