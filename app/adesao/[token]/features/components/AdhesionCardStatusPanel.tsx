"use client"

import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Cartão enviado e ainda sem confirmação da operadora. A tela atualiza sozinha; o botão só força
 * uma consulta e a fatura continua disponível quando existir.
 */
export function AdhesionCardStatusPanel({
  invoiceUrl,
  email,
  isValidating,
  onValidate,
}: {
  invoiceUrl: string | null
  email: string | null
  isValidating: boolean
  onValidate: () => void
}) {
  return (
    <section
      aria-labelledby="adhesion-card-status-title"
      className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="size-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-primary">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Em análise pela operadora
          </span>
          <h2
            id="adhesion-card-status-title"
            className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground"
          >
            Estamos confirmando seu cartão
          </h2>
          <p className="text-sm text-muted-foreground">
            Costuma levar poucos segundos. Esta tela atualiza sozinha; pode deixá-la aberta.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {email ? (
            <>
              O acesso vai para <span className="font-semibold text-foreground">{email}</span>.
            </>
          ) : (
            "O acesso chega por e-mail assim que a operadora aprovar."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {invoiceUrl ? (
            <Button asChild variant="ghost" className="max-lg:min-h-11">
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                Ver fatura
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="max-lg:min-h-11"
            onClick={onValidate}
            disabled={isValidating}
          >
            {isValidating ? "Verificando..." : "Atualizar status"}
          </Button>
        </div>
      </div>
    </section>
  )
}
