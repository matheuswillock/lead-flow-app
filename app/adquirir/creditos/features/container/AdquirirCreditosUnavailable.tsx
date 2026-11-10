import Link from "next/link"
import { MailX } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Venda de créditos de e-mail pausada: a página continua no ar, sem oferta nem botão de compra. */
export function AdquirirCreditosUnavailable() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MailX className="size-7" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
          Compra de créditos indisponível
        </h1>
        <p className="text-sm text-muted-foreground">
          A contratação de créditos de e-mail está pausada no momento. Seus créditos atuais continuam
          valendo normalmente.
        </p>
        <Button asChild size="lg" className="max-lg:min-h-11">
          <Link href="/">Voltar ao Corretor Studio</Link>
        </Button>
      </div>
    </main>
  )
}
