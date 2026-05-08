"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
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
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamSdrs, useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { usePerformanceContext } from '../context/PerformanceContext';
import { isPerformanceFiltersChanged, type PerformancePreset } from '../context/PerformanceTypes';

const PRESETS: { value: PerformancePreset; label: string }[] = [
  { value: '1d', label: '1d' },
  { value: '7d', label: '7d' },
  { value: '15d', label: '15d' },
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
];

const parseDateKey = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function PerformanceFiltersBar() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { filters, setFilter, setPreset, setDateRange, clearFilters } = usePerformanceContext();

  const { members: sdrs } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasCustomDateRange = !!(filters.startDate && filters.endDate);
  const isActivePreset = (preset: PerformancePreset) => !hasCustomDateRange && filters.preset === preset;

  const dateRangeValue: DateRange | undefined = hasCustomDateRange
    ? { from: parseDateKey(filters.startDate), to: parseDateKey(filters.endDate) }
    : undefined;

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      if (range?.from && range?.to) {
        setDateRange(
          format(range.from, 'yyyy-MM-dd'),
          format(range.to, 'yyyy-MM-dd')
        );
      } else {
        setDateRange('', '');
      }
    },
    [setDateRange]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilter('search', value);
      }, 300);
    },
    [setFilter]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showClear = isPerformanceFiltersChanged(filters);

  return (
    <div className="flex flex-col gap-4">
      {/* Presets Container */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 p-2 rounded-lg border border-border bg-card/50 shadow-sm">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              variant={isActivePreset(p.value) ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 text-xs font-medium transition-all ${
                isActivePreset(p.value)
                  ? 'shadow-[0_4px_14px_-6px_rgba(245,73,0,0.6)]'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Custom date range */}
        <LeadsDateFilter
          title="Período"
          value={dateRangeValue}
          onChange={handleDateRangeChange}
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* SDR filter */}
        {sdrs.length > 0 && (
          <Select
            value={filters.sdrId || '__all__'}
            onValueChange={(v) => setFilter('sdrId', v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-40 border-dashed text-xs">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos SDRs</SelectItem>
              {sdrs.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Closer filter */}
        {closers.length > 0 && (
          <Select
            value={filters.closerId || '__all__'}
            onValueChange={(v) => setFilter('closerId', v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-40 border-dashed text-xs">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos closers</SelectItem>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Search */}
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Buscar cliente..."
            defaultValue={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>

        {/* Clear */}
        {showClear && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
