'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Lock, QrCode } from "lucide-react";

import { AdhesionPixPanel } from "@/app/adesao/[token]/features/components/AdhesionPixPanel";
import { isPixExpired } from "@/components/public-checkout/pixExpiry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingGracePaymentContext } from "../context/BillingGracePaymentContext";
import type {
  BillingGraceCycleQuote,
  BillingGracePaymentMethod,
  BillingGracePaymentQuote,
  IBillingGracePaymentContext,
} from "../context/BillingGracePaymentTypes";
import {
  BillingGraceCardAnalysis,
  BillingGraceCardDeclined,
  BillingGraceCardForm,
  BillingGraceMethodChoice,
} from "./BillingGraceCardPayment";
import {
  BillingGraceBilledItems,
  BillingGraceCycleChoice,
  BillingGraceRevokeDialog,
  applyKeptUsers,
  revokedUsersOf,
  formatBRL,
  formatPeriod,
} from "./BillingGraceRenewalChoice";

const METHOD_LABEL: Record<BillingGracePaymentMethod, string> = { PIX: "PIX", CREDIT_CARD: "Cartão de crédito" };

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

function OrderSummary({ quote, method, total }: {
  quote: BillingGraceCycleQuote | null
  method: BillingGracePaymentMethod
  total: number | null
}) {
  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="gap-1 border-b border-border px-6 py-5">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Resumo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        <dl className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-4 text-sm">
          <SummaryRow label="Plano" value={quote ? quote.label : "—"} />
          {quote ? <SummaryRow label="Período" value={formatPeriod(quote)} /> : null}
          {quote && quote.extraUsersTotal > 0 ? (
            <SummaryRow label={`Usuários adicionais (${quote.billedUsers.length})`} value={formatBRL(quote.extraUsersTotal)} />
          ) : null}
          {quote && quote.extraTeamsTotal > 0 ? (
            <SummaryRow label={`Times adicionais (${quote.billedTeams.length})`} value={formatBRL(quote.extraTeamsTotal)} />
          ) : null}
          <SummaryRow label="Forma de pagamento" value={METHOD_LABEL[method]} />
          <div className="mt-1 flex items-end justify-between gap-4 border-t border-border pt-3">
            <dt className="text-sm font-semibold text-foreground">Total</dt>
            <dd className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums">
              {total == null ? "—" : formatBRL(total)}
            </dd>
          </div>
        </dl>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Valor calculado com os usuários e times atuais da sua conta.
        </p>
      </CardContent>
    </Card>
  );
}

function PixGenerateSection({ error, isLoading, canGenerate, onGenerate }: {
  error: string | null
  isLoading: boolean
  canGenerate: boolean
  onGenerate: () => void
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
            Pague com PIX
          </h2>
          <p className="text-sm text-muted-foreground">
            Gere o QR Code e pague no app do seu banco. A confirmação chega em segundos e o acesso volta sozinho.
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full sm:w-fit max-lg:min-h-11"
        onClick={onGenerate}
        disabled={isLoading || !canGenerate}
        aria-busy={isLoading}
      >
        {isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {isLoading ? "Gerando o QR Code..." : "Gerar QR Code PIX"}
      </Button>
    </section>
  );
}

function SuccessScreen({ appHref }: { appHref: string }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-semantic-success-surface text-semantic-success">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-foreground">Assinatura reativada</h1>
      <p className="text-base text-muted-foreground">
        Pagamento confirmado. O acesso da sua equipe já está liberado.
      </p>
      {/* Recarrega a página inteira para o acesso ser recalculado com a assinatura em dia. */}
      <Button asChild size="lg" className="max-lg:min-h-11">
        <a href={appHref}>Voltar ao Corretor Studio</a>
      </Button>
    </main>
  );
}

/** Resultado do pagamento já iniciado (PIX gerado, cartão em análise ou recusado); null se não há. */
function PaymentOutcome({ state, now, keptUserIds, onUsePix }: {
  state: IBillingGracePaymentContext
  now: number
  keptUserIds: string[]
  onUsePix: () => void
}) {
  const { payment, isLoading, createPayment, refreshPayment, resetPayment } = state;
  if (!payment) return null;
  if (payment.method === "CREDIT_CARD") {
    return payment.status === "failed"
      ? <BillingGraceCardDeclined reason={payment.failureReason} onRetry={resetPayment} onUsePix={onUsePix} />
      : <BillingGraceCardAnalysis />;
  }
  const instructions = payment.paymentInstructions;
  if (!instructions?.brCode) return null;
  return (
    <AdhesionPixPanel
      pix={{ payload: instructions.brCode, encodedImage: instructions.brCodeBase64 ?? "", expirationDate: instructions.expiresAt ?? null }}
      email={null}
      now={now}
      isExpired={isPixExpired(instructions.expiresAt, now)}
      isValidating={false}
      isRegenerating={isLoading}
      onValidate={() => void refreshPayment()}
      onRegenerate={() => void createPayment(payment.cycle ?? "", keptUserIds)}
    />
  );
}

