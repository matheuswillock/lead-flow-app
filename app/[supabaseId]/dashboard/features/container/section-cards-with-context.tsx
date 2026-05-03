'use client';

import { useDashboardContext } from '../context/DashboardContext';
import { DashboardCardsSkeleton } from './components/DashboardSkeleton';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  TrendingUp, 
  Calendar, 
  UserX, 
  Handshake, 
  Target, 
  DollarSign, 
  Settings, 
  TrendingDown,
  Wallet,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetricsFilters } from '../services/IDashboardMetricsService';
import { useTimezone } from '@/app/context/TimezoneContext';
import {
  addDaysInTz,
  addMonthsInTz,
  formatIntimezone,
  parseDateKeyToUtc,
  startOfDayInTz,
} from '@/lib/dates';

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
          aria-label="Ver detalhes do calculo"
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function parseDateInput(value: string, tz: string): Date | null {
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymdMatch) {
    const date = parseDateKeyToUtc(value, tz);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDayInTz(date, tz);
}

function getStartDateFromPeriod(period: MetricsFilters['period'] | undefined, tz: string): Date {
  const now = new Date();
  const startDate = startOfDayInTz(now, tz);

  switch (period) {
    case '7d':
      return startOfDayInTz(addDaysInTz(startDate, -7, tz), tz);
    case '30d':
      return startOfDayInTz(addDaysInTz(startDate, -30, tz), tz);
    case '3m':
      return startOfDayInTz(addMonthsInTz(startDate, -3, tz), tz);
    case '6m':
      return startOfDayInTz(addMonthsInTz(startDate, -6, tz), tz);
    case '1y':
      return startOfDayInTz(addMonthsInTz(startDate, -12, tz), tz);
    default:
      return startOfDayInTz(addDaysInTz(startDate, -30, tz), tz);
  }
}

function formatDatePtBr(date: Date, tz: string): string {
  return formatIntimezone(date, 'dd/MM/yyyy', tz);
}

