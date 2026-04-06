"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
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
import { LeadsFiltersLayout } from '@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout';
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
    ? { from: new Date(filters.startDate), to: new Date(filters.endDate) }
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
    <LeadsFiltersLayout>
      {/* Period presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={isActivePreset(p.value) ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-3 text-xs"
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

      {/* SDR filter */}
      {sdrs.length > 0 && (
        <Select
          value={filters.sdrId || '__all__'}
          onValueChange={(v) => setFilter('sdrId', v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-40 border-dashed text-xs">
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
          <SelectTrigger className="h-8 w-40 border-dashed text-xs">
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
      <Input
        ref={searchRef}
        placeholder="Buscar cliente..."
        defaultValue={filters.search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="h-8 w-48 text-xs"
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
