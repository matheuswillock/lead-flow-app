"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadsFiltersLayout } from '@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamSdrs, useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { useCarteiraContext } from '../context/CarteiraContext';
import { isCarteiraFiltersChanged, type PortfolioStatusFilter } from '../context/CarteiraTypes';

const STATUS_OPTIONS: { value: PortfolioStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'canceled', label: 'Cancelado' },
];

export function CarteiraFiltersBar() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { filters, setFilter, clearFilters } = useCarteiraContext();

  const { members: sdrs } = useTeamSdrs(supabaseId, activeTeamId);
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showClear = isCarteiraFiltersChanged(filters);

  return (
    <LeadsFiltersLayout>
      {/* Status filter */}
      <Select
        value={filters.portfolioStatus}
        onValueChange={(v) => setFilter('portfolioStatus', v as PortfolioStatusFilter)}
      >
        <SelectTrigger className="h-8 w-36 border-dashed text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
