"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

/** "08/11" no fuso de São Paulo, o mesmo da regra de vencimento. */
function formatGraceDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso))
}

export function billingGraceCopy(input: { graceUntil: string; isBillingOwner: boolean }) {
  const date = formatGraceDate(input.graceUntil)
  return input.isBillingOwner
    ? {
        title: "Sua assinatura venceu",
        description: `Regularize o pagamento até ${date} para a sua equipe não perder o acesso.`,
      }
    : {
        title: "A assinatura desta conta está pendente",
        description: `Se não for regularizada até ${date}, o acesso será pausado.`,
      }
}

/**
 * Aviso da carência de cobrança: a conta venceu e o acesso segue até o fim da tolerância. O master
 * (quem paga) recebe o atalho para regularizar; os demais usuários só são avisados.
 */
export function BillingGraceBanner({
  graceUntil,
  isBillingOwner,
  regularizeHref,
}: {
  graceUntil: string
  isBillingOwner: boolean
  /** Página de regularização; ausente quando o master já está nela. */
  regularizeHref?: string
}) {
  const copy = billingGraceCopy({ graceUntil, isBillingOwner })

  return (
    <div
      role="status"
      className="sticky top-0 z-50 border-b border-semantic-warning-border bg-semantic-warning-surface px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-semantic-warning" aria-hidden />
          <span>
            <span className="font-semibold">{copy.title}.</span> {copy.description}
          </span>
        </p>
        {isBillingOwner && regularizeHref ? (
          <Button asChild size="sm" className="w-fit shrink-0 max-lg:min-h-11">
            <Link href={regularizeHref}>
              Regularizar pagamento
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
