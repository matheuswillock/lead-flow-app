"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsFilterPresetsSheet } from "@/app/[supabaseId]/components/leads-filters/LeadsFilterPresetsSheet";
import { usePerformanceContext } from "../../context/PerformanceContext";
import {
  DEFAULT_PERFORMANCE_FILTERS,
  isPerformanceFiltersChanged,
  type PerformanceFiltersState,
  type PerformancePreset,
} from "../../context/PerformanceTypes";
import { PresetButton } from "./PresetButton";

const PERIOD_PRESETS: PerformancePreset[] = ["1d", "7d", "15d", "1m", "3m"];


const normalizePresetFilters = (raw: unknown): PerformanceFiltersState => {
  if (!raw || typeof raw !== "object") return DEFAULT_PERFORMANCE_FILTERS;
  const data = raw as Partial<PerformanceFiltersState>;
  return { ...DEFAULT_PERFORMANCE_FILTERS, ...data };
};

const normalizeFiltersForComparison = (f: PerformanceFiltersState): PerformanceFiltersState => ({
  ...DEFAULT_PERFORMANCE_FILTERS,
  ...f,
  sdrId: f.sdrId ?? "",
  closerId: f.closerId ?? "",
  startDate: f.startDate ?? "",
  endDate: f.endDate ?? "",
  search: "",
});

const areFiltersEqual = (a: PerformanceFiltersState, b: PerformanceFiltersState) =>
  JSON.stringify(normalizeFiltersForComparison(a)) ===
  JSON.stringify(normalizeFiltersForComparison(b));

const parseDateKey = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function PerfFiltersBar() {
  const { filters, setFilter, setPreset, setDateRange, clearFilters } = usePerformanceContext();

  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId, activeRole, isTeamMaster } = useTeamContext();
  const { user } = useUser();
  const isManager = isManagerLikeRole(activeRole ?? undefined);

  const canFilterByMember = isTeamMaster || (activeRole !== null && isManagerLikeRole(activeRole));

  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const [presetSnapshots, setPresetSnapshots] = useState<PerformanceFiltersState[]>([]);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `performance:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of [...sdrMembers, ...closerMembers]) {
      map.set(member.id, member.name || member.email);
    }
    return map;
  }, [closerMembers, sdrMembers]);

  const sdrOptions = useMemo(
    () => sdrMembers.map((m) => ({ value: m.id, label: m.name || m.email })),
    [sdrMembers]
  );

  const closerOptions = useMemo(
    () => closerMembers.map((m) => ({ value: m.id, label: m.name || m.email })),
    [closerMembers]
  );

  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!filters.startDate) return undefined;
    return {
      from: parseDateKey(filters.startDate),
      to: parseDateKey(filters.endDate),
    };
  }, [filters.startDate, filters.endDate]);

  const handleDateChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDateRange("", "");
      return;
    }
    setDateRange(
      format(range.from, "yyyy-MM-dd"),
      range.to ? format(range.to, "yyyy-MM-dd") : ""
    );
  };

  // Single-select wired to multi-select UI
  const handleSdrChange = (values: string[]) => {
    const prev = filters.sdrId ? [filters.sdrId] : [];
    const added = values.filter((v) => !prev.includes(v));
    setFilter("sdrId", added[0] ?? "");
  };

  const handleCloserChange = (values: string[]) => {
    const prev = filters.closerId ? [filters.closerId] : [];
    const added = values.filter((v) => !prev.includes(v));
    setFilter("closerId", added[0] ?? "");
  };

  const isFiltered = isPerformanceFiltersChanged(filters);

  const isPresetInUse = useMemo(
    () => presetSnapshots.some((snapshot) => areFiltersEqual(snapshot, filters)),
    [filters, presetSnapshots]
  );

  const presetDescriptionLabel = (q: PerformanceFiltersState): string => {
    const parts: string[] = [];
    if (q.preset && q.preset !== "7d") parts.push(`Período: ${q.preset}`);
    if (q.sdrId) parts.push("SDR filtrado");
    if (q.closerId) parts.push("Closer filtrado");
    if (q.startDate) parts.push(`De: ${q.startDate}${q.endDate ? ` até ${q.endDate}` : ""}`);
    return parts.length === 0 ? "Sem filtros aplicados" : parts.join(" • ");
  };

  const applyPerformanceFilters = (normalized: PerformanceFiltersState) => {
    setFilter("preset", normalized.preset);
    setFilter("sdrId", normalized.sdrId);
    setFilter("closerId", normalized.closerId);
    setDateRange(normalized.startDate, normalized.endDate);
  };

  return (
    <LeadsFiltersLayout>
      {/* Period presets */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border bg-card/50">
        {PERIOD_PRESETS.map((p) => (
          <PresetButton
            key={p}
            label={p}
            active={filters.preset === p && !filters.startDate}
            onClick={() => setPreset(p)}
          />
        ))}
      </div>

      {/* Custom date range */}
      <LeadsDateFilter
        title="Período"
        value={dateRange}
        onChange={handleDateChange}
      />

      {/* SDR */}
      {canFilterByMember && sdrOptions.length > 0 && (
        <LeadsMultiFilter
          title="SDR"
          options={sdrOptions}
          selectedValues={filters.sdrId ? [filters.sdrId] : []}
          onChange={handleSdrChange}
        />
      )}

      {/* Closer */}
      {canFilterByMember && closerOptions.length > 0 && (
        <LeadsMultiFilter
          title="Closer"
          options={closerOptions}
          selectedValues={filters.closerId ? [filters.closerId] : []}
          onChange={handleCloserChange}
        />
      )}

      <LeadsFilterPresetsSheet
        scope="performance"
        supabaseId={supabaseId}
        profileId={user?.id}
        teamId={activeTeamId}
        isManager={isManager}
        currentFilters={filters}
        isPresetActive={isPresetInUse}
        lastPresetStorageKey={lastPresetStorageKey}
        normalizePresetFilters={normalizePresetFilters}
        areFiltersEqual={areFiltersEqual}
        presetDescriptionLabel={presetDescriptionLabel}
        onApplyFilters={applyPerformanceFilters}
        getCreatorName={(id) => memberNameById.get(id)}
        onPresetsChange={(items) =>
          setPresetSnapshots(items.map((item) => normalizePresetFilters(item.queryJson)))
        }
      />

      {/* Clear */}
      {isFiltered && (
        <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
          <X className="mr-1 h-3 w-3" /> Limpar
        </Button>
      )}
    </LeadsFiltersLayout>
  );
}
