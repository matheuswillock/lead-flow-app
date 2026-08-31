"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import {
  formatCurrencyStateForDisplay,
  normalizeCurrencyState,
} from "../utils/currencyInput"

interface CurrencyFieldProps {
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
  "aria-label"?: string
  /** Valor canônico no form state (ex.: `"12345.67"`). */
  value: string
  /** Recebe o valor canônico normalizado a cada digitação. */
  onValueChange: (canonicalValue: string) => void
}

/**
 * Input monetário com estado de edição textual separado: com foco o usuário
 * digita livre (sem re-máscara nem salto de cursor); no blur/render sem foco
 * o valor canônico do form state é exibido formatado em `R$ x.xxx,xx`.
 */
export function CurrencyField({ value, onValueChange, ...inputProps }: CurrencyFieldProps) {
  const [editingText, setEditingText] = useState<string | null>(null)
  const displayValue = editingText ?? formatCurrencyStateForDisplay(value)

  return (
    <Input
      {...inputProps}
      inputMode="decimal"
      value={displayValue}
      onFocus={() => setEditingText(formatCurrencyStateForDisplay(value))}
      onChange={(event) => {
        setEditingText(event.target.value)
        onValueChange(normalizeCurrencyState(event.target.value))
      }}
      onBlur={() => setEditingText(null)}
    />
  )
}
