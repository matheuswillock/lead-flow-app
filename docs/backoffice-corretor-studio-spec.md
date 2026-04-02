# Backoffice Corretor Studio

## Objetivo
Criar um módulo interno de backoffice dentro do `lead-flow-app`, acessível pela rota `/backoffice`, reutilizando a arquitetura atual de frontend, backend, autenticação com Supabase e integração com Asaas.

## Escopo inicial
1. Gerar novo cliente.
2. Gerar pagamento.
3. Monitorar pagamento.
4. Cadastrar novos usuários backoffice.
5. Restringir usuários backoffice ao domínio `@corretorstudio.com`.
6. Definir `matheuswillock@corretorstudio.com` como usuário inicial com acesso total.
7. Preparar integração operacional para criação de mailbox na Hostinger por usuário backoffice.

## Decisões de arquitetura
- Reutilizar o app atual em vez de criar uma segunda aplicação.
- Reutilizar Supabase Auth como fonte de autenticação.
- Manter `Profile.role = backoffice` para autorização transversal no sistema.
- Criar tabela dedicada `backoffice_users` para metadados operacionais do time interno.
- Vincular `backoffice_users.profile_id -> profiles.id` em relação 1:1.
- Reaproveitar padrões já existentes de `app/api`, Prisma, services e useCases.
- Reaproveitar a identidade visual atual do Corretor Studio.
- Reaproveitar integração atual com Asaas para customer/payment/subscription status.

## Modelagem proposta
### Prisma
Adicionar:

```prisma
model BackofficeUser {
  id                  String   @id @default(uuid()) @db.Uuid
  profileId           String   @unique @db.Uuid
  email               String   @unique @db.Text
  fullAccess          Boolean  @default(false)
  isActive            Boolean  @default(true)
  mailboxStatus       String?  @db.Text
  mailboxProvisionedAt DateTime? @db.Timestamptz(6)
  createdByProfileId  String?  @db.Uuid
  createdAt           DateTime @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime @updatedAt @db.Timestamptz(6)

  profile            Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  createdByProfile   Profile?  @relation("BackofficeUserCreator", fields: [createdByProfileId], references: [id], onDelete: SetNull)

  @@index([isActive])
  @@map("backoffice_users")
}
```

### Ajustes complementares no `Profile`
- Continuar usando `role = backoffice`.
- Não criar autenticação paralela.
- `matheuswillock@corretorstudio.com` deve ser criado em `auth.users`, `profiles` e `backoffice_users`.

## Regras de acesso
### Perfis
- `backoffice` com `fullAccess = true`: acesso total ao módulo.
- `backoffice` com `fullAccess = false`: acesso operacional padrão.
- `manager` e `operator`: sem acesso ao módulo `/backoffice`.

### Validações
- Todo usuário backoffice deve ter email terminando em `@corretorstudio.com`.
- O módulo `/backoffice` só pode ser acessado por usuários autenticados com role `backoffice`.
- `matheuswillock@corretorstudio.com` nasce como `fullAccess = true`.

## Rotas e navegação
### Frontend
Criar área protegida própria:
- `app/backoffice/layout.tsx`
- `app/backoffice/page.tsx`
- `app/backoffice/clients/page.tsx`
- `app/backoffice/payments/page.tsx`
- `app/backoffice/users/page.tsx`

### Sidebar do backoffice
Itens iniciais:
- Dashboard
- Clientes
- Pagamentos
- Usuários backoffice

### Middleware
Atualizar `middleware.ts` para:
- incluir `/backoffice` como rota protegida;
- impedir acesso de `manager` e `operator`;
- permitir apenas usuário autenticado com `role = backoffice`;
- redirecionar não autorizados para rota apropriada.

## Backend proposto
### APIs internas
Criar endpoints seguindo padrão já existente:
- `POST /api/v1/backoffice/clients`
- `GET /api/v1/backoffice/clients`
- `GET /api/v1/backoffice/clients/[id]`
- `POST /api/v1/backoffice/payments`
- `GET /api/v1/backoffice/payments`
- `GET /api/v1/backoffice/payments/[id]`
- `POST /api/v1/backoffice/users`
- `GET /api/v1/backoffice/users`
- `PATCH /api/v1/backoffice/users/[id]`

