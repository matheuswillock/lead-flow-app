# Ambiente local em container (Podman/Docker Compose)

Leia este arquivo antes de testar qualquer implementação localmente: suíte, E2E, validação de fluxo ou reprodução de bug. O ambiente de teste local é **100% em container** e roda por `podman compose`. Não valide só no host.

## Regra para agentes

1. Teste implementações pelo stack em compose, não por servidor avulso, `next start` antigo ou Postgres do host.
2. Se a mudança precisa de um serviço, variável, volume, seed ou extensão para ser testada, **implemente isso no compose na mesma mudança** (`docker-compose.test.yml`, e `docker-compose.local.yml` quando o `bun run dev` também precisar). Teste que só passa com setup manual no host não vale.
3. Não aponte o stack de teste para Supabase remoto, banco remoto ou chave de produção. O stack usa `.env.test.example` (placeholders) + os overrides de CI de `scripts/ci-e2e.ts`.
4. Relate o exit code de cada comando e a contagem de testes (passou/falhou/pulou). Falha é falha: não a atribua ao ambiente sem evidência (log, `error-context.md`, comparação com `develop`).

## Comandos

| Objetivo | Comando |
|---|---|
| Tudo (unit + integração + E2E) | `bun run test:compose` |
| Só unitários | `bun run test:compose:unit` |
| Só integração | `bun run test:compose:integration` |
| Só E2E (Playwright) | `bun run test:compose:e2e` |
| Derrubar e apagar caches (`node_modules`, `.next`) | `bun run test:compose:down` |
| Manter o stack de pé entre execuções | `KEEP_STACK=1 bun run test:compose:e2e` |

Para um spec específico, rode `podman compose -p <projeto> -f docker-compose.test.yml --profile tests run --rm tests bunx playwright test e2e/specs/<arquivo>.spec.ts` com o stack já de pé (`KEEP_STACK=1`).

### Nunca opere o stack por nome de container

O projeto compose é `leadflow-test-<basename da worktree>` (`projectNameFor` em `scripts/lib/test-compose.ts`, passado com `-p`) e os containers se chamam `<projeto>-<serviço>-1`. Não há `container_name` fixo: nomes de container são globais no Podman, e `leadflow-test-app` já foi, em 2026-11-23, o app de **outra** worktree (`podman stop`/`start` por nome parou o app e reexecutou o `setup` alheio).

- Use sempre `podman compose -p <projeto> -f docker-compose.test.yml ...` (`exec`, `logs`, `ps`, `stop`, `start`, `down`). Nunca `podman stop|start|exec|rm <nome>`.
- Descubra o projeto com `bun -e 'import {COMPOSE_PROJECT} from "./scripts/lib/test-compose"; console.log(COMPOSE_PROJECT)'` na raiz da worktree.
- `down --volumes` e `bun run test:compose:down` só no seu próprio projeto.

### Inspecionar o app no navegador

O stack não publica porta no host (e não deve, por padrão). Para abrir o app no navegador, crie **fora do repositório** um override que publica a porta só no seu projeto, p. ex. `~/override-test-ports.yml`:

```yaml
services:
  db:
    ports:
      - "127.0.0.1:3100:3000"   # porta do host livre; o app compartilha a rede do db
```

e suba com `podman compose -p <projeto> -f docker-compose.test.yml -f ~/override-test-ports.yml up -d app`. A porta vai no `db` porque `app` usa `network_mode: service:db`. Escolha uma porta distinta por worktree.

Primeira execução: o build da imagem (~2,6 GB, Playwright) e do `next build` leva minutos. Reexecuções usam o cache dos volumes.

## Como o stack é montado (`docker-compose.test.yml`)

`db` → `forward` → `setup` → `app` → `tests`.

