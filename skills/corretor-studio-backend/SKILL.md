---
name: corretor-studio-backend
description: Guia obrigatório para construção de novas features de Backend/API no Corretor Studio (lead-flow-app). Cobre arquitetura de camadas Route→UseCase→Service→Prisma, padrão Output, scaffold, nomenclatura, variáveis de ambiente, logging, testes e validação. Use antes de implementar qualquer novo endpoint, UseCase, Service ou domínio de API.
---

# Corretor Studio — Backend Feature

Produz uma feature de backend completa e consistente com a arquitetura do lead-flow-app.

## Processo obrigatório (6 passos)

1. Ler contexto e verificar código similar
2. Gerar scaffold
3. Implementar UseCase (Interface + Implementação)
4. Implementar Service (quando necessário)
5. Implementar Route
6. Validar, atualizar Postman e commitar

---

## Passo 1 — Ler contexto e verificar código similar

Antes de qualquer implementação, ler:

| Fonte | O que extrai |
|---|---|
| `.github/instructions/project-context.instructions.md` | Stack, schema, domínios existentes |
| `app/api/useCases/` | UseCases similares ao domínio da feature |
| `app/api/services/` | Services similares |
| `app/api/v1/` | Routes existentes para referência de padrão HTTP |

Verificar se já existe UseCase/Service similar antes de criar do zero.

---

## Passo 2 — Gerar scaffold

Executar o gerador oficial antes de escrever qualquer arquivo:

```bash
bun run scaffold:feature -- --name <NomeDaFeatureEmPascalCase>
```

O scaffold cria automaticamente:
- `app/api/useCases/[feature]/I[Feature]UseCase.ts`
- `app/api/useCases/[feature]/[Feature]UseCase.ts`
- `app/api/services/I[Feature]Service.ts`
- `app/api/services/[Feature]Service.ts`
- `app/api/v1/[feature]/route.ts`

**Nunca criar esses arquivos manualmente** antes de rodar o scaffold.

---

## Passo 3 — Implementar UseCase

### Estrutura de pastas obrigatória

```
app/api/
├── v1/
│   └── [feature]/
│       ├── route.ts                  # HTTP root/collection
│       └── [id]/
│           └── route.ts              # HTTP parametrizado
├── useCases/
│   └── [feature]/
│       ├── I[Feature]UseCase.ts      # Contrato (interface)
│       └── [Feature]UseCase.ts       # Orquestração + Output
└── services/
    └── [Feature]/
        ├── I[Feature]Service.ts      # Contrato do service
        └── [Feature]Service.ts       # Implementação
```

### Padrão de Interface

```typescript
// I[Feature]UseCase.ts
import { Output } from '@/lib/output';

export interface I[Feature]UseCase {
  create[Feature](data: Create[Feature]DTO): Promise<Output>;
  get[Feature]ById(id: string, supabaseId: string): Promise<Output>;
  update[Feature](id: string, data: Update[Feature]DTO): Promise<Output>;
  delete[Feature](id: string, supabaseId: string): Promise<Output>;
  list[Feature](supabaseId: string): Promise<Output>;
}
```

### Padrão de Implementação

```typescript
// [Feature]UseCase.ts
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';

export class [Feature]UseCase implements I[Feature]UseCase {
  constructor(private readonly service?: I[Feature]Service) {}

  async create[Feature](data: Create[Feature]DTO): Promise<Output> {
    try {
      // 1. Validações de negócio
      if (!data.requiredField) {
        return new Output(false, [], ['Campo obrigatório ausente'], null);
      }

      // 2. Lógica (via Service ou Prisma direto)
      const result = await prisma.[feature].create({ data });

      return new Output(true, ['Criado com sucesso'], [], result);
    } catch (error) {
      console.error('[Feature]UseCase.create[Feature]:', error);
      return new Output(false, [], ['Erro interno ao criar [feature]'], null);
    }
  }
}
```

### Contrato Output (OBRIGATÓRIO)

```typescript
import { Output } from '@/lib/output';

// Sucesso
return new Output(true, ['Mensagem de sucesso'], [], result);

// Erro de validação
return new Output(false, [], ['Mensagem de erro'], null);

// Erro interno (no catch)
return new Output(false, [], ['Erro interno'], null);
```

Regras do Output:
- **TODOS** os métodos de UseCase retornam `Promise<Output>`.
- `isValid: true` apenas quando a operação foi bem-sucedida.
- `errorMessages` nunca vazio quando `isValid: false`.
- `result: null` em caso de erro.
- Nunca lançar exceção para fora do UseCase — capturar no `catch`.

---

## Passo 4 — Implementar Service (quando necessário)

Use Service quando houver lógica complexa, cálculos, transformações ou agregações que não pertencem ao UseCase.