export function SectionCardsWithContext() {
  const { metrics, isLoading, error, filters, customDateRange, isBlurred, toggleBlur } = useDashboardContext();
  const { tz } = useTimezone();

  if (isLoading) {
    return <DashboardCardsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        <p>Erro ao carregar métricas: {error}</p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Função para obter o texto do período
  const getPeriodText = () => {
    if (customDateRange) {
      return `período customizado`;
    }
    
    switch (filters.period) {
      case '7d':
        return 'últimos 7 dias';
      case '30d':
        return 'últimos 30 dias';
      case '3m':
        return 'últimos 3 meses';
      case '6m':
        return 'últimos 6 meses';
      case '1y':
        return 'último ano';
      default:
        return 'período selecionado';
    }
  };

  const periodText = getPeriodText();
  const filterDateRangeText = (() => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (customDateRange?.startDate && customDateRange?.endDate) {
      startDate = parseDateInput(customDateRange.startDate, tz);
      endDate = parseDateInput(customDateRange.endDate, tz);
    }

    if (!startDate || !endDate) {
      endDate = startOfDayInTz(new Date(), tz);
      startDate = getStartDateFromPeriod(filters.period, tz);
    }

    return `${formatDatePtBr(startDate, tz)} - ${formatDatePtBr(endDate, tz)}`;
  })();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6 px-4 lg:px-6">
      {/* Toggle de Blur para Privacidade */}
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="rounded-md border border-border/60 bg-card/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          {filterDateRangeText}
        </div>
        <Button variant="outline" size="sm" onClick={toggleBlur} className="gap-2">
          {isBlurred ? (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="text-xs">Mostrar valores</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span className="text-xs">Ocultar valores</span>
            </>
          )}
        </Button>
      </div>

      {/* SEÇÃO 1: MÉTRICAS PRINCIPAIS - Destaque Visual */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {/* Receita Total - DESTAQUE VERDE */}
        <Card className="@container/card border-green-500/30 bg-gradient-to-br from-green-50 via-green-50/50 to-transparent shadow-md dark:from-green-900/20 dark:via-green-900/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                💰 Receita Total
                <InfoTooltip text="Soma do ticket dos leads com status Negocio fechado no periodo selecionado." />
              </CardTitle>
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardDescription
              className={cn(
                "text-4xl font-bold text-foreground transition-all duration-200",
                isBlurred && "blur-sm select-none",
              )}
            >
              R$ {metrics.receitaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-green-600 dark:text-green-400">
              Total vendido (ticket) nos {periodText}
            </CardAction>
          </CardFooter>
        </Card>

        {/* Valor da Venda - DESTAQUE AMARELO */}
        <Card className="@container/card border-amber-500/30 bg-gradient-to-br from-amber-50 via-amber-50/50 to-transparent shadow-md dark:from-amber-900/20 dark:via-amber-900/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                📊 Valor da Venda
                <InfoTooltip text="Soma do valor da venda de todos os leads no período selecionado." />
              </CardTitle>
              <div className="rounded-full bg-amber-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <CardDescription
              className={cn(
                "text-4xl font-bold text-foreground transition-all duration-200",
                isBlurred && "blur-sm select-none",
              )}
            >
              R$ {metrics.ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Valor total de vendas
            </CardAction>
          </CardFooter>
        </Card>

        {/* Taxa de Conversão - DESTAQUE */}
        <Card className="@container/card border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/3 to-transparent shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                🎯 Taxa de Conversão
                <InfoTooltip text="Vendas divididas pelo total de leads do master no periodo selecionado." />
                </CardTitle>
              <div className="rounded-full bg-blue-500/10 p-2">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <CardDescription
              className={cn(
                "text-4xl font-bold text-foreground transition-all duration-200",
                isBlurred && "blur-sm select-none",
              )}
            >
              {metrics.taxaConversao}%
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Agendamentos convertidos em vendas
            </CardAction>
          </CardFooter>
        </Card>

        {/* Potencial de Receita - DESTAQUE */}
        <Card className="@container/card border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-purple-500/3 to-transparent shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                💼 Potencial de Receita
                <InfoTooltip text="Soma do valor atual de todos os leads no período selecionado." />
              </CardTitle>
              <div className="rounded-full bg-purple-500/10 p-2">
                <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <CardDescription
              className={cn(
                "text-4xl font-bold text-foreground transition-all duration-200",
                isBlurred && "blur-sm select-none",
              )}
            >
              R$ {metrics.cadencia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-purple-600 dark:text-purple-400">
              Valor atual total em pipeline
            </CardAction>
          </CardFooter>
        </Card>
      </div>

      {/* SEÇÃO 2: FUNIL DE VENDAS */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">📊 Funil de Vendas</h3>
        <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-4">
          {/* Agendamentos */}
          <Card className="@container/card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Agendamentos
                  <InfoTooltip text="Total de leads cadastrados pelo master no periodo selecionado." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-foreground transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.agendamentos}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">Leads cadastrados</CardAction>
            </CardFooter>
          </Card>

          {/* Negociação */}
          <Card className="@container/card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Negociação
                  <InfoTooltip text="Quantidade de leads em negociacao ou cotacao no periodo selecionado." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-foreground transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.negociacao}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">Em negociação</CardAction>
            </CardFooter>
          </Card>

          {/* Implementação */}
          <Card className="@container/card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-cyan-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Implementação
                  <InfoTooltip text="Quantidade de leads em proposta, DPS/Contrato, boleto ou documentos pendentes." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-foreground transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.implementacao}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">Em implementação</CardAction>
            </CardFooter>
          </Card>

          {/* Vendas - BG SÓBRIO PADRÃO */}
          <Card className="@container/card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Vendas
                  <InfoTooltip text="Quantidade de leads com status Negocio fechado no periodo selecionado." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-green-600 dark:text-green-400 transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.vendas}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">Concluídas</CardAction>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* SEÇÃO 3: REUNIÕES REALIZADAS */}
      {/* <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          📅 Reuniões realizadas
        </h3>
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
          <Card className="@container/card h-full">
            <CardHeader className="pb-2">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <CardTitle className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Reuniões realizadas (Closer)
                    <InfoTooltip text="Conta reuniões com 'Reunião realizada' marcada no período selecionado. Cada reunião conta tanto para o closer quanto para o SDR." />
                  </CardTitle>
                </div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">
                  Total: {metrics.reunioesRealizadasCloser}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              {renderMeetingsHeldRanking(metrics.reunioesRealizadasCloserRanking)}
            </CardContent>
            <CardFooter className="pt-0 mt-auto justify-start">
              <CardAction className="text-xs text-muted-foreground">
                Ranking de closers nos {periodText}
              </CardAction>
            </CardFooter>
          </Card>

          <Card className="@container/card h-full">
            <CardHeader className="pb-2">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <CardTitle className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Reuniões realizadas (SDR)
                    <InfoTooltip text="Conta reuniões com 'Reunião realizada' marcada no período selecionado. Cada reunião conta tanto para o closer quanto para o SDR (responsável)." />
                  </CardTitle>
                </div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">
                  Total: {metrics.reunioesRealizadasSdr}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              {renderMeetingsHeldRanking(metrics.reunioesRealizadasSdrRanking)}
            </CardContent>
            <CardFooter className="pt-0 mt-auto justify-start">
              <CardAction className="text-xs text-muted-foreground">
                Ranking de SDRs nos {periodText}
              </CardAction>
            </CardFooter>
          </Card>
        </div>
      </div> */}

      {/* SEÇÃO 3: INDICADORES DE PERFORMANCE */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          📈 Indicadores de Performance
        </h3>
        <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-2">
          {/* No-Show - BG AMARELO */}
          <Card className="@container/card border-yellow-500/30 bg-gradient-to-br from-yellow-50 via-yellow-50/50 to-transparent dark:from-yellow-900/20 dark:via-yellow-900/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Taxa de No-show
                  <InfoTooltip text="No-show dividido pelo total de leads do master no periodo selecionado." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-yellow-600 dark:text-yellow-400 transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.noShowRate?.toFixed(1)}%
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">Taxa de ausência</CardAction>
            </CardFooter>
          </Card>

          {/* Churn Rate */}
          <Card className="@container/card border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Taxa de Churn Rate
                  <InfoTooltip text="Negado operadora dividido por vendas no periodo selecionado." />
                </CardTitle>
              </div>
              <CardDescription
                className={cn(
                  "text-2xl font-bold text-red-600 dark:text-red-400 transition-all duration-200",
                  isBlurred && "blur-sm select-none",
                )}
              >
                {metrics.churnRate}%
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">
                Taxa de cancelamento
              </CardAction>
            </CardFooter>
          </Card>
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}

