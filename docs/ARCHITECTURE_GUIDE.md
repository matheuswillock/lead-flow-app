# 🏗️ Lead Flow - Guia de Arquitetura para IA/Copilot

> Documento de referência para implementações consistentes seguindo Clean Architecture

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral)
2. [Estrutura de Camadas](#estrutura-de-camadas)
3. [Padrões de Implementação](#padrões-de-implementação)
4. [Guia Passo a Passo](#guia-passo-a-passo)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Convenções e Padrões](#convenções-e-padrões)
7. [Checklist de Implementação](#checklist)

## 🎯 Visão Geral

O **Lead Flow** segue os princípios da **Clean Architecture** com separação clara de responsabilidades:

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   Route     │───▶│   UseCase    │───▶│    Service      │───▶│   Prisma     │
│ (HTTP Layer)│    │ (Business)   │    │ (Domain Logic)  │    │ (Database)   │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
```

### 🔄 Fluxos Suportados

1. **Completo**: `Route → UseCase → Service → Prisma`
2. **Simplificado**: `Route → UseCase → Prisma`

### 📦 Tipo de Retorno Padrão

Todas as APIs retornam o tipo `Output`:

```typescript
class Output {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: any;
}
```

## 🏛️ Estrutura de Camadas

### 📁 Organização de Arquivos

```
app/api/
├── v1/                           # Routes (HTTP Layer)
│   └── [feature]/
│       ├── route.ts             # Route principal
│       └── [id]/route.ts        # Route com parâmetros
├── useCases/                    # Business Logic Layer
│   └── [feature]/
│       ├── I[Feature]UseCase.ts # Interface
│       └── [Feature]UseCase.ts  # Implementação
└── services/                    # Domain Logic Layer (opcional)
    └── [Feature]Service.ts      # Lógica complexa
```

### 🎯 Responsabilidades por Camada

| Camada | Responsabilidade | Input | Output |
|--------|------------------|-------|--------|
| **Route** | • Parsing HTTP<br>• Validação de parâmetros<br>• Status codes | `NextRequest` | `NextResponse` |
| **UseCase** | • Orquestração<br>• Validação de negócio<br>• **Criação do Output** | DTOs tipados | `Output` |
| **Service** | • Lógica complexa<br>• Cálculos<br>• Transformações | DTOs tipados | DTOs tipados |
| **Prisma** | • Acesso a dados<br>• Queries<br>• Transações | Queries | Dados brutos |

## 🛠️ Padrões de Implementação

### 1. Interface do UseCase

```typescript
// app/api/useCases/[feature]/I[Feature]UseCase.ts
import type { Output } from "@/lib/output";

export interface [Feature]Filters {
  // Definir tipos de filtros
}

export interface I[Feature]UseCase {
  create[Feature](data: Create[Feature]DTO): Promise<Output>;
  get[Feature]ById(id: string): Promise<Output>;
  update[Feature](id: string, data: Update[Feature]DTO): Promise<Output>;
  delete[Feature](id: string): Promise<Output>;
  list[Feature](filters: [Feature]Filters): Promise<Output>;
}
```

### 2. Implementação do UseCase

```typescript
// app/api/useCases/[feature]/[Feature]UseCase.ts
import { Output } from "@/lib/output";
import type { I[Feature]UseCase } from "./I[Feature]UseCase";

export class [Feature]UseCase implements I[Feature]UseCase {
  
  async create[Feature](data: Create[Feature]DTO): Promise<Output> {
    try {
      // 1. Validações de entrada
      if (!data.requiredField) {
        return new Output(
          false,
          [],
          ['Campo obrigatório não informado'],
          null
        );
      }

      // 2. Chamar Service (se existir) ou Prisma diretamente
      const result = await [Feature]Service.create(data);
      // OU
      const result = await prisma.[feature].create({ data });

      // 3. Retornar Output de sucesso
      return new Output(
        true,
        ['[Feature] criado com sucesso'],
        [],
        result
      );

    } catch (error) {
      console.error('Erro ao criar [feature]:', error);
      
      return new Output(
        false,
        [],
        ['Erro interno do servidor'],
        null
      );
    }
  }
}

// Instância única
export const [feature]UseCase = new [Feature]UseCase();
```

### 3. Service (Opcional)

```typescript
// app/api/services/[Feature]Service.ts
import { prisma } from "@/app/api/infra/data/prisma";

export class [Feature]Service {
  
  static async complexCalculation(data: any) {
    // Lógica complexa aqui
    const result = await prisma.[feature].aggregate({
      // queries complexas
    });
    
    return this.transformData(result);
  }
  
  private static transformData(data: any) {
    // Transformações de dados
    return data;
  }
}
```

### 4. Route

```typescript
// app/api/v1/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { [feature]UseCase } from '@/app/api/useCases/[feature]/[Feature]UseCase';
import type { [Feature]Filters } from '@/app/api/useCases/[feature]/I[Feature]UseCase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parsing de parâmetros
    const filters: [Feature]Filters = {
      // extrair parâmetros da query
    };

    // Chamar UseCase
    const result = await [feature]UseCase.list[Feature](filters);

    // Determinar status code
    const statusCode = result.isValid ? 200 : 400;
    
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route:', error);
    
    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Chamar UseCase
    const result = await [feature]UseCase.create[Feature](body);

    const statusCode = result.isValid ? 201 : 400;
    
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route:', error);
    
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

## 📝 Guia Passo a Passo

### 🚀 Implementando uma Nova Feature

#### Passo 1: Definir a Interface do UseCase
```bash
# Criar arquivo
touch app/api/useCases/[feature]/I[Feature]UseCase.ts
```

#### Passo 2: Implementar o UseCase
```bash
# Criar arquivo
touch app/api/useCases/[feature]/[Feature]UseCase.ts
```

#### Passo 3: Criar Service (se necessário)
```bash
# Apenas para lógicas complexas
touch app/api/services/[Feature]Service.ts
```

#### Passo 4: Implementar Routes
```bash
# Route principal
touch app/api/v1/[feature]/route.ts

# Routes com parâmetros (se necessário)
touch app/api/v1/[feature]/[id]/route.ts
```

#### Passo 5: Testar e Documentar
```bash
# Adicionar no Postman collection
# Criar README específico se necessário
```

## 📚 Exemplos Práticos

### Exemplo 1: Feature Simples (Route → UseCase → Prisma)

```typescript
// Interface
export interface IUserUseCase {
  getUserById(id: string): Promise<Output>;
}

// UseCase
export class UserUseCase implements IUserUseCase {
  async getUserById(id: string): Promise<Output> {
    try {
      if (!id) {
        return new Output(false, [], ['ID é obrigatório'], null);
      }

      const user = await prisma.user.findUnique({
        where: { id }
      });

      if (!user) {
        return new Output(false, [], ['Usuário não encontrado'], null);
      }

      return new Output(true, ['Usuário encontrado'], [], user);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return new Output(false, [], ['Erro interno'], null);
    }
  }
}

// Route
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await userUseCase.getUserById(params.id);
  const statusCode = result.isValid ? 200 : 404;
  return NextResponse.json(result, { status: statusCode });
}
```

### Exemplo 2: Feature Complexa (Route → UseCase → Service → Prisma)

```typescript
// Service
export class MetricsService {
  static async calculateDashboardMetrics(filters: MetricsFilters) {
    const leads = await prisma.lead.findMany({
      where: { managerId: filters.managerId }
    });

    return {
      totalLeads: leads.length,
      conversion: this.calculateConversion(leads),
      revenue: this.calculateRevenue(leads)
    };
  }
}

// UseCase
export class MetricsUseCase implements IMetricsUseCase {
  async getDashboardMetrics(filters: MetricsFilters): Promise<Output> {
    try {
      if (!filters.managerId) {
        return new Output(false, [], ['Manager ID obrigatório'], null);
      }

      const metrics = await MetricsService.calculateDashboardMetrics(filters);

      return new Output(true, ['Métricas calculadas'], [], metrics);
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      return new Output(false, [], ['Erro interno'], null);
    }
  }
}
```

## 📐 Convenções e Padrões

### 🏷️ Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| **Interface UseCase** | `I[Feature]UseCase` | `IMetricsUseCase` |
| **Implementação UseCase** | `[Feature]UseCase` | `MetricsUseCase` |
| **Service** | `[Feature]Service` | `MetricsService` |
| **DTOs** | `[Action][Feature]DTO` | `CreateLeadDTO` |
| **Filters** | `[Feature]Filters` | `MetricsFilters` |
| **Route Arquivos** | `route.ts` | sempre `route.ts` |

### 🎯 Boas Práticas

#### ✅ Faça
- Use interfaces para UseCases
- Retorne sempre `Output` nos UseCases
- Valide entrada nos UseCases
- Use console.error para logs de erro
- Mantenha Routes simples (apenas HTTP handling)
- Use Services para lógica complexa
- Crie instâncias únicas dos UseCases

#### ❌ Não Faça
- Não coloque lógica de negócio nas Routes
- Não retorne dados brutos nas Routes
- Não use try/catch nas Routes para lógica de negócio
- Não acesse Prisma diretamente nas Routes
- Não misture responsabilidades entre camadas

### 🧪 Padrões de Validação

```typescript
// Validação simples
if (!data.requiredField) {
  return new Output(false, [], ['Campo obrigatório'], null);
}

// Validação múltipla
const errors = [];
if (!data.name) errors.push('Nome é obrigatório');
if (!data.email) errors.push('Email é obrigatório');

if (errors.length > 0) {
  return new Output(false, [], errors, null);
}

// Validação com Zod (recomendado)
const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido')
});

const validation = schema.safeParse(data);
if (!validation.success) {
  const errors = validation.error.errors.map(e => e.message);
  return new Output(false, [], errors, null);
}
```

## ✅ Checklist de Implementação

### 📋 Antes de Começar
- [ ] Definir se precisa de Service ou UseCase direto
- [ ] Identificar DTOs necessários
- [ ] Mapear validações de entrada
- [ ] Definir estrutura de resposta

### 🏗️ Durante a Implementação
- [ ] Criar interface do UseCase
- [ ] Implementar UseCase com Output
- [ ] Criar Service (se necessário)
- [ ] Implementar Routes
- [ ] Adicionar validações
- [ ] Tratar erros adequadamente

### 🧪 Após Implementação
- [ ] Testar todos os endpoints
- [ ] Verificar tipos TypeScript
- [ ] Validar padrão de resposta Output
- [ ] Documentar se necessário
- [ ] Adicionar ao Postman collection

### 🔍 Review Final
- [ ] Routes só fazem HTTP handling
- [ ] UseCases retornam Output
- [ ] Validações estão nos UseCases
- [ ] Erros são tratados adequadamente
- [ ] Nomenclatura segue padrões
- [ ] Responsabilidades estão separadas

## 🎯 Prompt Sugerido para IA/Copilot

```
Implemente uma nova feature seguindo a arquitetura do Lead Flow:

REQUISITOS:
- Seguir padrão: Route → UseCase → [Service] → Prisma
- UseCase deve retornar sempre Output da lib/output
- Usar interfaces para UseCases
- Routes apenas HTTP handling
- Validações nos UseCases
- Nomenclatura: I[Feature]UseCase, [Feature]UseCase, [Feature]Service

ESTRUTURA:
1. Interface: app/api/useCases/[feature]/I[Feature]UseCase.ts
2. Implementação: app/api/useCases/[feature]/[Feature]UseCase.ts  
3. Service (opcional): app/api/services/[Feature]Service.ts
4. Route: app/api/v1/[feature]/route.ts

EXEMPLO DE OUTPUT:
return new Output(true, ['Sucesso'], [], data);
return new Output(false, [], ['Erro'], null);

Feature solicitada: [DESCREVER AQUI]
```

---

📚 **Referências do Projeto:**
- [Metrics UseCase](app/api/useCases/metrics/) - Exemplo completo
- [Profile UseCase](app/api/useCases/profiles/) - Exemplo com Service
- [Output Class](lib/output/index.ts) - Tipo padrão de retorno