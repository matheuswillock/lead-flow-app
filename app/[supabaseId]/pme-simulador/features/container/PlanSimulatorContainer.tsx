"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { QuoteWizard } from "../components/QuoteWizard";
import { QuoteResults } from "../components/QuoteResults";
import { QuotesHome } from "../components/QuotesHome";
import { PlanDetailDialog } from "../components/PlanDetailDialog";
import { SendQuoteDialog } from "../components/SendQuoteDialog";

export function PlanSimulatorContainer() {
  const ctx = usePlanSimulatorContext();

  if (!ctx.headers) {
    return <Skeleton className="m-6 h-40 rounded-xl" />;
  }

  if (!ctx.isAllowed) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Alert className="max-w-xl border-semantic-warning-border bg-semantic-warning-surface">
          <AlertTitle className="text-semantic-warning">Acesso restrito</AlertTitle>
          <AlertDescription className="text-foreground">
            O Simulador de Planos está disponível apenas para SDR, Closer e perfis manager.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      {ctx.message ? (
        <Alert role="status" onClick={() => ctx.setMessage(null)} className="cursor-pointer">
          <AlertDescription>{ctx.message}</AlertDescription>
        </Alert>
      ) : null}

      {ctx.view === "home" ? <QuotesHome /> : null}
      {ctx.view === "wizard" ? <QuoteWizard /> : null}
      {ctx.view === "results" ? <QuoteResults /> : null}

      <PlanDetailDialog />
      <SendQuoteDialog />
    </div>
  );
}
