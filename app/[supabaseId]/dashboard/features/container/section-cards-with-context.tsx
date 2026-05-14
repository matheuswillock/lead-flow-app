'use client';
import * as React from "react";

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
  CalendarClock,
  UserX,
  Handshake,
  Target,
  DollarSign,
  Settings,
  TrendingDown,
  Wallet,
  Eye,
  EyeOff,
  Info,
  CheckCircle2,
  BanknoteArrowUp,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetricsFilters } from '../services/IDashboardMetricsService';
import { useTimezone } from '@/app/context/TimezoneContext';
import { DateRange } from "react-day-picker";
import { format, isSameDay } from "date-fns";
import {
  addDaysInTz,
  addMonthsInTz,
  formatIntimezone,
  parseDateKeyToUtc,
  startOfDayInTz,
} from '@/lib/dates';
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter";

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

interface FunnelCardItem {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

interface FunnelCardProps {
  icon: React.ReactNode;
  title: string;
  tooltip: string;
  total: React.ReactNode;
  totalColor?: string;
  subtitle: string;
  items: FunnelCardItem[];
  className?: string;
  isBlurred: boolean;
}

function FunnelCard({
  icon,
  title,
  tooltip,
  total,
  totalColor = "text-foreground",
  subtitle,
  items,
  className,
  isBlurred,
}: FunnelCardProps) {
  return (
    <Card className={cn("@container/card flex flex-col", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {title}
            <InfoTooltip text={tooltip} />
          </CardTitle>
        </div>
        <CardDescription
          className={cn(
            "text-4xl font-bold transition-all duration-200 mt-1",
            totalColor,
            isBlurred && "blur-sm select-none",
          )}
        >
          {total}
        </CardDescription>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <div className="px-6"><Separator /></div>
      <div className="flex flex-col gap-4 p-6 flex-1 justify-center">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <span className={cn("text-sm font-semibold tabular-nums", isBlurred && "blur-sm select-none")}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
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

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function SectionCardsWithContext() {
  const {
    metrics,
    isLoading,
    error,
    filters,
    customDateRange,
    isBlurred,
    toggleBlur,
    setPeriod,
    setCustomDateRange,
    clearCustomDateRange,
  } = useDashboardContext();
  const { tz } = useTimezone();
  const [customDateRangeDraft, setCustomDateRangeDraft] = React.useState<DateRange | undefined>(
    undefined
  );

  React.useEffect(() => {
    setCustomDateRangeDraft(
      customDateRange?.startDate
        ? {
            from: parseDateKey(customDateRange.startDate),
            to: parseDateKey(customDateRange.endDate ?? ""),
          }
        : undefined
    );
  }, [customDateRange]);

  const customDateFilterRange = React.useMemo<DateRange | undefined>(() => {
    return customDateRangeDraft;
  }, [customDateRangeDraft]);

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

  const handleCustomDateRangeChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setCustomDateRangeDraft(undefined);
      clearCustomDateRange();
      return;
    }
    const rangeStart = range.from;

    const normalizedRange: DateRange = {
      from: rangeStart,
      to: range.to && isSameDay(rangeStart, range.to) ? undefined : range.to,
    };

    setCustomDateRangeDraft(normalizedRange);

    const rangeEnd = normalizedRange.to;
    if (!rangeEnd) {
      return;
    }

    setCustomDateRange(
      format(rangeStart, "yyyy-MM-dd"),
      format(rangeEnd, "yyyy-MM-dd")
    );
  };
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
      {/* Header do dashboard com filtro global de periodo */}
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="rounded-md border border-border/60 bg-card/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          {filterDateRangeText}
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {(
            [
              { value: "7d", label: "7 dias" },
              { value: "30d", label: "30 dias" },
              { value: "3m", label: "3 meses" },
              { value: "6m", label: "6 meses" },
              { value: "1y", label: "1 ano" },
            ] as const
          ).map((period) => (
            <Button
              key={period.value}
              size="sm"
              variant={filters.period === period.value && !customDateRange ? "default" : "outline"}
              onClick={() => setPeriod(period.value)}
              className="text-xs"
            >
              {period.label}
            </Button>
          ))}
          <LeadsDateFilter
            title="Período customizado"
            value={customDateFilterRange}
            onChange={handleCustomDateRangeChange}
          />
          <Button size="sm" variant="outline" onClick={clearCustomDateRange} className="text-xs">
            Limpar
          </Button>
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
      </div>

      {/* SEÇÃO 1: MÉTRICAS PRINCIPAIS - Destaque Visual */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {/* Receita Total - DESTAQUE VERDE */}
        <Card className="@container/card border-green-500/30 bg-gradient-to-br from-green-50 via-green-50/50 to-transparent shadow-md dark:from-green-900/20 dark:via-green-900/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                💰 Receita Total
                <InfoTooltip text="Soma do ticket dos leads fechados no CRM no período selecionado." />
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
                📊 Intenção de Compra
                <InfoTooltip text="Soma de ticket dos leads do CRM no período selecionado." />
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
                <InfoTooltip text="Leads convertidos (Boleto gerado + DPS + Contrato fechado) dividido pelo total de leads no período." />
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
              Vendas / total de leads
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
        <div className="grid grid-cols-3 gap-4">
          {/* Agendamentos */}
          <FunnelCard
            className="row-span-2"
            isBlurred={isBlurred}
            icon={<Calendar className="h-4 w-4 text-blue-500" />}
            title="Agendamentos"
            tooltip="Quantidade de leads que tiveram agendamento no período selecionado, mesmo que o status tenha mudado depois."
            total={metrics.agendamentos}
            subtitle="Já agendados no período"
            items={[
              {
                icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                label: "Reuniões realizadas",
                value: Math.max(metrics.reunioesRealizadasCloser, metrics.reunioesRealizadasSdr),
              },
              {
                icon: <UserX className="h-4 w-4 text-amber-500" />,
                label: "No-show",
                value: metrics.noShowCount,
              },
              {
                icon: <CalendarClock className="h-4 w-4 text-blue-500" />,
                label: "Com data marcada",
                value: metrics.scheduledCount,
              },
            ]}
          />

          {/* Negociação — col 2, row 1 */}
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

          {/* Vendas — col 3, row-span-2 */}
          <FunnelCard
            className="row-span-2"
            isBlurred={isBlurred}
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            title="Vendas"
            tooltip="Total de leads convertidos: boleto gerado, DPS e contrato fechado."
            total={metrics.convertedCount}
            totalColor="text-green-600 dark:text-green-400"
            subtitle="Conversões no período"
            items={[
              {
                icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                label: "Vendas realizadas",
                value: metrics.salesCount,
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-green-500" />,
                label: "Vendas fechadas",
                value: metrics.dpsCount,
              },
              {
                icon: <BanknoteArrowUp className="h-4 w-4 text-blue-500" />,
                label: "Boletos gerados",
                value: metrics.vendasRealizadas,
              },
            ]}
          />

          {/* Implementação — col 2, row 2 */}
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
                  <InfoTooltip text="No-show dividido por (agendados + no-show) no período selecionado." />
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
                  Perdidos e desqualificados
                  <InfoTooltip text="(Perdidos + desqualificados) dividido pelo total de leads criados no período selecionado." />
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
                Perdidos e desqualificados no período
              </CardAction>
            </CardFooter>
          </Card>
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}

