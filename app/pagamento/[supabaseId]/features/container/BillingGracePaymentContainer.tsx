'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Loader2, Lock } from "lucide-react";

import { useAbacateCard } from "@/app/adesao/[token]/features/context/AbacateCardHook";
import { installmentAmounts } from "@/app/adesao/[token]/features/utils/adhesionPayment";
import { useOptionalUser } from "@/app/context/UserContext";
import { SelfCheckoutSkeleton } from "@/app/checkout/features/components/SelfCheckoutSkeleton";
import { SelfCheckoutLoadError, SelfCheckoutUnavailable } from "@/app/checkout/features/components/SelfCheckoutStateMessages";
import { CheckoutMobilePayBar } from "@/components/checkout/CheckoutMobilePayBar";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { CheckoutPaymentMethod } from "@/components/checkout/CheckoutPaymentMethod";
import { CheckoutPhaseNav } from "@/components/checkout/CheckoutPhaseNav";
import { CheckoutPixPayment } from "@/components/checkout/CheckoutPixPayment";
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";
import { CheckoutTermsNotice } from "@/components/checkout/CheckoutTermsNotice";
import { isPixExpired } from "@/components/public-checkout/pixExpiry";
import { Button } from "@/components/ui/button";
import { useBillingGracePaymentContext } from "../context/BillingGracePaymentContext";
import type { BillingGracePaymentMethod, BillingGracePaymentQuote } from "../context/BillingGracePaymentTypes";
import {
  BillingGraceCardAnalysis,
  BillingGraceCardDeclined,
  BillingGraceCardForm,
  BillingGraceSection,
} from "./BillingGraceCardPayment";
import {
  BillingGraceBilledItems,
  BillingGraceCycleChoice,
  BillingGraceRevokeDialog,
  applyKeptUsers,
  formatBRL,
  formatPeriod,
  revokedUsersOf,
} from "./BillingGraceRenewalChoice";
import {
  BILLING_GRACE_PHASE_LABELS,
  PAYMENT_PHASE,
  PLAN_PHASE,
  canOpenPaymentPhase,
  effectiveInstallments,
  paymentCaption,
  paymentSubmitLabel,
  resolveActivePhase,
  resolvePaymentMethod,
} from "../utils/billingGracePhases";

const PAYMENT_METHODS: BillingGracePaymentMethod[] = ["PIX", "CREDIT_CARD"];
const METHOD_LABEL: Record<BillingGracePaymentMethod, string> = { PIX: "PIX", CREDIT_CARD: "Cartão de crédito" };
const SUBMIT_ERROR_ID = "billing-grace-submit-error";

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
        {title}
      </h1>
      <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/** Pagamento por PIX antes de gerar o QR Code: o envio fica na lateral. */
function BillingGracePixIntro() {
  return (
    <BillingGraceSection
      id="billing-grace-pix-title"
      title="Pagamento por PIX"
      description="Gere o QR Code e pague no app do seu banco. A confirmação chega em segundos e o acesso volta sozinho."
    />
  );
}

/** Prazo inicial: o atual da conta quando ainda é vendido; senão o primeiro da tabela. */
function defaultCycleOf(quote: BillingGracePaymentQuote): string {
  const current = quote.currentCycle?.toLowerCase();
  return quote.cycles.find((cycle) => cycle.cycle === current)?.cycle ?? quote.cycles[0]?.cycle ?? "";
}

/**
 * "Tem certeza?" antes de pagar quando alguém vai perder o acesso. Sem revogação, segue direto.
 * Exceção registrada ao padrão do checkout: a confirmação é regra do negócio da carência.
 */
function useRevokeConfirmation(revokedCount: number) {
  const [isOpen, setIsOpen] = useState(false);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setIsOpen(false);
  }, []);

  const ensureConfirmed = useCallback((): Promise<boolean> => {
    if (revokedCount === 0) return Promise.resolve(true);
    setIsOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, [revokedCount]);

  return { isOpen, ensureConfirmed, confirm: () => settle(true), cancel: () => settle(false) };
}

/**
 * Renovação da assinatura pelo master, no visual do checkout em fases: primeiro o prazo e os
 * itens, depois o pagamento. A forma de pagamento, o resumo e o envio ficam na lateral.
 */
