---
name: corretor-studio-frontend
description: Guia obrigatório para construção de novas features de Frontend no Corretor Studio (lead-flow-app). Cobre arquitetura de camadas, scaffold, padrões de Context/Hook/Service/Container, regras de componentes shadcn, TypeScript strict, lint e validação. Use antes de implementar qualquer nova tela, rota, contexto ou componente de produto.
---

# Corretor Studio — Frontend Feature

Produz uma feature de frontend completa e consistente com a arquitetura do lead-flow-app.

## Processo obrigatório (7 passos)

1. Ler contexto e verificar código similar
2. Escrever a spec E2E **antes** do JSX (TDD) — ver `agents.md` § E2E Tests
3. Gerar scaffold
4. Implementar Context (Types → Hook → Context)
5. Implementar Service (Interface + Implementação)
6. Implementar Container e componentes visuais
7. Validar e commitar

---

## Passo 0 — Spec E2E antes do JSX (MUST)

Ler a seção **E2E Tests (FOR NEW FEATURES)** em `agents.md`. Copiar `e2e/specs/_template.spec.ts` para o path da convenção (`product` / `backoffice` / `checkout` / `public`). A spec precisa ficar vermelha antes de qualquer Container. Feature de cobrança chama `assertAsaasSandbox()` (`e2e/support/asaas.ts`) e **MUST NOT** usar Asaas de produção. Página `page.tsx` nova sem spec falha `bun run governance:check-e2e-pages`.

## Passo 1 — Ler contexto e verificar código similar

Antes de qualquer implementação, ler:

| Fonte | O que extrai |
|---|---|
| `.github/instructions/project-context.instructions.md` | Stack, schema, rotas existentes, hooks compartilhados |
| `app/[supabaseId]/dashboard/` | Referência de Context SOLID completo |
| `app/[supabaseId]/board/` | Referência de Container patterns |
| `app/[supabaseId]/manager-users/` | Referência de Service patterns |

Verificar se já existe feature similar antes de criar do zero.

---

## Passo 2 — Gerar scaffold

Executar o gerador oficial antes de escrever qualquer arquivo:

```bash
bun run scaffold:feature -- --name <NomeDaFeatureEmPascalCase>
```

O scaffold cria automaticamente:
- `page.tsx` + `loading.tsx`
- `features/context/*Types.ts`, `*Hook.ts`, `*Context.tsx`
- `features/services/I*Service.ts`, `*Service.ts`
- `features/container/*Container.tsx`

**Nunca criar esses arquivos manualmente** antes de rodar o scaffold.

---

## Passo 3 — Implementar Context (Types → Hook → Context)

### Estrutura de pastas obrigatória

```
app/[supabaseId]/[feature]/
├── page.tsx                          # Thin: só Provider + Container
├── loading.tsx                       # Loading UI da rota
└── features/
    ├── context/
    │   ├── [Feature]Types.ts         # I[Feature]State, I[Feature]Actions, I[Feature]Context
    │   ├── [Feature]Hook.ts          # Orquestração, estado, useCallback
    │   └── [Feature]Context.tsx      # createContext + Provider + consumer hook
    ├── services/
    │   ├── I[Feature]Service.ts      # Contrato do serviço
    │   └── [Feature]Service.ts       # Implementação + singleton exportado
    ├── container/
    │   ├── [Feature]Container.tsx    # Composição principal
    │   ├── [Feature]Header.tsx       # Cabeçalho (opcional)
    │   └── [Feature]Dialog.tsx       # Modais (opcional)
    ├── components/                   # Subcomponentes apresentacionais (opcional)
    ├── hooks/                        # Custom hooks extras (opcional)
    ├── validation/                   # Schemas Zod (opcional)
    └── utils/                        # Helpers puros (opcional)
```

### Padrão de Types

```typescript
// [Feature]Types.ts
export interface I[Feature]State {
  items: [Feature][];
  isLoading: boolean;
  error: string | null;
}

export interface I[Feature]Actions {
  fetchItems: () => Promise<void>;
  createItem: (data: Create[Feature]DTO) => Promise<void>;
}

export type I[Feature]Context = I[Feature]State & I[Feature]Actions;
```

### Padrão de Hook

```typescript
// [Feature]Hook.ts
export function use[Feature]Hook(service: I[Feature]Service): I[Feature]Context {
  const [items, setItems] = useState<[Feature][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await service.getItems();
      if (result.isValid) setItems(result.result);
      else setError(result.errorMessages[0]);
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  return { items, isLoading, error, fetchItems };
}
```

### Padrão de Context (Provider)

```typescript
// [Feature]Context.tsx
'use client';

export function [Feature]Provider({ children }: { children: ReactNode }) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const context = use[Feature]Hook([feature]Service);

  useEffect(() => {
    if (supabaseId) context.fetchItems();
  }, [supabaseId]);

  return (
    <[Feature]Context.Provider value={context}>
      {children}
    </[Feature]Context.Provider>
  );
}

export function use[Feature]Context() {
  const ctx = useContext([Feature]Context);
  if (!ctx) throw new Error('use[Feature]Context must be used within [Feature]Provider');
  return ctx;
}
```

