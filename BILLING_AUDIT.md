# BILLING_AUDIT.md — Auditoria completa de billing (motor de pagamentos, precificação, UI, e-mails, tipos de usuário)

**Data:** 2026-07-20
**Escopo:** performance e correção do motor de pagamentos (Asaas), consumo de webhooks, geração de cobranças, precificação (`PRICING_MODEL.md`/`PRICING_TABLE.md`), UI de cobrança no Backoffice, alertas, correção/atualização de assinaturas, tipos de usuário (member-pro, vitalício, associados), e-mails transacionais de cobrança.
**Método:** leitura de código e schema, consulta à documentação oficial do Asaas via MCP (`docs.asaas.com`), consulta ao Supabase MCP (projeto de produção `wcnxwdcoambpfwxwubka`, somente leitura: `get_advisors` + queries agregadas), consulta ao Vercel MCP (só para identificar o projeto de produção). **Nenhum código, dado ou configuração foi alterado nesta rodada.**
**Documentos relacionados (não duplicados aqui, referenciados):** `BILLING_ENGINE_AUDIT.md` (09/07/2026 — auditoria do motor Asaas legado, achados C1-C4 e P1-P15 ainda válidos e citados abaixo), `PRICING_MODEL.md` e `PRICING_TABLE.md` (19/07/2026 — catálogo de preços vigente e suas 10 inconsistências conhecidas), `BILLING_ENGINE_SPEC.md` (spec anterior — decisões D1-D9, parcialmente superseded, ver `BILLING_SPEC.md`).

---

## Sumário executivo

| # | Severidade | Achado | Por quê |
|---|---|---|---|
| C-1 | **Crítico** | RLS desabilitado em `asaas_webhook_events`, `profile_user_types`, `profile_user_type_assignments` (confirmado em produção) | Se os grants de `anon`/`authenticated` não forem restritos, qualquer requisição contra a API REST autogerada do Supabase pode ler/adulterar dados de billing e de tipo de usuário sem passar por nenhuma camada de autorização da aplicação — subordina todos os outros achados. |
| C0 | **Crítico** | Webhook trata eventos/status que não existem na API real do Asaas, e ignora os que existem | `SUBSCRIPTION_ACTIVATED`/`SUBSCRIPTION_SUSPENDED`/`SUBSCRIPTION_CANCELED` nunca são emitidos pelo Asaas (eventos reais: `CREATED`/`UPDATED`/`INACTIVATED`/`DELETED`); `status` real é `ACTIVE|EXPIRED|INACTIVE`, não `SUSPENDED`/`INACTIVATED`/`CANCELED`. O fallback `?? 'active'` reativa contas cuja assinatura acabou de ser desativada no Asaas. |
| C1 | **Crítico** | `POST /api/v1/profiles/permanent-subscription` público, sem autenticação, libera assinatura vitalícia | Ver `BILLING_ENGINE_AUDIT.md` C1 — ainda não corrigido. |
| C2 | **Crítico** | Cancelamento local não cancela no Asaas | Ver `BILLING_ENGINE_AUDIT.md` C2 — ainda não corrigido; cliente cancelado continua sendo cobrado de verdade. |
| C3 | **Crítico** | Toda confirmação de pagamento grava `subscriptionPlan: 'manager_base'` fixo | Ver `BILLING_ENGINE_AUDIT.md` C3 — regride o plano de contas `with_operators` a cada renovação. |
| — | **Crítico** | `POST /api/v1/backoffice/payments` sem `requireManagerAccess` | Qualquer operador do Backoffice pode criar cobranças reais no Asaas contra qualquer cliente; a única barreira é ocultar o botão no frontend. |
| — | **Alto** | Refund/chargeback (`PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_*`) não têm handler — confirmado contra a doc oficial | Conta permanece `active` depois de estorno/contestação vencida pelo cliente. |
| — | **Alto** | Preço hardcoded em ~15 arquivos + 2 sistemas de cobrança coexistindo (legado R$59,90 vs. catálogo `BackofficeProduct` R$89,90) | Risco de cobrar um valor e exibir outro; decisão do owner (banco como fonte única) ainda não implementada. |
| — | **Alto** | Assinatura não expõe entitlements por slug de forma unificada | `FeatureAccessService` já calcula `slugs`, mas `SubscriptionCheckService` ainda responde quase só `hasActiveSubscription`; cobrança, capacidade e acesso podem divergir sem um contrato único de `productSlugs`/`featureSlugs`/capacidades. |
| — | **Alto** | Início de cobrança pós-Member PRO depende só de cron diário, sem checkout explícito, sem validação prévia | Cliente pode ficar até 24h sem cobrança corrigida, ou nunca ser cobrado se faltar dado cadastral — falha só loga no console. |
| — | **Alto** | `SubscriptionManagementUseCase`: cancelamento, troca de cartão e retry de pagamento têm chamada ao Asaas comentada (`TODO`) mas retornam `success:true` | Usuário recebe confirmação de uma ação que não aconteceu de verdade. |
| — | **Médio** | Duas definições divergentes de "assinatura ativa" (`FeatureAccessService` vs. `SubscriptionCheckService`) | Sidebar liberada + página bloqueada simultaneamente para contas `trial`/`past_due` — bug de UX reproduzível. |

---

## 1. Segurança de borda do banco — RLS desabilitado (C-1)

Consulta ao Supabase MCP (projeto `wcnxwdcoambpfwxwubka`, "corretor-studio", produção — confirmado pelo owner) via `get_advisors(type: security)` retornou o lint `rls_disabled` (nível **critical**) apontando 49 tabelas sem Row Level Security. Dentro do escopo desta auditoria:

- **`public.asaas_webhook_events`** — a tabela de idempotência do webhook financeiro (schema Prisma: `AsaasWebhookEvent`, `prisma/schema.prisma` ~linha 4188; migration `supabase/migrations/20260701134057_asaas-webhook-events.sql`).
- **`public.profile_user_types`** e **`public.profile_user_type_assignments`** — as tabelas que definem quem é `member_pro`, vitalício etc., e as datas de expiração de acesso (`ProfileUserType`/`ProfileUserTypeAssignment`, `prisma/schema.prisma:3099-3135`).

**Por que é crítico:** com RLS desligado, a tabela fica sujeita apenas aos grants de Postgres nas roles `anon`/`authenticated` — as mesmas roles que o cliente Supabase usado no browser (`anon` key, pública, embutida no bundle do frontend) e qualquer sessão autenticada usam para falar diretamente com a API REST autogerada do Supabase (PostgREST), **sem passar pelas rotas Next.js**. Nenhuma das camadas de autorização documentadas nesta auditoria (`getBackofficeAccess()`, `getTeamAccess()`, `requireManagerAccess()`, validação de `isMaster`) protege esse caminho, porque elas vivem no código da aplicação, não no banco. Se os grants efetivos permitirem `SELECT`/`INSERT`/`UPDATE` nessas tabelas para `anon`/`authenticated`:
- `asaas_webhook_events` exposta em leitura vaza IDs de pagamento/assinatura Asaas e status de processamento; exposta em escrita permite forjar uma linha `status: processed` para um `eventId` que o webhook real ainda vai tentar processar, fazendo `claimForProcessing()` (`AsaasWebhookEventRepository.ts`) rejeitar o evento legítimo como duplicado — um vetor de negação de serviço seletiva contra webhooks específicos.
- `profile_user_type_assignments` exposta em escrita permitiria, na pior hipótese, que um cliente autenticado gravasse sua própria linha apontando para o `userTypeId` de `member_pro` — bypass completo de cobrança sem passar por nenhuma rota de Backoffice.

**Ação recomendada (não executada nesta auditoria):** confirmar os grants reais de `anon`/`authenticated` nessas tabelas específicas (a ausência de RLS não implica automaticamente que os grants permitem escrita — Supabase concede `SELECT`/`INSERT`/`UPDATE`/`DELETE` por padrão ao criar tabelas via client, mas isso precisa ser verificado tabela a tabela antes de calibrar a severidade final como exploração confirmada vs. exposição em potencial). O SQL de remediação sugerido pelo advisor (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) **não deve ser aplicado sem as policies corretas** — ligar RLS sem nenhuma policy bloqueia todo acesso legítimo, inclusive o do próprio backend via `service_role` só se as policies não isentarem essa role (o `service_role` do Supabase ignora RLS por padrão, então isso é seguro para o backend, mas qualquer acesso via `anon key` no client quebraria até haver policy). Ver estágio -1 de `BILLING_SPEC.md`.

As demais tabelas sem RLS reportadas pelo advisor (`backoffice_banned_users`, `backoffice_email_logs`, `backoffice_email_events`, `whatsapp_webhook_events`, `email_orphan_events`, entre ~40 outras) estão fora do escopo direto de billing e não são detalhadas aqui, mas usam a mesma causa raiz e a mesma remediação — vale uma auditoria de segurança dedicada fora deste documento.

---

## 2. Precificação

### 2.1 Decisão fechada nesta auditoria

O owner decidiu, durante esta auditoria: **o banco de dados é a única fonte de verdade para precificação.** Isso torna obsoleta a Decisão D1 de `BILLING_ENGINE_SPEC.md` (que propunha um catálogo versionado em código, `pricingCatalog.ts`) — ver `BILLING_SPEC.md` para o registro formal dessa mudança. O alvo é generalizar o padrão já usado por `lib/backoffice-adhesions/adhesion-pricing.ts` (que resolve preço via `BackofficeProduct`/`BackofficeProductPaymentRule` no banco) para todo o motor de cobrança, eliminando os literais hardcoded.

### 2.2 Dois sistemas de cobrança coexistindo

Confirmado com o owner: **por desenho**, convivem hoje:
- **Sistema legado ("System A")** — assinatura Asaas direta, valor mutável, plano base R$59,90 + operador R$19,90 + time R$29,90, tudo hardcoded (ver lista completa em `BILLING_ENGINE_AUDIT.md` item 1, ~15 arquivos backend + 4 frontend). Enum `SubscriptionPlan` (`manager_base`/`with_operators`) e comentários do schema Prisma (`prisma/schema.prisma:500-506`) refletem só este sistema.
- **Catálogo novo ("System B")** — `BackofficeProduct`/`BackofficeProductPaymentRule`, preço vem do banco, CRM a R$89,90/mês (PIX) desde 27/05/2026 (seed), add-ons (`extra-team`, `extra-user`, `whatsapp`, `email`, `cdp`) documentados em `PRICING_MODEL.md`/`PRICING_TABLE.md`.

Clientes antigos permanecem na assinatura Asaas legada (System A); clientes novos entram pelo catálogo novo (System B). Isso deixa de ser tratado como "acidente arquitetural" e passa a ser um estado de transição documentado — mas **ainda não há migração planejada dos clientes legados**, nem há confirmação de que o fluxo de autocadastro de produto (`CheckoutAsaasUseCase.createSubscriptionCheckout`, `app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts:207`, hardcoda `value: 59.90`) esteja de fato desativado para clientes novos — se ainda estiver ativo, **clientes novos que passam por esse fluxo específico continuam sendo cobrados 59,90, não 89,90**, o que contradiz a separação "antigos=59,90 / novos=89,90". Nenhuma chamada a `.createSubscriptionCheckout(` foi encontrada fora do próprio arquivo e da interface — indício de que a rota que a invocava pode ter sido descontinuada, mas isso **precisa ser confirmado** (grep não encontrou nenhuma rota `app/api/**/route.ts` chamando esse método; ver Pergunta Bloqueante §11).

### 2.3 Preço hardcoded — ~15 arquivos (System A)

