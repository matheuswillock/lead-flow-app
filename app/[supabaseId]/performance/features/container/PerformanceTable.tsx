"use client";

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePerformanceContext } from '../context/PerformanceContext';
import type { PerformanceSaleRow } from '../context/PerformanceTypes';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function SaleRow({ row }: { row: PerformanceSaleRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{row.leadName}</p>
          <p className="text-xs text-muted-foreground">{row.leadCode}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{formatDate(row.saleDate)}</TableCell>
      <TableCell className="text-sm">{row.sdr?.name ?? '—'}</TableCell>
      <TableCell className="text-sm">{row.closer?.name ?? '—'}</TableCell>
      <TableCell className="text-sm">{row.soldPlan ?? '—'}</TableCell>
      <TableCell className="text-right text-sm font-medium">{formatBRL(row.saleValue)}</TableCell>
      <TableCell className="text-sm">{formatDate(row.contractDueDate)}</TableCell>
    </TableRow>
  );
}

export function PerformanceTable() {
  const { data, isLoading, filters, setPage } = usePerformanceContext();
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Cliente</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Data da venda</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>SDR</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Closer</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Plano</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Valor da venda</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ fontSize: '11px' }}>Vigência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma venda encontrada no período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <SaleRow key={row.leadId} row={row} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
        Dados sincronizados do CRM • Apenas vendas e reuniões marcadas como realizadas no período selecionado
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPage(filters.page - 1)}
            disabled={filters.page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPage(filters.page + 1)}
            disabled={filters.page >= pagination.totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
