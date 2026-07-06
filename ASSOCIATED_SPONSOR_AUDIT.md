# ASSOCIATED_SPONSOR_AUDIT.md — Auditoria do Tipo de Usuário "Associado" e Restrição de Patrocinador

**Data:** 2026-07-06
**Escopo:** tipo de conta `associate` (e o irmão `guest`), vínculo `Profile.sponsorMasterId`, flag `Profile.canSponsorAccounts`, fluxos de conversão (Backoffice admin) e adesão (Backoffice), fila Associados no produto, rastreabilidade e ocorrências hardcoded dos e-mails `matheuswillock@gmail.com` / `bruno@onsidemarketing.com.br`.
**Método:** `/impeccable` audit + critique — leitura factual do código confrontada contra o estado-alvo de 7 requisitos.
**Rodada somente-leitura:** nenhum código de produção foi alterado.
**Verificação em produção pendente:** os MCPs Supabase e Vercel não estão autenticados nesta sessão; a checagem do estado real do banco (seção 4.1) precisa ser feita em sessão autenticada ou via SQL read-only autorizado.

---

## 🔴 Achado mais importante da rodada: typo silencioso no e-mail do Bruno

A migration de seed que marca os dois patrocinadores autorizados usa **`bruno@onsidemarketing.com.br`** — com um "e" a mais ("ons**e**ide" em vez de "onside"):

```sql
-- supabase/migrations/20260629201647_seed-guest-user-type-and-sponsors.sql:17-19
UPDATE "public"."corretor_studio_profiles"
SET "canSponsorAccounts" = true
WHERE "email" IN ('matheuswillock@gmail.com', 'bruno@onsidemarketing.com.br');
```

Todas as outras fontes do projeto usam o e-mail **sem** o "e": `prisma/seed.ts:18`, `prisma/seed-app.ts:8`, `postman/Lead-Flow-API-Collection.json:41` (`bruno@onsidemarketing.com.br`). Se o e-mail correto do profile em produção é `onsidemarketing`, o `UPDATE ... WHERE email IN (...)` foi um **no-op silencioso para o Bruno**: nenhum erro, nenhuma linha afetada, e o Bruno **não aparece em nenhum dropdown de patrocinador** (a lista é filtrada por `canSponsorAccounts = true`). Este é exatamente o modo de falha que o requisito 2 antecipava — "um typo silencioso quebra a validação sem erro claro".

O typo não é um acidente isolado da migration: ele nasce em `specs/associados.md` (linhas 3 e 599 usam `onsidemarketing`) e se propaga para a migration de referência `20260628192207_seed-bruno-sponsor-reference.sql:9-11`. A própria spec registrou a dúvida em Open Questions ("confirmar profileId em cada ambiente?") e ela nunca foi fechada.

**Ação requerida (não executada nesta rodada):** confirmar em produção qual e-mail existe em `corretor_studio_profiles` e o valor de `canSponsorAccounts` do Bruno; corrigir via migration de dados (nunca SQL Editor).

---

## 1. Sumário executivo

| # | Requisito-alvo | Veredito | Risco |
|---|----------------|----------|-------|
| 1 | Tipo de conta "Associado" explícito (não inferido) | **existe** | 🟢 baixo |
| 2 | Lista de patrocinadores com fonte única (não string literal) | **parcial** — fonte única existe (`canSponsorAccounts`), mas seed com typo e flag usado só para popular dropdown | 🔴 crítico |
| 3 | Ponto único de validação "este patrocinador é autorizado" | **não existe** — nenhum caminho de escrita valida o flag | 🔴 crítico |
| 4 | Atualização da lista sem deploy | **parcial** — flag é coluna no banco, mas não há UI/rota para gerenciá-lo; hoje só via migration/SQL | 🟡 médio |
| 5 | Isolamento e RBAC (Backoffice vs produto) | **parcial** — híbrido deliberado e documentado; lacunas pontuais (FK ausente, RLS sem policies) | 🟡 médio |
| 6 | Efeito da associação levantado e explícito | **existe** — `guest` = conta 100% gratuita ilimitada; `associate` = paga normal + fila operacional do patrocinador | 🟢 (informativo) |
| 7 | Rastreabilidade de quem aprovou/quando | **parcial** — fluxo admin registra `assignedByProfileId`; fluxo de adesão grava `null`; sem histórico; sponsor/flag sem trilha | 🟡 médio |

