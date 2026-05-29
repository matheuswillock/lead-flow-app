"use client";

import { type DragEvent, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CarteiraDetailModal } from '../components/CarteiraDetailModal';
import { useCarteiraContext } from '../context/CarteiraContext';
import {
  PORTFOLIO_SOURCE_LABELS,
  PORTFOLIO_STATUS_LABELS,
  type CarteiraDetailData,
  type CarteiraRow,
  type CarteiraTableColumnKey,
  type PortfolioStatusValue,
} from '../context/CarteiraTypes';

type SortDirection = 'asc' | 'desc';

type SortState = {
  column: CarteiraTableColumnKey;
  direction: SortDirection;
};

const SORTABLE_COLUMNS: ReadonlySet<CarteiraTableColumnKey> = new Set([
  'client',
  'operadora',
  'source',
  'contractDate',
  'value',
  'dueDate',
  'status',
  'sdr',
  'closer',
]);

const COLUMN_LABELS: Record<CarteiraTableColumnKey, string> = {
  client: 'Cliente',
  operadora: 'Operadora',
  source: 'Origem',
  contractDate: 'Data de Contrato',
  value: 'Valor',
  dueDate: 'Vencimento',
  status: 'Status',
  sdr: 'SDR',
  closer: 'Closer',
};

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function getSortValue(row: CarteiraRow, column: CarteiraTableColumnKey): string | number {
  switch (column) {
    case 'client':
      return row.leadName.toLowerCase();
    case 'operadora':
      return (row.operadora || '').toLowerCase();
    case 'source':
      return PORTFOLIO_SOURCE_LABELS[row.source].toLowerCase();
    case 'contractDate':
      return row.contractStartDate ? new Date(row.contractStartDate).getTime() : -1;
    case 'value':
      return row.saleValue;
    case 'dueDate':
      return row.contractDueDate ? new Date(row.contractDueDate).getTime() : -1;
    case 'status':
      return PORTFOLIO_STATUS_LABELS[row.portfolioStatus].toLowerCase();
    case 'sdr':
      return (row.sdr?.name || '').toLowerCase();
    case 'closer':
      return (row.closer?.name || '').toLowerCase();
    default:
      return '';
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
}

const STATUS_CONFIG: Record<
  PortfolioStatusValue,
  { icon: React.ReactNode; className: string }
> = {
  active: {
    icon: <CheckCircle2 className="size-4" />,
    className: 'text-[var(--semantic-success)]',
  },
  pending: {
    icon: <Clock className="size-4" />,
    className: 'text-[var(--semantic-warning)]',
  },
  canceled: {
    icon: <CircleOff className="size-4" />,
    className: 'text-destructive',
  },
};

function StatusCell({ status }: { status: PortfolioStatusValue }) {
  const config = STATUS_CONFIG[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex ${config.className}`}>{config.icon}</span>
      </TooltipTrigger>
      <TooltipContent>{PORTFOLIO_STATUS_LABELS[status]}</TooltipContent>
    </Tooltip>
  );
}

function ProfileCell({ person }: { person: { id: string; name: string } | null }) {
  if (!person) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className="size-7 cursor-default">
          <AvatarFallback className="text-[10px]">{getInitials(person.name)}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{person.name}</TooltipContent>
    </Tooltip>
  );
}

function renderDataCell(
  column: CarteiraTableColumnKey,
  row: CarteiraRow
): React.ReactNode {
  switch (column) {
    case 'client':
      return (
        <div className="flex flex-col items-center text-center">
          <p className="font-medium text-sm">{row.leadName}</p>
          <p className="text-xs text-muted-foreground">{row.leadCode}</p>
        </div>
      );
    case 'operadora':
      return <span className="text-sm text-muted-foreground">{row.operadora ?? '—'}</span>;
    case 'source':
      return <span className="text-sm text-muted-foreground">{PORTFOLIO_SOURCE_LABELS[row.source]}</span>;
    case 'contractDate':
      return <span className="text-sm">{formatDate(row.contractStartDate)}</span>;
    case 'value':
      return <span className="text-sm font-medium">{formatBRL(row.saleValue)}</span>;
    case 'dueDate':
      return <span className="text-sm">{formatDate(row.contractDueDate)}</span>;
    case 'status':
      return (
        <div className="flex justify-center">
          <StatusCell status={row.portfolioStatus} />
        </div>
      );
    case 'sdr':
      return (
        <div className="flex justify-center">
          <ProfileCell person={row.sdr} />
        </div>
      );
    case 'closer':
      return (
        <div className="flex justify-center">
          <ProfileCell person={row.closer} />
        </div>
      );
    default:
      return null;
  }
}

function ActionsCell({ row, onVisualize }: { row: CarteiraRow; onVisualize: (leadId: string) => void }) {
  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onVisualize(row.leadId)}>
            <Eye className="mr-2 size-4" />
            Visualizar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CarteiraTableRow({
  row,
  columnOrder,
  onVisualize,
}: {
  row: CarteiraRow;
  columnOrder: CarteiraTableColumnKey[];
  onVisualize: (leadId: string) => void;
}) {
  return (
    <TableRow>
      {columnOrder.map((column) => (
        <TableCell key={`${row.leadId}-${column}`} className="text-center">
          {renderDataCell(column, row)}
        </TableCell>
      ))}
      <TableCell className="w-10 text-center">
        <ActionsCell row={row} onVisualize={onVisualize} />
      </TableCell>
    </TableRow>
  );
}

export function CarteiraTable() {
  const {
    data,
    isLoading,
    filters,
    setPage,
    getEntryDetail,
    updateEntryDetail,
    tableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  } = useCarteiraContext();
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  const [sortState, setSortState] = useState<SortState | null>(null);
  const draggedColumnIdRef = useRef<CarteiraTableColumnKey | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<CarteiraTableColumnKey | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<CarteiraTableColumnKey | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<CarteiraDetailData | null>(null);

  const visibleColumnOrder = useMemo(() => {
    return tableColumnOrder.filter((column) => tableColumnVisibility[column] !== false);
  }, [tableColumnOrder, tableColumnVisibility]);

  const sortedRows = useMemo(() => {
    if (!sortState) return rows;
    const sorted = [...rows].sort((a, b) => {
      const left = getSortValue(a, sortState.column);
      const right = getSortValue(b, sortState.column);
      const result = compareValues(left, right);
      return sortState.direction === 'asc' ? result : -result;
    });
    return sorted;
  }, [rows, sortState]);

  const handleSort = (column: CarteiraTableColumnKey) => {
    if (!SORTABLE_COLUMNS.has(column)) return;
    setSortState((current) => {
      if (!current || current.column !== column) {
        return { column, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortIndicator = (column: CarteiraTableColumnKey) => {
    if (!sortState || sortState.column !== column) return '↕';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  const handleHeaderDragStart = (event: DragEvent<HTMLElement>, columnId: CarteiraTableColumnKey) => {
    draggedColumnIdRef.current = columnId;
    setDraggingColumnId(columnId);
    setDragOverColumnId(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', columnId);
  };

  const handleHeaderDrop = (targetColumnId: CarteiraTableColumnKey) => {
    const sourceColumnId = draggedColumnIdRef.current;
    draggedColumnIdRef.current = null;
    setDragOverColumnId(null);
    setDraggingColumnId(null);

    if (!sourceColumnId || sourceColumnId === targetColumnId) return;

    setTableColumnOrder((prev) => {
      const next = [...prev];
      const sourceIndex = next.indexOf(sourceColumnId);
      const targetIndex = next.indexOf(targetColumnId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceColumnId);
      return next;
    });
  };

  const handleVisualize = async (leadId: string) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetailData(null);
    try {
      const result = await getEntryDetail(leadId);
      setDetailData(result);
    } catch (err) {
      setIsDetailOpen(false);
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar detalhe');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDetailSave = async (leadId: string, payload: Parameters<typeof updateEntryDetail>[1]) => {
    const updated = await updateEntryDetail(leadId, payload);
    setDetailData(updated);
  };

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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumnOrder.map((column) => {
                  const sortable = SORTABLE_COLUMNS.has(column);
                  return (
                    <TableHead
                      key={column}
                      className={cn(
                        'text-center align-middle',
                        draggingColumnId === column ? 'opacity-60' : '',
                        dragOverColumnId === column ? 'bg-muted/50 ring-1 ring-primary/40' : '',
                        'cursor-move select-none'
                      )}
                      draggable
                      onDragStart={(event) => handleHeaderDragStart(event, column)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        if (draggedColumnIdRef.current && draggedColumnIdRef.current !== column) {
                          setDragOverColumnId(column);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverColumnId((prev) => (prev === column ? null : prev));
                      }}
                      onDragEnd={() => {
                        draggedColumnIdRef.current = null;
                        setDragOverColumnId(null);
                        setDraggingColumnId(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleHeaderDrop(column);
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center justify-center gap-1 text-center text-sm font-medium',
                          sortable ? 'w-full cursor-pointer text-foreground hover:text-foreground/80' : 'w-full cursor-default'
                        )}
                        onClick={() => handleSort(column)}
                        disabled={!sortable}
                      >
                        {COLUMN_LABELS[column]}
                        {sortable ? <span className="text-xs text-muted-foreground">{getSortIndicator(column)}</span> : null}
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="w-10 text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnOrder.length + 1} className="h-24 text-center text-muted-foreground">
                    Nenhum cliente na carteira.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <CarteiraTableRow
                    key={row.leadId}
                    row={row}
                    columnOrder={visibleColumnOrder}
                    onVisualize={handleVisualize}
                  />
                ))
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

      <CarteiraDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        detail={detailData}
        isLoading={isDetailLoading}
        onSave={handleDetailSave}
      />
    </TooltipProvider>
  );
}
