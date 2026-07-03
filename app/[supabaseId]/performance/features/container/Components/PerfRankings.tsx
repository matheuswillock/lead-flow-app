"use client";

import { ArrowUp, Calendar, Check, Handshake, Medal, Trophy, UserPlus, UserX } from "lucide-react";
import { useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { Skeleton } from "@/components/ui/skeleton";
import { PerfPersonModal, type PerfPersonModalPerson } from "./PerfPersonModal";
import { RankRow } from "./RankRow";
import { usePerformanceContext } from "../../context/PerformanceContext";
import type {
  PerformanceActivityKind,
  PerformanceDrilldownEntry,
  PerformanceRankingEntry,
  PerformanceRecentActivity,
} from "../../context/PerformanceTypes";

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M receita`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k receita`;
  return `R$ ${value.toFixed(0)} receita`;
}

function kindToTone(kind: PerformanceActivityKind): "good" | "bad" | "neutral" {
  if (kind === "sale" || kind === "meeting_held" || kind === "scheduled") return "good";
  if (kind === "no_show") return "bad";
  return "neutral";
}

function kindToIcon(kind: PerformanceActivityKind): React.ReactNode {
  switch (kind) {
    case "sale":          return <Handshake size={12} />;
    case "meeting_held":  return <Check size={12} />;
    case "proposal_sent": return <ArrowUp size={12} />;
    case "no_show":       return <UserX size={12} />;
    case "scheduled":     return <Calendar size={12} />;
    case "new_lead":      return <UserPlus size={12} />;
  }
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(diff / 3_600_000);
  const days    = Math.floor(diff / 86_400_000);

  if (minutes < 60) return `há ${minutes}min`;
  if (hours < 24)   return `há ${hours}h`;
  if (days === 1) {
    const t = new Date(isoString);
    return `ontem · ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  }
  return `há ${days}d`;
}

function mapActivities(
  activities: PerformanceRecentActivity[]
): PerfPersonModalPerson["activity"] {
  return activities.map((a) => ({
    text: a.text || `${a.leadName} (${a.leadCode})`,
    when: formatRelativeTime(a.createdAt),
    tone: kindToTone(a.kind),
    icon: kindToIcon(a.kind),
  }));
}

function buildPersonFromDrilldown(
  entry: PerformanceDrilldownEntry,
  rank: number
): PerfPersonModalPerson {
  const isCloser = entry.roleLabel === "Closer";
  const conversao =
    isCloser && entry.meetingsHeld > 0
      ? Math.round((entry.salesCount / entry.meetingsHeld) * 100)
      : 0;

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
          conversao,
          reunioes: entry.meetingsHeld,
          noshow: entry.noShowCount,
          faltas: entry.noShowCount,
        }
      : {
          agendamentos: entry.scheduledLeads,
          realizadas: entry.meetingsHeld,
          show: entry.attendanceRate,
          noshow: entry.noShowCount,
          faltas: entry.noShowCount,
        },
    activity: mapActivities(entry.recentActivities ?? []),
  };
}

export function PerfRankings() {
  const { data, isLoading } = usePerformanceContext();
  const { activeFunctions } = useTeamContext();
  const [selected, setSelected] = useState<PerfPersonModalPerson | null>(null);

  const isSelfView = data?.viewMode === "self";
  const showCloserSection = !isSelfView || activeFunctions.includes("CLOSER");
  const showSdrSection = !isSelfView || activeFunctions.includes("SDR");

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-75 rounded-xl" />
        ))}
      </div>
    );
  }

  const { rankings, drilldown } = data;

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
    const entry = drilldown.find(
      (d) => d.profileId === rankingEntry.profileId && d.roleLabel === "Closer"
    );
    if (entry) setSelected(buildPersonFromDrilldown(entry, idx + 1));
  }

  function handleSdrClick(rankingEntry: PerformanceRankingEntry, idx: number) {
    const entry = drilldown.find(
      (d) => d.profileId === rankingEntry.profileId && d.roleLabel === "SDR"
    );
    if (entry) setSelected(buildPersonFromDrilldown(entry, idx + 1));
  }

  return (
    <div className={`grid grid-cols-1 gap-5 ${showCloserSection && showSdrSection ? "lg:grid-cols-2" : ""}`}>
      {/* CLOSERS — Vendas */}
      {showCloserSection && (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--primary)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
              <Trophy size={14} className="text-primary" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">
                {isSelfView ? "Minha performance (Closer)" : "Ranking de Closers"}
              </div>
              <div className="text-[11px] text-foreground/45">
                {isSelfView ? "suas vendas fechadas no período" : "por vendas fechadas no período"}
              </div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {closersFormatted.length === 0 ? (
            <div className="text-center text-foreground/40 text-sm py-6">
              {isSelfView
                ? "Nenhuma venda registrada no período"
                : "Nenhum closer com vendas no período"}
            </div>
          ) : (
            closersFormatted.map((r, i) => (
              <RankRow
                key={rankings.closer[i]!.profileId}
                rank={isSelfView ? 1 : i + 1}
                {...r}
                suffix="vendas"
                color="var(--primary)"
                onClick={() => handleCloserClick(rankings.closer[i]!, i)}
              />
            ))
          )}
        </div>
      </div>
      )}

      {/* SDRs — Agendamentos */}
      {showSdrSection && (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--info)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--info)_25%,transparent)]">
              <Medal size={14} className="text-(--info)" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">
                {isSelfView ? "Minha performance (SDR)" : "Ranking de SDRs"}
              </div>
              <div className="text-[11px] text-foreground/45">
                {isSelfView ? "seus agendamentos no período" : "por agendamentos realizados"}
              </div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {sdrsFormatted.length === 0 ? (
            <div className="text-center text-foreground/40 text-sm py-6">
              {isSelfView
                ? "Nenhum agendamento registrado no período"
                : "Nenhum SDR com agendamentos no período"}
            </div>
          ) : (
            sdrsFormatted.map((r, i) => (
              <RankRow
                key={rankings.sdr[i]!.profileId}
                rank={isSelfView ? 1 : i + 1}
                {...r}
                suffix="agend."
                color="var(--info)"
                onClick={() => handleSdrClick(rankings.sdr[i]!, i)}
              />
            ))
          )}
        </div>
      </div>
      )}

      <PerfPersonModal
        open={selected !== null}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        person={selected}
      />
    </div>
  );
}