```typescript
// [Feature]Service.ts
export class [Feature]Service implements I[Feature]Service {
  calculate[Something](data: InputDTO): OutputDTO {
    // Lógica pura, sem efeitos colaterais de banco
    return transformedData;
  }
}
```

Service **não** retorna `Output` — retorna DTOs tipados. Quem cria o Output é sempre o UseCase.

---

## Passo 5 — Implementar Route

### Responsabilidades da Route (APENAS)

- Parse do `NextRequest` (body, query params, headers)
- Validação de presença de headers obrigatórios
- Chamar o UseCase
- Mapear `output.isValid` para status HTTP
- Retornar `NextResponse.json(output, { status })`

```typescript
// route.ts
import { NextRequest, NextResponse } from 'next/server';
import { [Feature]UseCase } from '@/app/api/useCases/[feature]/[Feature]UseCase';

const useCase = new [Feature]UseCase();

export async function POST(request: NextRequest) {
  console.info('[[Feature]Route][POST] iniciado');

  const supabaseId = request.headers.get('x-supabase-user-id');
  if (!supabaseId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const output = await useCase.create[Feature]({ ...body, supabaseId });

  return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
}

export async function GET(request: NextRequest) {
  console.info('[[Feature]Route][GET] iniciado');

  const supabaseId = request.headers.get('x-supabase-user-id');
  if (!supabaseId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const output = await useCase.list[Feature](supabaseId);
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
}
```

### Mapeamento de status HTTP

| Situação | Status |
|---|---|
| Criação bem-sucedida | 201 |
| Leitura/atualização bem-sucedida | 200 |
| Erro de validação (`isValid: false`) | 400 |
| Não autorizado (sem header) | 401 |
| Não encontrado | 404 |
| Erro interno (catch na route) | 500 |

### Regras de Route (MUST)

- **Nunca** chamar Prisma diretamente na Route.
- **Nunca** colocar lógica de negócio na Route.
- Log de rota: `[[Feature]Route][MÉTODO]` com `console.info`.
- Erros inesperados: `console.error`.
- Novos endpoints **DEVEM** estar em `/api/v1/...`.

### Variáveis de ambiente

- **Nunca** hardcodar URLs ou chaves — usar `getValidatedEnv()` de `@/lib/env`.
- Ao adicionar nova variável: atualizar `.env.example` + `lib/env/validation.ts`.

---

## Passo 6 — Validar, atualizar Postman e commitar

### Validação obrigatória (nessa ordem)

```bash
bun run typecheck
bun run lint
bun run governance:check
```

### Atualizar Postman

Após criar novos endpoints, atualizar obrigatoriamente:

```
postman/Lead-Flow-API-Collection.json
```

Incluir: método HTTP, headers (`x-supabase-user-id`), body de exemplo, status codes esperados.

### Formato de commit obrigatório

```
feat([feature]): implement [feature] backend

- Add I[Feature]UseCase interface and [Feature]UseCase implementation
- Add [Feature]Service for [lógica complexa] (se aplicável)
- Add POST/GET/PUT/DELETE routes at /api/v1/[feature]
- Update Postman collection with new endpoints

[Descrever o que resolve ou melhora]
```

---

## Checklist de implementação

- [ ] Scaffold gerado com `bun run scaffold:feature`
- [ ] Interface `I[Feature]UseCase` definida
- [ ] UseCase retorna `Output` em **todos** os métodos
- [ ] Route faz apenas HTTP handling (sem lógica de negócio)
- [ ] Route **não** chama Prisma diretamente
- [ ] Novos endpoints em `/api/v1/...`
- [ ] Logs com `console.info` (fluxo) e `console.error` (erros)
- [ ] Sem `any` implícito — TypeScript strict
- [ ] Sem variáveis de ambiente hardcoded
- [ ] Postman collection atualizada
- [ ] `bun run typecheck` passa
- [ ] `bun run lint` passa
- [ ] `bun run governance:check` passa

---

## Regras críticas (MUST)

- UseCase **SEMPRE** retorna `new Output(isValid, successMessages, errorMessages, result)`.
- Novos endpoints **DEVEM** estar em `/api/v1/...`.
- Routes **NÃO** chamam Prisma diretamente.
- Nunca criar `*_IMPLEMENTATION_SUMMARY.md` ou similar.
- Commits descritivos substituem documentos de resumo.

## Anti-padrões (MUST NOT)

- Prisma na Route — sempre via UseCase.
- Lógica de negócio na Route — sempre no UseCase.
- UseCase sem interface — sempre `I[Feature]UseCase.ts`.
- Retornar exceção sem capturar no `catch` do UseCase.
- Hardcodar URLs, tokens ou chaves em código.
- Usar `npm` ou `yarn` — sempre `bun` / `bunx --bun`.
