---
description: Scaffold e implementação de nova feature seguindo a arquitetura Lead Flow
---

Implemente uma nova feature no Lead Flow seguindo estritamente a arquitetura do projeto.

## Passos obrigatórios

1. **Leia o contexto do projeto** antes de qualquer coisa:
   - `.github/instructions/project-context.instructions.md` — stack, schema, rotas existentes
   - Verifique se já existe UseCase/Service similar em `app/api/useCases/` e `app/api/services/`

2. **Gere o scaffold** da feature (substitua `<nome>` pelo nome da feature em PascalCase):
   ```bash
   bun run scaffold:feature -- --name <nome>
   ```
   O scaffold cria: Route + UseCase + Service (backend) e Page + Loading + Context + Service + Container (frontend).

3. **Implemente a lógica** seguindo a arquitetura:
   - **Backend:** `Route → UseCase → [Service] → Prisma`
     - Route: apenas HTTP (parse request, chamar UseCase, mapear status code)
     - UseCase: validações, orquestração, **SEMPRE** retorna `Output` de `lib/output/index.ts`
     - Service: lógica complexa/domínio (opcional)
   - **Frontend:** `page → context → service` / `page → container → context`
     - `page.tsx`: thin, só monta provider + container
     - `features/context/`: estado + orquestração (`*Types.ts`, `*Hook.ts`, `*Context.tsx`)
     - `features/services/`: HTTP/API (`I*Service.ts` + `*Service.ts`)
     - `features/container/`: composição visual

4. **Componentes visuais:** use `bunx --bun shadcn@latest add <component>` antes de criar markup customizado.

5. **Após implementar**, atualize `postman/Lead-Flow-API-Collection.json` com o novo endpoint.

6. **Valide** com:
   ```bash
   bun run typecheck
   bun run lint
   bun run governance:check
   ```

## Regras críticas

- UseCase **SEMPRE** retorna `new Output(isValid, successMessages, errorMessages, result)`
- Novos endpoints **DEVEM** estar em `/api/v1/...`
- Routes **NÃO** chamam Prisma diretamente
- Nenhum `window.alert/confirm/prompt` — use shadcn `AlertDialog` e `sonner`
- Nenhum arquivo `*_IMPLEMENTATION_SUMMARY.md`
