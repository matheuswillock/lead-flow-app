# Spec: Patrocinador Autorizado — Fonte Única, Enforcement no Servidor e Gestão sem Deploy

**Data:** 2026-07-06 · **Atualizado:** 2026-07-09
**Base:** `ASSOCIATED_SPONSOR_AUDIT.md` (mesma rodada). Números de seção citados (ex.: 3.3) referem-se ao audit.
**Status:** Estágios 1–5 **implementados e commitados** (D1 opção A executada: tabela `backoffice_authorized_sponsors`, service `assertAuthorizedSponsor`, rotas + tela Backoffice, drop de `canSponsorAccounts`, testes dos 4 UseCases/Services). Pendentes: **Estágio 0** (verificação em produção), **push autorizado das migrations** e **Estágio 6** (cobertura do fluxo Proposta, adicionado em 09/07).

## Definições do owner (2026-07-09)

- **Usuário Associado** = usuário do produto Corretor Studio com outro usuário como **patrocinador**. Hoje existem exatamente 2 patrocinadores válidos: `matheuswillock@gmail.com` e `bruno@onsidemarketing.com.br` (grafia correta: **onside** — confirma o typo `onseidemarketing` das migrations históricas como bug).
- **Fluxo Proposta:** quando o associado move um lead para **Proposta** (`offerSubmission`), o sistema envia notificação e adiciona o lead à seção **Backoffice > Associados** do menu do patrocinador, para seguir o fluxo de registro na operadora (crítica / registrar venda). Auditado como item 8 do audit (seção 3.8): **já implementado** ponta a ponta (gatilho em `LeadUseCase.handleOfferSubmissionAlert`, fila via `LeadProposalReview`, notificação in-app + push + e-mail para patrocinador, master associado e backoffice do patrocinador). Lacuna restante: **sem testes** nesse caminho → Estágio 6.

---

## Background

O tier Associado/Convidado já existe (spec `specs/associados.md`, fases 1-6 implementadas no que toca a modelo, conversão, adesão e fila). A auditoria encontrou que a **restrição de patrocinador** — a regra com efeito financeiro direto, já que `guest` concede assinatura permanente gratuita — não é imposta no servidor: o flag `Profile.canSponsorAccounts` só filtra dropdowns, o seed que marca os 2 patrocinadores autorizados tem um typo silencioso no e-mail do Bruno (`onseidemarketing` vs `onsidemarketing`), não há UI para gerenciar a lista, e a trilha de auditoria é parcial.

### Lacunas (da auditoria)

