"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LeadsDateFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsDateFilter';
import { LeadsFiltersLayout } from '@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout';
import { LeadsMultiFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter';
import { LeadsFilterPresetsSheet } from '@/app/[supabaseId]/components/leads-filters/LeadsFilterPresetsSheet';
import { useTeamContext } from '@/app/context/TeamContext';
import { useUser } from '@/app/context/UserContext';
import { isManagerLikeRole } from '@/lib/roles';
import { useTeamSdrs, useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { useCarteiraContext } from '../context/CarteiraContext';
import { DEFAULT_CARTEIRA_FILTERS, isCarteiraFiltersChanged, type CarteiraFiltersState } from '../context/CarteiraTypes';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'canceled', label: 'Cancelado' },
];

const SOURCE_OPTIONS = [
  { value: 'crm', label: 'CRM' },
  { value: 'manual', label: 'Manual' },
  { value: 'brokerage_transfer', label: 'Transferência de corretagem' },
];


const normalizePresetFilters = (raw: unknown): CarteiraFiltersState => {
  if (!raw || typeof raw !== 'object') return DEFAULT_CARTEIRA_FILTERS;
  const data = raw as Partial<CarteiraFiltersState>;
  return {
    ...DEFAULT_CARTEIRA_FILTERS,
    ...data,
    search: typeof data.search === 'string' ? data.search : '',
    portfolioStatuses: Array.isArray(data.portfolioStatuses) ? data.portfolioStatuses : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    sdrIds: Array.isArray(data.sdrIds) ? data.sdrIds : [],
    closerIds: Array.isArray(data.closerIds) ? data.closerIds : [],
    operadoras: Array.isArray(data.operadoras) ? data.operadoras : [],
    contractDateStart: typeof data.contractDateStart === 'string' ? data.contractDateStart : '',
    contractDateEnd: typeof data.contractDateEnd === 'string' ? data.contractDateEnd : '',
    dueDateStart: typeof data.dueDateStart === 'string' ? data.dueDateStart : '',
    dueDateEnd: typeof data.dueDateEnd === 'string' ? data.dueDateEnd : '',
    documentSearch: typeof data.documentSearch === 'string' ? data.documentSearch : '',
    page: 1,
    pageSize: DEFAULT_CARTEIRA_FILTERS.pageSize,
  };
};

const normalizeFiltersForComparison = (filters: CarteiraFiltersState): CarteiraFiltersState => ({
  ...DEFAULT_CARTEIRA_FILTERS,
  ...filters,
  search: filters.search.trim(),
  documentSearch: filters.documentSearch.trim(),
  portfolioStatuses: [...filters.portfolioStatuses].sort(),
  sources: [...filters.sources].sort(),
  sdrIds: [...filters.sdrIds].sort(),
  closerIds: [...filters.closerIds].sort(),
  operadoras: [...filters.operadoras].sort(),
  page: 1,
  pageSize: DEFAULT_CARTEIRA_FILTERS.pageSize,
});

