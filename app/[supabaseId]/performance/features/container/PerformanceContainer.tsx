"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { usePerformanceContext } from "../context/PerformanceContext";
import { PerfFiltersBar } from "./Components/PerfFiltersBar";
import { PerfKpis } from "./Components/PerfKpis";
import { PerfTopHighlights } from "./Components/PerfTopHighlights";
import { PerfRankings } from "./Components/PerfRankings";
import { ExportarRelatorioModal } from "./Components/ExportarRelatorioModal";
import type { PerformanceTeamScope } from "../context/PerformanceTypes";

export function PerformanceContainer() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { user } = useUserContext();
  const { activeRole, isTeamMaster } = useTeamContext();
  const { error, filters, data, teamScope, setTeamScope, canUseAllTeamsScope } = usePerformanceContext();
  const [isExportarOpen, setIsExportarOpen] = useState(false);

  const isSelfView = data?.viewMode === "self";
  const canAccessMeetingsHeld =
    user?.isMaster === true ||
    isTeamMaster ||
    activeRole === "manager";

  const periodLabel = (
    {
      "1d": "ultimas 24h",
      "7d": "últimos 7 dias",
      "15d": "últimos 15 dias",
      "1m": "último mês",
      "3m": "últimos 3 meses",
    } as Record<string, string>
  )[filters.preset] ?? "últimos 7 dias";

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
                  {isSelfView ? (
                    <>
                      Seus indicadores comerciais no período —{" "}
                      <span className="text-foreground/80">{periodLabel}</span>
                    </>
                  ) : (
                    <>
                      Indicadores comerciais e ranking de SDRs e Closers —{" "}
                      <span className="text-foreground/80">{periodLabel}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canUseAllTeamsScope && (
                <ToggleGroup
                  type="single"
                  value={teamScope}
                  onValueChange={(value) => {
                    if (value === 'active' || value === 'all') {
                      setTeamScope(value as PerformanceTeamScope);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Escopo de times"
                >
                  <ToggleGroupItem value="active" aria-label="Time ativo">
                    Time ativo
                  </ToggleGroupItem>
                  <ToggleGroupItem value="all" aria-label="Todos os times">
                    Todos os times
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
              {canAccessMeetingsHeld && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${supabaseId}/performance/reunioes-realizadas`}>
                    <CalendarCheck data-icon="inline-start" size={13} />
                    Reuniões realizadas
                  </Link>
                </Button>
              )}
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
          {!isSelfView && <PerfTopHighlights />}
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