Lista completa mantida em `BILLING_ENGINE_AUDIT.md` item 1 (backend: `AsaasSubscriptionService.ts:79,104`, `AsaasOperatorService.ts:83,122,233,234`, `CheckoutAsaasUseCase.ts:207,455,596,600`, `SubscriptionUpgradeUseCase.ts:169,461,973,974`, `ManagerUserUseCase.ts:527`, `CreateManagerOnboarding.ts:89`, `create-card/route.ts:8`, `SubscriptionManagementUseCase.ts:385-387`, `BackofficeAllUsersUseCase.ts:32-33`, `BackofficePlatformUsersUseCase.ts:238-239`, `EmailCreditUseCase.ts:182`; frontend: `SubscriptionCard.tsx`, `SubscriptionBillingBreakdownCard.tsx`, `ReactivateSubscriptionDialog.tsx`, `SubscriptionCreditsDialog.tsx`). Uma mudança de preço hoje exige editar ~15 arquivos; esquecer um deles cobra um valor e exibe outro.

### 2.4 `subscriptionCycle`/`paymentStatus`/`paymentMethod` como `String` livre — bug confirmado em produção

`Profile.subscriptionCycle` e `ProfileSubscription.subscriptionCycle` são `String? @db.Text` com apenas um comentário ("MONTHLY, QUARTERLY, etc") como contrato — sem enum, sem validação. **Confirmado com query agregada em produção** (`wcnxwdcoambpfwxwubka`, somente leitura): contas mestras ativas têm `subscriptionCycle` gravado ora como `"quarterly"` (10 contas) ora como `"MONTHLY"` (5 contas) — **case inconsistente para o mesmo conceito**, prova de que qualquer código que compare a string exata (`=== "MONTHLY"`) já falha silenciosamente hoje em 2/3 das contas não-mensais amostradas. `PendingOperator.paymentStatus`/`paymentMethod` têm o mesmo problema (schema).

Achado adicional em produção: 2 contas com `subscriptionStatus: 'past_due'` **e** `hasPermanentSubscription: true` simultaneamente — combinação logicamente inconsistente (uma conta vitalícia não deveria carregar status de cobrança em atraso). Merece investigação da causa antes de qualquer normalização de dados (pode ser resíduo de uma conta que virou vitalícia depois de já estar em atraso, sem que o código limpe o `subscriptionStatus` antigo).

### 2.5 Variantes de `BackofficeProduct` fora do seed — confirmado em produção

Além da linha `isDefault:true` do CRM (R$89,90/79,90/69,90/69,90), o banco de produção tem **2 variantes de CRM não-default** que não existem em `prisma/seed-backoffice-products.ts`: uma fixa em R$150,00 em todos os ciclos, outra com R$120,00/89,90/79,90/100,00 por ciclo (mensal/trimestral/semestral/anual). Confirma `PRICING_TABLE.md` §7 item 3 ("Fixar `crm-lifetime` e variante Associados no seed... hoje só existem no backoffice manual") — e mostra que o problema é mais amplo do que só `crm-lifetime`: **qualquer** variante cadastrada manualmente no Backoffice é invisível para `bun run db:migrate:reset:local`, CI e novos ambientes. `crm-lifetime` confirmado com todos os campos de preço `null` também em produção (bate com `PRICING_MODEL.md` §6.1).

### 2.6 Demais inconsistências de precificação

Já catalogadas em detalhe em `PRICING_MODEL.md` §6 (6 itens) e `PRICING_TABLE.md` §7 (8 pendências) — não duplicadas aqui. Resumo dos pontos que mais interagem com o restante desta auditoria: acréscimo de cartão inconsistente entre produtos (CRM/WhatsApp cobram mais, CDP/email/extra-* não); `email` a R$29,90 pode canibalizar os futuros tiers de Radar; CDP segue `isActive:true` enquanto é tratado como "substituído" na documentação comercial.

### 2.7 Entitlements por assinatura — novo achado de modelagem

O estado desejado para a próxima SPEC é que a assinatura carregue explicitamente o que ela libera: `productSlugs` contratados, `featureSlugs` liberados, capacidades pagas e itens cobrados. Hoje isso existe de forma parcial e espalhada:

- `FeatureAccessService.resolveAllowedSlugs()` já calcula `slugs` de features a partir de `backoffice_features`, `productSlug`, herança pai/filho, grants beta e assinaturas ativas em `BackofficeUserSubscription`/`ProfileSubscription`.
- `SubscriptionCheckService.checkActiveSubscription()` ainda é essencialmente binário (`hasActiveSubscription`) e retorna uma assinatura simples com `id/status/plan/operatorCount`, sem carregar `productSlugs`, `featureSlugs`, capacidades ou composição de cobrança.
- `ProfileSubscriptionCapacity` modela capacidade de `extra-team`/`extra-user`, mas o gate de slugs não exige explicitamente capacidade positiva para liberar filhos add-on como `crm-time-manage-teams`/`crm-time-manage-users`.
- `BackofficeUserSubscription` representa produtos contratados, mas não modela quantidade; para add-ons multiplicáveis, a quantidade vive em `BackofficeAdhesion.extraTeams/extraUsers` e em `ProfileSubscriptionCapacity`, criando mais de uma fonte operacional.

**Risco:** a UI pode liberar um slug porque o produto existe, enquanto a operação bloqueia por falta de capacidade; ou a cobrança pode incluir uma capacidade sem que a assinatura exponha o slug correspondente. Para a SPEC, o contrato de assinatura deve responder, no mínimo, "quais produtos foram pagos?", "quais features estão liberadas?", "quais capacidades multiplicáveis estão disponíveis?" e "quais itens compõem o valor cobrado?".

