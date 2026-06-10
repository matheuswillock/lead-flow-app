"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Heart, Trash2, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LeadsDateFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsDateFilter';
import { LeadsFiltersLayout } from '@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout';
import { LeadsMultiFilter } from '@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter';
import { useTeamContext } from '@/app/context/TeamContext';
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

type CarteiraFilterPreset = {
  id: string;
  name: string;
  description: string | null;
  queryJson: CarteiraFiltersState;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  const { activeTeamId } = useTeamContext();
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
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presets, setPresets] = useState<CarteiraFilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [lastUsedPresetId, setLastUsedPresetId] = useState<string | null>(null);

  const presetsStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:filter-presets:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

  const lastPresetStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:last-used-preset:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

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

  useEffect(() => {
    if (!lastPresetStorageKey || typeof window === 'undefined') {
      setLastUsedPresetId(null);
      return;
    }
    setLastUsedPresetId(window.localStorage.getItem(lastPresetStorageKey));
  }, [lastPresetStorageKey]);

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
  const activePreset = useMemo(() => {
    return (
      presets.find((preset) =>
        areCarteiraFiltersEqual(normalizePresetFilters(preset.queryJson), filters)
      ) || null
    );
  }, [filters, presets]);
  const isPresetInUse = !!activePreset;

  const loadPresets = useCallback(async () => {
    if (!presetsStorageKey || typeof window === 'undefined') {
      setPresets([]);
      return;
    }
    setPresetsLoading(true);
    try {
      const stored = window.localStorage.getItem(presetsStorageKey);
      if (!stored) {
        setPresets([]);
        return;
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setPresets([]);
        return;
      }
      const normalized = parsed
        .map((preset: Partial<CarteiraFilterPreset>) => ({
          id: String(preset.id || ''),
          name: String(preset.name || ''),
          description: typeof preset.description === 'string' ? preset.description : null,
          queryJson: normalizePresetFilters(preset.queryJson),
          lastUsedAt: typeof preset.lastUsedAt === 'string' ? preset.lastUsedAt : null,
          createdAt: typeof preset.createdAt === 'string' ? preset.createdAt : new Date().toISOString(),
          updatedAt: typeof preset.updatedAt === 'string' ? preset.updatedAt : new Date().toISOString(),
        }))
        .filter((preset: CarteiraFilterPreset) => preset.id && preset.name);
      normalized.sort((a: CarteiraFilterPreset, b: CarteiraFilterPreset) => {
        const lastUsedA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const lastUsedB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        if (lastUsedA !== lastUsedB) return lastUsedB - lastUsedA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setPresets(normalized);
    } catch (error) {
      console.error('[CarteiraFiltersBar] Erro ao carregar presets:', error);
      toast.error('Erro ao carregar presets.');
      setPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  }, [presetsStorageKey]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const handleSavePreset = async () => {
    if (!presetsStorageKey || typeof window === 'undefined') return;
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      toast.error('Informe um nome para o preset.');
      return;
    }

    setIsSavingPreset(true);
    try {
      const now = new Date().toISOString();
      const preset: CarteiraFilterPreset = {
        id: crypto.randomUUID(),
        name: normalizedName,
        description: presetDescription.trim() || null,
        queryJson: normalizeFiltersForComparison(filters),
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const next = [preset, ...presets];
      window.localStorage.setItem(presetsStorageKey, JSON.stringify(next));
      setPresetName('');
      setPresetDescription('');
      toast.success('Filtro pré-definido salvo.');
      await loadPresets();
    } catch (error) {
      console.error('[CarteiraFiltersBar] Erro ao salvar preset:', error);
      toast.error('Erro ao salvar preset.');
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleUsePreset = async (preset: CarteiraFilterPreset) => {
    if (!presetsStorageKey || typeof window === 'undefined') return;
    const normalizedPreset = normalizePresetFilters(preset.queryJson);
    setFilters({
      ...normalizedPreset,
      page: 1,
      pageSize: DEFAULT_CARTEIRA_FILTERS.pageSize,
    });
    setLastUsedPresetId(preset.id);
    if (lastPresetStorageKey) {
      window.localStorage.setItem(lastPresetStorageKey, preset.id);
    }

    const updated = presets.map((item) =>
      item.id === preset.id
        ? { ...item, lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : item
    );
    window.localStorage.setItem(presetsStorageKey, JSON.stringify(updated));
    toast.success(`Preset "${preset.name}" aplicado.`);
    setPresetsOpen(false);
    await loadPresets();
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!presetsStorageKey || typeof window === 'undefined') return;
    try {
      const updated = presets.filter((preset) => preset.id !== presetId);
      window.localStorage.setItem(presetsStorageKey, JSON.stringify(updated));
      if (lastPresetStorageKey && lastUsedPresetId === presetId) {
        window.localStorage.removeItem(lastPresetStorageKey);
        setLastUsedPresetId(null);
      }
      toast.success('Preset removido.');
      await loadPresets();
    } catch (error) {
      console.error('[CarteiraFiltersBar] Erro ao remover preset:', error);
      toast.error('Erro ao remover preset.');
    }
  };

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
            className={`h-8 px-2 lg:px-3 ${isPresetInUse ? 'border-orange-500/70 text-orange-500' : ''}`}
          >
            <Heart className={`mr-2 h-4 w-4 ${isPresetInUse ? 'fill-orange-500 text-orange-500' : ''}`} />
            Presets
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Filtros pré-definidos</SheetTitle>
            <SheetDescription>
              Salve filtros da carteira para reaproveitar depois. Esses presets são privados por usuário.
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
              {isSavingPreset ? 'Salvando...' : 'Salvar filtro atual'}
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