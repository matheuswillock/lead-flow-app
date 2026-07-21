"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import useCrmContext from "../context/CrmHook";
import { DEFAULT_CRM_FILTERS, type CrmFiltersState, isCrmFiltersEmpty } from "../context/CrmTypes";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFilterPresetsSheet } from "@/app/[supabaseId]/components/leads-filters/LeadsFilterPresetsSheet";

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
  visibility: "private" | "team";
  createdBy: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const normalizeCrmPresetFilters = (raw: unknown): CrmFiltersState => {
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
  onlyDraft: filters.onlyDraft === true,
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
  const { activeTeamId, activeRole } = useTeamContext();
  const { user } = useUser();
  const isManager = isManagerLikeRole(activeRole ?? undefined);
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of [...sdrMembers, ...closerMembers]) {
      map.set(member.id, member.name || member.email);
    }
    return map;
  }, [closerMembers, sdrMembers]);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `crm:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const [presets, setPresets] = useState<CrmFilterPreset[]>([]);

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

  const isFiltered = !isCrmFiltersEmpty(crmFilters);
  const isPresetInUse = useMemo(
    () =>
      presets.some((preset) =>
        areCrmFiltersEqual(normalizeCrmPresetFilters(preset.queryJson), crmFilters)
      ),
    [crmFilters, presets]
  );

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
    if (queryJson.onlyDraft) parts.push("Rascunhos");
    if (parts.length === 0) return "Sem filtros aplicados";
    return parts.join(" • ");
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
        draft={crmFilters.onlyDraft}
        onToggleDraft={(value) => setCrmFilter("onlyDraft", value)}
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
      <LeadsFilterPresetsSheet
        scope="crm"
        supabaseId={supabaseId}
        profileId={user?.id}
        teamId={activeTeamId}
        isManager={isManager}
        currentFilters={crmFilters}
        isPresetActive={isPresetInUse}
        lastPresetStorageKey={lastPresetStorageKey}
        normalizePresetFilters={normalizeCrmPresetFilters}
        areFiltersEqual={areCrmFiltersEqual}
        presetDescriptionLabel={presetDescriptionLabel}
        onApplyFilters={setCrmFilters}
        getCreatorName={(id) => memberNameById.get(id)}
        onPresetsChange={setPresets}
      />
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
