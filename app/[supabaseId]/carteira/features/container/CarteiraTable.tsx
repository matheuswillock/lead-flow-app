"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCarteiraContext } from '../context/CarteiraContext';
import {
  PORTFOLIO_STATUS_LABELS,
  type CarteiraRow,
  type PortfolioStatusValue,
} from '../context/CarteiraTypes';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

const STATUS_BADGE_VARIANT: Record<PortfolioStatusValue, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  pending: 'secondary',
  canceled: 'destructive',
};

function NoteCell({ row, onSave }: { row: CarteiraRow; onSave: (note: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.note ?? '');

  if (!editing) {
    return (
      <span
        className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
        title="Clique para editar"
        onClick={() => setEditing(true)}
      >
        {row.note || <span className="italic text-xs">Adicionar nota...</span>}
      </span>
    );
  }

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const trimmed = value.trim();
        onSave(trimmed || null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(row.note ?? '');
          setEditing(false);
        }
      }}
      className="h-7 text-xs"
    />
  );
}

function CarteiraTableRow({ row }: { row: CarteiraRow }) {
  const { updateEntry } = useCarteiraContext();

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{row.leadName}</p>
          <p className="text-xs text-muted-foreground">{row.leadCode}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{row.sdr?.name ?? '—'}</TableCell>
      <TableCell className="text-sm">{row.closer?.name ?? '—'}</TableCell>
      <TableCell className="text-sm">{row.soldPlan ?? '—'}</TableCell>
      <TableCell className="text-right text-sm font-medium">{formatBRL(row.saleValue)}</TableCell>
      <TableCell className="text-sm">{formatDate(row.contractDueDate)}</TableCell>

      {/* Status inline */}
      <TableCell>
        <Select
          value={row.portfolioStatus}
          onValueChange={(v) => updateEntry(row.leadId, { portfolioStatus: v as PortfolioStatusValue })}
        >
          <SelectTrigger className="h-7 w-28 border-0 bg-transparent p-0 text-xs focus:ring-0">
            <Badge variant={STATUS_BADGE_VARIANT[row.portfolioStatus]} className="text-xs">
              {PORTFOLIO_STATUS_LABELS[row.portfolioStatus]}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Note inline */}
      <TableCell className="max-w-[160px]">
        <NoteCell
          row={row}
          onSave={(note) => updateEntry(row.leadId, { note })}
        />
      </TableCell>

      {/* Last contact inline */}
      <TableCell>
        <Input
          type="date"
          defaultValue={row.lastContactAt ? row.lastContactAt.substring(0, 10) : ''}
          onChange={(e) => {
            const val = e.target.value;
            updateEntry(row.leadId, { lastContactAt: val ? new Date(val).toISOString() : null });
          }}
          className="h-7 w-36 text-xs"
        />
      </TableCell>
    </TableRow>
  );
}

export function CarteiraTable() {
  const { data, isLoading, filters, setPage } = useCarteiraContext();
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  if (isLoading && !data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>SDR</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Último contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhum cliente na carteira.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <CarteiraTableRow key={row.leadId} row={row} />)
            )}
          </TableBody>
        </Table>
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
            <ChevronLeft className="h-4 w-4" />
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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
