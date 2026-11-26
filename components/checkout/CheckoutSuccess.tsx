"use client"

import type { ComponentProps } from "react"
import { CheckCircle2 } from "lucide-react"
import { CheckoutAutoRedirect } from "./CheckoutAutoRedirect"

import { AdhesionSuccessScreen } from "@/app/adesao/[token]/features/components/AdhesionSuccessScreen"
import { formatBRL } from "@/app/adesao/[token]/features/utils/adhesionPayment"

type AdhesionScreenProps = ComponentProps<typeof AdhesionSuccessScreen>

/** Contratação nova (self-checkout, adesão e adesão compartilhada): copy de boas-vindas e acesso por e-mail. */
type NewContractSuccessProps = AdhesionScreenProps & { variant?: "newContract" }

/** Add-on: os itens entram na assinatura da conta; sem senha nem boas-vindas. */
type AddonSuccessProps = {
  variant: "addon"
  email: string
  planLabel: string
  paymentLabel: string
  total: number
  /** Para onde o CTA "Voltar ao Corretor Studio" leva. */
  ctaHref: string
}

/** Cobrança de carência: a assinatura volta a valer; o CTA leva ao dashboard da conta. */
type RenewalSuccessProps = { variant: "renewal"; appHref: string }

export type CheckoutSuccessProps = NewContractSuccessProps | AddonSuccessProps | RenewalSuccessProps

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

function AddonSuccess({ email, planLabel, paymentLabel, total, ctaHref }: Omit<AddonSuccessProps, "variant">) {
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
            Os itens contratados foram adicionados à assinatura da sua conta.
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-5">
        <SummaryLine label="Item" value={planLabel} />
        <SummaryLine label="Pagamento" value={paymentLabel} />
        {email ? <SummaryLine label="E-mail do pagador" value={email} /> : null}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="text-sm font-semibold text-foreground">Total pago</dt>
          <dd className="font-display text-xl font-extrabold text-foreground tabular-nums">{formatBRL(total)}</dd>
        </div>
      </dl>

      <CheckoutAutoRedirect href={ctaHref} />
    </div>
  )
}

function RenewalSuccess({ appHref }: { appHref: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-semantic-success-surface text-semantic-success">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-foreground">
        Assinatura reativada
      </h1>
      <p className="text-base text-muted-foreground">Pagamento confirmado. O acesso da sua equipe já está liberado.</p>
      <CheckoutAutoRedirect href={appHref} />
    </div>
  )
}

/**
 * Tela de sucesso do kit, por jornada. `newContract` (padrão) é a contratação nova; `addon` e
 * `renewal` têm copy e CTA próprios e não falam de senha nem de envio de acesso.
 */
export function CheckoutSuccess(props: CheckoutSuccessProps) {
  if (props.variant === "addon") {
    return (
      <AddonSuccess
        email={props.email}
        planLabel={props.planLabel}
        paymentLabel={props.paymentLabel}
        total={props.total}
        ctaHref={props.ctaHref}
      />
    )
  }
  if (props.variant === "renewal") return <RenewalSuccess appHref={props.appHref} />
  return (
    <AdhesionSuccessScreen
      companyName={props.companyName}
      email={props.email}
      planLabel={props.planLabel}
      paymentLabel={props.paymentLabel}
      total={props.total}
    />
  )
}
