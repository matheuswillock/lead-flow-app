---
applyTo: '**'
---
# 🤖 Prompts para IA/Copilot - Lead Flow

> Prompts otimizados para implementações consistentes na arquitetura Lead Flow

## 📋 Índice

### 🔧 Backend/API
1. [Prompt Principal para Novas Features](#-prompt-principal-para-novas-features)
2. [Prompts Específicos por Tipo](#-prompts-específicos-por-tipo)
3. [Prompts para Correções](#-prompts-para-correções)

### 🎨 Frontend/Components  
4. [Prompts para Frontend/Components](#-prompts-para-frontendcomponents)
5. [Prompt Completo para Novo Componente](#-prompt-completo-para-novo-componente-frontend)

### 📝 Documentação & Testes
6. [Prompts para Documentação](#-prompts-para-documentação)
7. [Prompts para Testes](#-prompts-para-testes)
8. [Prompt para Review de Code](#-prompt-para-review-de-code)

### 📋 Utilitários
9. [Checklist de Prompt](#-checklist-de-prompt)

---

## 🎯 Prompt Principal para Novas Features

```
Implemente uma nova feature seguindo a arquitetura do Lead Flow App:

ARQUITETURA OBRIGATÓRIA:
- Route → UseCase → [Service opcional] → Prisma
- UseCase SEMPRE retorna Output (from @/lib/output)
- Routes fazem apenas HTTP handling
- Validações nos UseCases
- Usar interfaces para contratos

ESTRUTURA DE ARQUIVOS:
1. app/api/useCases/[feature]/I[Feature]UseCase.ts (interface)
2. app/api/useCases/[feature]/[Feature]UseCase.ts (implementação)
3. app/api/services/[Feature]Service.ts (opcional, para lógica complexa)
4. app/api/v1/[feature]/route.ts (HTTP endpoints)

PADRÃO OUTPUT OBRIGATÓRIO:
```typescript
return new Output(
  true,  // isValid: boolean
  ['Mensagem de sucesso'],  // successMessages: string[]
  [],  // errorMessages: string[]
  data  // result: any
);
```

EXEMPLO DE USECASE:
```typescript
export class [Feature]UseCase implements I[Feature]UseCase {
  async create[Feature](data: any): Promise<Output> {
    try {
      // Validações
      if (!data.required) {
        return new Output(false, [], ['Campo obrigatório'], null);
      }
      
      // Lógica (Service ou Prisma direto)
      const result = await prisma.[feature].create({ data });
      
      return new Output(true, ['Criado com sucesso'], [], result);
    } catch (error) {
      console.error('Erro:', error);
      return new Output(false, [], ['Erro interno'], null);
    }
  }
}
```

FEATURE SOLICITADA: [DESCREVER AQUI]
```

## 🎯 Prompts Específicos por Tipo

### 1. Feature CRUD Simples
```
Crie uma API CRUD completa para [ENTITY] seguindo a arquitetura Lead Flow:

REQUISITOS:
- Interface I[Entity]UseCase com métodos: create, getById, update, delete, list
- UseCase implementando a interface
- Routes GET, POST, PUT, DELETE
- Validações básicas
- Filtros para listagem
- Output pattern obrigatório

CAMPOS DA ENTIDADE:
[LISTAR CAMPOS]

VALIDAÇÕES NECESSÁRIAS:
[LISTAR VALIDAÇÕES]
```

### 2. Feature com Service Complexo
```
Implemente [FEATURE] com lógica complexa seguindo arquitetura Lead Flow:

ARQUITETURA:
Route → UseCase → Service → Prisma

RESPONSABILIDADES:
- Service: Cálculos complexos, transformações, agregações
- UseCase: Orquestração, validações, Output
- Route: HTTP handling apenas

LÓGICA COMPLEXA NECESSÁRIA:
[DESCREVER LÓGICA]

DADOS DE ENTRADA:
[DESCREVER INPUTS]

DADOS DE SAÍDA:
[DESCREVER OUTPUTS]
```

### 3. Feature de Relatórios/Analytics
```
Crie API de relatórios/analytics para [DOMAIN] seguindo Lead Flow:

ARQUITETURA OBRIGATÓRIA:
Route → UseCase → Service → Prisma (com agregações)

MÉTRICAS NECESSÁRIAS:
[LISTAR MÉTRICAS]

FILTROS:
[LISTAR FILTROS]

PERÍODO DE DADOS:
[DEFINIR PERÍODOS]

USAR COMO REFERÊNCIA:
/app/api/useCases/metrics/ (implementação existente)
```

## 🔧 Prompts para Correções

### 1. Migrar de Service Direto para UseCase
```
PROBLEMA: Esta route está chamando Service diretamente
SOLUÇÃO: Migrar para arquitetura correta Route → UseCase → Service

ARQUIVO ATUAL: [PATH]

REQUISITOS DA MIGRAÇÃO:
1. Criar I[Feature]UseCase interface
2. Criar [Feature]UseCase implementação
3. UseCase deve retornar Output
4. Route deve chamar UseCase
5. Manter lógica do Service intacta

MANTER COMPATIBILIDADE com responses existentes
```

### 2. Adicionar Validações Missing
```
PROBLEMA: UseCase sem validações adequadas
ARQUIVO: [PATH]

ADICIONAR VALIDAÇÕES:
1. Campos obrigatórios
2. Formatos de dados
3. Regras de negócio
4. Retornar Output com errorMessages apropriados

USAR PADRÃO:
```typescript
if (!data.field) {
  return new Output(false, [], ['Campo obrigatório'], null);
}
```
```

### 3. Corrigir Output Pattern
```
PROBLEMA: UseCase não retorna Output ou retorna formato incorreto
ARQUIVO: [PATH]

CORREÇÃO OBRIGATÓRIA:
- TODOS os métodos devem retornar Promise<Output>
- Usar: new Output(isValid, successMessages, errorMessages, result)
- Import: from "@/lib/output"

EXEMPLOS:
- Sucesso: new Output(true, ['Sucesso'], [], data)
- Erro: new Output(false, [], ['Erro'], null)
```

## 📝 Prompts para Documentação

### 1. Documentar Nova API
```
Crie documentação completa para a API [FEATURE] seguindo padrão Lead Flow:

INCLUIR:
1. Endpoints disponíveis
2. Parâmetros de entrada
3. Formato de resposta (Output pattern)
4. Exemplos de uso
5. Códigos de status HTTP
6. Possíveis erros

FORMATO: README.md na pasta da feature
REFERÊNCIA: /app/api/useCases/metrics/README.md
```

### 2. Atualizar Postman Collection
```
Atualize a collection Postman para incluir novos endpoints da feature [FEATURE]:

ENDPOINTS:
[LISTAR ENDPOINTS]

INCLUIR:
- Headers necessários
- Body examples
- Environment variables
- Tests básicos para status codes

ARQUIVO: /postman/[Feature]-API-Collection.json
```

## 🎨 Prompts para Frontend/Components

### 1. Novo Componente/Página Completa
```
Crie um novo componente frontend seguindo a arquitetura Lead Flow:

ESTRUTURA OBRIGATÓRIA:
app/[supabaseId]/[feature]/
├── page.tsx                     # Página principal
└── features/
    ├── container/               # Componentes de apresentação
    │   ├── [Feature]Container.tsx
    │   ├── [Feature]Dialog.tsx
    │   ├── [Feature]Header.tsx
    │   └── [Feature]Footer.tsx
    ├── context/                 # Context API (SOLID)
    │   ├── [Feature]Types.ts    # Interfaces e tipos
    │   ├── [Feature]Hook.ts     # Lógica de negócio
    │   └── [Feature]Context.tsx # Provider e Context
    ├── services/                # Camada de serviço
    │   ├── I[Feature]Service.ts # Interface do serviço
    │   └── [Feature]Service.ts  # Implementação
    └── hooks/                   # Custom hooks (opcional)
        └── use[Feature].ts

PADRÕES OBRIGATÓRIOS:
- Context seguindo SOLID (Types → Hook → Context)
- useParams para extrair supabaseId
- Estados de loading/error
- TypeScript completo
- Separação de responsabilidades

FEATURE SOLICITADA: [DESCREVER AQUI]
FUNCIONALIDADES: [LISTAR FUNCIONALIDADES]
```

### 2. Context SOLID Pattern
```
Implemente Context seguindo padrão SOLID para [FEATURE]:

ARQUITETURA OBRIGATÓRIA:
1. [Feature]Types.ts - Definições de tipos
2. [Feature]Hook.ts - Lógica de negócio com useCallback
3. [Feature]Context.tsx - Provider com useParams

TIPOS NECESSÁRIOS:
- I[Feature]State: estado do contexto
- I[Feature]Actions: ações disponíveis  
- I[Feature]Context: contexto completo
- [Feature]ContextType: tipo do provider

HOOK PATTERN:
```typescript
export function use[Feature]Hook({ 
  supabaseId, 
  service, 
  initialData 
}: Use[Feature]HookProps): Use[Feature]HookReturn {
  const [state, setState] = useState(initialState);
  
  const action = useCallback(async () => {
    // lógica com service
  }, [dependencies]);
  
  return { ...state, action };
}
```

CONTEXT PATTERN:
```typescript
export const [Feature]Provider: React.FC<I[Feature]ProviderProps> = ({
  children,
  initialData
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  
  const contextState = use[Feature]Hook({
    supabaseId,
    service: [feature]Service,
    initialData
  });
  
  return (
    <[Feature]Context.Provider value={contextState}>
      {children}
    </[Feature]Context.Provider>
  );
};
```

REFERÊNCIA: /app/[supabaseId]/dashboard/features/context/
```

### 3. Service Frontend Pattern
```
Crie Service para frontend da feature [FEATURE]:

RESPONSABILIDADES:
- Chamadas para API
- Transformação de dados
- Cache local (opcional)
- Tratamento de erros

INTERFACE PATTERN:
```typescript
export interface I[Feature]Service {
  get[Feature]s(filters: [Feature]Filters): Promise<[Feature][]>;
  get[Feature]ById(id: string): Promise<[Feature] | null>;
  create[Feature](data: Create[Feature]DTO): Promise<[Feature]>;
  update[Feature](id: string, data: Update[Feature]DTO): Promise<[Feature]>;
  delete[Feature](id: string): Promise<boolean>;
}
```

IMPLEMENTAÇÃO PATTERN:
```typescript
export class [Feature]Service implements I[Feature]Service {
  private baseUrl = '/api/v1/[feature]';
  
  async get[Feature]s(filters: [Feature]Filters): Promise<[Feature][]> {
    const params = new URLSearchParams(filters as any);
    const response = await fetch(`${this.baseUrl}?${params}`);
    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }
}

export const [feature]Service = new [Feature]Service();
```
```

### 4. Componente Container Pattern
```
Crie componentes container para [FEATURE] seguindo padrões:

ESTRUTURA:
1. [Feature]Container.tsx - Container principal
2. [Feature]Header.tsx - Cabeçalho com ações
3. [Feature]Dialog.tsx - Modal/Dialog
4. [Feature]Card.tsx - Card individual
5. [Feature]List.tsx - Lista de itens

CONTAINER PATTERN:
```typescript
'use client';

import { use[Feature]Context } from '../context/[Feature]Context';

export function [Feature]Container() {
  const { 
    items, 
    isLoading, 
    error, 
    fetchItems, 
    createItem 
  } = use[Feature]Context();

  if (isLoading) {
    return <[Feature]Skeleton />;
  }

  if (error) {
    return <[Feature]Error error={error} onRetry={fetchItems} />;
  }

  return (
    <div className="space-y-6">
      <[Feature]Header onAdd={createItem} />
      <[Feature]List items={items} />
    </div>
  );
}
```

USAR PADRÕES:
- Shadcn/ui components
- Loading states com skeleton
- Error boundaries
- Responsividade
```

### 5. Página Principal Pattern
```
Crie page.tsx para [FEATURE] seguindo arquitetura:

PATTERN OBRIGATÓRIO:
```typescript
import { [Feature]Provider } from './features/context/[Feature]Context';
import { [Feature]Container } from './features/container/[Feature]Container';

export default function [Feature]Page() {
  return (
    <[Feature]Provider>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">[Feature Title]</h1>
          <div className="text-sm text-muted-foreground">
            [Feature Description]
          </div>
        </div>

        <[Feature]Container />
      </div>
    </[Feature]Provider>
  );
}
```

CARACTERÍSTICAS:
- Provider no nível da página
- Layout consistente
- Títulos e descrições
- Classes Tailwind padrão
- Estrutura semântica
```

## 🎯 Prompt Completo para Novo Componente Frontend

```
Crie um componente frontend completo seguindo a arquitetura Lead Flow:

ARQUITETURA OBRIGATÓRIA:
app/[supabaseId]/[FEATURE]/
├── page.tsx (Provider + Layout)
└── features/
    ├── container/ (Componentes apresentação)
    ├── context/ (Context SOLID: Types → Hook → Context)
    ├── services/ (Interface + Service para API)
    └── hooks/ (Custom hooks opcionais)

REQUISITOS TÉCNICOS:
1. Context seguindo padrão SOLID (Types, Hook, Context)
2. useParams para extrair supabaseId automaticamente
3. Service para chamadas API com Output pattern
4. Estados loading/error com tratamento
5. TypeScript completo com interfaces
6. Componentes Shadcn/ui
7. Layout responsivo Tailwind

PADRÕES OBRIGATÓRIOS:

Context Types:
- I[Feature]State: estado do contexto
- I[Feature]Actions: ações disponíveis
- I[Feature]Context: contexto completo

Service Pattern:
- Interface I[Feature]Service
- Implementação [Feature]Service
- Chamadas fetch com tratamento Output
- Instância singleton exportada

Container Pattern:
- [Feature]Container (principal)
- [Feature]Header (cabeçalho)
- [Feature]Dialog (modais)
- Estados loading com skeleton
- Error handling com retry

Page Pattern:
- Provider no nível da página
- Layout consistente
- Título e descrição
- Container principal

REFERÊNCIAS NO PROJETO:
- /app/[supabaseId]/dashboard/ (Context SOLID completo)
- /app/[supabaseId]/board/ (Container patterns)
- /app/[supabaseId]/manager-users/ (Service patterns)

FEATURE SOLICITADA: [DESCREVER FUNCIONALIDADE]
COMPONENTES NECESSÁRIOS: [LISTAR COMPONENTES]
AÇÕES DO USUÁRIO: [LISTAR AÇÕES]
INTEGRAÇÃO API: [ENDPOINTS NECESSÁRIOS]
```

## 🧪 Prompts para Testes

### 1. Criar Testes Unitários
```
Crie testes unitários para [FEATURE] UseCase seguindo padrões:

TESTAR:
1. Validações de entrada (casos inválidos)
2. Fluxo de sucesso
3. Tratamento de erros
4. Retorno de Output correto

STRUCTURE:
- Arrange: Setup data
- Act: Call UseCase method
- Assert: Verify Output format

MOCK: Services e Prisma calls
```

### 2. Testes de Integração API
```
Crie testes de integração para endpoints [FEATURE]:

TESTAR:
1. HTTP methods (GET, POST, PUT, DELETE)
2. Status codes corretos
3. Formato de resposta Output
4. Headers apropriados
5. Validação de parâmetros

USAR: Vitest ou Jest
MOCK: Database calls quando necessário
```

## 🎯 Prompt para Review de Code

```
Revise o código implementado para [FEATURE] verificando:

ARQUITETURA ✅:
- [ ] Route → UseCase → [Service] → Prisma
- [ ] Interface definida para UseCase
- [ ] UseCase retorna Output sempre
- [ ] Route faz apenas HTTP handling

PADRÕES ✅:
- [ ] Nomenclatura: I[Feature]UseCase, [Feature]UseCase
- [ ] Validações nos UseCases
- [ ] console.error para logs
- [ ] Status codes baseados em Output.isValid

QUALIDADE ✅:
- [ ] Types TypeScript corretos
- [ ] Tratamento de erros adequado
- [ ] Separação de responsabilidades
- [ ] Consistência com código existente

SUGERIR MELHORIAS se necessário
```

### Frontend Review
```
Revise o componente frontend implementado para [FEATURE] verificando:

ARQUITETURA FRONTEND ✅:
- [ ] Page.tsx com Provider no nível superior
- [ ] Context seguindo SOLID (Types → Hook → Context)
- [ ] Service com interface e implementação
- [ ] Container components separados por responsabilidade

CONTEXT PATTERN ✅:
- [ ] useParams extrai supabaseId automaticamente
- [ ] useState com tipos corretos
- [ ] useCallback para ações (performance)
- [ ] Provider injeta dependências

SERVICE PATTERN ✅:
- [ ] Interface I[Feature]Service definida
- [ ] Implementação com tratamento Output
- [ ] Fetch com headers corretos
- [ ] Error handling adequado

COMPONENTS ✅:
- [ ] Loading states com skeleton
- [ ] Error handling com retry
- [ ] Componentes Shadcn/ui
- [ ] Layout responsivo Tailwind
- [ ] TypeScript completo

INTEGRAÇÃO ✅:
- [ ] Context consumido corretamente
- [ ] Service integrado com Context
- [ ] Estados sincronizados
- [ ] Performance otimizada

SUGERIR MELHORIAS se necessário
```

## 📋 Checklist de Prompt

Antes de usar qualquer prompt, certifique-se de:

- [ ] Definir claramente a feature desejada
- [ ] Especificar se precisa de Service ou não
- [ ] Listar campos/validações necessárias
- [ ] Mencionar referências no código existente
- [ ] Incluir exemplos específicos quando necessário

---

## ⚠️ IMPORTANTE: Política de Documentação

### ❌ NÃO CRIAR documentos de resumo ao final de cada execução

**EVITAR:**
- ❌ Documentos `[FEATURE]_IMPLEMENTATION_SUMMARY.md`
- ❌ Documentos `[FEATURE]_FIX_SUMMARY.md`
- ❌ Documentos `[FEATURE]_CHANGES_LOG.md`
- ❌ Documentos de changelog automático
- ❌ Resumos de cada alteração

**RAZÃO:**
Isso gera poluição no repositório com múltiplos arquivos de documentação que ficam desatualizados e dificultam a manutenção do projeto.

### ✅ DOCUMENTAR apenas quando necessário

**CRIAR documentação SOMENTE para:**
- ✅ **Arquitetura nova**: Quando criar um padrão arquitetural novo
- ✅ **APIs públicas**: README.md em `/app/api/useCases/[feature]/README.md`
- ✅ **Features complexas**: Documentação de uso em `/docs/[FEATURE]_GUIDE.md`
- ✅ **Configurações**: Setup, instalação, deployment
- ✅ **Convenções**: Padrões de código, boas práticas

**EXEMPLOS DE DOCUMENTAÇÃO APROPRIADA:**
```
✅ /docs/ARCHITECTURE_GUIDE.md       (arquitetura geral)
✅ /docs/API_CONVENTIONS.md          (convenções de API)
✅ /app/api/useCases/metrics/README.md  (documentação da API)
✅ /postman/README.md                (como usar collections)

❌ DASHBOARD_IMPLEMENTATION_SUMMARY.md  (resumo de implementação)
❌ LEAD_FIX_CHANGES.md                   (log de correções)
❌ NOSHOW_CORRECTION_SUMMARY.md          (resumo de correção)
```

### 📝 Use commits descritivos no lugar

Ao invés de criar documentos de resumo, use **commits bem descritivos**:

```bash
# ✅ Bom commit (substitui documento de resumo)
git commit -m "feat(dashboard): add NoShow rate calculation

- Changed NoShow from count to percentage
- Updated DashboardInfosService to calculate (noShow/agendamentos)*100
- Updated frontend interface and component
- Fixed card rendering issue

Resolves: Dashboard NoShow card showing empty value"

# ❌ Evite commits genéricos
git commit -m "fix: corrections"
```

### 🎯 Quando ADICIONAR ao Prompt

**Adicione esta instrução em TODOS os prompts:**

```
IMPORTANTE: Não crie documentos de resumo ao final (como *_SUMMARY.md, *_FIX.md, *_CHANGES.md).
Faça apenas as alterações necessárias no código e forneça um resumo verbal da implementação.
```

**Exemplo de prompt completo:**
```
Implemente [FEATURE] seguindo a arquitetura Lead Flow:

[... instruções da feature ...]

IMPORTANTE: 
- Não crie documentos de resumo ao final
- Apenas implemente o código necessário
- Forneça um resumo verbal das alterações
- Use commits descritivos ao invés de documentos
```

---

💡 **Dica**: Combine prompts quando necessário. Por exemplo: "Prompt Principal" + "Feature CRUD" para APIs completas.

💡 **Lembre-se**: Documentação de código e commits descritivos > Documentos de resumo automáticos.

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

## � Arquitetura Frontend/Components

### 📁 Estrutura de Componentes

```
app/[supabaseId]/[feature]/
├── page.tsx                     # Página principal com Provider
└── features/
    ├── container/               # Componentes de apresentação
    │   ├── [Feature]Container.tsx   # Container principal
    │   ├── [Feature]Dialog.tsx      # Modais e dialogs
    │   ├── [Feature]Header.tsx      # Cabeçalho
    │   ├── [Feature]Card.tsx        # Cards individuais
    │   └── [Feature]List.tsx        # Listas
    ├── context/                 # Context API (SOLID)
    │   ├── [Feature]Types.ts        # Interfaces e tipos
    │   ├── [Feature]Hook.ts         # Lógica de negócio
    │   └── [Feature]Context.tsx     # Provider e Context
    ├── services/                # Camada de serviço frontend
    │   ├── I[Feature]Service.ts     # Interface do serviço
    │   └── [Feature]Service.ts      # Implementação
    └── hooks/                   # Custom hooks (opcional)
        └── use[Feature].ts          # Hooks específicos
```

### 🔄 Arquitetura Frontend

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│    Page     │───▶│   Context    │───▶│    Service      │───▶│   API/Hook   │
│ (Provider)  │    │ (State Mgmt) │    │ (Data Layer)    │    │ (External)   │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
```

### 🎯 Responsabilidades Frontend

| Camada | Responsabilidade | Input | Output |
|--------|------------------|-------|--------|
| **Page** | • Provider setup<br>• Layout principal<br>• Roteamento | `params` | JSX com Provider |
| **Context** | • Estado global<br>• Ações compartilhadas<br>• Lógica de negócio | Props/Params | Estado tipado |
| **Service** | • Chamadas API<br>• Transformação dados<br>• Cache local | DTOs | Dados tipados |
| **Container** | • Apresentação<br>• Interação usuário<br>• Estados loading | Context | JSX Components |

### 🏗️ Padrões de Implementação Frontend

#### 1. Context SOLID Pattern

```typescript
// [Feature]Types.ts - Definições de tipos
export interface I[Feature]State {
  items: [Feature][];
  isLoading: boolean;
  error: string | null;
  filters: [Feature]Filters;
}

export interface I[Feature]Actions {
  fetchItems: () => Promise<void>;
  createItem: (data: Create[Feature]DTO) => Promise<void>;
  updateItem: (id: string, data: Update[Feature]DTO) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  updateFilters: (filters: Partial<[Feature]Filters>) => void;
}

export interface I[Feature]Context extends I[Feature]State, I[Feature]Actions {}

// [Feature]Hook.ts - Lógica de negócio
export function use[Feature]Hook({
  supabaseId,
  service,
  initialFilters
}: Use[Feature]HookProps): Use[Feature]HookReturn {
  
  const [state, setState] = useState<I[Feature]State>(initialState);

  const fetchItems = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const items = await service.get[Feature]s(state.filters);
      setState(prev => ({ ...prev, items, isLoading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error.message, 
        isLoading: false 
      }));
    }
  }, [service, state.filters]);

  return { ...state, fetchItems };
}

// [Feature]Context.tsx - Provider
export const [Feature]Provider: React.FC<I[Feature]ProviderProps> = ({
  children,
  initialFilters = {}
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const contextState = use[Feature]Hook({
    supabaseId,
    service: [feature]Service,
    initialFilters
  });

  return (
    <[Feature]Context.Provider value={contextState}>
      {children}
    </[Feature]Context.Provider>
  );
};
```

#### 2. Service Frontend Pattern

```typescript
// I[Feature]Service.ts - Interface
export interface I[Feature]Service {
  get[Feature]s(filters: [Feature]Filters): Promise<[Feature][]>;
  get[Feature]ById(id: string): Promise<[Feature] | null>;
  create[Feature](data: Create[Feature]DTO): Promise<[Feature]>;
  update[Feature](id: string, data: Update[Feature]DTO): Promise<[Feature]>;
  delete[Feature](id: string): Promise<boolean>;
}

// [Feature]Service.ts - Implementação
export class [Feature]Service implements I[Feature]Service {
  private baseUrl = '/api/v1/[feature]';

  async get[Feature]s(filters: [Feature]Filters): Promise<[Feature][]> {
    const params = new URLSearchParams(filters as any);
    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }

  async create[Feature](data: Create[Feature]DTO): Promise<[Feature]> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }
}

export const [feature]Service = new [Feature]Service();
```

#### 3. Container Component Pattern

```typescript
// [Feature]Container.tsx
'use client';

import { use[Feature]Context } from '../context/[Feature]Context';
import { [Feature]Header } from './[Feature]Header';
import { [Feature]List } from './[Feature]List';
import { [Feature]Dialog } from './[Feature]Dialog';
import { [Feature]Skeleton } from './[Feature]Skeleton';
import { [Feature]Error } from './[Feature]Error';

export function [Feature]Container() {
  const { 
    items, 
    isLoading, 
    error, 
    fetchItems,
    createItem 
  } = use[Feature]Context();

  if (isLoading && items.length === 0) {
    return <[Feature]Skeleton />;
  }

  if (error) {
    return (
      <[Feature]Error 
        error={error} 
        onRetry={fetchItems} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <[Feature]Header onAdd={createItem} />
      
      <[Feature]List 
        items={items} 
        isLoading={isLoading}
      />
      
      <[Feature]Dialog />
    </div>
  );
}
```

#### 4. Page Pattern

```typescript
// page.tsx
import { [Feature]Provider } from './features/context/[Feature]Context';
import { [Feature]Container } from './features/container/[Feature]Container';

export default function [Feature]Page() {
  return (
    <[Feature]Provider initialFilters={{ period: '30d' }}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            [Feature Title]
          </h1>
          <div className="text-sm text-gray-500">
            [Feature Description]
          </div>
        </div>

        <[Feature]Container />
      </div>
    </[Feature]Provider>
  );
}
```

### 📐 Convenções Frontend

#### 🏷️ Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| **Context Types** | `I[Feature]State/Actions/Context` | `IDashboardState` |
| **Hook** | `use[Feature]Hook` | `useDashboardHook` |
| **Provider** | `[Feature]Provider` | `DashboardProvider` |
| **Service** | `I[Feature]Service, [Feature]Service` | `IDashboardService` |
| **Container** | `[Feature]Container` | `DashboardContainer` |
| **Components** | `[Feature][Component]` | `DashboardHeader` |

#### ✅ Boas Práticas Frontend

- Use interfaces para Context state/actions
- Extraia supabaseId com useParams automaticamente
- Implemente estados de loading e error
- Use useCallback para ações
- Mantenha componentes pequenos e focados
- Use Shadcn/ui para componentes base
- Implemente skeleton loading
- Trate erros graciosamente

#### ❌ Evite

- Estado global desnecessário
- Componentes grandes monolíticos
- Lógica de negócio nos componentes
- Chamadas diretas de API nos componentes
- Props drilling excessivo
- Estados não tipados

## �🎯 Prompt Sugerido para IA/Copilot

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