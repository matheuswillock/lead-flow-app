---
mode: 'agent'
description: "Diagnosticar e corrigir desvios de arquitetura no Lead Flow (Prisma em route, UseCase sem Output, estrutura features/ incorreta)"
---

<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: .claude/skills/fix-arch.md -->
<!-- Regenerate with: bun run skills:sync -->


Diagnostique e corrija desvios de arquitetura no Lead Flow.

## Passo 1 — Identificar violações

Execute o check de governance para listar violações automáticas:
```bash
bun run governance:check
```

Além disso, verifique manualmente os padrões mais comuns:

### Violações de backend
- **Prisma direto em route** (`app/api/v1/**/route.ts` importando `prisma` sem passar por UseCase)
- **UseCase sem Output** (UseCase que não retorna `new Output(...)` de `lib/output/index.ts`)
- **Route com lógica de negócio** (validações, queries, transforms dentro do handler HTTP)

### Violações de frontend
- **Page com lógica densa** (`page.tsx` com `useEffect`, fetch direto, estado complexo)
- **Container chamando API diretamente** (componente em `features/container/` usando `fetch`/`axios`)
- **Estrutura `features/` incompleta** (faltando `context/`, `services/` ou `container/`)
- **Service sem interface** (apenas `*Service.ts` sem `I*Service.ts`)

## Passo 2 — Corrigir

Para cada violação encontrada, aplique a correção seguindo a arquitetura:

**Prisma em route → mover para UseCase:**
- Crie `app/api/useCases/[domain]/[Feature]UseCase.ts` com a lógica
- Route deve apenas chamar o UseCase e mapear o `Output` para status HTTP

**UseCase sem Output → adicionar contrato:**
- Import: `import { Output } from "@/lib/output"`
- Todos os returns devem ser `new Output(isValid, successMessages, errorMessages, result)`
- Se é legado aprovado, adicionar ao `useCaseWithoutOutputAllowlist` em `.governance/ai-governance.config.json`

**Estrutura features/ incompleta → criar arquivos faltantes:**
- `context/[Feature]Types.ts` — interfaces de estado e actions
- `context/[Feature]Hook.ts` — lógica de orquestração
- `context/[Feature]Context.tsx` — provider + consumer hook
- `services/I[Feature]Service.ts` — interface do serviço
- `services/[Feature]Service.ts` — implementação HTTP

## Passo 3 — Validar

Após as correções:
```bash
bun run typecheck
bun run lint
bun run governance:check
```

Se adicionou exceção legada, verifique se está documentada no allowlist.