**Os 5 achados estruturais mais importantes:**

1. **Typo `onsidemarketing` na migration de seed** (box acima) — o Bruno provavelmente não está marcado como patrocinador em produção; falha silenciosa, sem erro em lugar nenhum.
2. **`canSponsorAccounts` nunca é validado no caminho de escrita.** O flag existe e alimenta os dropdowns (`BackofficeAllUsersRepository.findSponsorMasterOptions`, `BackofficeAdhesionRepository.getOptions`), mas `BackofficeProfileUserTypeUseCase.convert()` valida apenas `findIsMaster(sponsorMasterId)` — **qualquer master da plataforma pode ser passado como patrocinador via API**, ignorando a lista de autorizados. A restrição "só 2 patrocinadores" é, hoje, uma restrição de UI.
3. **O fluxo de adesão valida ainda menos:** `BackofficeAdhesionUseCase.create` checa só a **presença** de `sponsorMasterId` (nem `isMaster`, nem existência do profile, nem autorização), e `backoffice_adhesions.sponsorMasterId` foi criada **sem FK** — um UUID inválido só explode na criação da conta (depois do fluxo de pagamento), quando o valor é copiado para `Profile.sponsorMasterId` (que tem FK).
4. **`guest` concede assinatura permanente (conta 100% gratuita e ilimitada)** — é o efeito financeiro direto do patrocínio, e é justamente o tipo com a trilha de auditoria mais fraca: no fluxo de adesão o `assignedByProfileId` é gravado como `null`.
5. **Zero testes nos UseCases com efeito financeiro:** `BackofficeProfileUserTypeUseCase` (conversão, mexe em `hasPermanentSubscription` e Asaas) e `BackofficeAdhesionUseCase`/`Service` (criação de conta guest sem cobrança) não têm nenhum teste. Os testes existentes cobrem só a fila (`AssociateBackofficeAccessUseCase.test.ts`) e privacidade (`TeamMembersAssociatePrivacy.test.ts`).

---

## 2. Mapa do módulo (arquivos-chave)

### Modelo de dados (`prisma/schema.prisma`)

| Item | Localização | Observação |
|------|-------------|------------|
| `Profile.sponsorMasterId` | `schema.prisma:602`, relação `ProfileSponsor` (:624-625) | FK self-relation `ON DELETE RESTRICT`, indexada (:713) |
| `Profile.canSponsorAccounts` | `schema.prisma:599`, index :714 | boolean default `false` — **a fonte única da lista de patrocinadores** |
| `Profile.hasPermanentSubscription` | `schema.prisma:598` | efeito financeiro do `guest` |
| `ProfileUserType` / `ProfileUserTypeAssignment` | `schema.prisma:2495-2525` | slugs `common`, `member_pro`, `associate`, `guest`; assignment 1:1 com `assignedByProfileId` |
| `LeadProposalReview` / `LeadRequiredDocument` | migration `20260628184146` | tabelas da fila; RLS habilitado **sem policies** |
| `backoffice_adhesions.sponsorMasterId` | migration `20260629201623:9-10` | coluna uuid **sem FK** |

### Migrations

- `20260628184146_associate-user-type-and-proposal-review-schema.sql` — sponsorMasterId + tabelas da fila
- `20260628184201_seed-associate-user-type-and-feature.sql` — seed slug `associate` + feature
- `20260628192207_seed-bruno-sponsor-reference.sql` — referência ao Bruno (**e-mail com typo**)
- `20260629201623_guest-user-type-and-sponsor-flag.sql` — `canSponsorAccounts` + coluna na adesão
- `20260629201647_seed-guest-user-type-and-sponsors.sql` — seed `guest` + marca os 2 patrocinadores (**e-mail do Bruno com typo**)

### Backend

| Fluxo | Arquivos |
|-------|----------|
| Conversão de tipo (admin) | `app/api/v1/backoffice/clients/all-users/[profileId]/user-type/route.ts` → `app/api/useCases/backoffice/BackofficeProfileUserTypeUseCase.ts` → `BackofficeAllUsersRepository` |
| Lista de patrocinadores (dropdown) | `app/api/v1/backoffice/clients/all-users/sponsor-masters/route.ts` → `listSponsorOptions()` → `findSponsorMasterOptions()` (`BackofficeAllUsersRepository.ts:739-746`) |
| Adesão (nova conta já associada/guest) | `app/api/v1/backoffice/adhesions/route.ts` → `BackofficeAdhesionUseCase.ts` → `BackofficeAdhesionService.ts` → `BackofficeAdhesionRepository.ts` |
| Fila Associados (produto) | `app/api/useCases/associateProposal/AssociateBackofficeAccessUseCase.ts` (+ `.test.ts`), `AssociateProposalUseCase.ts`, `AssociateProposalRepository.ts` |
| Privacidade do patrocinador | `TeamMembersUseCase.ts` / `TeamMembersRepository.ts` (+ `TeamMembersAssociatePrivacy.test.ts`) |

