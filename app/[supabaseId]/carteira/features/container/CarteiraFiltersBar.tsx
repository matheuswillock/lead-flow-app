"use client";

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadsDateFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsDateFilter';
import { LeadsFiltersLayout } from '@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout';
import { LeadsMultiFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamSdrs, useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { useCarteiraContext } from '../context/CarteiraContext';
import { isCarteiraFiltersChanged } from '../context/CarteiraTypes';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'canceled', label: 'Cancelado' },
];

function toDateRange(start: string, end: string): DateRange | undefined {
  if (!start && !end) return undefined;
  return {
    from: start ? new Date(start) : undefined,
    to: end ? new Date(end) : undefined,
  };
}

function fromDateRange(
  range: DateRange | undefined,
  setStart: (v: string) => void,
  setEnd: (v: string) => void
) {
  setStart(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
  setEnd(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
}

export function CarteiraFiltersBar() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { filters, setFilter, clearFilters, availableOperadoras } = useCarteiraContext();

  const { members: sdrs } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => setFilter('search', value), 300);
    },
    [setFilter]
  );

  const handleDocumentSearchChange = useCallback(
    (value: string) => {
      if (documentDebounceRef.current) clearTimeout(documentDebounceRef.current);
      documentDebounceRef.current = setTimeout(() => setFilter('documentSearch', value), 300);
    },
    [setFilter]
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (documentDebounceRef.current) clearTimeout(documentDebounceRef.current);
    };
  }, []);

  const contractDateRange = useMemo(
    () => toDateRange(filters.contractDateStart, filters.contractDateEnd),
    [filters.contractDateStart, filters.contractDateEnd]
  );

  const dueDateRange = useMemo(
    () => toDateRange(filters.dueDateStart, filters.dueDateEnd),
    [filters.dueDateStart, filters.dueDateEnd]
  );

  const handleContractDateChange = useCallback(
    (range: DateRange | undefined) => {
      fromDateRange(range, (v) => setFilter('contractDateStart', v), (v) => setFilter('contractDateEnd', v));
    },
    [setFilter]
  );

  const handleDueDateChange = useCallback(
    (range: DateRange | undefined) => {
      fromDateRange(range, (v) => setFilter('dueDateStart', v), (v) => setFilter('dueDateEnd', v));
    },
    [setFilter]
  );

  const sdrOptions = useMemo(() => sdrs.map((s) => ({ value: s.id, label: s.name })), [sdrs]);
  const closerOptions = useMemo(() => closers.map((c) => ({ value: c.id, label: c.name })), [closers]);

  const showClear = isCarteiraFiltersChanged(filters);

  return (
    <LeadsFiltersLayout>
      {/* Status multi-select */}
      <LeadsMultiFilter
        title="Status"
        options={STATUS_OPTIONS}
        selectedValues={filters.portfolioStatuses}
        onChange={(v) => setFilter('portfolioStatuses', v)}
      />

      {/* SDR multi-select */}
      {sdrOptions.length > 0 && (
        <LeadsMultiFilter
          title="SDRs"
          options={sdrOptions}
          selectedValues={filters.sdrIds}
          onChange={(v) => setFilter('sdrIds', v)}
        />
      )}

      {/* Closer multi-select */}
      {closerOptions.length > 0 && (
        <LeadsMultiFilter
          title="Closers"
          options={closerOptions}
          selectedValues={filters.closerIds}
          onChange={(v) => setFilter('closerIds', v)}
        />
      )}

      {/* Operadora filter */}
      {availableOperadoras.length > 0 && (
        <Select
          value={filters.operadora || '__all__'}
          onValueChange={(v) => setFilter('operadora', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-44 border-dashed text-xs">
            <SelectValue placeholder="Operadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas operadoras</SelectItem>
            {availableOperadoras.map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Contract date range */}
      <LeadsDateFilter
        title="Data de Contrato"
        value={contractDateRange}
        onChange={handleContractDateChange}
      />

      {/* Due date range */}
      <LeadsDateFilter
        title="Vencimento"
        value={dueDateRange}
        onChange={handleDueDateChange}
        allowFutureDates
      />

      {/* Name search */}
      <Input
        placeholder="Nome do cliente..."
        defaultValue={filters.search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="h-8 w-44 text-xs"
      />

      {/* Document search */}
      <Input
        placeholder="CPF / CNPJ / RG..."
        defaultValue={filters.documentSearch}
        onChange={(e) => handleDocumentSearchChange(e.target.value)}
        className="h-8 w-44 text-xs"
      />

      {/* Clear */}
      {showClear && (
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </LeadsFiltersLayout>
  );
}
