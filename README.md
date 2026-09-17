# Lead Flow App (Corretor Studio)

[![CI (develop -> version -> preview -> PR main)](https://github.com/matheuswillock/lead-flow-app/actions/workflows/ci-develop.yml/badge.svg)](https://github.com/matheuswillock/lead-flow-app/actions/workflows/ci-develop.yml)

Sistema de gestao de leads para corretores de planos de saude, com operacao em Kanban, pipeline de vendas, gerenciamento de equipe e fluxo de assinaturas/pagamentos.

## O que e o projeto

O **Lead Flow App** centraliza o ciclo comercial:

- Captacao e organizacao de leads
- Acompanhamento por status no board
- Colaboracao entre manager e operadores
- Gestao de assinatura com integracao de pagamentos

O projeto foi construido com Next.js (App Router), Supabase, PostgreSQL e Prisma.

## Como funciona

1. O usuario cria conta e autentica via Supabase.
2. O manager organiza equipe e define responsabilidades.
3. Leads entram no board e avancam pelos estagios do funil.
4. O sistema registra atividades, notificacoes e atualizacoes.
5. Assinaturas e cobrancas sao processadas pelo Asaas, com validacao por webhooks.

## Stack principal

### Frontend

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS + shadcn/ui + Radix UI
- React Hook Form + Zod

### Backend

- Next.js Route Handlers (`app/api/v1`)
- Camadas de UseCase e Service
- Prisma ORM + PostgreSQL (Supabase)
- Supabase Auth e Storage
- Integracoes: Asaas (pagamentos) e Resend (email)

## Pre-requisitos

- Node.js `>=24` (conforme `package.json`)
- Bun
- Docker Desktop (para o ambiente Supabase local)
- Supabase CLI (`npm install -g supabase` ou `brew install supabase/tap/supabase`)
- Conta Asaas Sandbox (se for testar pagamentos/webhooks)

## Instalacao e execucao

1. Clone o repositorio:

```bash
git clone https://github.com/matheuswillock/lead-flow-app.git
cd lead-flow-app
```

2. Instale as dependencias:

```bash
bun install
```

3. Configure as variaveis de ambiente:

```bash
# Linux/macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Edite o `.env` com as credenciais reais dos servicos (Supabase remoto, Asaas, Resend e chaves de criptografia).

4. Defina o usuario de teste local no `.env` (conta sintetica, nunca uma conta real):

```bash
LOCAL_DEV_USER_EMAIL=joaocleber@gmail.com
LOCAL_DEV_USER_PASSWORD=Senha@1234
```

5. Gere o cliente Prisma:

```bash
bun run prisma:generate
```

6. Inicie a aplicacao:

```bash
bun run dev
```

Acesse `http://localhost:3000` e entre com o e-mail/senha do passo 4.

O `bun run dev` (modo **db-only**, padrao) faz o resto sozinho na primeira execucao:

- sobe o Postgres local no Docker (`127.0.0.1:55322`, `docker-compose.local.yml`);
- aplica as migrations pendentes de `supabase/migrations/` no banco local;
- seeda o catalogo do backoffice;
- cria o usuario de teste: a conta entra no Auth remoto (o login do db-only passa
  por la), e o Profile + "Time Local" + assinatura vitalicia ficam **apenas** no
  Postgres local. Nenhum dado de producao e lido ou alterado.

O banco local comeca vazio (CRM sem leads). Para trabalhar com dados reais,
tudo e opt-in por flag:

```bash
bun run dev -- --clone       # clona o banco remoto para o Postgres local
bun run dev -- --remote-db   # SEM Docker: aponta direto para o banco remoto (escritas reais!)
```

Realtime local tambem e opt-in:

```bash
bun dev -- --hybrid    # + Realtime local (exige docker/local/.env.local-stack)
```

7. (Opcional) Para testar webhook local do Asaas:

```bash
bun run ngrok
```

---

## Banco de dados local

O projeto usa o **Supabase CLI** para replicar o ambiente remoto localmente via Docker.
A stack local inclui: PostgreSQL, Auth, Studio, Storage, Realtime e Edge Functions — identico ao ambiente de producao.

### O que o Supabase local oferece

| Servico | URL local | Descricao |
|---|---|---|
| API / PostgREST | http://127.0.0.1:54321 | Endpoint REST do banco |
| Supabase Studio | http://127.0.0.1:54323 | Interface visual (tabelas, SQL, Auth) |
| Postgres | `localhost:54322` | Conexao direta ao banco |
| Mailpit | http://127.0.0.1:54324 | Captura de emails enviados pelo Auth |

### Comandos principais

```bash
# Subir a stack completa (aplica migrations automaticamente)
supabase start

# Verificar status e obter as credenciais locais
supabase status

# Parar a stack (mantém os dados)
supabase stop

# Parar e remover todos os dados locais
supabase stop --no-backup

# Resetar o banco local e reaplicar todas as migrations do zero
bun run db:migrate:reset:local

# Ver status das migrations (local vs remoto)
bun run db:migrate:status
```

### Migrations

As migrations ficam em `supabase/migrations/` e sao criadas com:

```bash
bun run db:migrate:new <nome-da-migration>
# Cria: supabase/migrations/<timestamp>_<nome>.sql
```

Ao rodar `supabase start` ou `bun run db:migrate:reset:local`, todas as migrations sao aplicadas automaticamente ao banco local na ordem cronologica.

Para aplicar ao banco remoto (requer autorizacao explicita):

```bash
bun run db:migrate:push:dry-run   # visualiza o que sera aplicado
bun run db:migrate:push           # aplica ao remoto vinculado
```

### Configurando o .env.local para usar o banco local

Crie (ou edite) o arquivo `.env.local` na raiz do projeto com as credenciais locais.
Essas credenciais sao estaticas para todo projeto Supabase local — nao sao segredos:

```env
# Supabase local (supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Prisma — conecta direto ao Postgres do Supabase local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

O Next.js carrega `.env.local` com prioridade sobre `.env`, entao `bun run dev`
usara automaticamente o banco local enquanto o arquivo existir.

> **Nota:** O Prisma CLI (`bun run prisma:db:pull`, `prisma studio` etc.) le o `.env`,
> nao o `.env.local`. Comandos Prisma CLI continuam apontando ao banco remoto por padrao.

### Alternativa: PostgreSQL bare via docker-compose

O arquivo `docker-compose.yml` sobe apenas um PostgreSQL sem os servicos Supabase.
Use apenas para casos especificos (testes de integracao standalone, etc.).
Para desenvolvimento normal, prefira `supabase start`.

```bash
docker compose up -d    # sobe o Postgres na porta 5433
docker compose down     # para (mantém dados)
docker compose down -v  # para e remove os dados
```

Conexao: `postgresql://postgres:postgres@localhost:5433/leadflow_dev`

---

## Scripts mais usados

```bash
# Desenvolvimento
bun run dev
bun dev -- --hybrid
bun run build
bun run start

# Qualidade
bun run typecheck
bun run lint
bun run format

# Banco — Supabase CLI
supabase start
supabase stop
bun run db:migrate:new <nome>
bun run db:migrate:status
bun run db:migrate:reset:local

# Banco — Prisma
bun run prisma:generate
bun run prisma:studio
bun run prisma:db:pull
```

## Arquitetura do projeto

### Frontend

- As telas ficam no `app/`, com rotas publicas e protegidas.
- Rotas protegidas usam o segmento dinamico `app/[supabaseId]/`.
- Componentes reutilizaveis ficam em `components/` (`ui`, `forms`, `kanban`, etc.).
- Estado de pagina/feature usa Context + hooks por dominio.
- Servicos de consumo de API ficam organizados por feature.

Fluxo tipico no frontend:

`Page -> Context/Hook -> Service -> API /api/v1`

### Backend

O backend segue separacao por responsabilidades:

`Route (HTTP) -> UseCase (regra de negocio) -> Service (logica de dominio, quando necessario) -> Repository/Prisma (dados)`

- **Routes**: `app/api/v1/**/route.ts`
- **UseCases**: `app/api/useCases/*`
- **Services**: `app/api/services/*`
- **Infra/Repositorios**: `app/api/infra/data/repositories/*`
- **Persistencia**: Prisma + PostgreSQL (`prisma/schema.prisma`)

Padrao de resposta dos casos de uso: classe `Output` em `lib/output`.

## Estrutura resumida

```text
app/
  (auth)/                 # autenticacao
  [supabaseId]/           # area protegida (dashboard, board, pipeline, etc.)
  api/
    v1/                   # endpoints versionados
    useCases/             # casos de uso
    services/             # logica de dominio
    infra/data/repositories/
components/               # UI reutilizavel e componentes de feature
lib/                      # utilitarios, validacoes, clientes e servicos
prisma/                   # schema e seed
supabase/
  migrations/             # migrations SQL (fonte de verdade do schema)
  config.toml             # configuracao do ambiente Supabase local
docs/                     # documentacao tecnica complementar
```

## Time desenvolvedor

- **Matheus Willock** - responsavel pelo desenvolvimento do projeto

## Documentacao complementar

- [Guia rapido](./docs/QUICK_START.md)
- [Guia de arquitetura](./docs/ARCHITECTURE_GUIDE.md)
- [Configuracao Asaas](./docs/ASAAS_CONFIGURATION.md)
- [Setup de webhooks](./docs/WEBHOOK_SETUP.md)
- [Fluxo webhook-driven de pagamentos](./docs/WEBHOOK_DRIVEN_PAYMENT_FLOW.md)

## Licenca

MIT.
