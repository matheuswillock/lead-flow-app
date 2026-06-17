"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import useCrmContext from "../context/CrmHook";
import { DEFAULT_CRM_FILTERS, type CrmFiltersState, isCrmFiltersEmpty } from "../context/CrmTypes";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const STATUS_OPTIONS = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
  { value: "future_sale", label: "Venda Futura" },
  { value: "offerNegotiation", label: "Negociação" },
  { value: "pending_documents", label: "Documentos pendentes" },
  { value: "offerSubmission", label: "Proposta" },
  { value: "dps_agreement", label: "DPS | Contrato" },
  { value: "invoicePayment", label: "Boleto" },
  { value: "disqualified", label: "Desqualificado" },
  { value: "opportunityLost", label: "Perdido" },
  { value: "operator_denied", label: "Negado operadora" },
  { value: "contract_finalized", label: "Negócio fechado" },
];

type CrmFilterPreset = {
  id: string;
  name: string;
  description: string | null;
  queryJson: CrmFiltersState;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizePresetFilters = (raw: unknown): CrmFiltersState => {
  if (!raw || typeof raw !== "object") return DEFAULT_CRM_FILTERS;
  const data = raw as Partial<CrmFiltersState>;
  return {
    ...DEFAULT_CRM_FILTERS,
    ...data,
    statusFilter: Array.isArray(data.statusFilter) ? data.statusFilter : [],
    assignedUsers: Array.isArray(data.assignedUsers) ? data.assignedUsers : [],
    closerFilter: Array.isArray(data.closerFilter) ? data.closerFilter : [],
  };
};

const normalizeFiltersForComparison = (filters: CrmFiltersState): CrmFiltersState => ({
  ...DEFAULT_CRM_FILTERS,
  ...filters,
  query: filters.query.trim(),
  statusFilter: [...filters.statusFilter].sort(),
  assignedUsers: [...filters.assignedUsers].sort(),
  closerFilter: [...filters.closerFilter].sort(),
  periodStart: filters.periodStart || "",
  periodEnd: filters.periodEnd || "",
  scheduledPeriodStart: filters.scheduledPeriodStart || "",
  scheduledPeriodEnd: filters.scheduledPeriodEnd || "",
  onlyMeetingsHeld: filters.onlyMeetingsHeld === true,
  onlyTransfer: filters.onlyTransfer === true,
});

const areCrmFiltersEqual = (left: CrmFiltersState, right: CrmFiltersState) =>
  JSON.stringify(normalizeFiltersForComparison(left)) ===
  JSON.stringify(normalizeFiltersForComparison(right));

const parseDateKey = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function CrmFiltersBar() {
  const { crmFilters, setCrmFilters, setCrmFilter, clearCrmFilters } =
    useCrmContext();

  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presets, setPresets] = useState<CrmFilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `crm:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    if (!lastPresetStorageKey || typeof window === "undefined") {
      setLastUsedPresetId(null);
      return;
    }
    setLastUsedPresetId(window.localStorage.getItem(lastPresetStorageKey));
  }, [lastPresetStorageKey]);

  const responsibleOptions = useMemo(
    () =>
      sdrMembers.map((sdr) => ({
        value: sdr.id,
        label: sdr.name || sdr.email,
      })),
    [sdrMembers]
  );

  const closerOptions = useMemo(
    () =>
      closerMembers.map((closer) => ({
        value: closer.id,
        label: closer.name || closer.email,
      })),
    [closerMembers]
  );

  const createdDateRange = useMemo<DateRange | undefined>(() => {
    if (!crmFilters.periodStart) return undefined;
    return {
      from: parseDateKey(crmFilters.periodStart),
      to: parseDateKey(crmFilters.periodEnd),
    };
  }, [crmFilters.periodStart, crmFilters.periodEnd]);

  const scheduledDateRange = useMemo<DateRange | undefined>(() => {
    if (!crmFilters.scheduledPeriodStart) return undefined;
    return {
      from: parseDateKey(crmFilters.scheduledPeriodStart),
      to: parseDateKey(crmFilters.scheduledPeriodEnd),
    };
  }, [crmFilters.scheduledPeriodStart, crmFilters.scheduledPeriodEnd]);

  const handleCreatedDateChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setCrmFilters({ ...crmFilters, periodStart: "", periodEnd: "" });
      return;
    }
    setCrmFilters({
      ...crmFilters,
      periodStart: format(range.from, "yyyy-MM-dd"),
      periodEnd: range.to ? format(range.to, "yyyy-MM-dd") : "",
    });
  };

  const handleScheduledDateChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setCrmFilters({
        ...crmFilters,
        scheduledPeriodStart: "",
        scheduledPeriodEnd: "",
      });
      return;
    }
    setCrmFilters({
      ...crmFilters,
      scheduledPeriodStart: format(range.from, "yyyy-MM-dd"),
      scheduledPeriodEnd: range.to ? format(range.to, "yyyy-MM-dd") : "",
    });
  };

  const loadPresets = async () => {
    if (!supabaseId || !activeTeamId) {
      setPresets([]);
      return;
    }

    setPresetsLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${activeTeamId}/crm/filter-presets`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao carregar presets.");
      }
      const nextPresets = Array.isArray(result.result)
        ? result.result.map((preset: any) => ({
            ...preset,
            queryJson: normalizePresetFilters(preset.queryJson),
          }))
        : [];
      setPresets(nextPresets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar filtros salvos.");
      setPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  };

  useEffect(() => {
    void loadPresets();
  }, [supabaseId, activeTeamId]);

  const isFiltered = !isCrmFiltersEmpty(crmFilters);
  const activePreset = useMemo(() => {
    return (
      presets.find((preset) =>
        areCrmFiltersEqual(normalizePresetFilters(preset.queryJson), crmFilters)
      ) || null
    );
  }, [crmFilters, presets]);
  const isPresetInUse = !!activePreset;

  const presetDescriptionLabel = (queryJson: CrmFiltersState) => {
    const parts: string[] = [];
    if (queryJson.query?.trim()) parts.push(`Busca: "${queryJson.query.trim()}"`);
    if (queryJson.statusFilter.length) parts.push(`Status: ${queryJson.statusFilter.join(", ")}`);
    if (queryJson.assignedUsers.length) parts.push(`Responsáveis: ${queryJson.assignedUsers.length}`);
    if (queryJson.closerFilter.length) parts.push(`Closers: ${queryJson.closerFilter.length}`);
    if (queryJson.periodStart) {
      parts.push(
        `Período: ${queryJson.periodStart}${queryJson.periodEnd ? ` até ${queryJson.periodEnd}` : ""}`
      );
    }
    if (queryJson.scheduledPeriodStart) {
      parts.push(
        `Agendamento: ${queryJson.scheduledPeriodStart}${queryJson.scheduledPeriodEnd ? ` até ${queryJson.scheduledPeriodEnd}` : ""}`
      );
    }
    if (queryJson.onlyMeetingsHeld) parts.push("Reuniões realizadas");
    if (queryJson.onlyTransfer) parts.push("Transferência");
    if (parts.length === 0) return "Sem filtros aplicados";
    return parts.join(" • ");
  };

  const handleSavePreset = async () => {
    if (!supabaseId || !activeTeamId) return;
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      toast.error("Informe um nome para o preset.");
      return;
    }

    setIsSavingPreset(true);
    try {
      const response = await fetch(`/api/v1/teams/${activeTeamId}/crm/filter-presets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
        body: JSON.stringify({
          name: normalizedName,
          description: presetDescription.trim() || null,
          queryJson: crmFilters,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Não foi possível salvar o preset.");
      }
      toast.success("Filtro pré-definido salvo.");
      setPresetName("");
      setPresetDescription("");
      await loadPresets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar preset.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleUsePreset = async (preset: CrmFilterPreset) => {
    if (!supabaseId || !activeTeamId) return;

    setCrmFilters(normalizePresetFilters(preset.queryJson));
    setLastUsedPresetId(preset.id);
    if (lastPresetStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(lastPresetStorageKey, preset.id);
    }

    try {
      await fetch(`/api/v1/teams/${activeTeamId}/crm/filter-presets/${preset.id}/use`, {
        method: "POST",
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
    } catch (error) {
      console.error("[CrmFiltersBar] Falha ao marcar preset como usado:", error);
    }

    toast.success(`Preset "${preset.name}" aplicado.`);
    setPresetsOpen(false);
    await loadPresets();
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!supabaseId || !activeTeamId) return;
    try {
      const response = await fetch(`/api/v1/teams/${activeTeamId}/crm/filter-presets/${presetId}`, {
        method: "DELETE",
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Não foi possível remover o preset.");
      }
      if (lastPresetStorageKey && typeof window !== "undefined" && lastUsedPresetId === presetId) {
        window.localStorage.removeItem(lastPresetStorageKey);
        setLastUsedPresetId(null);
      }
      toast.success("Preset removido.");
      await loadPresets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover preset.");
    }
  };

  return (
    <LeadsFiltersLayout>
      <Input
        placeholder="Filtrar por nome..."
        value={crmFilters.query}
        onChange={(e) => setCrmFilter("query", e.target.value)}
        className="h-8 w-[150px] lg:w-[250px]"
      />
      <LeadsStatusFilter
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={crmFilters.statusFilter}
        onChangeStatuses={(values) => setCrmFilter("statusFilter", values)}
        meetingHeld={crmFilters.onlyMeetingsHeld}
        onToggleMeetingHeld={(value) =>
          setCrmFilter("onlyMeetingsHeld", value)
        }
        transfer={crmFilters.onlyTransfer}
        onToggleTransfer={(value) => setCrmFilter("onlyTransfer", value)}
      />
      {responsibleOptions.length > 0 && (
        <LeadsMultiFilter
          title="Responsável"
          options={responsibleOptions}
          selectedValues={crmFilters.assignedUsers}
          onChange={(values) => setCrmFilter("assignedUsers", values)}
        />
      )}
      {closerOptions.length > 0 && (
        <LeadsMultiFilter
          title="Closer"
          options={closerOptions}
          selectedValues={crmFilters.closerFilter}
          onChange={(values) => setCrmFilter("closerFilter", values)}
        />
      )}
      <LeadsDateFilter
        title="Data de Criação"
        value={createdDateRange}
        onChange={handleCreatedDateChange}
      />
      <LeadsDateFilter
        title="Data de Agendamento"
        value={scheduledDateRange}
        onChange={handleScheduledDateChange}
        allowFutureDates
      />
      <Sheet
        open={presetsOpen}
        onOpenChange={(open) => {
          setPresetsOpen(open);
          if (open) {
            void loadPresets();
          }
        }}
      >
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className={`h-8 px-2 lg:px-3 ${isPresetInUse ? "border-orange-500/70 text-orange-500" : ""}`}
          >
            <Heart
              className={`mr-2 h-4 w-4 ${isPresetInUse ? "fill-orange-500 text-orange-500" : ""}`}
            />
            Presets
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Filtros pré-definidos</SheetTitle>
            <SheetDescription>
              Salve filtros por time para reaproveitar depois. Esses presets são privados por usuário.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 grid gap-3 rounded-lg border border-border/60 p-3">
            <Input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Nome do preset"
            />
            <Input
              value={presetDescription}
              onChange={(event) => setPresetDescription(event.target.value)}
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
                  <div
                    key={preset.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{preset.name}</p>
                        {isLastUsed ? <Badge variant="secondary">Último usado</Badge> : null}
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
                      {preset.description?.trim() || presetDescriptionLabel(normalizePresetFilters(preset.queryJson))}
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
      {isFiltered && (
        <Button
          variant="ghost"
          className="h-8 px-2 lg:px-3"
          onClick={clearCrmFilters}
        >
          Limpar
        </Button>
      )}
    </LeadsFiltersLayout>
  );
}