### Frontend

- `app/backoffice/(app)/clients/all-users/features/components/BackofficeProfileUserTypeDialog.tsx` — conversão com Select de patrocinador (busca `sponsor-masters`)
- `app/backoffice/(app)/clients/adhesions/features/components/BackofficeAdhesionDialog.tsx` — adesão com Select de patrocinador (via `getOptions`)
- `app/[supabaseId]/associados/**` — fila Associados (feature scaffold completo)

### Spec existente

- `specs/associados.md` — spec completa do tier Associado (fases 1-6, decisions log). **Contém o e-mail com typo.**

---

## 3. Audit — os 7 requisitos, linha a linha

### 3.1 Tipo de conta "Associado" — **existe** ✅

Diferenciação explícita, não inferida:

- Slug `associate` (e `guest`) em `profile_user_types`, atribuído via `ProfileUserTypeAssignment` (1:1 por profile).
- Vínculo `Profile.sponsorMasterId` (FK self-relation, `ON DELETE RESTRICT`) — obrigatório na conversão para `associate`/`guest` (`BackofficeProfileUserTypeUseCase.ts:50-51, 87-88`) e na adesão (`BackofficeAdhesionUseCase.ts:127-131`).
- Conversão reversa protegida: voltar para `common`/`member_pro` é bloqueado enquanto houver propostas abertas na fila (`convert()` → `hasOpenProposalReviewsForAssociate`, `BackofficeAllUsersRepository.ts:748-760`) e zera `sponsorMasterId`.

### 3.2 Patrocinador restrito a lista de autorizados — **parcial** 🔴

**O que está certo:** a fonte única existe e é melhor do que o mínimo aceitável do estado-alvo — não é env var nem comparação de string literal em código de produção; é o flag `Profile.canSponsorAccounts` no banco, referenciando o profile (não o e-mail bruto). Os dois pontos que montam dropdowns consultam esse flag:

- `BackofficeAllUsersRepository.findSponsorMasterOptions()` (:739-746) — `where: { canSponsorAccounts: true }`
- `BackofficeAdhesionRepository.getOptions()` (:458-462) — idem

Os e-mails dos dois patrocinadores **não** aparecem hardcoded em nenhum UseCase/rota/frontend do fluxo de patrocínio — só na migration de seed (dado, não código), que é o lugar aceitável. Inventário completo de ocorrências hardcoded na seção 5.

**O que está errado:**

1. O seed que materializa a lista tem o typo do Bruno (box no topo) — a fonte única provavelmente está **incompleta em produção**.
2. O flag é consultado **apenas para popular dropdowns**. Nenhum caminho de escrita o valida (ver 3.3). A "lista de autorizados" restringe o que o admin *vê*, não o que a API *aceita*.

### 3.3 Ponto único de validação — **não existe** 🔴

Não há nenhum lugar no código que responda "este profile é um patrocinador autorizado?" no caminho de escrita. O que existe é uma validação **parcial e duplicada**:

| Caminho | O que valida sobre o sponsor | O que NÃO valida |
|---------|------------------------------|-------------------|
| `convert()` branch `associate` (`BackofficeProfileUserTypeUseCase.ts:49-84`) | presença, não-self, `findIsMaster` | `canSponsorAccounts` |
| `convert()` branch `guest` (:86-115) | **mesmas 3 checagens copiadas e coladas** | `canSponsorAccounts` |
| Adesão `create` (`BackofficeAdhesionUseCase.ts:127-131`) | **só presença** | existência, `isMaster`, `canSponsorAccounts` |
| Adesão `ensureAccountForPaidAdhesion` (`BackofficeAdhesionService.ts:1319`) | nada — copia `adhesion.sponsorMasterId` para o Profile | tudo |
| Frontend (2 dialogs) | presença (obrigatório no submit) | — (dropdown já vem filtrado) |