- 3.2 Fonte única existe (`canSponsorAccounts`) mas o seed com typo provavelmente deixou o Bruno de fora em produção; flag usado só para popular dropdown.
- 3.3 Nenhum caminho de escrita valida `canSponsorAccounts`; validação parcial (`isMaster`, não-self) duplicada em 2 branches do `convert()` e ausente no fluxo de adesão.
- 3.4 Gerenciar a lista exige migration/SQL — na prática, deploy.
- 3.5 `backoffice_adhesions.sponsorMasterId` sem FK; RLS habilitado sem policies nas tabelas da fila.
- 3.7 Adesão grava `assignedByProfileId: null`; sem histórico de conversões; `sponsorMasterId`/`canSponsorAccounts` sem trilha de quem/quando.
- 5 `HealthPlanUseCase` com RBAC por e-mail literal (mesmo anti-padrão, fora do fluxo de patrocínio).
- 6 (critique #5) Zero testes em `BackofficeProfileUserTypeUseCase` e `BackofficeAdhesionUseCase`.

## Goals

### Primários (must-have)

1. **Enforcement no servidor:** toda escrita que define um patrocinador (`convert()` para `associate`/`guest`, criação de adesão, criação de conta pós-adesão) valida que o profile indicado é um patrocinador autorizado — em **um único Service**.
2. **Corrigir o estado de produção:** Bruno (`bruno@onsidemarketing.com.br`) marcado como patrocinador via migration de dados idempotente, após confirmação do e-mail real no banco.
3. **Gestão sem deploy:** tela no Backoffice para conceder/revogar autorização de patrocinador, com registro de quem/quando; revogação não quebra contas já associadas.
4. **Rastreabilidade completa:** toda concessão/revogação de patrocinador e toda conversão de tipo registra autor e timestamp; o fluxo de adesão deixa de gravar `assignedByProfileId: null`.
5. **Cobertura de testes** (unit + integração) para o Service de autorização, `BackofficeProfileUserTypeUseCase.convert` e o caminho de sponsor da adesão — pré-requisito de cada estágio, mesmo padrão WhatsApp/E-mail/Dialer.

### Secundários

6. FK em `backoffice_adhesions.sponsorMasterId` (fail fast antes do pagamento).
7. Eliminar o RBAC por e-mail literal de `HealthPlanUseCase` (mesmo anti-padrão, mesma frente).
8. Corrigir o e-mail do Bruno em `specs/associados.md` (origem do typo).
9. Remover senhas em texto plano de `prisma/seed.ts`/`seed-app.ts` (achado de segurança da mesma busca).

## Non-Goals

- Redesenhar o tier Associado/Convidado (modelo, fila, privacidade, crítica de proposta) — tudo isso funciona e tem spec própria (`specs/associados.md`).
- Multi-patrocinador por conta (o modelo já suporta n patrocinadores autorizados e 1 patrocinador por conta; não muda).
- Cobrança/benefício do `associate` (paga normal hoje; decisão comercial fora desta rodada).
- Expiração/revisão periódica de contas `guest` (registrado como pergunta aberta ao owner, não bloqueia).
- Migrar a fila Associados para o módulo admin `app/backoffice/` (decisão já registrada na spec original: fica no produto).

---

## Decisões arquiteturais

### D1 — Fonte única: tabela dedicada `BackofficeAuthorizedSponsor` (recomendado) vs manter o flag ⚠️ decisão do owner

**Opção A (recomendada): tabela `backoffice_authorized_sponsors`.**

```prisma
model BackofficeAuthorizedSponsor {
  id           String    @id @default(uuid()) @db.Uuid
  profileId    String    @unique @db.Uuid
  isActive     Boolean   @default(true)
  grantedByProfileId String?  @db.Uuid   // master backoffice que concedeu
  grantedAt    DateTime  @default(now()) @db.Timestamptz(6)
  revokedByProfileId String?  @db.Uuid
  revokedAt    DateTime? @db.Timestamptz(6)
  notes        String?   @db.Text

  profile   Profile  @relation("AuthorizedSponsorProfile", fields: [profileId], references: [id], onDelete: Restrict)
  grantedBy Profile? @relation("AuthorizedSponsorGrantedBy", fields: [grantedByProfileId], references: [id], onDelete: SetNull)
  revokedBy Profile? @relation("AuthorizedSponsorRevokedBy", fields: [revokedByProfileId], references: [id], onDelete: SetNull)

  @@index([isActive])
  @@map("backoffice_authorized_sponsors")
}
```

Por quê: (a) respeita o isolamento do Backoffice — é uma regra de aprovação interna, prefixo `Backoffice*`, referenciando `profileId` (o único acoplamento cross-módulo permitido); (b) a trilha de auditoria (quem concedeu/revogou, quando) vem de graça na própria tabela — o boolean nunca teria isso; (c) revogar = `isActive: false` preservando histórico, em vez de flipar um flag sem memória. `Profile.canSponsorAccounts` é **descontinuado** como fonte de verdade (mantido no schema até o Estágio 5, quando é removido; nenhum código novo o consulta a partir do Estágio 1).

**Opção B: manter `Profile.canSponsorAccounts` + tabela de log separada.** Menos migração, mas duas estruturas para manter em sincronia e o flag continua sem dono claro de módulo. Só escolher se o owner quiser mudança mínima.

**Descartado: env var `AUTHORIZED_SPONSOR_EMAILS`.** Reintroduziria e-mail como identidade (o typo do Bruno é a prova do risco), exigiria redeploy para mudar a lista e não tem trilha.

### D2 — Ponto único de validação: `BackofficeSponsorAuthorizationService`

Novo service em `app/api/services/backofficeSponsorAuthorization/` (interface + implementação, padrão do projeto):

```typescript
interface IBackofficeSponsorAuthorizationService {
  /** Lança/retorna erro de domínio se o profile não for patrocinador autorizado ativo. */
  assertAuthorizedSponsor(sponsorProfileId: string): Promise<SponsorAuthorizationResult>
  listAuthorizedSponsors(): Promise<AuthorizedSponsorOption[]>   // substitui os 2 findMany por canSponsorAccounts
  grant(profileId: string, grantedByProfileId: string, notes?: string): Promise<...>
  revoke(profileId: string, revokedByProfileId: string): Promise<...>
}
```

`assertAuthorizedSponsor` valida, nesta ordem: profile existe → `isMaster` → registro ativo em `backoffice_authorized_sponsors`. Consumidores (todos passam a chamar o service, nenhum reimplementa):

1. `BackofficeProfileUserTypeUseCase.convert` — branches `associate` e `guest` (substitui as checagens copiadas e coladas; mantém a checagem não-self no UseCase, que é regra do fluxo, não do patrocinador).
2. `BackofficeAdhesionUseCase.create` / `BackofficeAdhesionService.create` — valida **antes** de criar a adesão (fail fast, audit critique #2).
3. `BackofficeAdhesionService.ensureAccountForPaidAdhesion` — revalida antes de copiar para o Profile (o patrocinador pode ter sido revogado entre a adesão e o pagamento; nesse caso a conta é criada **sem** vínculo + alerta de log, nunca falha a criação da conta paga — decisão registrável em D2a se o owner preferir bloquear).
4. Rotas de dropdown (`sponsor-masters`, `adhesions` getOptions) — via `listAuthorizedSponsors()`.

Frontend continua validando só presença (UX), rota continua validando só tipo/formato — a autorização mora exclusivamente no service.

### D3 — Correção do typo: verificação primeiro, migration de dados depois

Estágio 0 confirma em produção (SQL read-only, seção 4 do audit) qual e-mail existe. A migration de correção (`bun run db:migrate:new seed-authorized-sponsors-fix`) então: (a) insere os 2 patrocinadores em `backoffice_authorized_sponsors` resolvendo por **ambas** as grafias (`onside`/`onseide`) para cobrir qualquer ambiente; (b) é idempotente (`ON CONFLICT ("profileId") DO NOTHING`); (c) termina com um `DO $$ ... RAISE WARNING` se nenhum profile do Bruno for encontrado — visível no log de push, em vez de no-op mudo. Backfill: qualquer profile com `canSponsorAccounts = true` também entra na tabela (preserva o Matheus já marcado).

### D4 — FK e integridade na adesão

Migration schema (`bun run db:migrate:from-prisma`) adiciona a FK `backoffice_adhesions.sponsorMasterId → corretor_studio_profiles(id) ON DELETE SET NULL`. Antes dela, a migration de dados anula sponsors órfãos (`UPDATE ... SET "sponsorMasterId" = NULL WHERE` não existe profile) — a query de detecção já está no audit 4.2.

### D5 — Rastreabilidade da adesão

`ensureAccountForPaidAdhesion` passa a preencher `assignedByProfileId` com o `Profile.id` vinculado ao `BackofficeUser` criador da adesão (`BackofficeUser.profileId`, elo já permitido), com fallback `null` apenas quando o backoffice user não tem profile vinculado. Sem novo campo no schema — usa a trilha que já existe e estava sendo desperdiçada.

### D6 — Tela de gestão no Backoffice (sem deploy)

Nova rota `app/api/v1/backoffice/authorized-sponsors/` (GET lista / POST grant / DELETE revoke) protegida por `getBackofficeAccess()` + `requireMasterAccess` — somente masters do Backoffice gerenciam a lista. UI em `app/backoffice/(app)/clients/authorized-sponsors/` com o scaffold `features/` canônico. Revogação exibe aviso com o número de contas patrocinadas ativas (`countSponsoredAccounts`) e deixa claro que os vínculos existentes são preservados. Postman atualizado no mesmo estágio.

### D7 — `HealthPlanUseCase` sem e-mail literal

A checagem `profileEmail !== HEALTH_PLAN_ADMIN_EMAIL` (audit 5) vira uma checagem de master backoffice (`BackofficeUser` ativo com role master) ou, mínimo aceitável, env var `HEALTH_PLAN_ADMIN_EMAILS` lida em um único ponto. Recomendado: backoffice user, pois "gerir catálogo global de planos" é função administrativa. Escopo pequeno e independente — estágio próprio para não contaminar a frente de patrocínio.

---

## Estágios

> Regras para todos os estágios: `Route → UseCase → [Service] → Prisma`; UseCase retorna `Output`; testes obrigatórios antes de fechar o estágio; validação `bun run typecheck && bun run lint && bun run governance:check && bun run lint:pt-br` (+ `design:check` quando houver UI); nenhum push de migration para o remoto sem autorização explícita do owner; não criar `*_SUMMARY.md`.

### Estágio 0 — Verificação em produção (read-only, bloqueante)

**Prompt Codex:**

```text
Com acesso autorizado ao banco de produção do Corretor Studio (somente leitura), execute as
queries da seção 4 de ASSOCIATED_SPONSOR_AUDIT.md e reporte:
1. O e-mail exato do profile do Bruno (onside vs onseide) e o valor de canSponsorAccounts
   dele e do matheuswillock@gmail.com.
2. Todas as contas com userType associate/guest, seus patrocinadores e se o patrocinador
   tem canSponsorAccounts = true.
3. Adesões com sponsorMasterId apontando para profile inexistente.
Não altere nada. Registre o resultado como comentário no PR desta spec.
```

**Não tocar:** qualquer escrita no banco; qualquer arquivo de código.
**Aceite:** resultado das 3 queries registrado; hipótese do typo confirmada ou refutada.
**Validação manual:** conferir no Backoffice (dropdown de patrocinador do dialog de tipo de usuário) se o Bruno aparece hoje.

### Estágio 1 — Tabela `BackofficeAuthorizedSponsor` + seed corrigido

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md. Implemente a fonte única de patrocinadores autorizados:

1. Adicione o model BackofficeAuthorizedSponsor ao prisma/schema.prisma conforme D1 da
   ASSOCIATED_SPONSOR_SPEC.md (tabela backoffice_authorized_sponsors, profileId @unique,
   isActive, grantedBy/grantedAt, revokedBy/revokedAt, notes) e as relações inversas no
   model Profile.
2. Gere a migration de schema com: bun run db:migrate:from-prisma -- backoffice-authorized-sponsors
   (requer Supabase local na porta 55322). Revise o SQL gerado.
3. Crie a migration de dados com: bun run db:migrate:new seed-authorized-sponsors-fix
   contendo SQL idempotente que:
   a. Insere em backoffice_authorized_sponsors todo profile com canSponsorAccounts = true
      (backfill), ON CONFLICT ("profileId") DO NOTHING.
   b. Insere o profile cujo email seja bruno@onsidemarketing.com.br OU
      bruno@onseidemarketing.com.br (cobre o typo histórico) e o matheuswillock@gmail.com.
   c. Termina com DO $$ ... $$ que emite RAISE WARNING se nenhum profile com email
      ILIKE 'bruno@ons%idemarketing.com.br' foi autorizado — nunca falha silenciosamente.
4. Valide o replay local: bun run db:migrate:reset:local. NÃO execute db:migrate:push.
5. Corrija bruno@onseidemarketing.com.br → bruno@onsidemarketing.com.br em
   specs/associados.md (linhas 3 e 599).

Testes: não há lógica de runtime neste estágio; garanta que prisma generate e typecheck passam.
```

**Não tocar:** UseCases/Services/rotas existentes; `canSponsorAccounts` (permanece no schema, intocado); fluxo de adesão; frontend.
**Aceite:** migration de schema gerada via CLI (não manual); seed idempotente com warning anti-no-op; replay local limpo; spec original corrigida.
**Validação manual:** `bun run db:migrate:reset:local` e conferir `SELECT * FROM backoffice_authorized_sponsors` no banco local (deve conter os profiles dos seeds locais marcados).

### Estágio 2 — `BackofficeSponsorAuthorizationService` + enforcement

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md. Crie o ponto único de validação de patrocinador:

1. Crie app/api/services/backofficeSponsorAuthorization/ com
   IBackofficeSponsorAuthorizationService.ts e BackofficeSponsorAuthorizationService.ts
   (métodos assertAuthorizedSponsor, listAuthorizedSponsors, grant, revoke — assinatura em
   D2 da ASSOCIATED_SPONSOR_SPEC.md). Repositório dedicado em
   app/api/infra/data/repositories/backofficeSponsorAuthorization/ (interface + impl).
   assertAuthorizedSponsor valida: profile existe → isMaster → registro ativo na tabela.
2. BackofficeProfileUserTypeUseCase.convert: nos branches associate e guest, substitua a
   checagem findIsMaster(sponsorMasterId) por assertAuthorizedSponsor via service injetado
   no construtor. Mantenha a checagem não-self e as mensagens de erro em pt-BR
   ("Patrocinador não autorizado" para falha de autorização).
3. BackofficeAdhesionUseCase.create: quando userType for associate/guest, além da presença,
   chame assertAuthorizedSponsor antes de service.create.
4. BackofficeAdhesionService.ensureAccountForPaidAdhesion: revalide o sponsor antes de
   createPaidManagerProfile; se revogado nesse meio-tempo, crie a conta com
   sponsorMasterId: null e console.error identificando a adesão (não falhe a conta paga).
5. Rotas sponsor-masters (listSponsorOptions) e adhesions getOptions: troque os findMany
   por canSponsorAccounts pelo listAuthorizedSponsors() do service.

Testes obrigatórios (padrão dos testes existentes em app/api/useCases/**/*.test.ts):
- BackofficeSponsorAuthorizationService: autorizado ativo passa; revogado falha; não-master
  falha; profile inexistente falha.
- BackofficeProfileUserTypeUseCase.convert: associate/guest com sponsor não autorizado
  retorna Output inválido e não escreve nada; com sponsor autorizado segue o fluxo atual
  (incluindo hasPermanentSubscription true para guest e false para associate); não-self
  mantido; conversão reversa com propostas abertas mantida.
- Adesão: create com sponsor não autorizado retorna erro antes de criar a adesão.

Rode typecheck, lint, governance:check e lint:pt-br. Nenhuma migration neste estágio.
```

**Não tocar:** frontend (os dialogs continuam funcionando — a rota de opções muda de fonte, não de contrato); tabelas/fila Associados; `AssociateBackofficeAccessUseCase`; migrations.
**Aceite:** nenhum `findMany({ where: { canSponsorAccounts: true } })` restante fora do repositório novo; nenhuma escrita de `sponsorMasterId` sem passar pelo service; todos os testes novos verdes.
**Validação manual:** no Backoffice local, converter conta para Convidado escolhendo patrocinador válido (sucesso) e via Postman com um `sponsorMasterId` de master comum (deve retornar 400 "Patrocinador não autorizado").

### Estágio 3 — Integridade e rastreabilidade da adesão

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md.

1. Migration de dados (bun run db:migrate:new fix-orphan-adhesion-sponsors): UPDATE
   idempotente anulando backoffice_adhesions.sponsorMasterId sem profile correspondente.
2. Adicione a relação/FK no prisma/schema.prisma (BackofficeAdhesion.sponsorMaster →
   Profile, ON DELETE SET NULL) e gere a migration de schema via
   bun run db:migrate:from-prisma -- backoffice-adhesions-sponsor-fk. Valide replay local.
3. BackofficeAdhesionService: nas 3 chamadas de upsertUserTypeAssignment do
   ensureAccountForPaidAdhesion, preencha assignedByProfileId com o Profile.id do
   BackofficeUser criador da adesão (via createdByBackofficeUserId → BackofficeUser.profileId),
   fallback null quando não houver vínculo.

Testes: adesão guest criada por backoffice user com profile vinculado grava
assignedByProfileId correto; sem vínculo grava null sem falhar.
NÃO execute db:migrate:push.
```

**Não tocar:** fluxo de pagamento/Asaas; contratos das rotas de adesão; frontend.
**Aceite:** FK presente no schema local após replay; nenhum sponsor órfão sobrevivente; `assignedByProfileId` populado no caminho de adesão; testes verdes.
**Validação manual:** criar adesão Convidado local ponta a ponta e conferir `profile_user_type_assignments.assignedByProfileId` preenchido.

### Estágio 4 — Tela Backoffice "Patrocinadores" + rotas de gestão

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md, DESIGN.md e o skill design-system-guard (obrigatório
para todo o JSX novo; use shadcn MCP antes de criar componentes; tokens semânticos, sem hex).

1. Rotas em app/api/v1/backoffice/authorized-sponsors/route.ts:
   - GET: lista patrocinadores (ativos e revogados) com contagem de contas patrocinadas.
   - POST { profileId, notes? }: grant — valida isMaster, registra grantedByProfileId do
     acesso backoffice.
   - DELETE (route.ts em [profileId]/): revoke — registra revokedByProfileId/revokedAt,
     nunca deleta a linha.
   Todas com getBackofficeAccess() + requireMasterAccess, chamando um novo
   BackofficeAuthorizedSponsorUseCase que retorna Output e delega ao service do Estágio 2.
2. UI em app/backoffice/(app)/clients/authorized-sponsors/ com scaffold canônico
   (page.tsx fino, features/context|services|container; service com interface + impl).
   Layout conforme mockup M1 da ASSOCIATED_SPONSOR_SPEC.md: tabela + dialog de concessão
   (Select de masters elegíveis) + AlertDialog de revogação mostrando o número de contas
   patrocinadas ativas. Botões de mutação com request lock. Toasts via sonner.
3. Adicione a entrada no menu do backoffice junto às demais de clients.
4. Atualize postman/Lead-Flow-API-Collection.json com as 3 rotas novas.

Testes: UseCase grant/revoke (sucesso, não-master, duplicado, revogar inexistente) e
autorização das rotas (não-master recebe 403).
Rode typecheck, lint, governance:check, design:check e lint:pt-br.
```

**Não tocar:** fluxos de conversão/adesão (já consomem o service); tabela `backoffice_authorized_sponsors` (schema congelado no Estágio 1); fila Associados.
**Aceite:** grant/revoke funcionais sem nenhuma migration/SQL manual; trilha completa (quem/quando) visível na tela; Postman atualizado; design:check limpo.
**Validação manual:** conceder autorização a um master de teste, vê-lo aparecer no dropdown do dialog de tipo de usuário; revogar e confirmar que (a) some do dropdown, (b) a conta já patrocinada por ele continua íntegra, (c) nova conversão apontando para ele retorna 400.

#### Mockup M1 — Backoffice > Clientes > Patrocinadores

```
┌─────────────────────────────────────────────────────────────────────┐
│ Patrocinadores autorizados                       [+ Autorizar]      │
│ Masters que podem patrocinar contas Associado e Convidado           │
├─────────────────────────────────────────────────────────────────────┤
│ Nome              E-mail                    Contas   Status  Desde  │
│ Matheus Willock   matheuswillock@gmail.com    3     [Ativo]  29/06  │
│ Bruno Marcelino   bruno@onsidemarketing...    1     [Ativo]  06/07  │
│ João Teste        joao@exemplo.com            0   [Revogado] 01/07  │
│                                          revogado por Matheus 05/07 │
│                                                          [Ações ⋮]  │
└─────────────────────────────────────────────────────────────────────┘

Dialog "Autorizar patrocinador":
┌───────────────────────────────────────┐
│ Autorizar patrocinador                │
│ Master*        [Select: masters ▾]    │
│ Observações    [textarea opcional]    │
│            [Cancelar] [Autorizar]     │
└───────────────────────────────────────┘

AlertDialog "Revogar":
┌─────────────────────────────────────────────┐
│ Revogar autorização de Bruno Marcelino?     │
│ 1 conta patrocinada ativa será preservada;  │
│ novas associações com este patrocinador     │
│ serão bloqueadas.                           │
│                  [Cancelar] [Revogar]       │
└─────────────────────────────────────────────┘
```

(Status com `Badge`; tabela shadcn; sem side-stripes; tokens `semantic-*` para Ativo/Revogado.)

### Estágio 5 — Limpeza e anti-padrões correlatos

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md.

1. Remova Profile.canSponsorAccounts do prisma/schema.prisma (a fonte de verdade é
   backoffice_authorized_sponsors desde o Estágio 2; confirme com grep que nenhum código
   o consulta) e gere a migration via bun run db:migrate:from-prisma -- drop-can-sponsor-accounts.
2. HealthPlanUseCase: substitua a checagem profileEmail !== HEALTH_PLAN_ADMIN_EMAIL por
   verificação de BackofficeUser master ativo (D7 da spec); remova a constante com o
   e-mail literal. Ajuste/adicione teste do caminho 403.
3. prisma/seed.ts e prisma/seed-app.ts: troque as senhas literais por leitura de env
   (SEED_USER_PASSWORD) com fallback aleatório logado no console; nunca commitar senha real.
4. Unifique o fallback 'matheuswillock@gmail.com' de EmailService.ts:613 e
   BackofficeLeadScheduleInviteService.ts:214 em um único helper lib/email/resend-owner-email.ts
   que lê RESEND_OWNER_EMAIL e loga erro claro quando ausente (sem literal duplicado).

NÃO execute db:migrate:push. Rode a sequência completa de validação.
```

**Não tocar:** comportamento das rotas de health plan além da fonte da autorização; fluxo de envio de e-mail (só a origem do fallback).
**Aceite:** `grep canSponsorAccounts` retorna só migrations históricas; `grep "matheuswillock@gmail.com"` no código de produto retorna zero (restam seeds/postman/docs/migrations); replay local limpo; testes verdes.
**Validação manual:** criar plano de saúde como master backoffice (sucesso) e como usuário comum (403); rodar seed local sem senha hardcoded.

> Se as senhas de `seed.ts` alguma vez foram usadas em ambiente real, **rotacioná-las imediatamente** — isso independe do estágio e não espera a spec.

### Estágio 6 — Cobertura do fluxo Proposta do associado (adicionado 2026-07-09)

O fluxo definido pelo owner (associado move lead para Proposta → notificação + fila do patrocinador) já está implementado (audit 3.8), mas sem nenhum teste — e os erros do caminho são engolidos por `.catch(console.error)`, então regressão ali é silenciosa.

**Prompt Codex:**

```text
No lead-flow-app, siga agents.md. Adicione testes (padrão dos *.test.ts existentes em
app/api/useCases/**) para o fluxo de Proposta em conta associada — NENHUMA mudança de
comportamento, somente testes; se um teste revelar bug, reporte antes de corrigir:

1. AssociateProposalUseCase.notifyAssociateOfferSubmission
   (app/api/useCases/associateProposal/AssociateProposalUseCase.ts:45):
   - time de conta associada: cria LeadProposalReview via ensureProposalArtifacts,
     dispara notificação in-app, web push e e-mail para os destinatários resolvidos;
   - sem destinatários (recipients null/vazio): retorna sem efeitos colaterais;
   - falha em um canal (ex.: e-mail) não impede os demais.
2. Resolução de destinatários — findAssociateOfferNotificationRecipients
   (AssociateProposalRepository.ts:293): retorna patrocinador + master associado +
   membros backoffice dos times do patrocinador, com dedupe; retorna null para time
   sem sponsorMasterId.
3. LeadUseCase.handleOfferSubmissionAlert (LeadUseCase.ts:2459), bifurcação:
   - guard: só dispara na entrada em offerSubmission (não em re-save no mesmo status);
   - conta associada: chama notifyAssociateOfferSubmission e NÃO envia o e-mail
     interno tradicional (emailRecipients vazio, sem anexos);
   - conta comum: caminho tradicional inalterado;
   - resetReviewOnResubmit chamado ao reentrar em Proposta.

Rode bun run typecheck, lint, governance:check e lint:pt-br.
```

**Não tocar:** comportamento de `LeadUseCase`, `AssociateProposalUseCase`, service e repository (somente testes); notificações/e-mails; migrations.
**Aceite:** os 3 blocos cobertos; suíte verde; nenhuma mudança de produção no diff além de arquivos `*.test.ts`.
**Validação manual (E2E, após push autorizado das migrations):** converter uma conta de teste para Associado com o Bruno como patrocinador, mover um lead para Proposta e confirmar: lead visível em **Backoffice > Associados** do Bruno, notificação in-app + push + e-mail recebidos por Bruno, master associado e backoffice do Bruno.

---

## Critérios de aceite globais

| # | Critério | Verificação |
|---|----------|-------------|
| 1 | Bruno autorizado em produção com o e-mail correto | Estágio 0 + push autorizado do Estágio 1 + dropdown do Backoffice |
| 2 | `assertAuthorizedSponsor` é o único ponto que decide autorização de patrocinador | grep: nenhuma escrita de `sponsorMasterId` fora do service/consumidores |
| 3 | API rejeita patrocinador não autorizado em conversão e adesão | testes de integração + Postman manual |
| 4 | Grant/revoke pelo Backoffice sem migration, com autor e timestamp | tela do Estágio 4 |
| 5 | Revogação preserva contas associadas existentes | teste + validação manual E4 |
| 6 | Trilha de conversão completa também no fluxo de adesão | `assignedByProfileId` populado (E3) |
| 7 | Zero e-mail literal com efeito de autorização em código de produto | grep pós-E5 |
| 8 | Todos os UseCases/rotas tocados com testes | CI |
| 9 | Associado move lead para Proposta → lead na fila Backoffice > Associados do patrocinador + notificação in-app/push/e-mail (definição do owner 09/07) | testes do Estágio 6 + validação E2E com o Bruno após push |

## Perguntas abertas (não bloqueantes)

- [ ] **D2a:** se o patrocinador for revogado entre a adesão e o pagamento, a conta paga nasce sem vínculo (proposto) ou a criação bloqueia até decisão manual?
- [ ] **Contas `guest` existentes:** owner quer um relatório/tela listando contas gratuitas ativas e seus patrocinadores (extensão natural da tela do E4)?
- [ ] **Expiração de `guest`:** permanece vitalícia ou ganha revisão periódica (ex.: `accessExpiresAt` anual como o Member PRO)?

## Decisions log

> **Q:** Backoffice ou produto?
> **A:** A *autorização de patrocinador* é regra de aprovação interna → Backoffice (tabela `Backoffice*`, rotas `api/v1/backoffice/**`, `getBackofficeAccess()`). A *fila Associados* permanece no produto, conforme decisão já registrada em `specs/associados.md`.

> **Q:** Tabela dedicada ou env var?
> **A:** Tabela dedicada (D1-A). Env var reintroduz identidade por e-mail — o typo do Bruno é o contraexemplo definitivo — e exige deploy para mudar a lista.

> **Q:** O modelo nasce como lista (n patrocinadores)?
> **A:** Já nasceu: tanto o flag atual quanto a tabela proposta suportam n patrocinadores. Os 2 e-mails são o conteúdo inicial da lista, não o formato dela.

> **Q:** O que a associação desbloqueia?
> **A:** Respondido pelo código (audit 3.6): `guest` = isenção total de cobrança (`hasPermanentSubscription`); `associate` = paga normal + operação da fila pelo patrocinador. Nenhuma suposição pendente.

> **Q:** Qual a grafia correta do e-mail do Bruno? (Open Question herdada de `specs/associados.md`)
> **A:** `bruno@onsidemarketing.com.br` (**onside**, sem o "e") — confirmado pelo owner em 2026-07-09. As migrations históricas com `onseidemarketing` permanecem intocadas (histórico imutável); a correção vive em `20260706173731_seed-authorized-sponsors-fix.sql`, que cobre ambas as grafias.

> **Q:** O fluxo Proposta → fila do patrocinador precisa ser construído?
> **A:** Não — já existe ponta a ponta (audit 3.8). O que falta é cobertura de testes (Estágio 6) e a validação E2E em produção, que depende do push autorizado das migrations para o Bruno finalmente poder ser patrocinador.