**Regra auditada para add-ons filhos:** slugs filhos que funcionam como add-on devem exigir produto ativo **e** capacidade/quantidade paga quando o add-on for multiplicável. Exemplos: `extra-team` libera gestão/criação de times adicionais só se houver capacidade de times; `extra-user` libera gestão/criação de usuários adicionais só se houver capacidade de usuários. Add-ons booleanos como `whatsapp` e tiers de `email-dispatch-*`/`radar-*` dependem do produto ativo; `radar-setup` é taxa única e não libera feature sozinho.

---

## 3. Motor de vendas — preço negociado por adesão (feature nova)

Requisito de produto recebido durante esta auditoria, não um achado de bug: um vendedor precisa poder aplicar um preço diferente do preço de tabela para uma adesão específica (ex.: CRM R$100 → desconto de 10% só para aquele lead), sem alterar a tabela de precificação central.

**Estado atual confirmado:** não existe nenhum campo de desconto/override em `BackofficeAdhesion` nem em `lib/backoffice-adhesions/adhesion-pricing.ts` (grep por `discount|override|customPrice|manualPrice|negotiat` no schema, zero ocorrências ligadas a produto/adesão/preço). `BackofficeContract`/`BackofficeContractVersion` (`prisma/schema.prisma:1081-1122`) existem no banco, mas são upload e versionamento de **arquivo PDF** de contrato assinado — não têm nenhum campo de valor monetário e não são reaproveitáveis para este requisito.

**Decisões do owner (definidas nesta auditoria):**
1. Qualquer usuário do Backoffice pode aplicar desconto até um **teto percentual configurável**; acima do teto, exige aprovação de MANAGER/MASTER.
2. O desconto se aplica ao **valor total calculado da adesão** (plano + add-ons juntos), não item a item.
3. O formato do ajuste é **percentual** sobre o preço de tabela vigente (não valor fixo em R$) — o valor final é recalculado a partir do preço de tabela no momento do fechamento, preservando o percentual negociado (não o valor nominal).

O desenho técnico completo (campos de schema, ponto de integração no motor de cálculo, UI) está na `BILLING_SPEC.md`, estágio "Motor de vendas / preço negociado por adesão".

---

## 4. Motor Asaas / webhooks

### 4.1 C0 — o motor de webhook trata eventos e status que não existem na API real do Asaas

Confirmado contra a documentação oficial do Asaas (`docs.asaas.com/docs/subscription-events`, `docs.asaas.com/docs/payment-events`, schema OpenAPI `SubscriptionGetResponseDTO`) via MCP — **nenhuma auditoria anterior verificou isso contra a fonte oficial**.