Consequência: um master backoffice pode converter qualquer conta para `guest` (assinatura permanente gratuita) apontando **qualquer master da plataforma** como "patrocinador" — o payload da API aceita qualquer UUID de master, e a resposta será `200`. A regra de negócio "somente Matheus e Bruno patrocinam" não é imposta em nenhuma camada do servidor.

A spec `specs/associados.md:78` previa um `AssociateAccessService` — o que foi implementado (`AssociateBackofficeAccessUseCase`) resolve **acesso à fila** (leitura), não autorização de patrocinador (escrita).

### 3.4 Atualização sem deploy — **parcial** 🟡

- ✅ A lista vive no banco (coluna `canSponsorAccounts`): adicionar/remover patrocinador **não requer** mudança de código nem redeploy.
- ✅ Revogar um patrocinador não quebra contas já associadas: o vínculo `sponsorMasterId` é FK independente do flag; a fila usa o vínculo no momento da query (`AssociateProposalRepository.countSponsoredAccounts`).
- ❌ **Não existe UI nem rota para gerenciar o flag.** Hoje a única forma de marcar/desmarcar um patrocinador é migration de dados (as duas existentes) ou SQL manual no banco — que a governança do projeto proíbe fora de migration. Na prática, mudar a lista exige um PR + migration + push autorizado, ou seja, exige deploy de fato.
- ❌ Trocar o e-mail de um patrocinador (caso citado no requisito) não afeta o flag (que é por profile, não por e-mail) — ponto positivo do modelo —, mas o seed por e-mail já demonstrou ser frágil na criação inicial.

### 3.5 Isolamento e RBAC — **parcial** 🟡 (híbrido deliberado)

O conceito é **híbrido por decisão registrada** (`specs/associados.md`, Decisions Log): a *administração* (conversão de tipo, adesão, lista de patrocinadores) vive no Backoffice; a *fila operacional* vive no produto, porque é operada pelo patrocinador/backoffice dele dentro do CRM.

- ✅ Rotas admin sob `app/api/v1/backoffice/**` com `getBackofficeAccess()` + `requireMasterAccess` (`user-type/route.ts:24-29`, `sponsor-masters/route.ts:10-15`, `adhesions/route.ts`).
- ✅ Fila no produto com `getTeamAccess()` + feature slug `crm-backoffice-associados` + matriz de papéis (sponsor master / `backoffice` / manager delegado) e bloqueio de contas associadas (`AssociateBackofficeAccessUseCase.ts:27-53`) — com teste.
- ✅ `sponsorMasterId`/`canSponsorAccounts` em `Profile` — dentro do único acoplamento cross-módulo permitido pela governança (Profile).
- ⚠️ `backoffice_adhesions.sponsorMasterId` referencia um profile do produto **sem FK** (migration `20260629201623`) — integridade não garantida; erro só aparece tarde (3.3).
- ⚠️ RLS habilitado em `corretor_studio_lead_proposal_reviews` e `corretor_studio_lead_required_documents` **sem nenhuma policy** (migration `20260628184146:155-157`). Fail-closed para acesso não-service-role (ok), mas a spec previa "políticas por teamId via join com Lead" — não implementadas.
- ⚠️ `LeadProposalReview`/`LeadRequiredDocument` não são tabelas `Backoffice*` — correto, pois pertencem ao domínio do produto (leads), mas vale registrar que a fronteira foi analisada e é intencional.

### 3.6 Efeito da associação — **existe e é explícito no código** ✅ (informativo)

Não é pergunta bloqueante: o código responde com precisão o que cada tipo desbloqueia.

| Tipo | Efeito financeiro | Efeito operacional |
|------|-------------------|--------------------|
| `associate` | **Paga normalmente**: a conversão exige/cria Asaas customer (`convert()` → `ensureProfileAsaasCustomer`, :63-67) e força `hasPermanentSubscription = false` (:76) | Conta opera CRM próprio; o patrocinador ganha a fila Associados, vê os times no switcher com badge, e o backoffice dele processa propostas na operadora; membros da conta associada não veem o patrocinador (privacidade testada) |
| `guest` | **Conta 100% gratuita e ilimitada**: `hasPermanentSubscription = true` (:107; adesão: `BackofficeAdhesionService.ts:1298,1318`), que ativa assinatura em `isAccountSubscriptionActive` (`lib/subscription/isAccountSubscriptionActive.ts:34-35`), libera slots ilimitados de times/usuários (`app/hooks/useBillingSlots.ts:27-28`) e passa nos gates de feature (`lib/billing/team-has-product-feature.ts:47-48`) | Mesmo vínculo `sponsorMasterId` |