### Casos de uso
#### Gerar novo cliente
- Criar cliente no Asaas se ainda não existir.
- Criar ou atualizar `Profile`/registro de domínio necessário para cliente.
- Persistir referência do cliente Asaas.

#### Gerar pagamento
- Permitir cobrança avulsa inicialmente.
- Reutilizar `lib/asaas.ts`.
- Criar service específico para payments se ainda não existir.
- Persistir metadados do pagamento localmente para monitoramento interno.

#### Monitorar pagamento
- Listar pagamentos e status.
- Exibir `PENDING`, `RECEIVED`, `CONFIRMED`, `OVERDUE`, `REFUNDED`.
- Reaproveitar webhook do Asaas para atualização assíncrona de status.

#### Criar usuário backoffice
Fluxo:
1. Validar domínio `@corretorstudio.com`.
2. Criar usuário no Supabase Auth.
3. Criar `Profile` com `role = backoffice`.
4. Criar `BackofficeUser`.
5. Disparar provisionamento de mailbox na Hostinger.

## Hostinger mailbox
### Diretriz de implementação
Como a criação da mailbox depende do painel/API disponível na conta Hostinger, a implementação deve ser desacoplada.

Criar interface:
- `IMailboxProvisioningService`

Implementações:
- `HostingerMailboxProvisioningService` (real, se API disponível)
- `NoopMailboxProvisioningService` (fallback operacional/manual)

### Fluxo
- Ao criar usuário backoffice, registrar `mailboxStatus = pending`.
- Se integração automática existir, provisionar e atualizar para `active`.
- Se não existir API disponível, manter `pending_manual_action` e exibir instrução operacional no backoffice.

## Seed inicial
Adicionar script/seed idempotente para garantir:
- existência do usuário `matheuswillock@corretorstudio.com`;
- `role = backoffice`;
- `fullAccess = true`;
- registro correspondente em `backoffice_users`.

## UI
### Padrões visuais
- Reutilizar os componentes atuais (`sidebar`, `header`, `table`, `dialog`, `form`, `skeleton`).
- Reutilizar a mesma identidade visual da plataforma principal.
- Não misturar o menu do cliente com o menu operacional interno.

### Telas
#### Dashboard backoffice
- cards de resumo: clientes criados, cobranças pendentes, cobranças confirmadas, usuários backoffice ativos.

#### Clientes
- tabela com busca e ação “novo cliente”.

#### Pagamentos
- tabela com status, método, valor, vencimento, cliente e ações de detalhe.

#### Usuários backoffice
- tabela com nome, email, full access, status da mailbox e status de acesso.
- modal para criar usuário.

## Segurança
- Nunca confiar no frontend para role.
- Validar role e vínculo do backoffice em todas as rotas `/api/v1/backoffice/*`.
- Restringir criação de usuários backoffice a operadores com `fullAccess = true`.
- Auditar `createdByProfileId` em toda criação interna relevante.

## Observações sobre a base atual
O projeto atual já oferece uma boa base para esse módulo:
- já existe `UserRole.backoffice` no Prisma;
- já existe middleware centralizado;
- já existe `UserContext` e layout com sidebar;
- já existe integração com Supabase SSR;
- já existe integração com Asaas.

## Ordem sugerida de implementação
1. Migration Prisma para `backoffice_users`.
2. Seed do usuário inicial.
3. Guardas de middleware e autorização server-side.
4. Layout `/backoffice` reutilizando componentes atuais.
5. CRUD de usuários backoffice.
6. Fluxo de criação de cliente.
7. Fluxo de geração de cobrança.
8. Monitoramento de pagamentos.
9. Provisionamento de mailbox Hostinger.
10. Ajustes finais de UX e logs.

## Critérios de aceite
- `/backoffice` exige autenticação.
- somente `backoffice` acessa `/backoffice`.
- `matheuswillock@corretorstudio.com` entra com acesso total.
- criação de usuário backoffice exige domínio `@corretorstudio.com`.
- usuário criado gera registros coerentes em Supabase Auth, `profiles` e `backoffice_users`.
- backoffice consegue criar cliente, gerar cobrança e acompanhar status.
- criação/provisionamento de mailbox fica registrada com status visível.
