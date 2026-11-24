"use client"

import { useId } from "react"

import { formatBRL, installmentAmounts } from "@/app/adesao/[token]/features/utils/adhesionPayment"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Parcelas do cartão em Select do shadcn. O total é o mesmo em qualquer parcela; o valor de cada
 * parcela aparece na opção. Os dados do cartão ficam no campo seguro do Abacate Pay.
 */
export function CheckoutInstallmentsSelect({
  total,
  maxInstallments,
  value,
  disabled,
  onChange,
}: {
  total: number
  maxInstallments: number
  value: number
  disabled: boolean
  onChange: (installments: number) => void
}) {
  const id = useId()
  const counts = Array.from({ length: Math.max(1, maxInstallments) }, (_, index) => index + 1)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Parcelas</Label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))} disabled={disabled}>
        <SelectTrigger id={id} className="w-full max-lg:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {counts.map((count) => (
            <SelectItem key={count} value={String(count)}>
              {count}x de {formatBRL(installmentAmounts(total, count)[0])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
