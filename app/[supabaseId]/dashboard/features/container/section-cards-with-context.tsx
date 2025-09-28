'use client';

import { useDashboardContext } from '../context/DashboardContext';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SectionCardsWithContext() {
  const { metrics, isLoading, error } = useDashboardContext();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className="@container/card animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </CardHeader>
            <CardFooter className="pt-0">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
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

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      
      {/* Vendas */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vendas
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            {metrics.vendas}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Leads finalizados
          </CardAction>
        </CardFooter>
      </Card>

      {/* Agendamentos */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Agendamentos
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            {metrics.agendamentos}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Leads agendados
          </CardAction>
        </CardFooter>
      </Card>

      {/* Negociação */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Negociação
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            {metrics.negociacao}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Em negociação
          </CardAction>
        </CardFooter>
      </Card>

      {/* Taxa de Conversão */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Taxa de Conversão
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            {metrics.taxaConversao}%
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Agendamentos → Vendas
          </CardAction>
        </CardFooter>
      </Card>

      {/* Receita Total */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Receita Total
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            R$ {metrics.receitaTotal.toLocaleString('pt-BR')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Total faturado
          </CardAction>
        </CardFooter>
      </Card>

      {/* Implementação */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Implementação
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
            {metrics.implementacao}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-0">
          <CardAction className="text-xs text-muted-foreground">
            Em implementação
          </CardAction>
        </CardFooter>
      </Card>

      {/* Churn Rate */}
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Churn Rate
          </CardTitle>
          <CardDescription className="text-3xl font-bold text-foreground">
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
  );
}