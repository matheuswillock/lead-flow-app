# Dashboard API Documentation

## Visão Geral

A Dashboard API foi implementada para fornecer métricas em tempo real baseadas nos dados do pipeline de leads. A API calcula estatísticas como receita total, novos leads, leads ativos, taxa de conversão e tendências mensais.

## Arquitetura

### Backend Structure

```
app/api/useCases/dashboard/
├── IDashboardUseCase.ts      # Interface e tipos TypeScript
├── DashboardUseCase.ts       # Lógica de negócio e cálculos
└── /api/v1/dashboard/[supabaseId]/metrics/route.ts  # Endpoint HTTP

hooks/
└── useDashboard.ts           # Hook React para frontend

components/
├── section-cards.tsx         # Cards de métricas principais
└── chart-area-interactive.tsx # Gráfico de tendências
```

### Fluxo de Dados

1. **Frontend** → Hook `useDashboard` 
2. **Hook** → API `/api/v1/dashboard/[supabaseId]/metrics`
3. **API** → `DashboardUseCase.calculateMetrics()`
4. **UseCase** → `LeadRepository` + `ProfileRepository`
5. **Repositories** → Prisma ORM → PostgreSQL

## API Reference

### GET `/api/v1/dashboard/[supabaseId]/metrics`

Retorna métricas calculadas para um usuário específico.

#### Parâmetros

- `supabaseId` (string): ID do usuário no Supabase

#### Response

```typescript
interface DashboardMetrics {
  totalRevenue: {
    value: number;          // Receita total em R$
    previousValue: number;  // Valor do período anterior
    trend: "up" | "down";   // Tendência
    percentage: number;     // Variação percentual
  };
  newLeads: {
    value: number;          // Novos leads do período
    previousValue: number;  // Leads do período anterior
    trend: "up" | "down";   // Tendência
    percentage: number;     // Variação percentual
  };
  activeLeads: {
    value: number;          // Leads ativos no pipeline
    previousValue: number;  // Leads ativos anteriormente
    trend: "up" | "down";   // Tendência
    percentage: number;     // Variação percentual
  };
  conversionRate: {
    value: number;          // Taxa de conversão %
    previousValue: number;  // Taxa anterior
    trend: "up" | "down";   // Tendência
    percentage: number;     // Variação percentual
  };
  leadsByStatus: {
    [status: string]: number; // Contagem por status
  };
  monthlyTrend: {
    month: string;          // YYYY-MM format
    value: number;          // Número de leads no mês
  }[];
  topPerformers: {
    id: string;             // ID do usuário
    name: string;           // Nome do usuário
    leads: number;          // Total de leads
    conversions: number;    // Total de conversões
  }[];
}
```

#### Exemplo de Response

```json
{
  "isValid": true,
  "result": {
    "totalRevenue": {
      "value": 25000.00,
      "previousValue": 20000.00,
      "trend": "up",
      "percentage": 25.0
    },
    "newLeads": {
      "value": 45,
      "previousValue": 38,
      "trend": "up", 
      "percentage": 18.4
    },
    "activeLeads": {
      "value": 120,
      "previousValue": 115,
      "trend": "up",
      "percentage": 4.3
    },
    "conversionRate": {
      "value": 15.5,
      "previousValue": 12.8,
      "trend": "up",
      "percentage": 21.1
    },
    "leadsByStatus": {
      "NEW": 25,
      "QUALIFIED": 30,
      "PROPOSAL": 15,
      "CLOSED_WON": 8,
      "CLOSED_LOST": 12
    },
    "monthlyTrend": [
      { "month": "2024-10", "value": 35 },
      { "month": "2024-11", "value": 42 },
      { "month": "2024-12", "value": 45 }
    ],
    "topPerformers": [
      {
        "id": "user-1",
        "name": "João Silva",
        "leads": 25,
        "conversions": 8
      }
    ]
  }
}
```

## Frontend Integration

### Hook Usage

```typescript
import { useDashboard } from '@/hooks/useDashboard';
import { useUser } from '@/app/context/UserContext';

function DashboardComponent() {
  const { user } = useUser();
  const { metrics, isLoading, error, refetch } = useDashboard(user?.supabaseId);
  
  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;
  
  return (
    <div>
      <h1>Receita: R$ {metrics.totalRevenue.value}</h1>
      <p>Tendência: {metrics.totalRevenue.trend}</p>
    </div>
  );
}
```

### Components

#### SectionCards
- Exibe 4 cards principais com métricas
- Formatação automática de valores monetários
- Indicadores visuais de tendência
- Estados de loading e erro

#### ChartAreaInteractive  
- Gráfico de área interativo
- Filtragem por período (7d, 30d, 90d)
- Dados de tendência mensal
- Tooltip com formatação local (pt-BR)

## Cálculos de Métricas

### Receita Total
- Soma de `leadValue` para leads com status `CLOSED_WON`
- Comparação com período anterior de igual duração

### Novos Leads
- Contagem de leads criados nos últimos 30 dias
- Comparação com 30 dias anteriores

### Leads Ativos
- Leads com status diferente de `CLOSED_WON` e `CLOSED_LOST`
- Comparação com snapshot do período anterior

### Taxa de Conversão
- (Leads convertidos / Total de leads) * 100
- Baseado em leads dos últimos 30 dias

### Tendência Mensal
- Agrupamento por mês de criação
- Últimos 6 meses de dados
- Usado para gráfico de tendências

## Permissões e Segurança

- Dados filtrados por `managerId` ou próprio `supabaseId`
- Validação de autenticação via contexto de usuário
- Managers veem dados de toda a equipe
- Operators veem apenas seus próprios dados

## Testes

Execute o script de teste:

```bash
./scripts/test-dashboard.sh
```

## Limitações Atuais

1. **Cache**: Não há cache implementado, cálculos são feitos a cada requisição
2. **Performance**: Para grandes volumes, pode ser necessária otimização
3. **Real-time**: Dados não são atualizados automaticamente (requires manual refresh)

## Melhorias Futuras

1. **Cache Redis**: Implementar cache para otimizar performance
2. **WebSockets**: Real-time updates usando Supabase Realtime
3. **Filtros**: Adicionar filtros por período, status, vendedor
4. **Drill-down**: Permitir análise detalhada por clique nos gráficos
5. **Export**: Funcionalidade de export para Excel/PDF