### Padrão de page.tsx

```typescript
// page.tsx — thin entrypoint, NUNCA lógica aqui
import { [Feature]Provider } from './features/context/[Feature]Context';
import { [Feature]Container } from './features/container/[Feature]Container';

export default function [Feature]Page() {
  return (
    <[Feature]Provider>
      <[Feature]Container />
    </[Feature]Provider>
  );
}
```

---

## Passo 4 — Implementar Service

### Padrão de Interface

```typescript
// I[Feature]Service.ts
export interface I[Feature]Service {
  getItems(supabaseId: string): Promise<Output>;
  createItem(supabaseId: string, data: Create[Feature]DTO): Promise<Output>;
}
```

### Padrão de Implementação

```typescript
// [Feature]Service.ts
export class [Feature]Service implements I[Feature]Service {
  async getItems(supabaseId: string): Promise<Output> {
    const res = await fetch(`/api/v1/[feature]`, {
      cache: 'no-store',
      headers: { 'x-supabase-user-id': supabaseId },
    });
    return res.json();
  }
}

export const [feature]Service = new [Feature]Service();
```

Regras obrigatórias de Service:
- Sempre `cache: 'no-store'` em fetch de dados mutáveis.
- Nunca hardcodar URLs — usar caminhos relativos `/api/v1/...`.
- Tratar `result.isValid` para propagar erros ao contexto.
- Exportar instância singleton ao final do arquivo.

---

## Passo 5 — Implementar Container e componentes visuais

### Padrão de Container

```typescript
// [Feature]Container.tsx
'use client';

export function [Feature]Container() {
  const { items, isLoading, error, fetchItems } = use[Feature]Context();

  if (isLoading) return <[Feature]Skeleton />;
  if (error) return <[Feature]Error error={error} onRetry={fetchItems} />;

  return (
    <div className="flex flex-col gap-6">
      <[Feature]Header />
      <[Feature]List items={items} />
    </div>
  );
}
```

### Regras de componentes visuais

- **MUST** consultar shadcn via MCP antes de criar markup customizado:
  ```
  shadcn:search_items_in_registries → shadcn:view_items_in_registries → bunx --bun shadcn@latest add <componente>
  ```
- `Skeleton` para loading states — nunca `animate-pulse` manual.
- `Badge` para status — nunca `span` customizado.
- `Separator` em vez de `<hr>` ou `border-t`.
- `sonner` (toast) para feedback — nunca `window.alert`.
- `AlertDialog` para confirmações destrutivas — nunca `window.confirm`.
- `FieldGroup` + `Field` em formulários — nunca `div` com `space-y-*`.
- `gap-*` em vez de `space-y-*` / `space-x-*`.
- `size-*` quando largura = altura.
- `cn()` de `@/lib/utils` para classes condicionais.
- Nunca `dark:` manual para cores — tokens semânticos cuidam disso.

### Regras de data-fetching

- Effects de data-fetching devem ser idempotentes.
- Deduplicação: chave estável + in-flight guard + last-success guard.
- Nunca depender de funções/objetos que recriam a cada render como dependências de `useEffect`.

### Regras de mutations (POST/PUT/PATCH/DELETE)

- Travar no primeiro clique: loading imediato + botão desabilitado.
- Unlock obrigatório no `finally`.

---

## Passo 6 — Validar e commitar

Executar obrigatoriamente antes de qualquer commit:

```bash
bun run typecheck
bun run lint
bun run governance:check
bun run governance:check-e2e-pages
```

Formato de commit obrigatório:

```
feat([feature]): implement [feature] frontend

- Add [Feature]Context with Types, Hook, Provider
- Add [Feature]Service with interface and singleton
- Add [Feature]Container with loading/error states
- Add [Feature]Dialog for create/edit actions

[Descrever o que resolve ou melhora]
```

---

## Regras críticas (MUST)

- TypeScript strict — sem `any` implícito, sem `.js`.
- `useParams()` para extrair `supabaseId` — nunca props drilling.
- `page.tsx` thin — só Provider + Container, zero lógica.
- Nunca `window.alert`, `window.confirm`, `window.prompt`.
- Nunca criar `*_IMPLEMENTATION_SUMMARY.md` ou similar.
- Commits descritivos substituem documentos de resumo.

## Anti-padrões (MUST NOT)

- Chamar API diretamente de componente — sempre via Service.
- Lógica de negócio em Container — sempre no Hook.
- `useEffect` com dependências instáveis (funções sem `useCallback`).
- Múltiplos contextos para a mesma feature.
- Importar Prisma ou código de servidor em componentes client.
