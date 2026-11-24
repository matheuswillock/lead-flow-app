"use client"

import type { ReactNode } from "react"

import AnimatedStepper from "@/components/ui/smoothui/animated-stepper"

/**
 * Stepper das fases do checkout. Só mostra o progresso: o avanço é feito pelos botões de Continuar
 * e Voltar, então os passos não são clicáveis. O conteúdo da fase atual troca com a animação do
 * próprio stepper. No celular os rótulos somem, então a fase aparece em texto acima.
 */
export function CheckoutStepper({
  labels,
  currentIndex,
  children,
}: {
  labels: readonly string[]
  currentIndex: number
  children: ReactNode
}) {
  return (
    <>
      <p className="text-center text-sm font-medium text-muted-foreground sm:hidden" aria-live="polite">
        Passo {currentIndex + 1} de {labels.length}: {labels[currentIndex]}
      </p>
      <AnimatedStepper
        steps={labels.map((label, index) => ({
          label,
          content: index === currentIndex ? children : null,
        }))}
        currentStep={currentIndex}
        variant="horizontal"
        indicatorClassName="mx-auto w-full max-w-xl"
      />
    </>
  )
}