- **`db`**: `supabase/postgres:17.6.1.149`, dados em tmpfs, com os stubs de `docker/local/` (`auth`, `storage`, `_realtime`). Não publica porta no host.
- **`forward`**: encaminha `127.0.0.1:55322` → `5432` no namespace do `db`. O `migrate.sh` da imagem fixa a porta 5432 e ignora `PGPORT`; o projeto fala em `:55322`.
- **`setup`**: `bun install --frozen-lockfile --ignore-scripts`, `prisma generate`, `db:seed:e2e` (migrations + catálogo + master E2E) e `next build`.
- **`app`**: `next start` com `APP_ENV=test` e `E2E_TEST_MODE=true`.
- **`tests`** (profile `tests`): roda a suíte contra `http://127.0.0.1:3000`.

`forward`, `setup`, `app` e `tests` compartilham o namespace de rede do `db` (`network_mode: service:db`). Por isso `.env.test`, `seed-e2e.ts` e o Playwright funcionam sem mudança, e o stack não conflita com o `leadflow-local-db` do `bun run dev` (que ocupa `:55322` no host).

O repositório é montado em `/app` com `label=disable` (SELinux) e `node_modules`/`.next` ficam em volumes nomeados. A imagem (`docker/test/Containerfile`) só tem ferramentas.

## Contas e processos: o que dá e o que não dá para validar

Dá para validar localmente, dentro do stack:

- Criar contas, perfis, times, membros e assinaturas por fixture (`e2e/support/*`, `getPrisma()`), e entrar por cookie assinado (`injectE2eAuthCookie`). É assim que as specs cobrem gate de acesso, CRM, agenda, backoffice, checkout, formulários públicos e webhooks.
- Percorrer o processo completo na UI renderizada: navegação, formulários, permissões por papel, estados de assinatura, rotas de API e regras de negócio persistidas no Postgres local.
- Migrations: o `setup` aplica todas as de `supabase/migrations` num banco vazio a cada execução, o que pega migration quebrada ou fora de ordem.

**Não** dá para validar localmente (declare isso no relatório quando o fluxo depender):

- Cadastro/login reais no Supabase Auth, e Storage real: continuam remotos. O stack usa stubs de schema e cookie E2E. O modo `hybrid` do compose local só cobre Realtime e proxy.
- Provedores externos (Asaas, Abacate, Resend, WhatsApp/OpenWA, Meta): o stack usa placeholders e sandbox. Fluxo que exige o provedor real fica como "não verificado".

## Armadilhas já medidas

- `next build` precisa de heap maior: o orquestrador define `NODE_OPTIONS=--max-old-space-size=8192` (sem isso, OOM).
- Playwright roda em **Node**, nunca com `bunx --bun` (os specs falham com `AggregateError ... errors building`).
- `healthcheck` com `CMD-SHELL` usa `sh` (dash) no Ubuntu: não há `/dev/tcp`; use `pg_isready`/`curl`.
- Contexto de build mínimo (`docker/test`): não use o repo inteiro como contexto.
- `--ignore-scripts` no install é intencional: o `postinstall` instalaria git hooks no `.git` do host montado.
- O Playwright grava `playwright-report/` e `test-results/` na raiz do repo (montado). Leia o `error-context.md` se precisar, e **apague as duas pastas antes de `governance:check`**: ele varre `playwright-report/**/*.js` e reprova por "arquivo não-TS fora de allowlist".
- Spec vermelha que já tem correção na `develop`: compare com `git log origin/develop -- <spec>` antes de investigar o app (caso `account-access-gate`, commit `7360afbbc`).

## Manutenção

- Mudou dependência de ferramenta (versão do Playwright, Postgres, bun)? Atualize `docker/test/Containerfile` e/ou a imagem do `db` junto, e rode `bun run test:compose:down` para renovar os caches.
- Lógica do fluxo mora em `scripts/lib/test-compose.ts` (testada em `scripts/lib/test-compose.test.ts`); `scripts/test-compose.ts` e `scripts/test-compose-entry.ts` são só entrypoints.
- `e2e:ci` (Vercel CI, `scripts/ci-e2e.ts`) é outro fluxo, com `docker run` direto. Não o altere para fins locais.
