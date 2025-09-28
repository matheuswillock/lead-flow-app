# Dashboard Service - Documentação

## Componentes e Métricas

O serviço `DashboardInfosService` calcula as seguintes métricas baseadas nos status dos leads:

### 📊 Métricas Principais

| Métrica | Componentes (Status) | Descrição |
|---------|---------------------|-----------|
| **Agendamentos** | `scheduled` | Total de leads agendados |
| **Negociação** | `offerNegotiation` | Leads em negociação |
| **Implementação** | `offerSubmission` + `dps_agreement` + `invoicePayment` + `pending_documents` | Leads em processo de implementação |
| **Vendas** | `contract_finalized` | Leads com contrato finalizado |

### 📈 Métricas Calculadas

| Métrica | Fórmula | Formato |
|---------|---------|---------|
| **Taxa de Conversão** | `(vendas / agendamentos) * 100` | Porcentagem |
| **Receita Total** | Soma dos `currentValue` dos leads com status `contract_finalized` | Valor monetário |
| **Churn Rate** | `(operator_denied / vendas) * 100` | Porcentagem |

## 🎯 Mapeamento Status → Métricas

```typescript
const STATUS_GROUPS = {
  AGENDAMENTOS: ['scheduled'],
  NEGOCIACAO: ['offerNegotiation'], 
  IMPLEMENTACAO: [
    'offerSubmission',    // Proposta
    'dps_agreement',      // DPS | Contrato
    'invoicePayment',     // Boleto
    'pending_documents'   // Documentos pendentes
  ],
  VENDAS: ['contract_finalized'],
  CHURN: ['operator_denied'],
}
```

## 🔧 Como Usar

### 1. Métricas Básicas do Dashboard

```typescript
import { DashboardInfosService } from '@/app/api/services/DashboardInfos';

const metrics = await DashboardInfosService.getDashboardMetrics({
  managerId: 'uuid-do-manager',
  period: '30d', // '7d' | '30d' | '3m' | '6m' | '1y'
});

console.log({
  agendamentos: metrics.agendamentos,        // 15
  negociacao: metrics.negociacao,            // 8
  implementacao: metrics.implementacao,      // 12
  vendas: metrics.vendas,                    // 5
  taxaConversao: metrics.taxaConversao,      // 33.33%
  receitaTotal: metrics.receitaTotal,        // R$ 25.000,00
  churnRate: metrics.churnRate,              // 10%
});
```

### 2. API Endpoint

```bash
GET /api/v1/dashboard/metrics?managerId=uuid&period=30d
```

Resposta:
```json
{
  "isValid": true,
  "successMessages": ["Métricas do dashboard carregadas com sucesso"],
  "errorMessages": [],
  "result": {
    "agendamentos": 15,
    "negociacao": 8, 
    "implementacao": 12,
    "vendas": 5,
    "taxaConversao": 33.33,
    "receitaTotal": 25000.00,
    "churnRate": 10.00,
    "leadsPorPeriodo": [
      {"periodo": "2024-01-01", "total": 3},
      {"periodo": "2024-01-02", "total": 2}
    ],
    "statusCount": {
      "new_opportunity": 5,
      "scheduled": 15,
      "contract_finalized": 5,
      // ... outros status
    }
  }
}
```

### 3. Filtros por Data

```typescript
const metrics = await DashboardInfosService.getDashboardMetrics({
  managerId: 'uuid-do-manager',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});
```

### 4. Métricas Detalhadas por Status

```typescript
const detailedMetrics = await DashboardInfosService.getDetailedStatusMetrics('uuid-do-manager');

// Retorna:
// [
//   { 
//     status: 'contract_finalized', 
//     count: 5, 
//     averageValue: 5000, 
//     totalValue: 25000 
//   },
//   // ... outros status
// ]
```

## 📊 Componentes para o Dashboard

Para implementar no front-end, use estes componentes para cada métrica:

### Cards Principais
- **Total Revenue** → `receitaTotal`
- **New Customers** → `agendamentos` 
- **Active Accounts** → `implementacao`
- **Growth Rate** → `taxaConversao`

### Charts
- **Total Visitors** → `leadsPorPeriodo` (gráfico de linha)
- **Status Distribution** → `statusCount` (gráfico de barras/pizza)

### Indicadores
- 📈 **Taxa de Conversão**: `taxaConversao`%
- 📉 **Churn Rate**: `churnRate`%
- 💰 **Receita**: R$ `receitaTotal`
- 🎯 **Vendas**: `vendas` contratos

## ⚡ Otimizações

1. **Cache**: As consultas podem ser cacheadas por período
2. **Indexação**: Os campos `managerId`, `status`, `createdAt` são indexados
3. **Agregação**: Usa `groupBy` do Prisma para performance
4. **Filtros**: Suporte a filtros por data e período

## 🚀 Próximos Passos

1. Implementar cache Redis para métricas
2. Adicionar métricas por operador
3. Criar dashboard em tempo real com WebSockets
4. Implementar relatórios exportáveis (PDF/Excel)