"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Voltar e Continuar da fase. No celular o Continuar fica na barra fixa do rodapé, então aqui
 * ele só aparece a partir do `lg`.
 */
export function CheckoutPhaseNav({
  onBack,
  onNext,
  disabled = false,
}: {
  onBack?: () => void
  onNext?: () => void
  disabled?: boolean
}) {
  if (!onBack && !onNext) return null

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <Button type="button" variant="outline" size="lg" className="max-lg:min-h-11" onClick={onBack} disabled={disabled}>
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Voltar
        </Button>
      ) : (
        <span />
      )}
      {onNext ? (
        <Button type="button" size="lg" className="max-lg:hidden" onClick={onNext} disabled={disabled}>
          Continuar
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
