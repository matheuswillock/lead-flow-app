'use client';
import * as React from "react";

import { useDashboardContext } from '../context/DashboardContext';
import { DashboardCardsSkeleton } from './components/DashboardSkeleton';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  TrendingUp,
  Calendar,
  CalendarClock,
  CircleAlert,
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
  FileText,
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

interface PrimaryMetricCardProps {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  value: string;
  valueClassName?: string;
  caption: string;
  isBlurred: boolean;
}

function PrimaryMetricCard({
  icon,
  label,
  tooltip,
  value,
  valueClassName,
  caption,
  isBlurred,
}: PrimaryMetricCardProps) {
  return (
    <Card className="@container/card shadow-none">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {icon}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 cursor-help shrink-0 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-center text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums leading-tight transition-all duration-200",
            valueClassName,
            isBlurred && "blur-sm select-none",
          )}
        >
          {value}
        </p>
        <p className="mt-auto text-[10px] text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
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
    refreshMetrics,
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
      <div className="px-4 lg:px-6">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Erro ao carregar métricas</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void refreshMetrics()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
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

      {/* SEÇÃO 1: MÉTRICAS PRINCIPAIS */}
      <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2 @4xl/main:grid-cols-4">
        <PrimaryMetricCard
          icon={<DollarSign className="size-4 text-muted-foreground" />}
          label="Receita Realizada"
          tooltip="Soma do ticket dos leads com contrato finalizado no período selecionado."
          value={`R$ ${metrics.receitaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueClassName="text-semantic-success"
          caption={`Contratos finalizados nos ${periodText}`}
          isBlurred={isBlurred}
        />
        <PrimaryMetricCard
          icon={<TrendingUp className="size-4 text-muted-foreground" />}
          label="Valor em Pipeline"
          tooltip="Soma do ticket de todos os leads ativos no período — valor total que pode se tornar receita."
          value={`R$ ${metrics.ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          caption={`Total em negociação nos ${periodText}`}
          isBlurred={isBlurred}
        />
        <PrimaryMetricCard
          icon={<Target className="size-4 text-muted-foreground" />}
          label="Taxa de Conversão"
          tooltip="Contratos finalizados dividido pelo total de leads criados no período."
          value={`${metrics.taxaConversao}%`}
          caption={`Contratos fechados ÷ total de leads nos ${periodText}`}
          isBlurred={isBlurred}
        />
        <PrimaryMetricCard
          icon={<Wallet className="size-4 text-muted-foreground" />}
          label="Potencial de Receita"
          tooltip="Soma do valor atual de todos os leads no período selecionado."
          value={`R$ ${metrics.cadencia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          caption="Valor atual total em pipeline"
          isBlurred={isBlurred}
        />
      </div>

      {/* SEÇÃO 2: FUNIL DE VENDAS */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">📊 Funil de Vendas</h3>
        <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2 @xl/main:grid-cols-3">
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
                  <InfoTooltip text="Quantidade de leads em negociação ou cotação no período selecionado." />
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
            tooltip="Total de leads que avançaram para boleto gerado, DPS preenchido ou contrato finalizado no período."
            total={metrics.convertedCount}
            totalColor="text-green-600 dark:text-green-400"
            subtitle="Conversões no período"
            items={[
              {
                icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                label: "Contratos finalizados",
                value: metrics.salesCount,
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-green-500" />,
                label: "DPS preenchidos",
                value: metrics.dpsCount,
              },
              {
                icon: <BanknoteArrowUp className="h-4 w-4 text-blue-500" />,
                label: "Boletos gerados",
                value: metrics.vendasRealizadas,
              },
              {
                icon: <FileText className="h-4 w-4 text-orange-500" />,
                label: "Propostas enviadas",
                value: metrics.proposalCount,
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

      {/* SEÇÃO 3: INDICADORES DE PERFORMANCE */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          📈 Indicadores de Performance
        </h3>
        <div className="grid grid-cols-1 gap-4 @md/main:grid-cols-2">
          {/* No-Show - BG AMARELO */}
          <Card className="@container/card border-yellow-500/30 bg-gradient-to-br from-yellow-50 via-yellow-50/50 to-transparent dark:from-yellow-900/20 dark:via-yellow-900/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Taxa de Ausência
                  <InfoTooltip text="Clientes sem comparecimento ÷ (reuniões realizadas + sem comparecimento) no período." />
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
              <CardAction className="text-xs text-muted-foreground">Clientes que não compareceram à reunião</CardAction>
            </CardFooter>
          </Card>

          {/* Churn Rate */}
          <Card className="@container/card border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Taxa de Perda
                  <InfoTooltip text="Leads perdidos ou desqualificados ÷ total de leads criados no período." />
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
                Leads perdidos ou desqualificados no período
              </CardAction>
            </CardFooter>
          </Card>
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}

