'use client';

import { useDashboardContext } from '../context/DashboardContext';
import { DashboardCardsSkeleton } from '../components/DashboardSkeleton';
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
  Wallet
} from 'lucide-react';

export function SectionCardsWithContext() {
  const { metrics, isLoading, error } = useDashboardContext();

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

  return (
    <div className="space-y-6 px-4 lg:px-6">
      
      {/* SEÇÃO 1: MÉTRICAS PRINCIPAIS - Destaque Visual */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        
        {/* Receita Total - DESTAQUE */}
        <Card className="@container/card border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                💰 Receita Total
              </CardTitle>
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardDescription className="text-4xl font-bold text-foreground">
              R$ {metrics.receitaTotal.toLocaleString('pt-BR')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-green-600 dark:text-green-400">
              Total faturado no período
            </CardAction>
          </CardFooter>
        </Card>

        {/* Taxa de Conversão - DESTAQUE */}
        <Card className="@container/card border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/3 to-transparent shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                🎯 Taxa de Conversão
              </CardTitle>
              <div className="rounded-full bg-blue-500/10 p-2">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <CardDescription className="text-4xl font-bold text-foreground">
              {metrics.taxaConversao}%
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Agendamentos convertidos em vendas
            </CardAction>
          </CardFooter>
        </Card>

        {/* Cadência - DESTAQUE */}
        <Card className="@container/card border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-purple-500/3 to-transparent shadow-md @xl/main:col-span-2 @4xl/main:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                💼 Cadência
              </CardTitle>
              <div className="rounded-full bg-purple-500/10 p-2">
                <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <CardDescription className="text-4xl font-bold text-foreground">
              R$ {metrics.cadencia.toLocaleString('pt-BR')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-0">
            <CardAction className="text-xs font-medium text-purple-600 dark:text-purple-400">
              Valor total em pipeline
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
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-foreground">
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
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Negociação
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-foreground">
                {metrics.negociacao}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">
                Em negociação
              </CardAction>
            </CardFooter>
          </Card>

          {/* Implementação */}
          <Card className="@container/card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-cyan-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Implementação
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-foreground">
                {metrics.implementacao}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">
                Em implementação
              </CardAction>
            </CardFooter>
          </Card>

          {/* Vendas */}
          <Card className="@container/card border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Vendas
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics.vendas}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs font-medium text-green-600 dark:text-green-400">
                ✅ Concluídas
              </CardAction>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* SEÇÃO 3: INDICADORES DE PERFORMANCE */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">📈 Indicadores de Performance</h3>
        <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-2">
          
          {/* No-Show */}
          <Card className="@container/card border-amber-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  No-Show
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {metrics.noShowRate?.toFixed(1)}%
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <CardAction className="text-xs text-muted-foreground">
                Taxa de ausência
              </CardAction>
            </CardFooter>
          </Card>

          {/* Churn Rate */}
          <Card className="@container/card border-red-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Churn Rate
                </CardTitle>
              </div>
              <CardDescription className="text-2xl font-bold text-red-600 dark:text-red-400">
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
  );
}