Ou seja: **o tipo com maior efeito financeiro é o `guest`** (isenção total de cobrança), e é ele que depende do patrocinador cuja autorização não é validada no servidor (3.3). O rigor de billing exigido pelo requisito se aplica sobretudo aqui.

### 3.7 Auditoria/rastreabilidade — **parcial** 🟡

- ✅ Fluxo admin: `ProfileUserTypeAssignment.assignedByProfileId` + `createdAt`/`updatedAt` registram quem converteu e quando (`user-type/route.ts:45` passa `result.access.profileId`).
- ❌ Fluxo de adesão: as três chamadas de `upsertUserTypeAssignment` gravam `assignedByProfileId: null` (`BackofficeAdhesionService.ts:1337, 1343, 1349`) — a autoria existe indiretamente em `BackofficeAdhesion.createdByBackofficeUserId`, mas não na trilha do tipo de usuário.
- ❌ O assignment é um **upsert 1:1**: cada conversão sobrescreve a anterior — não há histórico de conversões (quem transformou a conta em `guest` e depois de volta em `common` some do registro).
- ❌ `updateSponsorMasterId` não registra quem/quando alterou o vínculo, e mudanças em `canSponsorAccounts` não têm trilha nenhuma (hoje só existem via SQL).
- ❌ Não existem os campos `sponsoredAt`/`sponsoredBy` (ou equivalente) previstos no estado-alvo.

---

## 4. Verificações pendentes (exigem acesso a produção)

Os MCPs Supabase/Vercel não estão autenticados nesta sessão. Antes do Estágio 1 da spec, executar (read-only):

### 4.1 Estado real dos patrocinadores

```sql
SELECT id, email, "canSponsorAccounts", "isMaster"
FROM corretor_studio_profiles
WHERE email ILIKE '%onside%' OR email ILIKE '%onseide%'
   OR email = 'matheuswillock@gmail.com';
```

Hipótese a confirmar: o profile do Bruno existe com `onsidemarketing` e está com `canSponsorAccounts = false` (o UPDATE do seed não o encontrou).

### 4.2 Integridade dos vínculos existentes

```sql
-- contas associadas/guest e seus patrocinadores
SELECT p.email, put.slug, sp.email AS sponsor_email, sp."canSponsorAccounts"
FROM corretor_studio_profiles p
JOIN profile_user_type_assignments a ON a."profileId" = p.id
JOIN profile_user_types put ON put.id = a."userTypeId"
LEFT JOIN corretor_studio_profiles sp ON sp.id = p."sponsorMasterId"
WHERE put.slug IN ('associate', 'guest');

-- adesões com sponsor apontando para profile inexistente (coluna sem FK)
SELECT a.id, a."sponsorMasterId"
FROM backoffice_adhesions a
LEFT JOIN corretor_studio_profiles p ON p.id = a."sponsorMasterId"
WHERE a."sponsorMasterId" IS NOT NULL AND p.id IS NULL;
```

---

## 5. Inventário de ocorrências hardcoded dos e-mails (Fase 1, item 3)

### Relacionadas ao conceito de patrocinador

| Arquivo:linha | Conteúdo | Classificação |
|---------------|----------|---------------|
| `supabase/migrations/20260629201647_seed-guest-user-type-and-sponsors.sql:19` | `WHERE "email" IN ('matheuswillock@gmail.com', 'bruno@onsidemarketing.com.br')` | Seed de dados (aceitável em migration) — **mas com typo no Bruno** 🔴 |
| `supabase/migrations/20260628192207_seed-bruno-sponsor-reference.sql:9,11` | `bruno@onsidemarketing.com.br` | Migration de referência (no-op) — **typo** |
| `specs/associados.md:3,599` | `bruno@onsidemarketing.com.br` | Documentação — **origem do typo**, corrigir |

### Não relacionadas a patrocinador, mas mesmo anti-padrão (e-mail literal com efeito de autorização/roteamento)