/** O passo de pagamento: carregando, resultado do pagamento, formulário do cartão ou geração do PIX. */
function PaymentArea({ state, now, selected, keptUserIds, payByCard, onUsePix, onGeneratePix, onBeforeCardPay }: {
  state: IBillingGracePaymentContext
  now: number
  selected: BillingGraceCycleQuote | null
  keptUserIds: string[]
  payByCard: boolean
  onUsePix: () => void
  onGeneratePix: () => void
  onBeforeCardPay: () => Promise<boolean>
}) {
  const { isLoading, error, quote, payment, createCardPayment } = state;
  const cardCheckout = quote?.cardCheckout ?? null;
  if (isLoading && !quote && !payment) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (payment && (payment.method === "CREDIT_CARD" || payment.paymentInstructions?.brCode)) {
    return <PaymentOutcome state={state} now={now} keptUserIds={keptUserIds} onUsePix={onUsePix} />;
  }
  if (payByCard && cardCheckout && selected?.cardTotal != null) {
    return (
      <BillingGraceCardForm
        cardCheckout={cardCheckout}
        cycle={selected.cycle}
        keptUserIds={keptUserIds}
        amount={selected.cardTotal}
        maxInstallments={selected.maxInstallments}
        isPaying={isLoading}
        error={error}
        onBeforePay={onBeforeCardPay}
        onPay={createCardPayment}
      />
    );
  }
  return <PixGenerateSection error={error} isLoading={isLoading} canGenerate={Boolean(selected)} onGenerate={onGeneratePix} />;
}

/** Prazo inicial: o atual da conta quando ainda é vendido; senão o primeiro da tabela. */
function defaultCycleOf(quote: BillingGracePaymentQuote): string {
  const current = quote.currentCycle?.toLowerCase();
  return quote.cycles.find((cycle) => cycle.cycle === current)?.cycle ?? quote.cycles[0]?.cycle ?? "";
}

/**
 * "Tem certeza?" antes de pagar quando alguém vai perder o acesso. Sem revogação, segue direto.
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
 * Renovação da assinatura pelo master, no visual da contratação: escolhe o prazo, vê quem e o que
 * está sendo cobrado e paga no PIX (ou no cartão, quando a renovação enviar `cardCheckout`).
 */
export function BillingGracePaymentContainer() {
  const state = useBillingGracePaymentContext();
  const { isLoading, quote, payment, load, createPayment, resetPayment } = state;
  const params = useParams<{ supabaseId: string }>();
  const [now, setNow] = useState(() => Date.now());
  const [method, setMethod] = useState<BillingGracePaymentMethod>("PIX");
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
  const toggleUser = (userId: string, kept: boolean) => {
    setRemovedUserIds((current) => {
      const next = new Set(current);
      if (kept) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (payment?.status === "completed") {
    return <SuccessScreen appHref={params?.supabaseId ? `/${params.supabaseId}/dashboard` : "/"} />;
  }

  const canPayByCard = Boolean(quote?.cardCheckout && selected?.cardTotal != null);
  const activeMethod: BillingGracePaymentMethod = payment?.method ?? (canPayByCard ? method : "PIX");
  const total = payment ? payment.amountCents / 100 : selected ? (activeMethod === "CREDIT_CARD" ? selected.cardTotal : selected.pixTotal) : null;
  const usePix = () => {
    resetPayment();
    setMethod("PIX");
  };
  const generatePix = async () => {
    if (await confirmation.ensureConfirmed()) await createPayment(cycle, keptUserIds);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-6 py-8">
      <PageHeading
        title="Renove sua assinatura"
        description="Escolha o prazo, confira o que está sendo cobrado e pague para manter o acesso da sua equipe."
      />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {quote && !payment ? (
            <BillingGraceCycleChoice
              cycles={quote.cycles.map((item) => applyKeptUsers(item, new Set(keptUserIds)))}
              value={cycle} disabled={isLoading} onChange={setChosenCycle} />
          ) : null}
          {selected ? (
            <BillingGraceBilledItems
              quote={selected}
              keptUserIds={new Set(keptUserIds)}
              disabled={isLoading || Boolean(payment)}
              onToggleUser={toggleUser}
            />
          ) : null}
          {canPayByCard && selected && !payment ? (
            <BillingGraceMethodChoice
              value={activeMethod}
              pixAmount={selected.pixTotal}
              cardAmount={selected.cardTotal ?? selected.pixTotal}
              maxInstallments={selected.maxInstallments}
              disabled={isLoading}
              onChange={setMethod}
            />
          ) : null}
          <PaymentArea
            state={state}
            now={now}
            selected={selected}
            keptUserIds={keptUserIds}
            payByCard={activeMethod === "CREDIT_CARD"}
            onUsePix={usePix}
            onGeneratePix={() => void generatePix()}
            onBeforeCardPay={confirmation.ensureConfirmed}
          />
        </div>
        <aside aria-label="Resumo" className="lg:sticky lg:top-6">
          <OrderSummary quote={selected} method={activeMethod} total={total} />
        </aside>
      </div>
      <BillingGraceRevokeDialog
        revokedUsers={revokedUsers}
        open={confirmation.isOpen}
        onOpenChange={(open) => {
          if (!open) confirmation.cancel();
        }}
        onConfirm={confirmation.confirm}
      />
    </main>
  );
}
