"use client";

import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout";
import { useLeadTransfersContext } from "../context/LeadTransfersContext";
import type { LeadTransferStateFilter } from "../context/LeadTransfersTypes";

const STATUS_OPTIONS: Array<{ value: LeadTransferStateFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "completed", label: "Concluídas" },
];

export function LeadTransfersFiltersBar() {
  const { data, filters, setFilter, setDateRange, clearFilters } = useLeadTransfersContext();

  const dateRange: DateRange | undefined =
    filters.dateFrom || filters.dateTo
      ? {
          from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          to: filters.dateTo ? new Date(filters.dateTo) : undefined,
        }
      : undefined;

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== "all" ||
    filters.toTeamId !== "" ||
    filters.transferredByProfileId !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <LeadsFiltersLayout
      actions={
        hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={clearFilters}>
            <X data-icon="inline-start" />
            Limpar filtros
          </Button>
        ) : null
      }
    >
      <Input
        placeholder="Filtrar por nome, e-mail ou telefone..."
        value={filters.search}
        onChange={(event) => setFilter("search", event.target.value)}
        className="h-9 max-w-md"
      />

      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={filters.status === option.value ? "default" : "outline"}
          className="h-8"
          onClick={() => setFilter("status", option.value)}
        >
          {option.label}
        </Button>
      ))}

      <LeadsDateFilter
        title="Data"
        value={dateRange}
        onChange={(range) => {
          setDateRange(
            range?.from ? format(range.from, "yyyy-MM-dd") : "",
            range?.to ? format(range.to, "yyyy-MM-dd") : ""
          );
        }}
        allowFutureDates
      />

      {(data?.facets.destinationTeams.length ?? 0) > 0 && (
        <Select
          value={filters.toTeamId || "all"}
          onValueChange={(value) => setFilter("toTeamId", value === "all" ? "" : value)}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Time destino" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os destinos</SelectItem>
            {data?.facets.destinationTeams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(data?.facets.transferredBy.length ?? 0) > 0 && (
        <Select
          value={filters.transferredByProfileId || "all"}
          onValueChange={(value) =>
            setFilter("transferredByProfileId", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder="Transferido por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {data?.facets.transferredBy.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.fullName ?? member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters ? (
        <Badge variant="secondary" className="h-8 px-3">
          Filtros ativos
        </Badge>
      ) : null}
    </LeadsFiltersLayout>
  );
}