export function BillingGracePaymentContainer() {
  const state = useBillingGracePaymentContext();
  const { isLoading, error, quote, payment, load, createPayment, createCardPayment, refreshPayment, resetPayment } = state;
  const card = useAbacateCard();
  const params = useParams<{ supabaseId: string }>();
  const email = useOptionalUser()?.user?.email ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [requestedMethod, setRequestedMethod] = useState<BillingGracePaymentMethod>("PIX");
  const [phaseIndex, setPhaseIndex] = useState(PLAN_PHASE);
  const [chosenCycle, setChosenCycle] = useState<string | null>(null);
  const [removedUserIds, setRemovedUserIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const cycle = payment?.cycle ?? chosenCycle ?? (quote ? defaultCycleOf(quote) : "");
  const cycleQuote = quote?.cycles.find((item) => item.cycle === cycle) ?? null;
  // Todos começam mantidos; o master desmarca quem não deve continuar.
  const keptUserIds = (cycleQuote?.accountUsers ?? []).map((user) => user.id).filter((id) => !removedUserIds.has(id));
  const selected = cycleQuote ? applyKeptUsers(cycleQuote, new Set(keptUserIds)) : null;
  const revokedUsers = selected ? revokedUsersOf(selected) : [];
  const confirmation = useRevokeConfirmation(revokedUsers.length);

  const canPayByCard = Boolean(quote?.cardCheckout && selected?.cardTotal != null);
  const method = payment?.method ?? resolvePaymentMethod(requestedMethod, canPayByCard);
  const activeIndex = resolveActivePhase(Boolean(payment), phaseIndex);
  const isPaymentPhase = activeIndex === PAYMENT_PHASE;
  const installments = effectiveInstallments(card.installmentsChoice, selected?.maxInstallments ?? 1);
  const isBusy = isLoading || card.isTokenizing;
  const message = card.cardError ?? error;
  const submitLabel = paymentSubmitLabel({ method, isBusy: isLoading, isTokenizing: card.isTokenizing });
  const cardTotal = selected?.cardTotal ?? null;
  const total = payment
    ? payment.amountCents / 100
    : selected
      ? method === "CREDIT_CARD" && cardTotal != null
        ? cardTotal
        : selected.pixTotal
      : null;
  const installmentCaption =
    method === "CREDIT_CARD" && installments > 1 && total != null
      ? `em ${installments}x de ${formatBRL(installmentAmounts(total, installments)[0])}`
      : null;

  // Erro do envio fica na lateral, que no celular está abaixo da dobra: leva o foco até ele.
  useEffect(() => {
    if (message) document.getElementById(SUBMIT_ERROR_ID)?.scrollIntoView({ block: "center" });
  }, [message]);

  if (payment?.status === "completed") {
    return <CheckoutSuccess variant="renewal" appHref={params?.supabaseId ? `/${params.supabaseId}/dashboard` : "/"} />;
  }
  if (!quote) {
    return error ? <SelfCheckoutLoadError message={error} onRetry={() => void load()} /> : <SelfCheckoutSkeleton />;
  }
  if (quote.cycles.length === 0) return <SelfCheckoutUnavailable />;

  const toggleUser = (userId: string, kept: boolean) => {
    setRemovedUserIds((current) => {
      const next = new Set(current);
      if (kept) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const usePix = () => {
    resetPayment();
    setRequestedMethod("PIX");
  };
  const goNext = () => {
    if (canOpenPaymentPhase(Boolean(selected))) setPhaseIndex(PAYMENT_PHASE);
  };
  const goBack = () => setPhaseIndex(PLAN_PHASE);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // O pagamento só começa na fase de pagamento; antes disso, o envio só avança a fase.
    if (!isPaymentPhase) {
      goNext();
      return;
    }
    if (payment || !selected || isBusy) return;
    if (!(await confirmation.ensureConfirmed())) return;
    if (method === "PIX") {
      await createPayment(cycle, keptUserIds);
      return;
    }
    const checkout = quote?.cardCheckout;
    if (!checkout) return;
    // O token do cartão vale 60 segundos: só é gerado depois das confirmações.
    const { payer } = checkout;
    const cardToken = await card.tokenizeCard({
      fullName: payer.name,
      email: payer.email,
      cnpj: payer.taxId,
      phone: payer.cellphone,
    });
    if (cardToken) await createCardPayment({ cycle, keptUserIds, cardToken, installments });
  }

  const planPhase = (
    <div className="flex flex-col gap-8">
      <BillingGraceCycleChoice
        cycles={quote.cycles.map((item) => applyKeptUsers(item, new Set(keptUserIds)))}
        value={cycle}
        disabled={isLoading}
        onChange={setChosenCycle}
      />
      {selected ? (
        <BillingGraceBilledItems
          quote={selected}
          keptUserIds={new Set(keptUserIds)}
          disabled={isLoading}
          onToggleUser={toggleUser}
        />
      ) : null}
    </div>
  );

  // Resultado do pagamento já iniciado (PIX gerado, cartão em análise ou recusado).
  const paymentPhase = (() => {
    if (payment?.method === "CREDIT_CARD") {
      return payment.status === "failed" ? (
        <BillingGraceCardDeclined reason={payment.failureReason} onRetry={resetPayment} onUsePix={usePix} />
      ) : (
        <BillingGraceCardAnalysis />
      );
    }
    if (payment) {
      const instructions = payment.paymentInstructions;
      if (!instructions?.brCode) return <BillingGracePixIntro />;
      return (
        <CheckoutPixPayment
          pix={{
            payload: instructions.brCode,
            encodedImage: instructions.brCodeBase64 ?? "",
            expirationDate: instructions.expiresAt ?? null,
          }}
          email={email}
          now={now}
          isExpired={isPixExpired(instructions.expiresAt, now)}
          isValidating={false}
          isRegenerating={isLoading}
          onValidate={() => void refreshPayment()}
          onRegenerate={() => void createPayment(payment.cycle ?? "", keptUserIds)}
        />
      );
    }
    if (method === "CREDIT_CARD" && quote.cardCheckout && selected?.cardTotal != null) {
      return (
        <BillingGraceCardForm
          cardFieldRef={card.cardFieldRef}
          publicKey={quote.cardCheckout.publicKey}
          amount={selected.cardTotal}
          maxInstallments={selected.maxInstallments}
          installments={installments}
          disabled={isBusy}
          onInstallmentsChange={card.setInstallmentsChoice}
        />
      );
    }
    return <BillingGracePixIntro />;
  })();

  const canSubmit = isPaymentPhase && !payment && Boolean(selected);

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeading
        title="Renove sua assinatura"
        description="Pague por PIX ou cartão para manter o acesso da sua equipe."
      />
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <CheckoutStepper labels={BILLING_GRACE_PHASE_LABELS} currentIndex={activeIndex}>
            {isPaymentPhase ? paymentPhase : planPhase}
          </CheckoutStepper>

          {payment ? null : (
            <CheckoutPhaseNav
              onBack={isPaymentPhase ? goBack : undefined}
              onNext={isPaymentPhase ? undefined : goNext}
              disabled={isBusy || !selected}
            />
          )}
        </div>

        <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
          <CheckoutOrderSummary
            footer={
              <>
                {message ? (
                  <p id={SUBMIT_ERROR_ID} role="alert" className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {message}
                  </p>
                ) : null}
                {canSubmit ? <CheckoutTermsNotice /> : null}
                {canSubmit ? (
                  // No celular o envio fica na barra fixa, junto com o total.
                  <Button type="submit" size="lg" className="w-full max-lg:hidden" disabled={isBusy} aria-busy={isBusy}>
                    {isBusy ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
                    {submitLabel}
                  </Button>
                ) : null}
                <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
                  <Lock className="size-3.5 shrink-0" aria-hidden />
                  {method === "CREDIT_CARD"
                    ? "Seus dados do cartão são enviados com segurança e não ficam salvos conosco."
                    : "O QR Code vale por tempo limitado. O acesso volta sozinho após a confirmação."}
                </p>
              </>
            }
          >
            {canPayByCard && selected ? (
              <CheckoutPaymentMethod
                methods={PAYMENT_METHODS}
                value={method}
                pixTotal={selected.pixTotal}
                cardTotal={selected.cardTotal ?? selected.pixTotal}
                pixSavings={Math.max(
                  0,
                  Math.round(((selected.cardTotal ?? selected.pixTotal) - selected.pixTotal) * 100) / 100,
                )}
                maxInstallments={selected.maxInstallments}
                disabled={isBusy || Boolean(payment)}
                onChange={setRequestedMethod}
              />
            ) : null}

            <dl className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-4 text-sm">
              <SummaryRow label="Plano" value={selected ? selected.label : "—"} />
              {selected ? <SummaryRow label="Período" value={formatPeriod(selected)} /> : null}
              {selected && selected.extraUsersTotal > 0 ? (
                <SummaryRow
                  label={`Usuários adicionais (${selected.billedUsers.length})`}
                  value={formatBRL(selected.extraUsersTotal)}
                />
              ) : null}
              {selected && selected.extraTeamsTotal > 0 ? (
                <SummaryRow
                  label={`Times adicionais (${selected.billedTeams.length})`}
                  value={formatBRL(selected.extraTeamsTotal)}
                />
              ) : null}
              <SummaryRow label="Forma de pagamento" value={METHOD_LABEL[method]} />
            </dl>

            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums">
                  {total == null ? "—" : formatBRL(total)}
                </span>
              </div>
              {installmentCaption ? (
                <p className="text-right text-xs text-muted-foreground tabular-nums">{installmentCaption}</p>
              ) : null}
            </div>
          </CheckoutOrderSummary>
        </aside>

        {/* Celular: total e ação sempre à vista. Nas fases intermediárias a ação é Continuar. */}
        {payment || !selected || total == null ? null : (
          <CheckoutMobilePayBar
            total={total}
            caption={paymentCaption(method, installments)}
            label={isPaymentPhase ? submitLabel : "Continuar"}
            isBusy={isBusy}
            disabled={isBusy}
            onContinue={isPaymentPhase ? undefined : goNext}
          />
        )}
      </form>

      <BillingGraceRevokeDialog
        revokedUsers={revokedUsers}
        open={confirmation.isOpen}
        onOpenChange={(open) => {
          if (!open) confirmation.cancel();
        }}
        onConfirm={confirmation.confirm}
      />
    </div>
  );
}
