"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatBRL } from "../utils/adhesionPayment"

const NEXT_STEPS = [
  "Abra o e-mail que enviamos com o assunto do Corretor Studio.",
  "Clique no link para criar sua senha de acesso.",
  "Entre e comece a cadastrar seu time e seus leads.",
]

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  )
}

/** Fechamento da contratação: confirma o pagamento, resume o pedido e diz o que fazer agora. */
export function AdhesionSuccessScreen({
  companyName,
  email,
  planLabel,
  paymentLabel,
  total,
}: {
  companyName: string
  email: string
  planLabel: string
  paymentLabel: string
  total: number
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-semantic-success-surface text-semantic-success">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground">
            Pagamento confirmado
          </h1>
          <p className="text-base text-muted-foreground">
            Boas-vindas ao Corretor Studio{companyName ? `, ${companyName}` : ""}.
          </p>
        </div>
      </div>

      <section
        aria-labelledby="adhesion-success-next"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="adhesion-success-next" className="font-display text-lg font-bold text-foreground">
              Seu acesso foi enviado
            </h2>
            <p className="break-words text-sm text-muted-foreground">
              Para <span className="font-semibold text-foreground">{email}</span>
            </p>
          </div>
        </div>
        <ol className="flex flex-col gap-3">
          {NEXT_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm text-foreground">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary"
              >
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Não chegou? Confira a caixa de spam e as promoções.</p>
      </section>

      <dl className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-5">
        <SummaryLine label="Plano" value={planLabel} />
        <SummaryLine label="Pagamento" value={paymentLabel} />
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm font-semibold text-foreground">Total pago</dt>
          <dd className="font-display text-xl font-extrabold text-foreground tabular-nums">{formatBRL(total)}</dd>
        </div>
      </dl>

      <Button asChild size="lg" className="w-full max-lg:min-h-11 sm:w-fit sm:self-center">
        <Link href="/sign-in">
          Ir para o login
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Link>
      </Button>
    </div>
  )
}
