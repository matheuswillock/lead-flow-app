"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { useOperationalAccess } from "@/app/context/OperationalAccessContext";
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter";
import { useTeamContext } from "@/app/context/TeamContext";
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { useLeadTransfersContext } from "../context/LeadTransfersContext";
import { isLeadTransfersFiltersChanged } from "../context/LeadTransfersTypes";

const TRANSFER_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "completed", label: "Concluída" },
];

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDateRange(from: string, to: string): DateRange | undefined {
  if (!from && !to) return undefined;
  return {
    from: from ? parseDateKey(from) : undefined,
    to: to ? parseDateKey(to) : undefined,
  };
}

const MULTISKILL_FILTER_OPTIONS = [{ value: "multiskill", label: "MultiSkill" }];

export function LeadTransfersFiltersBar() {
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const { access: operationalAccess } = useOperationalAccess();
  const { data, filters, setFilter, setDateRange, clearFilters } = useLeadTransfersContext();
  const { members: sdrMembers } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closerMembers } = useTeamClosers(supabaseId, activeTeamId);

  const transferDateRange = useMemo(
    () => toDateRange(filters.transferDateFrom, filters.transferDateTo),
    [filters.transferDateFrom, filters.transferDateTo]
  );

  const preScheduledDateRange = useMemo(
    () => toDateRange(filters.preScheduledDateFrom, filters.preScheduledDateTo),
    [filters.preScheduledDateFrom, filters.preScheduledDateTo]
  );

  const scheduledDateRange = useMemo(
    () => toDateRange(filters.scheduledDateFrom, filters.scheduledDateTo),
    [filters.scheduledDateFrom, filters.scheduledDateTo]
  );

  const destinationOptions = useMemo(
    () =>
      (data?.facets.destinationTeams ?? []).map((team) => ({
        value: team.id,
        label: team.name,
      })),
    [data?.facets.destinationTeams]
  );

  const transferredByOptions = useMemo(
    () =>
      (data?.facets.transferredBy ?? []).map((member) => ({
        value: member.id,
        label: member.fullName ?? member.email,
      })),
    [data?.facets.transferredBy]
  );

  const sdrOptions = useMemo(
    () =>
      sdrMembers.map((member) => ({
        value: member.id,
        label: member.name || member.email,
      })),
    [sdrMembers]
  );

  const closerOptions = useMemo(
    () =>
      closerMembers.map((member) => ({
        value: member.id,
        label: member.name || member.email,
      })),
    [closerMembers]
  );

  const isFiltered = isLeadTransfersFiltersChanged(filters);
  const showMultiskillFilter = operationalAccess.multiskillExternalTransfer;

  return (
    <LeadsFiltersLayout>
      <Input
        placeholder="Filtrar por nome, e-mail ou telefone..."
        value={filters.search}
        onChange={(event) => setFilter("search", event.target.value)}
        className="h-8 w-[150px] lg:w-[250px]"
      />

      <LeadsMultiFilter
        title="Transferência"
        options={TRANSFER_STATUS_OPTIONS}
        selectedValues={filters.transferStatuses}
        onChange={(values) => setFilter("transferStatuses", values as typeof filters.transferStatuses)}
      />

      {showMultiskillFilter ? (
        <LeadsMultiFilter
          title="MultiSkill"
          options={MULTISKILL_FILTER_OPTIONS}
          selectedValues={filters.multiskillOnly ? ["multiskill"] : []}
          onChange={(values) => setFilter("multiskillOnly", values.includes("multiskill"))}
        />
      ) : null}

      {sdrOptions.length > 0 && (
        <LeadsMultiFilter
          title="SDR"
          options={sdrOptions}
          selectedValues={filters.sdrProfileIds}
          onChange={(values) => setFilter("sdrProfileIds", values)}
        />
      )}

      {closerOptions.length > 0 && (
        <LeadsMultiFilter
          title="Closer"
          options={closerOptions}
          selectedValues={filters.closerProfileIds}
          onChange={(values) => setFilter("closerProfileIds", values)}
        />
      )}

      {destinationOptions.length > 0 && (
        <LeadsMultiFilter
          title="Time destino"
          options={destinationOptions}
          selectedValues={filters.toTeamIds}
          onChange={(values) => setFilter("toTeamIds", values)}
        />
      )}

      {transferredByOptions.length > 0 && (
        <LeadsMultiFilter
          title="Transferido por"
          options={transferredByOptions}
          selectedValues={filters.transferredByProfileIds}
          onChange={(values) => setFilter("transferredByProfileIds", values)}
        />
      )}

      <LeadsDateFilter
        title="Data da transferência"
        value={transferDateRange}
        onChange={(range) => {
          setDateRange(
            "transferDate",
            range?.from ? format(range.from, "yyyy-MM-dd") : "",
            range?.to ? format(range.to, "yyyy-MM-dd") : ""
          );
        }}
        allowFutureDates
      />

      <LeadsDateFilter
        title="Pré-agendamento"
        value={preScheduledDateRange}
        onChange={(range) => {
          setDateRange(
            "preScheduledDate",
            range?.from ? format(range.from, "yyyy-MM-dd") : "",
            range?.to ? format(range.to, "yyyy-MM-dd") : ""
          );
        }}
        allowFutureDates
      />

      <LeadsDateFilter
        title="Data de agendamento"
        value={scheduledDateRange}
        onChange={(range) => {
          setDateRange(
            "scheduledDate",
            range?.from ? format(range.from, "yyyy-MM-dd") : "",
            range?.to ? format(range.to, "yyyy-MM-dd") : ""
          );
        }}
        allowFutureDates
      />

      {isFiltered && (
        <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
          Limpar
        </Button>
      )}
    </LeadsFiltersLayout>
  );
}
