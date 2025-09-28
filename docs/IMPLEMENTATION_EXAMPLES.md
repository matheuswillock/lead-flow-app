# 🔧 Lead Flow - Exemplos Práticos de Implementação

> Exemplos reais baseados no código existente do projeto

## 📚 Exemplos Baseados no Código Atual

### 1. Metrics API - Exemplo Completo

Este é um exemplo real implementado no projeto que segue perfeitamente a arquitetura.

#### Interface (`IMetricsUseCase.ts`)
```typescript
import type { Output } from "@/lib/output";

export interface MetricsFilters {
  managerId: string;
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
}

export interface IMetricsUseCase {
  getDashboardMetrics(filters: MetricsFilters): Promise<Output>;
  getDetailedStatusMetrics(managerId: string): Promise<Output>;
}
```

#### UseCase (`MetricsUseCase.ts`)
```typescript
import { Output } from "@/lib/output";
import { DashboardInfosService, DashboardFilters } from "@/app/api/services/DashboardInfos";
import type { IMetricsUseCase, MetricsFilters } from "./IMetricsUseCase";

export class MetricsUseCase implements IMetricsUseCase {
  
  async getDashboardMetrics(filters: MetricsFilters): Promise<Output> {
    try {
      // 1. Validação de entrada
      if (!filters.managerId) {
        return new Output(false, [], ['managerId é obrigatório'], null);
      }

      // 2. Converter para formato do Service
      const serviceFilters: DashboardFilters = {
        managerId: filters.managerId,
        period: filters.period || '30d',
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };

      // 3. Chamar Service
      const metrics = await DashboardInfosService.getDashboardMetrics(serviceFilters);

      // 4. Retornar Output de sucesso
      return new Output(
        true,
        ['Métricas do dashboard carregadas com sucesso'],
        [],
        metrics
      );

    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      
      return new Output(false, [], ['Erro interno do servidor ao buscar métricas'], null);
    }
  }
}

export const metricsUseCase = new MetricsUseCase();
```

#### Service (`DashboardInfos.ts`)
```typescript
import { prisma } from "@/app/api/infra/data/prisma";
import { LeadStatus } from "@prisma/client";

export class DashboardInfosService {
  
  static async getDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetrics> {
    // Query base com filtros
    const whereClause = {
      managerId: filters.managerId,
      ...(filters.startDate && filters.endDate && {
        createdAt: { gte: filters.startDate, lte: filters.endDate },
      }),
    };

    // Buscar dados do Prisma
    const leads = await prisma.lead.findMany({
      where: whereClause,
      select: { id: true, status: true, currentValue: true, createdAt: true },
    });

    // Processar e calcular métricas
    const metrics = this.calculateMetrics(leads);
    
    return metrics;
  }

  private static calculateMetrics(leads: any[]): DashboardMetrics {
    // Lógica complexa de cálculo aqui
    return {
      agendamentos: 0,
      vendas: 0,
      taxaConversao: 0,
      // ... outras métricas
    };
  }
}
```

#### Route (`/api/v1/dashboard/metrics/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { metricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import type { MetricsFilters } from '@/app/api/useCases/metrics/IMetricsUseCase';

export async function GET(request: NextRequest) {
  try {
    // 1. Parsing de parâmetros HTTP
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');
    const period = searchParams.get('period') as '7d' | '30d' | '3m' | '6m' | '1y' || '30d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 2. Montar filtros
    const filters: MetricsFilters = {
      managerId: managerId || '',
      period,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    };

    // 3. Chamar UseCase (que retorna Output)
    const result = await metricsUseCase.getDashboardMetrics(filters);

    // 4. Determinar status code baseado no Output
    const statusCode = result.isValid ? 200 : 400;
    
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route de métricas:', error);
    
    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}
```

### 2. Profile API - Exemplo Simplificado

Exemplo de UseCase que acessa Prisma diretamente.

#### Interface (`IProfileUseCase.ts`)
```typescript
import type { Output } from "@/lib/output";

export interface IProfileUseCase {
  getProfileBySupabaseId(supabaseId: string): Promise<Output>;
  updateProfile(supabaseId: string, updates: ProfileUpdateData): Promise<Output>;
}
```

#### UseCase (`ProfileUseCase.ts`)
```typescript
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileUseCase } from "./IProfileUseCase";

