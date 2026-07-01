"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Heart, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTeamContext } from "@/app/context/TeamContext";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { usePerformanceContext } from "../../context/PerformanceContext";
import {
  DEFAULT_PERFORMANCE_FILTERS,
  isPerformanceFiltersChanged,
  type PerformanceFiltersState,
  type PerformancePreset,
} from "../../context/PerformanceTypes";
import { PresetButton } from "./PresetButton";

const PERIOD_PRESETS: PerformancePreset[] = ["1d", "7d", "15d", "1m", "3m"];

type PerformanceFilterPreset = {
  id: string;
  name: string;
  description: string | null;
  queryJson: PerformanceFiltersState;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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

  const canFilterByMember = isTeamMaster || (activeRole !== null && isManagerLikeRole(activeRole));

  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presets, setPresets] = useState<PerformanceFilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `performance:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    if (!lastPresetStorageKey || typeof window === "undefined") {
      setLastUsedPresetId(null);
      return;
    }
    setLastUsedPresetId(window.localStorage.getItem(lastPresetStorageKey));
  }, [lastPresetStorageKey]);

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

  const loadPresets = async () => {
    if (!supabaseId || !activeTeamId) {
      setPresets([]);
      return;
    }
    setPresetsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${activeTeamId}/performance/filter-presets`,
        {
          headers: {
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
        }
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] ?? "Erro ao carregar presets.");
      }
      setPresets(
        Array.isArray(result.result)
          ? result.result.map((p: unknown) => ({
              ...(p as PerformanceFilterPreset),
              queryJson: normalizePresetFilters((p as PerformanceFilterPreset).queryJson),
            }))
          : []
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar filtros salvos.");
      setPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  };

  useEffect(() => {
    void loadPresets();
  }, [supabaseId, activeTeamId]);

  const isFiltered = isPerformanceFiltersChanged(filters);

  const activePreset = useMemo(
    () =>
      presets.find((p) =>
        areFiltersEqual(normalizePresetFilters(p.queryJson), filters)
      ) ?? null,
    [presets, filters]
  );

  const presetDescriptionLabel = (q: PerformanceFiltersState): string => {
    const parts: string[] = [];
    if (q.preset && q.preset !== "7d") parts.push(`Período: ${q.preset}`);
    if (q.sdrId) parts.push("SDR filtrado");
    if (q.closerId) parts.push("Closer filtrado");
    if (q.startDate) parts.push(`De: ${q.startDate}${q.endDate ? ` até ${q.endDate}` : ""}`);
    return parts.length === 0 ? "Sem filtros aplicados" : parts.join(" • ");
  };

  const handleSavePreset = async () => {
    if (!supabaseId || !activeTeamId) return;
    const name = presetName.trim();
    if (!name) { toast.error("Informe um nome para o preset."); return; }
    setIsSavingPreset(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${activeTeamId}/performance/filter-presets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({
            name,
            description: presetDescription.trim() || null,
            queryJson: filters,
          }),
        }
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] ?? "Não foi possível salvar o preset.");
      }
      toast.success("Filtro pré-definido salvo.");
      setPresetName("");
      setPresetDescription("");
      await loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar preset.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleUsePreset = async (preset: PerformanceFilterPreset) => {
    if (!supabaseId || !activeTeamId) return;
    const normalized = normalizePresetFilters(preset.queryJson);
    // Apply all filter fields from saved preset
    setFilter("preset", normalized.preset);
    setFilter("sdrId", normalized.sdrId);
    setFilter("closerId", normalized.closerId);
    setDateRange(normalized.startDate, normalized.endDate);
    setLastUsedPresetId(preset.id);
    if (lastPresetStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(lastPresetStorageKey, preset.id);
    }
    try {
      await fetch(
        `/api/v1/teams/${activeTeamId}/performance/filter-presets/${preset.id}/use`,
        {
          method: "POST",
          headers: {
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
        }
      );
    } catch (err) {
      console.error("[PerfFiltersBar] Falha ao marcar preset como usado:", err);
    }
    toast.success(`Preset "${preset.name}" aplicado.`);
    setPresetsOpen(false);
    await loadPresets();
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!supabaseId || !activeTeamId) return;
    try {
      const res = await fetch(
        `/api/v1/teams/${activeTeamId}/performance/filter-presets/${presetId}`,
        {
          method: "DELETE",
          headers: {
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
        }
      );
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] ?? "Não foi possível remover o preset.");
      }
      if (lastPresetStorageKey && typeof window !== "undefined" && lastUsedPresetId === presetId) {
        window.localStorage.removeItem(lastPresetStorageKey);
        setLastUsedPresetId(null);
      }
      toast.success("Preset removido.");
      await loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover preset.");
    }
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

      {/* Presets */}
      <Sheet
        open={presetsOpen}
        onOpenChange={(open) => {
          setPresetsOpen(open);
          if (open) void loadPresets();
        }}
      >
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 px-2 lg:px-3 ${activePreset ? "border-primary/70 text-primary" : ""}`}
          >
            <Heart
              className={`mr-2 h-4 w-4 ${activePreset ? "fill-primary text-primary" : ""}`}
            />
            Presets
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-105 sm:w-120">
          <SheetHeader>
            <SheetTitle>Filtros pré-definidos</SheetTitle>
            <SheetDescription>
              Salve filtros por time para reaproveitar depois. Esses presets são privados por usuário.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 grid gap-3 rounded-lg border border-border/60 p-3">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nome do preset"
            />
            <Input
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="Descrição da query"
            />
            <Button onClick={() => void handleSavePreset()} disabled={isSavingPreset}>
              {isSavingPreset ? "Salvando..." : "Salvar filtro atual"}
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {presetsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando presets...</p>
            ) : presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum preset salvo ainda.</p>
            ) : (
              presets.map((preset) => {
                const isLastUsed = preset.id === lastUsedPresetId;
                return (
                  <div key={preset.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{preset.name}</p>
                        {isLastUsed && <Badge variant="secondary">Último usado</Badge>}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleDeletePreset(preset.id)}
                        aria-label={`Remover preset ${preset.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {preset.description?.trim() ||
                        presetDescriptionLabel(normalizePresetFilters(preset.queryJson))}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => void handleUsePreset(preset)}>
                        Usar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Clear */}
      {isFiltered && (
        <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
          <X className="mr-1 h-3 w-3" /> Limpar
        </Button>
      )}
    </LeadsFiltersLayout>
  );
}
