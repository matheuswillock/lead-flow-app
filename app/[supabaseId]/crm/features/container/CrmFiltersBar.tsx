"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import useCrmContext from "../context/CrmHook";
import { isCrmFiltersEmpty } from "../context/CrmTypes";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";

const STATUS_OPTIONS = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
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

export function CrmFiltersBar() {
  const { crmFilters, setCrmFilters, setCrmFilter, clearCrmFilters } =
    useCrmContext();

  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

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

  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!crmFilters.periodStart) return undefined;
    return {
      from: new Date(crmFilters.periodStart),
      to: crmFilters.periodEnd ? new Date(crmFilters.periodEnd) : undefined,
    };
  }, [crmFilters.periodStart, crmFilters.periodEnd]);

  const handleDateChange = (range: DateRange | undefined) => {
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

  const isFiltered = !isCrmFiltersEmpty(crmFilters);

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
        value={dateRange}
        onChange={handleDateChange}
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