| Arquivo:linha | Conteúdo | Risco |
|---------------|----------|-------|
| `app/api/useCases/healthPlans/HealthPlanUseCase.ts:17,91` | `HEALTH_PLAN_ADMIN_EMAIL = "matheuswillock@gmail.com"` usado como **checagem de autorização** (`profileEmail !== HEALTH_PLAN_ADMIN_EMAIL` → 403) | 🔴 RBAC por e-mail hardcoded em UseCase de produto — mesmo defeito que o requisito 2 proíbe para patrocinador |
| `lib/services/EmailService.ts:613` | fallback `process.env.RESEND_OWNER_EMAIL \|\| 'matheuswillock@gmail.com'` | 🟡 fallback de test-mode com e-mail pessoal em código |
| `app/api/services/Backoffice/backofficeLeadSchedule/BackofficeLeadScheduleInviteService.ts:214` | idem | 🟡 duplicação do fallback acima |
| `prisma/seed.ts:18,20` / `prisma/seed-app.ts:8,10` | ambos os e-mails **com senhas em texto plano** (`Onside@2025`, `Nath@1308`) commitadas no repositório | 🔴 credenciais reais versionadas — se qualquer uma dessas senhas é usada fora do ambiente local, rotacionar já |
| `postman/Lead-Flow-Environment.json:196`, `postman/Lead-Flow-API-Collection.json:41,131,3225` | e-mails como variáveis de ambiente/exemplos Postman | 🟢 aceitável (tooling) |
| `docs/VERCEL_DEPLOYMENT.md:28-120` | e-mail do owner em doc de deploy (test mode) | 🟢 aceitável (doc) |

---

## 6. Critique — riscos além dos 7 itens

1. **A restrição de negócio inteira mora na UI.** O servidor aceita qualquer master como patrocinador (3.3). O mitigante é que só um master do Backoffice pode chamar essas rotas — mas o requisito trata patrocínio com rigor de billing exatamente porque "quem pode patrocinar libera algo": um operador backoffice mal-intencionado ou um bug de frontend concede contas `guest` vitalícias com um POST. Defense-in-depth exige a checagem no servidor.
2. **Falha tardia na adesão.** Sem FK e sem validação na criação da adesão, um `sponsorMasterId` inválido atravessa todo o funil (criação da adesão → link público → pagamento externo → criação de conta) e só explode na FK do Profile, depois que o cliente pagou. O rollback existe (`cancelAdhesionAndRestoreLead`), mas a experiência e o suporte pagam o preço.
3. **Validação triplicada e divergente** (frontend presença / rota presença+tipo / UseCase isMaster+não-self, com o branch `guest` copiando e colando o branch `associate`). Quando a regra mudar (ex.: exigir `canSponsorAccounts`), há 5+ pontos para atualizar e nenhum compilador vai reclamar do que faltar.
4. **`guest` não exige gestão de expiração nem revisão.** `member_pro` tem `accessExpiresAt` com validação de 1 dia–1 ano; `guest` é vitalício por construção (`accessExpiresAt: null` + `hasPermanentSubscription`). Não há relatório/tela que liste quantas contas gratuitas existem e quem as patrocinou — combinado com a trilha `assignedByProfileId: null` da adesão, é a lacuna de auditoria mais séria do módulo.
5. **`HealthPlanUseCase` normaliza o anti-padrão.** Enquanto existir RBAC por e-mail literal em um UseCase de produto, o padrão "compara com string" continua disponível para copiar. Vale corrigir na mesma frente (flag/role no banco), ainda que fora do escopo estrito de patrocínio.
6. **O typo demonstra ausência de validação pós-seed.** Nenhum check (teste, script, health-check) confirma que os patrocinadores esperados estão marcados. Um `RAISE NOTICE` (como o da migration de referência) não falha o pipeline — e foi exatamente o que aconteceu.
7. **Senhas em texto plano nos seeds** (`seed.ts`/`seed-app.ts`) — fora do escopo de patrocínio, mas encontradas na busca obrigatória pelos e-mails; tratadas como achado de segurança independente.

---

## 7. Conclusão

O conceito "Associado + patrocinador" **existe e está bem modelado** (slug explícito, FK com RESTRICT, flag por profile em vez de e-mail hardcoded — arquitetura acima do mínimo do estado-alvo). As lacunas são de **enforcement e operação**: a lista de autorizados não é validada em nenhuma escrita, o seed que a materializa tem um typo silencioso que provavelmente deixou o Bruno de fora em produção, não há como gerenciar a lista sem migration, e a trilha de auditoria é parcial. A spec de correção (`ASSOCIATED_SPONSOR_SPEC.md`) ataca esses pontos em 5 estágios, sem redesenhar o que já funciona.
