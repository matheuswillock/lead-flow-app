'use client';

import type { ReactNode, RefObject } from "react";
import { CreditCard, Loader2, QrCode } from "lucide-react";

import {
  AbacateCardField,
  type AbacateCardFieldHandle,
} from "@/app/adesao/[token]/features/components/AbacateCardField";
import { CheckoutInstallmentsSelect } from "@/components/checkout/CheckoutInstallmentsSelect";
import { Button } from "@/components/ui/button";

/** Seção de uma fase: título e uma linha de apoio, sem número. */
export function BillingGraceSection({
  id,
  title,
  description,
  pill,
  children,
}: {
  id: string
  title: string
  description: string
  pill?: ReactNode
  children?: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {pill}
        <div className="flex flex-col gap-1">
          <h2 id={id} className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Dados do cartão pelo Abacate Pay: os campos ficam no iframe seguro e o token só é gerado no
 * envio, na lateral. Aqui ficam as parcelas.
 */
export function BillingGraceCardForm({
  cardFieldRef,
  publicKey,
  amount,
  maxInstallments,
  installments,
  disabled,
  onInstallmentsChange,
}: {
  cardFieldRef: RefObject<AbacateCardFieldHandle | null>
  publicKey: string
  amount: number
  /** Parcelas até o número de meses do prazo escolhido. */
  maxInstallments: number
  installments: number
  disabled: boolean
  onInstallmentsChange: (installments: number) => void
}) {
  return (
    <BillingGraceSection
      id="billing-grace-card-title"
      title="Dados do cartão"
      description="Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app."
    >
      <AbacateCardField ref={cardFieldRef} publicKey={publicKey} amountInCents={Math.round(amount * 100)} />
      {maxInstallments > 1 ? (
        <CheckoutInstallmentsSelect
          total={amount}
          maxInstallments={maxInstallments}
          value={installments}
          disabled={disabled}
          onChange={onInstallmentsChange}
        />
      ) : null}
    </BillingGraceSection>
  );
}

/** Cartão enviado e aguardando a resposta do banco; a tela atualiza sozinha. */
export function BillingGraceCardAnalysis() {
  return (
    <BillingGraceSection
      id="billing-grace-analysis-title"
      title="Estamos confirmando seu cartão"
      description="Costuma levar poucos segundos. Esta tela atualiza sozinha; pode deixá-la aberta."
      pill={
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Em análise pela operadora
        </span>
      }
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Aguardando a confirmação do banco...
      </p>
    </BillingGraceSection>
  );
}

/** Cartão recusado: corrigir os dados ou trocar para PIX, sem perder o prazo escolhido. */
export function BillingGraceCardDeclined({
  reason,
  onRetry,
  onUsePix,
}: {
  reason?: string | null
  onRetry: () => void
  onUsePix: () => void
}) {
  return (
    <BillingGraceSection
      id="billing-grace-declined-title"
      title="Não conseguimos aprovar o cartão"
      description={reason ?? "O banco recusou a cobrança. Nada foi cobrado. Corrija os dados ou use outra forma de pagamento."}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" className="max-lg:min-h-11" onClick={onRetry}>
          <CreditCard data-icon="inline-start" aria-hidden />
          Corrigir dados do cartão
        </Button>
        <Button type="button" size="lg" variant="outline" className="max-lg:min-h-11" onClick={onUsePix}>
          <QrCode data-icon="inline-start" aria-hidden />
          Pagar com PIX
        </Button>
      </div>
    </BillingGraceSection>
  );
}
