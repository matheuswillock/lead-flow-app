"use client";

import { usePerformanceContext } from '../context/PerformanceContext';
import { PerfFiltersBar } from './Components/PerfFiltersBar';
import { PerfKpis } from './Components/PerfKpis';
import { PerfTopHighlights } from './Components/PerfTopHighlights';
import { PerfRankings } from './Components/PerfRankings';
import { Button } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';
import type { PerformancePreset } from '../context/PerformanceTypes';

export function PerformanceContainer() {
  const { data, error, filters, setFilter, setPreset, clearFilters } = usePerformanceContext();

  const periodLabel =
    {
      "1d": "ultimas 24h",
      "7d": "ultimos 7 dias",
      "15d": "ultimos 15 dias",
      "1m": "ultimo mes",
      "3m": "ultimos 3 meses",
    }[filters.preset] || "ultimos 7 dias";

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
                <p className="text-[12.5px] text-white/55 mt-1.5">
                  Indicadores comerciais e ranking de SDRs e Closers —{" "}
                  <span className="text-white/80">{periodLabel}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/45 px-2.5 py-1 rounded-md border border-border bg-(--card)/40">
                Ultima atualizacao: <span className="text-white/75 num">ha 2 min</span>
              </div>
              <Button className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] rounded-md border border-border hover:bg-white/4 text-white/85">
                <Download size={13} /> Exportar relatorio
              </Button>
              <Button className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] rounded-md bg-primary text-primary-foreground font-semibold shadow-[0_6px_18px_-8px_rgba(245,73,0,0.55)] hover:brightness-110">
                <Plus size={14} strokeWidth={2.5} /> Nova meta
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 px-3 py-3">
            <PerfFiltersBar
              preset={filters.preset}
              setPreset={(p: string) => setPreset(p as PerformancePreset)}
              sdrPicks={filters.sdrId ? [filters.sdrId] : []}
              closerPicks={filters.closerId ? [filters.closerId] : []}
              datePick={filters.startDate || ""}
              presets={["1d", "7d", "15d", "1m", "3m"]}
              onClearAll={clearFilters}
              search={filters.search}
              onSearchChange={(value: string) => setFilter('search', value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <PerfKpis />
          <PerfTopHighlights />
          <PerfRankings />
          <div className="pb-6 pt-2 text-center text-[11px] text-white/35">
            Dados sincronizados com CRM · Apenas vendas e reunioes marcadas como realizadas no
            periodo selecionado
          </div>
        </div>
      </div>
    </div>
  );
}
