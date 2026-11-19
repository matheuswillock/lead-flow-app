"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { usePageBreadcrumb } from "@/app/context/PageBreadcrumbContext";
import { PlanSimulatorShell } from "@/components/plan-simulator/PlanSimulatorShell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { QuoteResults } from "../components/QuoteResults";
import { QuotesHome } from "../components/QuotesHome";
import { QuoteWizard } from "../components/QuoteWizard";

export function PlanSimulatorContainer() {
  const ctx = usePlanSimulatorContext();
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { setOverride } = usePageBreadcrumb();
  const { view, nome, goHome } = ctx;

  // Breadcrumb no header global: "Simulador de Planos" (linkável, volta à lista) › tela atual.
  useEffect(() => {
    if (view === "home") {
      setOverride(null);
      return;
    }
    setOverride({
      label: view === "wizard" ? "Nova cotação" : nome.trim() || "Cotação",
      trail: [
        {
          label: "Simulador de Planos",
          href: `/${supabaseId}/pme-simulador`,
          onClick: (event) => {
            // Clique simples volta à lista sem recarregar; Ctrl/Cmd/Shift/botão do meio seguem o link normal.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            goHome();
          },
        },
      ],
    });
    return () => setOverride(null);
  }, [view, nome, supabaseId, goHome, setOverride]);

  if (!ctx.headers) {
    return (
      <PlanSimulatorShell>
        <Skeleton className="m-6 h-40 rounded-xl" />
      </PlanSimulatorShell>
    );
  }

  if (!ctx.isAllowed) {
    return (
      <PlanSimulatorShell>
        <div className="wrap narrow">
          <div className="empty">
            <h3>Acesso restrito</h3>
            <p>O Simulador de Planos está disponível apenas para SDR, Closer e perfis manager.</p>
          </div>
        </div>
      </PlanSimulatorShell>
    );
  }

  return (
    <PlanSimulatorShell>
      {ctx.message ? (
        <div className="warnbox" role="status" style={{ margin: "12px 16px 0" }} onClick={() => ctx.setMessage(null)}>
          {ctx.message}
        </div>
      ) : null}

      {ctx.view === "home" ? <QuotesHome /> : null}
      {ctx.view === "wizard" ? <QuoteWizard /> : null}
      {ctx.view === "results" ? <QuoteResults /> : null}
    </PlanSimulatorShell>
  );
}