const areCarteiraFiltersEqual = (left: CarteiraFiltersState, right: CarteiraFiltersState) =>
  JSON.stringify(normalizeFiltersForComparison(left)) ===
  JSON.stringify(normalizeFiltersForComparison(right));

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
  const { activeTeamId, activeRole } = useTeamContext();
  const { user } = useUser();
  const isManager = isManagerLikeRole(activeRole ?? undefined);
  const {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    availableOperadoras,
  } = useCarteiraContext();

  const { members: sdrs } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const unifiedSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [presetSnapshots, setPresetSnapshots] = useState<CarteiraFiltersState[]>([]);

  const presetsStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:filter-presets:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of [...sdrs, ...closers]) {
      map.set(member.id, member.name || member.email);
    }
    return map;
  }, [closers, sdrs]);

  const handleUnifiedSearchChange = useCallback(
    (value: string) => {
      if (unifiedSearchDebounceRef.current) clearTimeout(unifiedSearchDebounceRef.current);
      unifiedSearchDebounceRef.current = setTimeout(() => {
        setFilter('search', value);
        setFilter('documentSearch', value);
      }, 300);
    },
    [setFilter]
  );

  useEffect(() => {
    return () => {
      if (unifiedSearchDebounceRef.current) clearTimeout(unifiedSearchDebounceRef.current);
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
  const isPresetInUse = useMemo(
    () => presetSnapshots.some((snapshot) => areCarteiraFiltersEqual(snapshot, filters)),
    [filters, presetSnapshots]
  );

  const presetDescriptionLabel = (queryJson: CarteiraFiltersState) => {
    const parts: string[] = [];
    if (queryJson.search?.trim()) parts.push(`Busca: "${queryJson.search.trim()}"`);
    if (queryJson.portfolioStatuses.length) parts.push(`Status: ${queryJson.portfolioStatuses.length}`);
    if (queryJson.sources.length) parts.push(`Origem: ${queryJson.sources.length}`);
    if (queryJson.sdrIds.length) parts.push(`SDRs: ${queryJson.sdrIds.length}`);
    if (queryJson.closerIds.length) parts.push(`Closers: ${queryJson.closerIds.length}`);
    if (queryJson.contractDateStart) {
      parts.push(
        `Contrato: ${queryJson.contractDateStart}${queryJson.contractDateEnd ? ` até ${queryJson.contractDateEnd}` : ''}`
      );
    }
    if (queryJson.dueDateStart) {
      parts.push(
        `Vencimento: ${queryJson.dueDateStart}${queryJson.dueDateEnd ? ` até ${queryJson.dueDateEnd}` : ''}`
      );
    }
    return parts.length ? parts.join(' • ') : 'Sem filtros aplicados';
  };

  const applyCarteiraFilters = (normalized: CarteiraFiltersState) => {
    setFilters({
      ...normalized,
      page: 1,
      pageSize: DEFAULT_CARTEIRA_FILTERS.pageSize,
    });
  };

  return (
    <LeadsFiltersLayout>
      {/* Unified search: nome + documento (primeiro item) */}
      <Input
        placeholder="Nome do cliente ou CPF / CNPJ / RG..."
        defaultValue={filters.search || filters.documentSearch}
        onChange={(e) => handleUnifiedSearchChange(e.target.value)}
        className="h-8 w-72 text-xs"
      />

      {/* Status multi-select */}
      <LeadsMultiFilter
        title="Status"
        options={STATUS_OPTIONS}
        selectedValues={filters.portfolioStatuses}
        onChange={(v) => setFilter('portfolioStatuses', v)}
      />

      <LeadsMultiFilter
        title="Origem"
        options={SOURCE_OPTIONS}
        selectedValues={filters.sources}
        onChange={(v) => setFilter('sources', v)}
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

      {/* Operadora filter (multi, padrão Status) */}
      {availableOperadoras.length > 0 && (
        <LeadsMultiFilter
          title="Operadora"
          options={availableOperadoras.map((op) => ({ value: op, label: op }))}
          selectedValues={filters.operadoras}
          onChange={(v) => setFilter('operadoras', v)}
        />
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

      <LeadsFilterPresetsSheet
        scope="carteira"
        supabaseId={supabaseId}
        profileId={user?.id}
        teamId={activeTeamId}
        isManager={isManager}
        currentFilters={normalizeFiltersForComparison(filters)}
        isPresetActive={isPresetInUse}
        lastPresetStorageKey={lastPresetStorageKey}
        importFromLocalStorageKey={presetsStorageKey}
        normalizePresetFilters={normalizePresetFilters}
        areFiltersEqual={areCarteiraFiltersEqual}
        presetDescriptionLabel={presetDescriptionLabel}
        onApplyFilters={applyCarteiraFilters}
        getCreatorName={(id) => memberNameById.get(id)}
        onPresetsChange={(items) =>
          setPresetSnapshots(items.map((item) => normalizePresetFilters(item.queryJson)))
        }
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