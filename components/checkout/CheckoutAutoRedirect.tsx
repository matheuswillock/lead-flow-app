"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export const CHECKOUT_REDIRECT_SECONDS = 5

/** Próximo valor do contador regressivo; zero é o momento do redirecionamento. */
export function tickCheckoutCountdown(seconds: number): number {
  return Math.max(0, seconds - 1)
}

/**
 * Confirmação final do checkout logado: leva o usuário ao app em alguns segundos, com a opção
 * de ir agora. Usa navegação completa para o dashboard recalcular o acesso já pago.
 */
export function CheckoutAutoRedirect({
  href,
  seconds = CHECKOUT_REDIRECT_SECONDS,
}: {
  href: string
  seconds?: number
}) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining(tickCheckoutCountdown), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  useEffect(() => {
    if (remaining === 0) window.location.assign(href)
  }, [href, remaining])

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {`Você será levado ao Corretor Studio em ${remaining} s.`}
      </p>
      <Button asChild size="lg" className="max-lg:min-h-11">
        <a href={href}>
          Ir agora
          <ArrowRight data-icon="inline-end" aria-hidden />
        </a>
      </Button>
    </div>
  )
}
