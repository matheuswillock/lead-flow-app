'use client';

import { CreditCard, Loader2, QrCode, ShieldCheck, XCircle } from "lucide-react";

import { AbacateCardField } from "@/app/adesao/[token]/features/components/AbacateCardField";
import { AdhesionInstallmentsField } from "@/app/adesao/[token]/features/components/AdhesionPaymentFields";
import { AdhesionPaymentMethod } from "@/app/adesao/[token]/features/components/AdhesionPaymentMethod";
import { useAbacateCard } from "@/app/adesao/[token]/features/context/AbacateCardHook";
import { Button } from "@/components/ui/button";
import type {
  BillingGraceCardCheckout,
  BillingGraceCardInput,
  BillingGracePaymentMethod,
} from "../context/BillingGracePaymentTypes";

function PanelShell({ icon, title, description, children }: {
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex items-start gap-4">
        {icon}
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const ICON_BOX = "flex size-12 shrink-0 items-center justify-center rounded-xl";

/** PIX ou cartão. Só aparece quando a renovação aceita cartão. */
export function BillingGraceMethodChoice({ value, pixAmount, cardAmount, maxInstallments, disabled, onChange }: {
  value: BillingGracePaymentMethod
  pixAmount: number
  cardAmount: number
  maxInstallments: number
  disabled: boolean
  onChange: (method: BillingGracePaymentMethod) => void
}) {
  return (
    <section aria-labelledby="adhesion-method-title" className="flex flex-col gap-3">
      <h2 id="adhesion-method-title" className="text-sm font-semibold text-foreground">Forma de pagamento</h2>
      <AdhesionPaymentMethod
        methods={["PIX", "CREDIT_CARD"]}
        value={value}
        pixTotal={pixAmount}
        cardTotal={cardAmount}
        pixSavings={Math.max(0, Math.round((cardAmount - pixAmount) * 100) / 100)}
        maxInstallments={maxInstallments}
        disabled={disabled}
        onChange={onChange}
      />
    </section>
  );
}

/**
 * Cartão pelo Abacate Pay: os campos vêm num iframe seguro e o token (uso único, 60s) só é
 * gerado no clique em pagar.
 */
export function BillingGraceCardForm({ cardCheckout, cycle, keptUserIds, amount, maxInstallments, isPaying, error, onBeforePay, onPay }: {
  cardCheckout: BillingGraceCardCheckout
  cycle: string
  keptUserIds: string[]
  amount: number
  /** Parcelas até o número de meses do prazo escolhido. */
  maxInstallments: number
  isPaying: boolean
  error: string | null
  /** Confirmações antes de cobrar (ex.: perda do ilimitado); `false` cancela sem validar o cartão. */
  onBeforePay: () => Promise<boolean>
  onPay: (input: BillingGraceCardInput) => Promise<void>
}) {
  const { cardFieldRef, installmentsChoice, setInstallmentsChoice, cardError, isTokenizing, tokenizeCard } = useAbacateCard();
  const isBusy = isPaying || isTokenizing;
  const message = cardError ?? error;
  const installments = Math.min(installmentsChoice, maxInstallments);

  const handlePay = async () => {
    // O token vale 60 segundos: só valida o cartão depois das confirmações.
    if (!(await onBeforePay())) return;
    const { payer } = cardCheckout;
    const cardToken = await tokenizeCard({ fullName: payer.name, email: payer.email, cnpj: payer.taxId, phone: payer.cellphone });
    if (cardToken) await onPay({ cycle, keptUserIds, cardToken, installments });
  };

  return (
    <PanelShell
      icon={<span className={`${ICON_BOX} bg-primary/10 text-primary`}><CreditCard className="size-6" aria-hidden /></span>}
      title="Pague com cartão"
      description="Crédito Visa ou Mastercard. O banco pode pedir uma confirmação no app."
    >
      <AbacateCardField ref={cardFieldRef} publicKey={cardCheckout.publicKey} amountInCents={Math.round(amount * 100)} />
      {maxInstallments > 1 ? (
        <AdhesionInstallmentsField
          total={amount}
          maxInstallments={maxInstallments}
          fixedSchedule={null}
          value={installments}
          disabled={isBusy}
          onChange={setInstallmentsChoice}
        />
      ) : null}
      {message ? <p role="alert" className="text-sm font-medium text-destructive">{message}</p> : null}
      <Button type="button" size="lg" className="w-full sm:w-fit max-lg:min-h-11" onClick={() => void handlePay()} disabled={isBusy} aria-busy={isBusy}>
        {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {isTokenizing ? "Validando o cartão..." : isPaying ? "Processando..." : "Pagar com cartão"}
      </Button>
    </PanelShell>
  );
}

/** Cartão enviado e aguardando a resposta do banco; a tela atualiza sozinha. */
export function BillingGraceCardAnalysis() {
  return (
    <PanelShell
      icon={<span className={`${ICON_BOX} bg-primary/10 text-primary`}><ShieldCheck className="size-6" aria-hidden /></span>}
      title="Pagamento em análise"
      description="O banco está confirmando a cobrança no seu cartão. Isso costuma levar poucos segundos e a tela atualiza sozinha."
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Aguardando a confirmação do banco...
      </p>
    </PanelShell>
  );
}

/** Cartão recusado: tentar de novo ou trocar para PIX, sem perder a página. */
export function BillingGraceCardDeclined({ reason, onRetry, onUsePix }: {
  reason?: string | null
  onRetry: () => void
  onUsePix: () => void
}) {
  return (
    <PanelShell
      icon={<span className={`${ICON_BOX} bg-destructive/10 text-destructive`}><XCircle className="size-6" aria-hidden /></span>}
      title="O cartão não foi aprovado"
      description={reason ?? "O banco recusou a cobrança. Nada foi cobrado. Confira os dados ou use outra forma de pagamento."}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" className="max-lg:min-h-11" onClick={onRetry}>
          <CreditCard data-icon="inline-start" aria-hidden />
          Tentar outro cartão
        </Button>
        <Button type="button" size="lg" variant="outline" className="max-lg:min-h-11" onClick={onUsePix}>
          <QrCode data-icon="inline-start" aria-hidden />
          Pagar com PIX
        </Button>
      </div>
    </PanelShell>
  );
}
