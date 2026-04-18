# Lead Flow App (Corretor Studio)

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
- Banco PostgreSQL (recomendado: Supabase)
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

Edite o `.env` com as credenciais reais dos servicos (Supabase, banco, Asaas, Resend e chaves de criptografia).

4. Gere cliente Prisma e aplique migracoes:

```bash
bun run prisma:generate
bun run prisma:migrate
```

5. (Opcional) Rode seed:

```bash
bun run prisma:seed
```

6. Inicie a aplicacao:

```bash
bun run dev
```

Acesse `http://localhost:3000`.

7. (Opcional) Para testar webhook local do Asaas:

```bash
bun run ngrok
```

## Scripts mais usados

```bash
# Desenvolvimento
bun run dev
bun run build
bun run start

# Qualidade
bun run typecheck
bun run lint
bun run format

# Banco
bun run prisma:generate
bun run prisma:migrate
bun run prisma:studio
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
prisma/                   # schema, migracoes e seed
docs/                     # documentação tecnica complementar
```

## Time desenvolvedor

- **Matheus Willock** - responsavel pelo desenvolvimento do projeto

## documentação complementar

- [Guia rapido](./docs/QUICK_START.md)
- [Guia de arquitetura](./docs/ARCHITECTURE_GUIDE.md)
- [Configuracao Asaas](./docs/ASAAS_CONFIGURATION.md)
- [Setup de webhooks](./docs/WEBHOOK_SETUP.md)
- [Fluxo webhook-driven de pagamentos](./docs/WEBHOOK_DRIVEN_PAYMENT_FLOW.md)

## Licenca

MIT.