- **Eventos de assinatura reais**: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED` (+ eventos de split, irrelevantes aqui). `processAsaasWebhookEvent.ts:330-333` e `PaymentValidationService.ts:71,97-105` tratam `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_SUSPENDED`, `SUBSCRIPTION_CANCELED` — **nenhum dos três é emitido pelo Asaas**. São branches mortos que nunca vão executar em produção.
- **`subscription.status` real** (enum oficial `SubscriptionGetResponseSubscriptionStatus`): `ACTIVE | EXPIRED | INACTIVE`. `PaymentValidationService.ts:111-117` (`mapStatusFromPayload`) só reconhece as strings `'SUSPENDED'`, `'INACTIVATED'`, `'CANCELLED'`/`'CANCELED'` — nenhuma delas bate com os valores reais (`'INACTIVE'` ≠ `'INACTIVATED'`; `'EXPIRED'` nem é checado em lugar nenhum).
- **Consequência concreta e grave** (`PaymentValidationService.ts:122`): `mappedStatus = mappedFromEvent ?? mappedFromPayload ?? 'active'`. Quando o Asaas manda `SUBSCRIPTION_UPDATED` com `status: "INACTIVE"` ou `"EXPIRED"` — os **únicos** valores reais de desativação que o Asaas de fato envia — nenhum dos dois mapeamentos casa, e o fallback grava `subscriptionStatus: 'active'` no perfil. **Uma assinatura que acabou de ser desativada no Asaas é lida pela aplicação como reativada.**
- **Consequência adicional**: como `SUBSCRIPTION_SUSPENDED`/`SUBSCRIPTION_CANCELED` nunca disparam de verdade, o estado local `suspended` é, na prática, **inalcançável via webhook** — esta é a causa raiz do item P2 #11 de `BILLING_ENGINE_AUDIT.md` ("sem transição automática past_due → suspended"), que antes era descrito como uma lacuna e agora tem explicação: o mecanismo nunca poderia ter funcionado, porque escuta um vocabulário de eventos que o Asaas não fala.
- A documentação oficial confirma ainda (recipe `inative-uma-assinatura-por-inadimplência`) que **o Asaas não inativa sozinho** uma assinatura em atraso — cabe à aplicação chamar `PUT /v3/subscriptions/{id}` com `{"status": "INACTIVE"}` ao identificar inadimplência prolongada via `PAYMENT_OVERDUE`. Nenhum ponto do código faz essa chamada — o `past_due` marcado localmente (`PaymentValidationService.ts:152-184`) nunca é refletido de volta para o Asaas, então a assinatura no Asaas continua `ACTIVE` gerando novas cobranças indefinidamente, mesmo que a aplicação já considere a conta em atraso.
- **Refund/chargeback confirmados como eventos reais e documentados**: `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` — todos documentados oficialmente, com fluxos completos de exemplo na doc do Asaas. Nenhum tem handler no código (`AsaasWebhookTypes.ts` define os tipos, mas não há `case` para eles). Isso eleva de "gap provável" (auditoria de 09/07) para **gap confirmado contra a especificação oficial**: uma conta permanece `active` depois de um estorno ou de uma disputa de chargeback vencida pelo cliente.

### 4.2 Achados já catalogados em `BILLING_ENGINE_AUDIT.md` (referenciados, não duplicados)

C1 (rota pública de vitalício sem auth), C2 (cancelamento não cancela no Asaas), C3 (plano regride para `manager_base`), e a tabela de riscos P1-P15 completa (§"CRITIQUE — riscos priorizados"). Todos confirmados ainda presentes no código nesta rodada (re-verificados por leitura direta, não só por confiança no documento anterior).

### 4.3 Achados novos desta rodada (não estavam na auditoria de 09/07)

- **Condição de corrida em `claimForProcessing()`** (`AsaasWebhookEventRepository.ts:20-74`): `findUnique` seguido de `create` são dois round-trips separados, não atômicos. Entregas duplicadas concorrentes do mesmo `eventId` (comportamento "at least once" documentado oficialmente pelo Asaas) podem fazer duas requisições verem `!existing` simultaneamente; a perdedora recebe um erro de constraint único não tratado dentro da função, que sobe ao `catch` externo de `route.ts` e retorna HTTP 200 `success:false` — silenciosamente enganoso (a requisição perdedora não processou nada, mas o Asaas não tenta de novo).
- **`resolveAsaasWebhookEventId`** (`processAsaasWebhookEvent.ts:35-46`): quando o Asaas manda um payload sem `id` nem `payment.id`/`subscription.id`, o fallback gera `` `${event}:${Date.now()}` `` — **não é idempotente**; uma reentrega genuína do mesmo payload geraria um ID diferente e seria reprocessada como evento novo.
- **Três `TODO`s que retornam sucesso falso ao usuário** (`SubscriptionManagementUseCase.ts`): `cancelSubscription()` (linha ~661, chamada ao Asaas comentada), `updatePaymentMethod()` (linhas 722-733, idem) e `retryPayment()` (linhas 781-789, idem) — todos os três chamam a API do Asaas em comentário e ainda assim retornam `Output(true, [...])`. O usuário recebe a mensagem "cartão atualizado com sucesso" ou "pagamento em retentativa" quando nada disso aconteceu de fato. `retryPayment` é ainda pior: o frontend (`SubscriptionService.ts:139-144`) chama `POST {baseUrl}/invoices/retry`, rota que **não existe** em `app/api/v1/subscription-management/` — o botão está quebrado ponta a ponta, independente do stub.
- **Token do webhook comparado sem constant-time** (`route.ts:35`, `!==` simples) — risco teórico baixo para um segredo compartilhado de webhook, mas vale registrar.
- **Cliente Asaas sem timeout** (`lib/asaas.ts`, `asaasFetch`/`asaas()`): nenhum `AbortController`/timeout no `fetch()`. Uma resposta lenta ou travada do Asaas bloqueia indefinidamente (até o limite de `maxDuration` da rota, quando existir) qualquer endpoint que chame a API de forma síncrona/aguardada — não é fire-and-forget na maioria dos fluxos de checkout/upgrade.
- Erros da API do Asaas são recapturados e relançados como `Error` genérico em todos os wrappers (`AsaasSubscriptionService`, `AsaasCustomerService`, `AsaasOperatorService`, `IncrementalBillingService`), descartando o `statusCode` que `asaasFetch` anexa (`lib/asaas.ts:85`) — nenhum chamador consegue distinguir um 429 (rate limit, documentado oficialmente: 100 req/min por endpoint, cota de 25.000 req/12h por conta, 50 requisições GET concorrentes) de um 400 (erro de validação, definitivo) ou 5xx (falha do Asaas, retryable).

---

## 5. Backoffice — UI e autorização

### 5.1 Bypass de autorização confirmado

`POST /api/v1/backoffice/payments` (`app/api/v1/backoffice/payments/route.ts:36-52`) — cria cobranças reais no Asaas — **não chama `requireManagerAccess()`**, ao contrário de `pricing/route.ts:30` e do `PATCH` de `invoices/[invoiceId]/route.ts:49-50`, que seguem o padrão corretamente. A única barreira hoje é no frontend: `canManage = !user?.isOperator` (`BackofficePaymentsContext.tsx:42`) só esconde o botão "Nova Cobrança" — qualquer operador do Backoffice pode chamar a rota diretamente e criar cobranças arbitrárias contra qualquer cliente com `asaasCustomerId`.

### 5.2 Controles sem função real em tela de produção

`BackofficeClientInvoiceDetailsContainer.tsx`: "Compartilhar fatura" (linha 246, chama `handleNoopAction` — `return undefined`), "Confirmar recebimento em dinheiro" (linha 283) e "Remover cobrança" (linhas 287-292, com estilo destrutivo) têm `onSelect={(e) => e.preventDefault()}` **sem handler real**. São botões visíveis, clicáveis, com aparência de funcionalidade real (compartilhar link de fatura, marcar pagamento em dinheiro, apagar uma cobrança) que não existe — risco de confiança direto numa tela de dinheiro.

### 5.3 Ação de alto impacto sem confirmação

"Tornar cliente vitalício" / "Remover plano vitalício" (`BackofficeClientDetailsContainer.tsx:262-277, 863-885`) alterna entre cobrança normal e vitalícia num único clique, sem nenhum `AlertDialog` de confirmação — só um toast depois do fato. Dado que isso interrompe toda cobrança futura do cliente, e que o projeto já usa `AlertDialog` corretamente em outros lugares (`BackofficeProductDeleteDialog.tsx`), a ausência aqui é uma lacuna de padrão, não de tecnologia disponível.

### 5.4 `DialogContent` sem wrapper de scroll (viola `CLAUDE.md`)

`BackofficePaymentsContainer.tsx`: o dialog "Nova Cobrança" (linha 240, `sm:max-w-md`) e o dialog do QR Code PIX (linha 76, `sm:max-w-sm`) não têm o padrão `max-h-[90vh] flex flex-col` + `overflow-y-auto` exigido pela governança do projeto para `DialogContent` com conteúdo não-trivial — presente corretamente em `BackofficeProductDialog.tsx:95` e `BackofficeClientInvoiceDetailsContainer.tsx:457`. O formulário "Nova Cobrança" tem 5 campos + rodapé e pode transbordar em viewports curtos.

---

## 6. E-mails e alertas de cobrança

### 6.1 Inventário de e-mails transacionais de cobrança (`lib/services/EmailService.ts`, todos HTML inline, sem react-email)

| E-mail | Gatilho | Automático? |
|---|---|---|
| Confirmação de pagamento (`sendSubscriptionConfirmationEmail`) | Webhook `PAYMENT_CONFIRMED`/`RECEIVED` (`PaymentValidationService.ts:223-276`) | Sim, mas fire-and-forget não-aguardado (`.then/.catch`, linhas 249-270) — falha de envio só vira `console.warn`, nunca reprocessada, nunca alertada. |
| Vencimento/atraso de fatura (`notifyMasterUserInvoiceStatusEmail`, `BackofficePlatformUsersUseCase.ts:966-1100`) | Botão manual na tela de fatura do Backoffice | **Não** — é o único e-mail de cobrança em atraso do sistema, e depende de um humano abrir a fatura e clicar. |
| Add-on pendente/confirmado, adesão via checkout | Fluxos de operador/time/adesão | Sim, dentro do próprio fluxo síncrono. |
| `sendPendingAccountUserPaymentEmail` (`EmailService.ts:1466`) | — | Código morto — zero chamadores encontrados no repositório. |

**Não existe nenhum e-mail automático de**: lembrete de vencimento próximo, cobrança em atraso recorrente (dunning), renovação confirmada (fora do primeiro pagamento), cancelamento de assinatura. O único cron de billing existente (`vercel.json`) é `/api/v1/billing/cron/member-pro-expiration` — nenhum cron cobre lembrete/dunning de assinatura principal.

### 6.2 Nenhuma visibilidade de e-mails de cobrança falhos

`sendEmailUntracked` (usado por todos os e-mails de billing) **intencionalmente não cria `EmailLog`** (comentário em `EmailService.ts:44-55`: "Envios intencionalmente sem team_id... Não cria EmailLog"). Isso significa que nenhum e-mail de cobrança aparece no painel de analytics de e-mail do Backoffice (`/backoffice/emails/analytics`) — uma falha de entrega (bounce, spam, erro de Resend) é completamente invisível para qualquer pessoa da operação.

### 6.3 Nenhuma visibilidade de webhooks Asaas falhos

Webhooks que falham no processamento são persistidos com `status: 'failed'` em `asaas_webhook_events` (`route.ts:90`) e capturados no Sentry — mas **nenhuma tela do Backoffice lista, filtra ou permite reprocessar** eventos falhos, ao contrário do padrão já existente no projeto para falhas de webhook do WhatsApp (`lib/whatsapp/whatsapp-webhook-failure-alert.ts` + página `/backoffice/integracoes`). Sentry é hoje o único lugar onde um humano descobre um webhook de cobrança que falhou.

### 6.4 Nenhum dashboard de contas em risco

`PAYMENT_OVERDUE` só seta `subscriptionStatus: 'past_due'` no `Profile` (`PaymentValidationService.ts:151-184`) — sem e-mail automático, sem notificação in-app, sem contador/badge em nenhuma tela do Backoffice. Contas `past_due` ou `canceled` só são visíveis abrindo o cliente específico um a um; não existe uma lista agregada "contas em atraso" ou "canceladas este mês".

---

## 7. Tipos de usuário (member-pro, vitalício, associados)

### 7.1 Modelo de dados

`ProfileUserType` (`prisma/schema.prisma:3105-3116`) é uma tabela de lookup com `slug` livre (`String`, não enum) — valores conhecidos no código: `"common" | "member_pro" | "associate" | "guest"`. `ProfileUserTypeAssignment` (1:1 com `Profile`) guarda `userTypeId`, `accessStartsAt`, `accessExpiresAt`, `assignedByProfileId`. **"Vitalício" não é um `userType`** — é a flag booleana independente `hasPermanentSubscription`, presente tanto em `Profile` quanto em `ProfileSubscription` (duplicação de estado já registrada em `PRICING_MODEL.md`/achados de hoje).

### 7.2 Dois mecanismos de "vitalício" desconectados

`hasPermanentSubscription` (flag, bypassa toda cobrança em qualquer lugar que a leia) e o produto `crm-lifetime` (`BackofficeProductBillingMode.LIFETIME`, preço `null` no seed e em produção) não têm nenhuma ligação confirmada no código — não foi encontrado o ponto que, ao concluir uma compra de `crm-lifetime`, efetivamente grava `hasPermanentSubscription = true`. Se esse elo não existir, uma compra de `crm-lifetime` não concede de fato acesso vitalício sob a lógica atual do `FeatureAccessService`/`SubscriptionGuard`. **Precisa ser confirmado antes de tratar como funcionando** (ver Pergunta Bloqueante §11).

### 7.3 Duas definições divergentes de "assinatura ativa" — bug de UX reproduzível

`FeatureAccessService.ACTIVE_SUBSCRIPTION_STATUSES = {active, trial, past_due}` (gate que libera slugs de feature/sidebar) vs. `SubscriptionCheckService.isActive = (subscriptionStatus === 'active')` (gate que controla o bloqueio de página inteira via `SubscriptionGuard`, usado em `crm`, `dashboard`, `associados`, `automations`, `carteira`, `manager-users`, `performance`, `lead-transfers`, `calendar`). Um master/manager com status `trial` ou `past_due` tem a sidebar liberada (primeiro gate diz "ativo") mas simultaneamente vê a página bloqueada com "Assinatura Inativa" (segundo gate diz "inativo") — **as duas definições nunca foram unificadas em uma constante compartilhada**, apesar de `BILLING_ENGINE_AUDIT.md` item 4 já mencionar vagamente "cada módulo com sua própria noção de ativo" sem identificar este par específico nem o efeito concreto.

### 7.4 Início de cobrança na transição Member PRO → cliente pagante (achado novo)

Rastreado ponta a ponta: `app/api/v1/billing/cron/member-pro-expiration/route.ts` (cron `0 6 * * *`) → `MemberProBillingUseCase.processExpiredMemberProAccounts()` (`app/api/useCases/billing/MemberProBillingUseCase.ts:132-185`) → `IncrementalBillingService.ensureOrSyncRecurringSubscription()` (`app/api/services/billing/IncrementalBillingService.ts:425-495`).

- **O bypass termina instantaneamente, mas o início da cobrança real só roda 1x por dia.** `isActiveMemberProAssignment()` (`memberProBillingRules.ts:18-26`) é calculada ao vivo a partir de `accessExpiresAt`: no segundo em que expira, `resolveMemberProBypass()` já retorna `false`, e qualquer cobrança incremental **nova** (ex.: adicionar operador) já cobra em cheio a partir desse instante. Mas a criação/sincronização da **assinatura recorrente base** só acontece quando o cron roda — janela de até ~24h em que o benefício Member PRO já acabou, mas a assinatura recorrente correspondente ainda não foi criada/atualizada.
- **Sem checkout explícito no momento em que a cobrança nasce.** Quando o master ainda não tem `asaasSubscriptionId` real, `ensureOrSyncRecurringSubscription` (linhas 425-495) chama `createAsaasSubscription(...)` diretamente (PIX por padrão, ou cartão se já existir `creditCardToken` de uma assinatura anterior) — **sem nenhuma tela de confirmação/pagamento para o cliente nesse instante**. Presume que `asaasCustomerId` e dados cadastrais já existem.
- **`upsertUserTypeAssignment` não valida nada antes de conceder Member PRO** (`BackofficeAllUsersRepository.ts:697-723`) — um admin do Backoffice pode conceder `member_pro` a qualquer perfil, inclusive um que nunca passou por checkout (sem `asaasCustomerId`, sem cartão, sem CPF). Quando o período acaba, `ensureCustomer()` → `createAsaasCustomer()` pode falhar por dado cadastral faltante, e o erro só é `console.error` dentro do loop do cron (`MemberProBillingUseCase.ts:99-101`) — sem alerta, sem retry, sem visibilidade no Backoffice. O master fica "preso": sem benefício Member PRO, sem cobrança criada, potencialmente bloqueado pelo `FeatureAccessService` sem nenhuma tela explicando o motivo.
- **Cron sem reforço fora do horário fixo.** Se o cron falhar num dia (deploy, erro do Vercel), a janela de notificação por e-mail (`shouldNotify`, `MemberProBillingUseCase.ts:143-145`, só dispara se `accessExpiresAt >= now - 1 dia`) pode ser perdida por completo — o cliente é cobrado pela primeira vez sem nunca ter recebido o aviso "seu Member PRO acabou".
- **Copy do e-mail assume que já existia assinatura** ("Sua assinatura foi atualizada para refletir o uso atual da conta", `MemberProBillingUseCase.ts:161`) mesmo quando, na prática, essa pode ser a primeira cobrança real da conta — mensagem confusa para quem nunca pagou nada antes.

---

## 8. Performance do motor de pagamentos

> Seção baseada em leitura estática de código e schema (sem acesso a APM/métricas de produção). Os dois agentes de investigação de performance originalmente disparados para esta seção foram cancelados no meio da sessão (interrupção do usuário); os achados abaixo vêm de verificação direta e pontual, não de uma varredura completa — recomenda-se uma auditoria de performance dedicada mais profunda como próximo passo, não coberta por este documento.

### 8.1 Índices faltando nos campos de lookup mais usados pelo webhook

`Profile.asaasCustomerId`, `Profile.subscriptionId` e `Profile.asaasSubscriptionId` (`prisma/schema.prisma` ~linhas 731-740) **não têm nenhum índice** (`@@index`/`@unique`) — confirmado por leitura direta do bloco de índices do modelo `Profile` (linhas 161-165, só `role`/`managerId`/`sponsorMasterId`/`cpfCnpj`/`googleConnectionId`). Esses três campos são exatamente as chaves de busca (`findByAsaasCustomerId`, `findBySubscriptionId`) usadas em **todo evento de webhook Asaas recebido** (`PaymentValidationService.ts` para `PAYMENT_OVERDUE`/`PAYMENT_CONFIRMED`, `processAsaasWebhookEvent.ts` para `SUBSCRIPTION_CREATED`/`UPDATED`). Com 185 masters hoje isso não pesa, mas é um full scan que cresce linearmente com a base — e é o tipo de índice mais barato de adicionar (impacto alto, risco de migration baixíssimo). Por comparação, `asaas_webhook_events` já tem o índice correto (`@@index([status, receivedAt(sort: Desc)])`), mostrando que o padrão existe no projeto, só não foi aplicado em `Profile`.

### 8.2 Possível violação da regra de reuso de `TeamContext` no bootstrap autenticado

`lib/bootstrap/getAuthenticatedLayoutBootstrapData.ts` — chamado em todo carregamento de página autenticada — dispara em paralelo `getTeamsRouteHandler(request)` (linha 56, uma chamada interna a um route handler completo), `checkSubscriptionUseCase.execute(...)` (linha 75) e `featureAccessUseCase.execute(...)` (linha 94). Nenhum dos três recebe um `TeamContext` já resolvido em comum — cada um é uma unidade independente que, pelo padrão do projeto (`getTeamAccess()` resolvendo `profile` + `teamMember`), provavelmente resolve seu próprio profile/team internamente. Isso é candidato a violar a regra do próprio `CLAUDE.md` ("o par `profile.findUnique` + `teamMember.findUnique` MUST NOT ser executado mais de uma vez por requisição HTTP") — precisa de confirmação lendo os três caminhos internos (não feito aqui por escopo), mas a estrutura já é o sinal clássico dessa violação: three separate `.execute()`/handler calls dentro do mesmo bootstrap, sem um `ctx: TeamContext` explícito passado entre eles.

### 8.3 Chamadas ao Asaas sem timeout, algumas síncronas no caminho de resposta

Já registrado em §4.3: `lib/asaas.ts` (`asaasFetch`/`asaas()`) não define `AbortController`/timeout em nenhuma chamada. Fluxos como `CheckoutAsaasUseCase.createSubscriptionCheckout`, `IncrementalBillingService.ensureOrSyncRecurringSubscription` e as rotas de add-on (`teams/payments/create`, `operators/payments/create`) aguardam (`await`) essas chamadas diretamente no caminho de resposta HTTP ao usuário — uma resposta lenta do Asaas (rate limit documentado: 100 req/min por endpoint, 25.000 req/12h por conta, 50 GETs concorrentes) trava a requisição do usuário até o Asaas responder ou até o limite de `maxDuration` da rota (quando existir).

### 8.4 Sem camada de cache para status de assinatura/feature access

Nenhum `unstable_cache`, cache em memória ou Redis foi encontrado na frente de `FeatureAccessService` ou dos serviços de checagem de assinatura — toda resolução de acesso consulta o Postgres a cada requisição. Dado que o estado de billing muda com pouca frequência (poucas vezes por dia por conta, no máximo), isso é uma oportunidade de otimização não avaliada nesta rodada, não necessariamente um problema hoje — fica registrado para uma auditoria de performance dedicada decidir se vale a complexidade de invalidação de cache.

### 8.5 Listagem de cobranças no Backoffice sem `select`

`BackofficePaymentRepository.findMany()` (`app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository.ts:28-29`) chama `prisma.backofficePayment.findMany({...})` **sem `select`** — traz todas as colunas da tabela para uma tela de lista paginada, contrariando a diretriz do projeto de preferir `select` a fetch completo. Tabela com 0 linhas em produção hoje (baixo impacto atual), mas o padrão errado se propaga se copiado para outras listagens.

---

## 9. Débito técnico estrutural

- `SubscriptionUpgradeUseCase.ts` com 1.527 linhas, payloads `any`, logs de debug verbosos em produção (emoji + `console.info` em quase todo método).
- Lógica de "adicionar operador" triplicada entre `AsaasOperatorService`, `CheckoutAsaasUseCase` e `SubscriptionUpgradeUseCase` — três implementações parcialmente divergentes do mesmo conceito.
- Dois clientes HTTP Asaas em `lib/asaas.ts` (`asaasFetch` e o `asaas()` legado) com comportamento de erro ligeiramente diferente.
- `PaymentValidationService.processWebhook` mistura ativação de assinatura, envio de e-mail transacional e mapeamento de status num único método de ~250 linhas.
- `BackofficeClientDetailsContainer.tsx` ultrapassa 1000 linhas cobrindo times + membros + faturas + toggle vitalício num único container/contexto — a lógica de listagem/filtro de faturas (parte deste escopo de auditoria) está misturada com gestão de time, ao contrário da tela de detalhe de fatura individual, que tem seu próprio módulo `features/` dedicado.

---

## 10. Perguntas bloqueantes remanescentes

1. **`CheckoutAsaasUseCase.createSubscriptionCheckout` ainda está em uso para clientes novos?** Nenhuma rota chamando esse método foi encontrada — se estiver morto, remover; se estiver ativo por algum caminho não encontrado nesta auditoria, ele cobra 59,90 de clientes que deveriam entrar no catálogo novo a 89,90.
2. **Existe plano de migrar os clientes legados (System A, 59,90) para o catálogo novo (System B, 89,90)?** Ou eles permanecem na assinatura Asaas antiga até cancelamento natural? Decisão de negócio, não técnica.
3. **Uma compra de `crm-lifetime` de fato seta `hasPermanentSubscription = true`?** Não foi encontrado o ponto de integração — precisa confirmação antes de tratar o produto como funcional.
4. **Grants efetivos de `anon`/`authenticated`** em `asaas_webhook_events`/`profile_user_type_assignments`/`profile_user_types` — necessário para calibrar a severidade final do achado C-1 (exposição confirmada vs. em potencial).
5. Reaproveitadas de `BILLING_ENGINE_AUDIT.md` (ainda sem resposta): confirmação de dados de produção Asaas (só sandbox foi verificado até hoje), origem das 3 assinaturas sandbox com `value: 5990`, comportamento desejado quando o crédito de e-mail estoura sem `autoChargeOverage`.
6. **Confirmar violação de reuso de `TeamContext`** no bootstrap autenticado (§8.2) — a estrutura do código é candidata à violação, mas não foi confirmado lendo os três caminhos internos (`getTeamsRouteHandler`, `CheckSubscriptionUseCase`, `featureAccessUseCase`) ponta a ponta.
7. **Contrato de entitlements da assinatura:** definir se o retorno oficial deve expor `productSlugs`, `featureSlugs`, `addonSlugs`, capacidades e itens cobrados no próprio `/api/v1/subscriptions/check`, no bootstrap autenticado, ou em um endpoint dedicado reutilizado por ambos.
8. **Produto vendável vs. feature navegável:** confirmar a regra operacional de que preço sempre mora em `BackofficeProduct.featureSlug`, enquanto navegação/acesso mora em `BackofficeFeature.slug`; `radar-setup` e outros fees entram só como itens cobrados, não como feature liberável.
9. **Filhos herdados vs. cobrados separadamente:** confirmar que `inheritParentSettings=true` herda acesso do pai, enquanto filhos add-on exigem `productSlug` próprio e, quando multiplicáveis, capacidade positiva.
10. **Clientes legados:** definir como preservar System A (R$59,90/19,90/29,90) sem misturar automaticamente esses valores com o catálogo System B no momento em que a assinatura passar a expor itens por slug.
