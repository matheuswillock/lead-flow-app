# Metrics API - Arquitetura Clean

## 🏗️ Estrutura da Aplicação

A API de métricas segue a arquitetura limpa com as seguintes camadas:

```
Route → UseCase → Service → Database
```

### 📁 Estrutura de Arquivos

```
app/api/
├── v1/dashboard/metrics/
│   ├── route.ts                    # GET /api/v1/dashboard/metrics
│   └── detailed/[managerId]/
│       └── route.ts                # GET /api/v1/dashboard/metrics/detailed/{managerId}
├── useCases/metrics/
│   ├── IMetricsUseCase.ts          # Interface do UseCase
│   └── MetricsUseCase.ts           # Implementação do UseCase
└── services/
    └── DashboardInfos.ts           # Lógica de negócio e queries
```

## 🔄 Fluxo de Dados

### 1. Route Layer (`route.ts`)
- **Responsabilidade**: Parsing de parâmetros HTTP, validação básica
- **Input**: `NextRequest`
- **Output**: `NextResponse` com `Output`

### 2. UseCase Layer (`MetricsUseCase.ts`)
- **Responsabilidade**: Orquestração da lógica de negócio, validações, criação do Output
- **Input**: DTOs tipados (`MetricsFilters`)
- **Output**: `Output` (sempre)

### 3. Service Layer (`DashboardInfosService.ts`)
- **Responsabilidade**: Lógica de negócio pura, queries complexas, cálculos
- **Input**: DTOs tipados (`DashboardFilters`)
- **Output**: DTOs tipados (`DashboardMetrics`)

## 📡 Endpoints

### 1. Dashboard Metrics
```http
GET /api/v1/dashboard/metrics?managerId={uuid}&period=30d&startDate=2024-01-01&endDate=2024-01-31
```

**Parâmetros:**
- `managerId` (obrigatório): UUID do manager
- `period` (opcional): `7d` | `30d` | `3m` | `6m` | `1y`
- `startDate` (opcional): Data de início (ISO string)
- `endDate` (opcional): Data de fim (ISO string)

**Resposta:**
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
    "leadsPorPeriodo": [...],
    "statusCount": {...}
  }
}
```

### 2. Detailed Status Metrics
```http
GET /api/v1/dashboard/metrics/detailed/{managerId}
```

**Resposta:**
```json
{
  "isValid": true,
  "successMessages": ["Métricas detalhadas carregadas com sucesso"],
  "errorMessages": [],
  "result": [
    {
      "status": "contract_finalized",
      "count": 5,
      "averageValue": 5000,
      "totalValue": 25000
    }
  ]
}
```

## 🎯 Principais Benefícios

### ✅ Separação de Responsabilidades
- **Route**: Apenas HTTP handling
- **UseCase**: Orquestração e validação de negócio
- **Service**: Lógica pura e queries

### ✅ Consistência de Output
- Todos os endpoints retornam o padrão `Output`
- UseCase é responsável por criar o Output correto
- Tratamento de erro centralizado

### ✅ Testabilidade
- Cada camada pode ser testada independentemente
- Mocking facilitado por interfaces
- Lógica de negócio isolada

### ✅ Reutilização
- Services podem ser reutilizados por múltiplos UseCases
- UseCases podem ser reutilizados por múltiplas Routes
- Interfaces facilitam diferentes implementações

## 🔧 Como Usar

### No Frontend:
```typescript
// Buscar métricas do dashboard
const response = await fetch(`/api/v1/dashboard/metrics?managerId=${userId}&period=30d`);
const data = await response.json();

if (data.isValid) {
  const metrics = data.result;
  // usar metrics...
} else {
  console.error(data.errorMessages);
}
```

### Adicionar Nova Métrica:
1. **Service**: Adicionar método no `DashboardInfosService`
2. **UseCase**: Adicionar método na interface e implementação
3. **Route**: Criar novo endpoint ou estender existente

## 🚀 Próximos Passos

1. **Testes Unitários**: Para cada camada
2. **Cache**: Implementar cache no UseCase
3. **Rate Limiting**: Adicionar na Route
4. **Monitoramento**: Logs estruturados em cada camada