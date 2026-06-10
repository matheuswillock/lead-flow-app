"use client";

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Info, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CarteiraRenovacaoModal } from '../components/CarteiraRenovacaoModal';
import { useCarteiraContext } from '../context/CarteiraContext';
import {
  RENEWAL_STATUS_LABELS,
  type CarteiraRow,
  type RenewalStatus,
} from '../context/CarteiraTypes';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function computeReajustePercent(saleValue: number, renewalAmount: number | null): number | null {
  if (renewalAmount == null || saleValue <= 0) return null;
  return ((renewalAmount - saleValue) / saleValue) * 100;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function DueDateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-sm text-muted-foreground">—</span>;
  const days = differenceInCalendarDays(new Date(date), new Date());
  const isExpired = days < 0;
  const isSoon = days >= 0 && days <= 90;
  const colorClass =
    isExpired ? 'text-semantic-danger' :
    isSoon    ? 'text-semantic-warning' : '';
  const label = isExpired ? 'Vencido' : isSoon ? 'Expira em breve' : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-sm font-medium', colorClass)}>{formatDate(date)}</span>
      {label && <span className={cn('text-[10px] font-semibold', colorClass)}>{label}</span>}
    </div>
  );
}

export function OperadoraChip({ name }: { name: string | null }) {
  if (!name) return <span className="text-sm text-muted-foreground">—</span>;
  return <span className="text-xs font-medium text-foreground">{name}</span>;
}

function DueDateBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const days = differenceInCalendarDays(new Date(date), new Date());
  const isExpired = days < 0;
  const isSoon = days >= 0 && days <= 90;
  if (!isExpired && !isSoon) return null;
  const label = isExpired ? `Vencido há ${Math.abs(days)}d` : `Vence em ${days}d`;
  return (
    <Badge
      variant="outline"
      className={cn(
        'px-1.5 text-[10px] font-semibold',
        isExpired
          ? 'border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger'
          : 'border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning',
      )}
    >
      {label}
    </Badge>
  );
}

const STATUS_DOT_BG: Record<RenewalStatus, string> = {
  to_renew:  'bg-primary',
  contacted: 'bg-blue-500',
  proposal:  'bg-semantic-warning',
  renewed:   'bg-semantic-success',
  lost:      'bg-semantic-danger',
};

const STATUS_TEXT_COLOR: Record<RenewalStatus, string> = {
  to_renew:  'text-primary',
  contacted: 'text-blue-500',
  proposal:  'text-semantic-warning',
  renewed:   'text-semantic-success',
  lost:      'text-semantic-danger',
};

