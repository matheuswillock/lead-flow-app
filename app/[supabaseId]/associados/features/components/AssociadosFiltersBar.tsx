"use client";

import { useMemo } from "react";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";
import { LeadsSingleFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsSingleFilter";
import type { AssociateProposalRow, AssociadosFiltersState } from "../context/AssociadosTypes";

type AssociadosFiltersBarProps = {
  filters: AssociadosFiltersState;
  items: AssociateProposalRow[];
  onChange: (patch: Partial<AssociadosFiltersState>) => void;
  onRefresh: () => void;
};

function toDateRange(from?: string, to?: string): DateRange | undefined {
  if (!from && !to) return undefined;
  return {
    from: from ? startOfDay(parseISO(from)) : undefined,
    to: to ? endOfDay(parseISO(to)) : undefined,
  };
}

export function AssociadosFiltersBar({
  filters,
  items,
  onChange,
  onRefresh,
}: AssociadosFiltersBarProps) {
  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.associateAccountId, item.associateAccountName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (filters.associateAccountId && item.associateAccountId !== filters.associateAccountId) continue;
      map.set(item.teamId, item.teamName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items, filters.associateAccountId]);

  const closerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (filters.teamId && item.teamId !== filters.teamId) continue;
      if (!item.closerId || !item.closerName) continue;
      map.set(item.closerId, item.closerName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items, filters.teamId]);

  const enteredAtRange = toDateRange(filters.from, filters.to);

  function clearFilters() {
    onChange({
      search: "",
      associateAccountId: "",
      teamId: "",
      closerId: "",
      from: "",
      to: "",
      page: 1,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id="associados-search"
        placeholder="Filtrar por nome..."
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        className="h-8 w-[180px] lg:w-[260px]"
      />

      <LeadsSingleFilter
        title="contas"
        options={accountOptions.map((option) => ({
          label: option.name,
          value: option.id,
        }))}
        value={filters.associateAccountId}
        onChange={(associateAccountId) =>
          onChange({
            associateAccountId,
            teamId: "",
            closerId: "",
            page: 1,
          })
        }
      />

      <LeadsSingleFilter
        title="times"
        options={teamOptions.map((option) => ({
          label: option.name,
          value: option.id,
        }))}
        value={filters.teamId}
        onChange={(teamId) =>
          onChange({
            teamId,
            closerId: "",
            page: 1,
          })
        }
      />

      <LeadsSingleFilter
        title="closers"
        options={closerOptions.map((option) => ({
          label: option.name,
          value: option.id,
        }))}
        value={filters.closerId}
        onChange={(closerId) =>
          onChange({
            closerId,
            page: 1,
          })
        }
      />

      <LeadsDateFilter
        title="Data de Entrada"
        value={enteredAtRange}
        onChange={(range) =>
          onChange({
            from: range?.from ? range.from.toISOString().slice(0, 10) : "",
            to: range?.to ? range.to.toISOString().slice(0, 10) : "",
            page: 1,
          })
        }
      />

      <Button variant="outline" size="sm" onClick={clearFilters} className="h-8">
        Limpar filtros
      </Button>
      <Button variant="outline" size="sm" onClick={onRefresh} className="h-8">
        Atualizar
      </Button>
    </div>
  );
}
