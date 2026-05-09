"use client";

import { Medal, Trophy } from "lucide-react";
import { PerfPersonModal } from "./PerfPersonModal";
import { RankRow } from "./RankRow";
import { usePerformanceContext } from "../../context/PerformanceContext";
import { useEffect, useState } from "react";
import type { PerformanceRankingEntry, PerformanceDrilldownEntry } from "../../context/PerformanceTypes";

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M receita`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k receita`;
  return `R$ ${value.toFixed(0)} receita`;
}

function buildPersonFromDrilldown(
  entry: PerformanceDrilldownEntry,
  rank: number
) {
  const isCloser = entry.roleLabel === "Closer";
  return {
    name: entry.name,
    email: entry.email,
    avatar: `avatar-${(rank % 6) + 1}`,
    team: "",
    joined: "",
    rank,
    kind: isCloser ? "closer" : "sdr",
    stats: isCloser
      ? {
          vendas: entry.salesCount,
          receita: entry.totalSalesValue,
          conversao: entry.attendanceRate,
          reunioes: entry.meetingsHeld,
          faltas: 0,
          noshow: entry.noShowCount,
        }
      : {
          agendamentos: entry.scheduledLeads,
          realizadas: entry.meetingsHeld,
          show: entry.attendanceRate,
          tentativas: 0,
          conexoes: 0,
          faltas: 0,
          noshow: entry.noShowCount,
        },
    trend: [],
    trendPct: 0,
    funnel: [],
    activity: [],
  };
}

export function PerfRankings() {
  const { data, isLoading } = usePerformanceContext();
  const [selected, setSelected] = useState<ReturnType<typeof buildPersonFromDrilldown> | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card h-[300px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const { rankings, drilldown } = data;

  // Map ranking entries to RankRow props
  const closerMax = rankings.closer.length > 0 ? Math.max(...rankings.closer.map((r) => r.count)) : 1;
  const sdrMax = rankings.sdr.length > 0 ? Math.max(...rankings.sdr.map((r) => r.count)) : 1;

  const closersFormatted = rankings.closer.map((r, i) => ({
    name: r.name,
    role: "CLOSER",
    avatar: `avatar-${(i % 6) + 1}`,
    value: r.count,
    secondary: formatCurrencyShort(r.totalSalesValue),
    pct: closerMax > 0 ? Math.round((r.count / closerMax) * 100) : 0,
  }));

  const sdrsFormatted = rankings.sdr.map((r, i) => ({
    name: r.name,
    role: "",
    avatar: `avatar-${(i % 6) + 1}`,
    value: r.count,
    secondary: `${r.meetingsHeld} reuniões realizadas - ${r.attendanceRate.toFixed(0)}%`,
    pct: sdrMax > 0 ? Math.round((r.count / sdrMax) * 100) : 0,
  }));

  function handleCloserClick(rankingEntry: PerformanceRankingEntry, idx: number) {
    const drilldownEntry = drilldown.find(
      (d) => d.profileId === rankingEntry.profileId && d.roleLabel === "Closer"
    );
    if (drilldownEntry) {
      setSelected(buildPersonFromDrilldown(drilldownEntry, idx + 1));
    }
  }

  function handleSdrClick(rankingEntry: PerformanceRankingEntry, idx: number) {
    const drilldownEntry = drilldown.find(
      (d) => d.profileId === rankingEntry.profileId && d.roleLabel === "SDR"
    );
    if (drilldownEntry) {
      setSelected(buildPersonFromDrilldown(drilldownEntry, idx + 1));
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* CLOSERS — Vendas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--primary)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
              <Trophy size={14} className="text-primary" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Ranking de Closers</div>
              <div className="text-[11px] text-white/45">por vendas fechadas no período</div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {closersFormatted.length === 0 ? (
            <div className="text-center text-white/40 text-sm py-6">
              Nenhum closer com vendas no período
            </div>
          ) : (
            closersFormatted.map((r, i) => (
              <RankRow
                key={rankings.closer[i].profileId}
                rank={i + 1}
                {...r}
                suffix="vendas"
                color="var(--primary)"
                onClick={() => handleCloserClick(rankings.closer[i], i)}
              />
            ))
          )}
        </div>
      </div>

      {/* SDRs — Agendamentos */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--info)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--info)_25%,transparent)]">
              <Medal size={14} className="text-(--info)" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Ranking de SDRs</div>
              <div className="text-[11px] text-white/45">por agendamentos realizados</div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {sdrsFormatted.length === 0 ? (
            <div className="text-center text-white/40 text-sm py-6">
              Nenhum SDR com agendamentos no período
            </div>
          ) : (
            sdrsFormatted.map((r, i) => (
              <RankRow
                key={rankings.sdr[i].profileId}
                rank={i + 1}
                {...r}
                suffix="agend."
                color="var(--info)"
                onClick={() => handleSdrClick(rankings.sdr[i], i)}
              />
            ))
          )}
        </div>
      </div>

      <PerfPersonModal person={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