export class ProfileUseCase implements IProfileUseCase {
  
  async getProfileBySupabaseId(supabaseId: string): Promise<Output> {
    try {
      // Validação
      if (!supabaseId) {
        return new Output(false, [], ["Supabase ID é obrigatório"], null);
      }

      // Buscar diretamente no repositório (que usa Prisma)
      const profile = await profileRepository.findBySupabaseId(supabaseId);

      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      return new Output(true, ["Perfil encontrado com sucesso"], [], profile);
      
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }
}

export const profileUseCase = new ProfileUseCase();
```

## 🎯 Padrões de Resposta

### ✅ Sucesso
```json
{
  "isValid": true,
  "successMessages": ["Operação realizada com sucesso"],
  "errorMessages": [],
  "result": {
    "id": "123",
    "name": "Example"
  }
}
```

### ❌ Erro de Validação
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Campo obrigatório não informado"],
  "result": null
}
```

### ⚠️ Recurso Não Encontrado
```json
{
  "isValid": false,
  "successMessages": [],
  "errorMessages": ["Recurso não encontrado"],
  "result": null
}
```

## 🧪 Testes de API

### Usando cURL
```bash
# GET com filtros
curl -X GET "http://localhost:3000/api/v1/dashboard/metrics?managerId=uuid&period=30d"

# POST com dados
curl -X POST "http://localhost:3000/api/v1/profiles" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

### Usando Postman
O projeto já inclui collections Postman em `/postman/`:
- `Lead-API-Collection.json`
- `Profile-API-Collection.json`
- `Manager-User-API-Collection.json`

## 🔄 Fluxos de Implementação

### Para Features Simples
1. **Definir Interface**: Tipos e métodos
2. **Implementar UseCase**: Validação → Prisma → Output
3. **Criar Route**: Parsing → UseCase → HTTP Response

### Para Features Complexas
1. **Definir Interface**: Tipos e métodos
2. **Criar Service**: Lógica complexa e cálculos
3. **Implementar UseCase**: Validação → Service → Output
4. **Criar Route**: Parsing → UseCase → HTTP Response

## 📋 Checklist Específico

### ✅ Interface UseCase
- [ ] Extends da interface base se existir
- [ ] Métodos retornam `Promise<Output>`
- [ ] Tipos de entrada bem definidos
- [ ] Nomenclatura consistente

### ✅ Implementação UseCase
- [ ] Implements da interface
- [ ] Validações de entrada
- [ ] Try/catch adequado
- [ ] Retorna sempre Output
- [ ] Logs de erro com console.error
- [ ] Instância única exportada

### ✅ Service (se usado)
- [ ] Métodos estáticos
- [ ] Lógica pura (sem efeitos colaterais HTTP)
- [ ] Retorna dados tipados
- [ ] Separação de responsabilidades

### ✅ Route
- [ ] Apenas parsing HTTP
- [ ] Chama UseCase
- [ ] Status code baseado em Output.isValid
- [ ] Tratamento de erro genérico
- [ ] Não contém lógica de negócio

## 🚀 Comandos Úteis

```bash
# Testar APIs localmente
bun run dev

# Verificar tipos
bun run typecheck

# Executar linting
bun run lint

# Gerar Prisma Client
bun run prisma:generate

# Executar migrações
bun run prisma:migrate

# Abrir Prisma Studio
bun run prisma:studio
```

## 📖 Referências do Código

- **Metrics**: `/app/api/useCases/metrics/` - Exemplo completo com Service
- **Profiles**: `/app/api/useCases/profiles/` - Exemplo com Repository
- **Manager Users**: `/app/api/useCases/managerUser/` - Exemplo CRUD
- **Output Class**: `/lib/output/index.ts` - Classe padrão de retorno
- **Prisma Setup**: `/app/api/infra/data/prisma.ts` - Configuração do banco

---

💡 **Dica**: Use este documento como referência ao implementar novas features. Todos os exemplos são baseados no código real do projeto!