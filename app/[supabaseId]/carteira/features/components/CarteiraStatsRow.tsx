"use client";

import { useMemo } from 'react';
import { CheckCircle2, Clock, Info, Users, Wallet } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCarteiraContext } from '../context/CarteiraContext';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CarteiraStatsRow() {
  const { data, isLoading } = useCarteiraContext();

  const stats = useMemo(() => {
    const rows = data?.rows ?? [];
    const total = data?.pagination.totalRows ?? 0;
    const valor = rows.reduce((sum, r) => sum + r.saleValue, 0);
    const ativos = rows.filter((r) => r.portfolioStatus === 'active').length;
    const vencendo = rows.filter((r) => {
      if (!r.contractDueDate) return false;
      const days = differenceInCalendarDays(new Date(r.contractDueDate), new Date());
      return days >= 0 && days <= 90;
    }).length;
    const ativosPct = total > 0 ? Math.round((ativos / total) * 100) : 0;
    return { total, valor, ativos, vencendo, ativosPct };
  }, [data]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Total de clientes</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Total de clientes na carteira (página atual).
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wallet className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Valor da carteira</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Soma do valor de venda dos contratos da página atual.
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-28" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums leading-tight">{formatBRL(stats.valor)}</p>
            )}
            {!isLoading && <p className="mt-auto text-[10px] text-muted-foreground">página atual</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={cn('size-4', isLoading ? 'text-muted-foreground' : 'text-semantic-success')} />
                <p className="text-xs text-muted-foreground">Contratos ativos</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Contratos com status ativo ÷ total × 100.
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-semantic-success">{stats.ativos}</p>
            )}
            {!isLoading && <p className="mt-auto text-[10px] text-semantic-success">{stats.ativosPct}% do total</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className={cn('size-4', isLoading ? 'text-muted-foreground' : 'text-semantic-warning')} />
                <p className="text-xs text-muted-foreground">Vencendo em 90 dias</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-48 text-center text-xs">
                  Contratos com vencimento nos próximos 90 dias.
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-semantic-warning">{stats.vencendo}</p>
            )}
            {!isLoading && <p className="mt-auto text-[10px] text-semantic-warning">requerem atenção</p>}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
