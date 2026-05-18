"use client";

import { useState } from 'react';
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
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

function CarteiraTableRow({
  row,
  onVisualize,
}: {
  row: CarteiraRow;
  onVisualize: (leadId: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-center">
        <div className="flex flex-col items-center text-center">
          <p className="font-medium text-sm">{row.leadName}</p>
          <p className="text-xs text-muted-foreground">{row.leadCode}</p>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">{row.operadora ?? '—'}</TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">{PORTFOLIO_SOURCE_LABELS[row.source]}</TableCell>
      <TableCell className="text-center text-sm">{formatDate(row.contractStartDate)}</TableCell>
      <TableCell className="text-center text-sm font-medium">{formatBRL(row.saleValue)}</TableCell>
      <TableCell className="text-center text-sm">{formatDate(row.contractDueDate)}</TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <StatusCell status={row.portfolioStatus} />
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <ProfileCell person={row.sdr} />
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center">
          <ProfileCell person={row.closer} />
        </div>
      </TableCell>
      <TableCell className="w-10 text-center">
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
      </TableCell>
    </TableRow>
  );
}

export function CarteiraTable() {
  const { data, isLoading, filters, setPage, getEntryDetail, updateEntryDetail } = useCarteiraContext();
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<CarteiraDetailData | null>(null);

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
                <TableHead className="text-center">Cliente</TableHead>
                <TableHead className="text-center">Operadora</TableHead>
                <TableHead className="text-center">Origem</TableHead>
                <TableHead className="text-center">Data de Contrato</TableHead>
                <TableHead className="text-center">Valor</TableHead>
                <TableHead className="text-center">Vencimento</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">SDR</TableHead>
                <TableHead className="text-center">Closer</TableHead>
                <TableHead className="w-10 text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    Nenhum cliente na carteira.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <CarteiraTableRow
                    key={row.leadId}
                    row={row}
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
