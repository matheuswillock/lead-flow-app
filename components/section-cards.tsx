"use client";

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TrendingDown, TrendingUp, Loader2 } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useUser } from '@/app/context/UserContext'

export function SectionCards() {
  const { user } = useUser();
  const { metrics, isLoading, error } = useDashboard(user?.supabaseId || null);

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar números
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  // Função para formatar porcentagem
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <CardDescription>Carregando...</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-2xl font-semibold">--</span>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Erro ao carregar dados</CardDescription>
            <CardTitle className="text-red-600">{error}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Total Revenue Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Receita Total</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(metrics.totalRevenue.value)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.totalRevenue.trend === "up" ? <TrendingUp /> : <TrendingDown />}
              {metrics.totalRevenue.trend === "up" ? "+" : "-"}{metrics.totalRevenue.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.totalRevenue.trend === "up" ? "Crescimento" : "Redução"} este mês{" "}
            {metrics.totalRevenue.trend === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Baseado em leads com valor definido
          </div>
        </CardFooter>
      </Card>

      {/* New Leads Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Novos Leads</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(metrics.newLeads.value)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.newLeads.trend === "up" ? <TrendingUp /> : <TrendingDown />}
              {metrics.newLeads.trend === "up" ? "+" : "-"}{metrics.newLeads.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.newLeads.trend === "up" ? "Aumento" : "Redução"} este período{" "}
            {metrics.newLeads.trend === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            {metrics.newLeads.trend === "up" ? "Boa captação de leads" : "Atenção necessária na captação"}
          </div>
        </CardFooter>
      </Card>

      {/* Active Leads Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Leads Ativos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(metrics.activeLeads.value)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.activeLeads.trend === "up" ? <TrendingUp /> : <TrendingDown />}
              {metrics.activeLeads.trend === "up" ? "+" : "-"}{metrics.activeLeads.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.activeLeads.trend === "up" ? "Pipeline crescendo" : "Pipeline reduzindo"}{" "}
            {metrics.activeLeads.trend === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">Leads em andamento no pipeline</div>
        </CardFooter>
      </Card>

      {/* Conversion Rate Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Taxa de Conversão</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatPercentage(metrics.conversionRate.value)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {metrics.conversionRate.trend === "up" ? <TrendingUp /> : <TrendingDown />}
              {metrics.conversionRate.trend === "up" ? "+" : "-"}{metrics.conversionRate.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {metrics.conversionRate.trend === "up" ? "Performance melhorando" : "Performance em queda"}{" "}
            {metrics.conversionRate.trend === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            {metrics.conversionRate.trend === "up" ? "Excelente resultado" : "Acompanhar de perto"}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