function RenewalStatsRow({ renewalClients }: { renewalClients: CarteiraRow[] }) {
  const total = renewalClients.length;
  const aTrabalhar = renewalClients.filter((r) =>
    r.renewalStatus === 'to_renew' || r.renewalStatus === 'contacted' || r.renewalStatus === 'proposal'
  ).length;
  const renovados = renewalClients.filter((r) => r.renewalStatus === 'renewed').length;
  const perdidos = renewalClients.filter((r) => r.renewalStatus === 'lost').length;
  const retentionDenominator = renovados + perdidos;
  const retention = retentionDenominator > 0 ? Math.round((renovados / retentionDenominator) * 100) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-semantic-warning" />
                <p className="text-xs text-muted-foreground">Janela de renovação</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Clientes com vencimento em até 90 dias.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-semantic-warning">{total}</p>
            <p className="mt-auto text-[10px] text-semantic-warning">vencem em até 90 dias</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">A trabalhar</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Renovações com status A renovar, Contatado ou Proposta enviada.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{aTrabalhar}</p>
            <p className="mt-auto text-[10px] text-muted-foreground">aguardando ação</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-semantic-success" />
                <p className="text-xs text-muted-foreground">Renovados</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Renovações concluídas; subtítulo mostra as perdidas.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-semantic-success">{renovados}</p>
            <p className="mt-auto text-[10px] text-semantic-success">{perdidos} perdido{perdidos !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="size-4 text-semantic-success" />
                <p className="text-xs text-muted-foreground">Taxa de retenção</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Renovados ÷ (Renovados + Perdidos) × 100.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', retention !== null ? 'text-semantic-success' : 'text-foreground')}>
              {retention === null ? '—' : `${retention}%`}
            </p>
            <p className={cn('mt-auto text-[10px]', retentionDenominator > 0 ? 'text-semantic-success' : 'text-muted-foreground')}>
              {retentionDenominator > 0 ? `${renovados}/${retentionDenominator} fechados` : 'sem fechamentos'}
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function PipelineView({
  clients,
  onRowClick,
}: {
  clients: CarteiraRow[];
  onRowClick: (row: CarteiraRow) => void;
}) {
  if (clients.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border text-sm text-muted-foreground">
        Nenhum cliente com vencimento nos próximos 90 dias.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Operadora</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Reajuste</TableHead>
            <TableHead>Valor atual → novo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((row) => {
            const reajuste = computeReajustePercent(row.saleValue, row.renewalAmount);
            const isFinished = row.renewalStatus === 'renewed' || row.renewalStatus === 'lost';
            return (
              <TableRow
                key={row.portfolioId}
                className={cn('cursor-pointer', isFinished && 'opacity-60')}
                onClick={() => onRowClick(row)}
              >
                <TableCell>
                  <div className="flex flex-col items-start">
                    <p className="text-sm font-medium">{row.leadName}</p>
                    <p className="text-xs text-muted-foreground">{row.leadCode}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <OperadoraChip name={row.operadora} />
                </TableCell>
                <TableCell>
                  <DueDateCell date={row.contractDueDate} />
                </TableCell>
                <TableCell>
                  {reajuste === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className={cn('text-sm font-medium', reajuste >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                      {formatPercent(reajuste)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.renewalAmount == null ? (
                    <span className="text-sm font-medium">{formatBRL(row.saleValue)}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-sm line-through text-muted-foreground">{formatBRL(row.saleValue)}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium">{formatBRL(row.renewalAmount)}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className={cn('flex items-center gap-1.5', STATUS_TEXT_COLOR[row.renewalStatus])}>
                    <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_BG[row.renewalStatus])} />
                    <span className="text-xs font-medium">{RENEWAL_STATUS_LABELS[row.renewalStatus]}</span>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function KanbanCard({
  row,
  onCardClick,
  onDragStart,
}: {
  row: CarteiraRow;
  onCardClick: (row: CarteiraRow) => void;
  onDragStart: (e: React.DragEvent, portfolioId: string) => void;
}) {
  const reajuste = computeReajustePercent(row.saleValue, row.renewalAmount);
  const displayValue = row.renewalAmount ?? row.saleValue;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, row.portfolioId)}
      onClick={() => onCardClick(row)}
      className="cursor-grab shadow-none transition-shadow hover:shadow-md active:cursor-grabbing active:opacity-50"
    >
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{row.leadName}</p>
          <p className="text-xs text-muted-foreground">{row.leadCode}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <OperadoraChip name={row.operadora} />
          <DueDateBadge date={row.contractDueDate} />
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          {reajuste === null ? (
            <span className="text-xs text-muted-foreground">Sem reajuste</span>
          ) : (
            <div className={cn('flex items-center gap-1', reajuste >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
              {reajuste >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              <span className="text-xs font-semibold">{formatPercent(reajuste)}</span>
            </div>
          )}
          <span className="text-sm font-bold">{formatBRL(displayValue)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  col,
  clients,
  onStatusChange,
  onCardClick,
  onDragStart,
}: {
  col: RenewalStatus;
  clients: CarteiraRow[];
  onStatusChange: (portfolioId: string, status: RenewalStatus) => void;
  onCardClick: (row: CarteiraRow) => void;
  onDragStart: (e: React.DragEvent, portfolioId: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const portfolioId = e.dataTransfer.getData('portfolioId');
    if (portfolioId) onStatusChange(portfolioId, col);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_BG[col])} />
          <span className="text-xs font-semibold">{RENEWAL_STATUS_LABELS[col]}</span>
        </div>
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
          clients.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}>
          {clients.length}
        </span>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-14 flex-col gap-2 rounded-md p-1 transition-colors',
          isOver && 'bg-muted/40 ring-1 ring-border',
        )}
      >
        {clients.map((row) => (
          <KanbanCard
            key={row.portfolioId}
            row={row}
            onCardClick={onCardClick}
            onDragStart={onDragStart}
          />
        ))}
        {clients.length === 0 && (
          <div className={cn(
            'flex h-14 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground transition-colors',
            isOver && 'border-primary/50 bg-primary/5 text-primary',
          )}>
            Soltar aqui
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanView({
  clients,
  onStatusChange,
  onCardClick,
}: {
  clients: CarteiraRow[];
  onStatusChange: (portfolioId: string, status: RenewalStatus) => void;
  onCardClick: (row: CarteiraRow) => void;
}) {
  const columns = Object.keys(RENEWAL_STATUS_LABELS) as RenewalStatus[];

  const handleDragStart = (e: React.DragEvent, portfolioId: string) => {
    e.dataTransfer.setData('portfolioId', portfolioId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="grid grid-cols-5 gap-3">
      {columns.map((col) => {
        const colClients = clients.filter((r) => r.renewalStatus === col);
        return (
          <KanbanColumn
            key={col}
            col={col}
            clients={colClients}
            onStatusChange={onStatusChange}
            onCardClick={onCardClick}
            onDragStart={handleDragStart}
          />
        );
      })}
    </div>
  );
}

export function CarteiraRenovacoesView() {
  const { data, updateEntry } = useCarteiraContext();
  const [selectedRow, setSelectedRow] = useState<CarteiraRow | null>(null);

  const renewalClients = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (!r.contractDueDate) return false;
      const days = differenceInCalendarDays(new Date(r.contractDueDate), new Date());
      return days <= 90;
    });
  }, [data]);

  const handleStatusChange = (portfolioId: string, status: RenewalStatus) => {
    const row = renewalClients.find((r) => r.portfolioId === portfolioId);
    if (row) {
      void updateEntry(row.leadId, { renewalStatus: status });
    }
  };

  const selectedStatus = selectedRow?.renewalStatus ?? 'to_renew';

  return (
    <div className="flex flex-col gap-5">
      <RenewalStatsRow renewalClients={renewalClients} />

      <Tabs defaultValue="pipeline">
        <TabsList className="h-8">
          <TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger>
          <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-3">
          <PipelineView
            clients={renewalClients}
            onRowClick={setSelectedRow}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-3">
          <KanbanView
            clients={renewalClients}
            onStatusChange={handleStatusChange}
            onCardClick={setSelectedRow}
          />
        </TabsContent>
      </Tabs>

      <CarteiraRenovacaoModal
        open={selectedRow !== null}
        onOpenChange={(open) => { if (!open) setSelectedRow(null); }}
        row={selectedRow}
        status={selectedStatus}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
