"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerformanceContext } from "../context/PerformanceContext";
import { PerfFiltersBar } from "./Components/PerfFiltersBar";
import { PerfKpis } from "./Components/PerfKpis";
import { PerfTopHighlights } from "./Components/PerfTopHighlights";
import { PerfRankings } from "./Components/PerfRankings";
import { ExportarRelatorioModal } from "./Components/ExportarRelatorioModal";

export function PerformanceContainer() {
  const { error, filters } = usePerformanceContext();
  const [isExportarOpen, setIsExportarOpen] = useState(false);

  const periodLabel = (
    {
      "1d": "ultimas 24h",
      "7d": "ultimos 7 dias",
      "15d": "ultimos 15 dias",
      "1m": "ultimo mes",
      "3m": "ultimos 3 meses",
    } as Record<string, string>
  )[filters.preset] ?? "ultimos 7 dias";

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="bg-grid">
        <div className="px-6 py-6 max-w-370 mx-auto w-full flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="font-display text-[26px] font-bold leading-none tracking-tight">
                  Performance
                </h1>
                <p className="text-[12.5px] text-foreground/55 mt-1.5">
                  Indicadores comerciais e ranking de SDRs e Closers —{" "}
                  <span className="text-foreground/80">{periodLabel}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-foreground/45 px-2.5 py-1 rounded-md border border-border bg-card/40">
                Ultima atualizacao: <span className="text-foreground/75 num">ha 2 min</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportarOpen(true)}
              >
                <Download data-icon="inline-start" size={13} />
                Exportar relatorio
              </Button>
              {/*
                TODO(performance): implementar serviço de Metas e reativar o fluxo de "Nova meta".
              */}
              {/*
              <Button
                size="sm"
                onClick={() => setIsNovaMetaOpen(true)}
              >
                <Plus data-icon="inline-start" size={14} strokeWidth={2.5} />
                Nova meta
              </Button>
              */}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-3">
            <PerfFiltersBar />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <PerfKpis />
          <PerfTopHighlights />
          <PerfRankings />
          <div className="pb-6 pt-2 text-center text-[11px] text-foreground/35">
            Dados sincronizados com CRM · Apenas vendas e reunioes marcadas como realizadas no
            periodo selecionado
          </div>
        </div>
      </div>

      {/*
        TODO(performance): implementar serviço de Metas e reativar modal de criação de meta.
      */}
      {/*
      <NovaMetaModal open={isNovaMetaOpen} onOpenChange={setIsNovaMetaOpen} />
      */}
      <ExportarRelatorioModal open={isExportarOpen} onOpenChange={setIsExportarOpen} />
    </div>
  );
}
