# 📊 Metrics Repository - Refatoração para Arquitetura Clean

## 🏗️ Arquitetura Implementada

A implementação das métricas agora segue a arquitetura correta:

```
Route → UseCase → Service → Repository → Prisma
```

## 🆔 Parâmetro de Busca: supabaseId

**IMPORTANTE**: Todas as métricas são buscadas pelo `supabaseId` do usuário autenticado, não pelo `managerId`.

## 📁 Estrutura de Arquivos

```
app/api/
├── v1/dashboard/metrics/
│   └── route.ts                           # HTTP Layer
├── useCases/metrics/
│   ├── IMetricsUseCase.ts                # Business Interface
│   └── MetricsUseCase.ts                 # Business Logic
├── services/
│   └── DashboardInfos.ts                 # Domain Logic
└── infra/data/repositories/metrics/
    ├── IMetricsRepository.ts             # Data Interface
    └── MetricsRepository.ts              # Data Access Layer
```

## 🔄 Fluxo de Dados Atual

### 1. Route (`/api/v1/dashboard/metrics/route.ts`)
- Parsing de parâmetros HTTP
- Chama `metricsUseCase.getDashboardMetrics()`

### 2. UseCase (`MetricsUseCase.ts`)
- Validações de entrada
- Orquestração da lógica
- Chama `DashboardInfosService.getDashboardMetrics()`
- Retorna `Output`

### 3. Service (`DashboardInfos.ts`)
- Lógica de negócio complexa
- Cálculos e transformações
- Chama `metricsRepository` para acesso aos dados
- Retorna dados tipados

### 4. Repository (`MetricsRepository.ts`)
- **ÚNICA camada que acessa Prisma**
- Queries específicas para métricas
- Retorna dados brutos do banco

## 📋 Métodos do Repository

### `findLeadsForMetrics(filters: MetricsFilters)`
```typescript
// Busca leads básicos para cálculo de métricas
const leads = await metricsRepository.findLeadsForMetrics({
  supabaseId: 'uuid-from-auth',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});
```

### `getStatusMetrics(supabaseId: string)`
```typescript
// Busca métricas agrupadas por status
const statusMetrics = await metricsRepository.getStatusMetrics('supabase-uuid');
```

### `getLeadsByPeriod(supabaseId, startDate, endDate)`
```typescript
// Busca leads agrupados por período
const periodData = await metricsRepository.getLeadsByPeriod(
  'supabase-uuid', 
  startDate, 
  endDate
);
```

## 🎯 Benefícios da Refatoração

### ✅ Separação de Responsabilidades
- **Repository**: Apenas acesso a dados (Prisma)
- **Service**: Lógica de negócio e cálculos
- **UseCase**: Orquestração e validações
- **Route**: HTTP handling

### ✅ Testabilidade Melhorada
- Repository pode ser mockado facilmente
- Service testável sem dependência do banco
- UseCase testável com Service mockado

### ✅ Reutilização
- Repository pode ser usado por outros Services
- Queries centralizadas e consistentes
- Interface clara para acesso aos dados

### ✅ Manutenibilidade
- Mudanças no banco ficam isoladas no Repository
- Lógica de negócio fica no Service
- Fácil identificação de responsabilidades

## 🔧 Exemplo de Uso

```typescript
// Service usa Repository
export class DashboardInfosService {
  static async getDashboardMetrics(filters: DashboardFilters) {
    // 1. Buscar dados via Repository
    const leads = await metricsRepository.findLeadsForMetrics({
      managerId: filters.managerId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // 2. Processar dados (lógica de negócio)
    const statusCount = this.processStatusCount(leads);
    const metrics = this.calculateMetrics(statusCount);

    return metrics;
  }
}
```

## 📊 Tipos de Dados

### `LeadMetricsData`
```typescript
interface LeadMetricsData {
  id: string;
  status: LeadStatus;
  currentValue: any; // Prisma Decimal
  createdAt: Date;
}
```

### `StatusMetricsData`
```typescript
interface StatusMetricsData {
  status: LeadStatus;
  _count: { id: number };
  _avg: { currentValue: any };
  _sum: { currentValue: any };
}
```

## 🚀 Próximos Passos

1. **Testes Unitários**: Criar testes para o Repository
2. **Performance**: Otimizar queries se necessário
3. **Cache**: Implementar cache no Service se necessário
4. **Monitoring**: Adicionar logs estruturados

---

💡 **Importante**: Todo acesso ao Prisma deve ser feito APENAS através do Repository. O Service não deve acessar Prisma diretamente.