'use client';

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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <p style={{ fontSize: '14px', fontWeight: '500' }}>{row.leadName}</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{row.leadCode}</p>
        </div>
      </TableCell>
      <TableCell style={{ fontSize: '14px' }}>{formatDate(row.saleDate)}</TableCell>
      <TableCell style={{ fontSize: '14px' }}>{row.sdr?.name ?? '—'}</TableCell>
      <TableCell style={{ fontSize: '14px' }}>{row.closer?.name ?? '—'}</TableCell>
      <TableCell style={{ fontSize: '14px' }}>{row.soldPlan ?? '—'}</TableCell>
      <TableCell style={{ textAlign: 'right', fontSize: '14px', fontWeight: '500' }}>{formatBRL(row.saleValue)}</TableCell>
      <TableCell style={{ fontSize: '14px' }}>{formatDate(row.contractDueDate)}</TableCell>
    </TableRow>
  );
}

export function PerformanceTable() {
  const { data, isLoading, filters, setPage } = usePerformanceContext();
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  if (isLoading && !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{
        borderRadius: '0.65rem',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--card)',
        overflow: 'hidden'
      }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderBottom: '1px solid var(--border)' }}>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Cliente
              </TableHead>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Data da venda
              </TableHead>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                SDR
              </TableHead>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Closer
              </TableHead>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Plano
              </TableHead>
              <TableHead style={{
                textAlign: 'right',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Valor da venda
              </TableHead>
              <TableHead style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.55)'
              }}>
                Vigência
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} style={{
                  height: '96px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.55)'
                }}>
                  Nenhuma venda encontrada no período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <SaleRow key={row.leadId} row={row} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div style={{
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '12px',
        paddingBottom: '12px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.55)'
      }}>
        Dados sincronizados com CRM · Apenas vendas e reuniões marcadas como realizadas no período selecionado
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, filters.page - 1))}
            disabled={filters.page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
            Página {filters.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(pagination.totalPages, filters.page + 1))}
            disabled={filters.page >= pagination.totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
