# BILLING_ENGINE_SPEC.md — Evolução do Motor de Cobrança/Assinaturas (Asaas)

**Versão:** 1.0 (proposta — depende das respostas às perguntas bloqueantes do `BILLING_ENGINE_AUDIT.md`)
**Base:** auditoria de 2026-07-09 (`BILLING_ENGINE_AUDIT.md`)

---

## Goal

Tornar o motor de cobrança **claro, consistente e auditável**: uma única fonte de preço, tipos fortes para ciclo/status, webhook resiliente a reentrega e a eventos negativos (estorno/chargeback), ciclo de vida completo da assinatura (adesão → upgrade/downgrade → mudança de ciclo → cancelamento real no Asaas), cobrança opt-in de overage de e-mail, e trilha de auditoria de toda mudança de plano — com cobertura de teste obrigatória em cada transição de estado.

## Non-goals

- Migrar de Asaas para outro PSP.
- Reestruturar o modelo comercial (preços/valores permanecem os atuais: base 59,90 / operador 19,90 / time 29,90 — pendente confirmação (b)/(c) da auditoria).
- Unificar `EmailCreditSubscription` e Dialer dentro da assinatura única do Profile (ver Decisão D4 — permanecem modelos separados, agora documentados como decisão).
- UI de edição de preço em runtime (ver Decisão D1; evolução futura opcional, pendente pergunta (f)).
- Refatorar o Backoffice de adesões (`BackofficeAdhesion*`) — fora de escopo.

---

## Decisões arquiteturais

### D1. Fonte única de preço: catálogo em código versionado
Um único módulo `app/api/shared/billing/pricingCatalog.ts` define nome, valor, ciclos permitidos e descrição Asaas de cada item cobrável (plano base, operador, time adicional, planos de crédito de e-mail, taxa de overage). Todos os pontos que hoje têm literais (15 arquivos backend + 4 frontend) passam a importar do catálogo; o frontend recebe os valores via API (`billingSummary`), com o catálogo como fallback único.
**Justificativa:** o Asaas não tem catálogo de planos (confirmado na spec OpenAPI) — o preço só existe no nosso código, logo o código precisa ter exatamente 1 definição. Tabela em banco fica como evolução opcional (pergunta (f)) — não bloqueia esta spec, pois o catálogo em código já elimina a dessincronia.

### D2. `SubscriptionCycle` vira enum tipado
Enum Prisma `SubscriptionCycle { MONTHLY QUARTERLY SEMIANNUALLY YEARLY }` substitui a `String` livre em `Profile.subscriptionCycle`. Valores espelham a nomenclatura do Asaas (`SEMIANNUALLY`, não `SEMIANNUAL`) para eliminar camada de tradução. `LIFETIME` **não** entra no enum: vitalício não é ciclo de cobrança, é a flag `hasPermanentSubscription` (semânticas distintas — uma assinatura vitalícia não tem `nextDueDate`).
**Justificativa:** typos hoje persistem silenciosamente; o webhook grava valor cru do Asaas. Migration converte valores existentes (todos `MONTHLY` no sandbox; produção a confirmar) e normaliza desconhecidos para `MONTHLY` com log.

### D3. `SubscriptionPlan` reflete a realidade — sem inventar planos
O enum atual (`free_trial`, `manager_base`, `with_operators`) permanece; **não** adicionamos ciclos como planos (ciclo é dimensão ortogonal, campo próprio) nem "Time Adicional" como plano (é add-on aditivo, já modelado por contagem/valor). O que muda: `updateProfileStatus` **deixa de sobrescrever** o plano (deriva de `operatorCount > 0 ? with_operators : manager_base` apenas quando o campo está nulo).

### D4. Billing por módulo — decisão formalizada, não acidente
- **Assinatura principal do Profile (Asaas, valor mutável):** plano base + operadores + times adicionais. Continua sendo 1 assinatura Asaas por master.
- **Email Campaigns (`EmailCreditSubscription`, por Team):** permanece modelo separado, porque a unidade de cobrança é o Time (multi-time por master) e o consumo é variável — acoplar à assinatura do Profile obrigaria rateio artificial. Ganha integração Asaas própria (cobrança dos planos + overage) nesta spec.
- **Dialer:** licença própria com proração (spec própria); segue o mesmo padrão do e-mail: modelo separado por Team, conectado ao mesmo `pricingCatalog` e ao mesmo feature gating central.
**Justificativa:** o custo de unificar é maior que o de padronizar. O que fica proibido é cada módulo inventar seu próprio conceito de "assinatura ativa" — isso passa a vir do gate central (D5).

### D5. Feature gating: `FeatureAccessService` é a única resposta para "tem acesso?"
Já existe e funciona ([FeatureAccessService.ts](app/api/services/featureAccess/FeatureAccessService.ts)). A spec consolida: (1) `ACTIVE_SUBSCRIPTION_STATUSES` vira export único compartilhado; (2) checks diretos de `subscriptionStatus` espalhados em rotas são substituídos por chamada ao serviço (backend) e ao hook de features (frontend); (3) add-ons pagos (Time Adicional, Email, Dialer) registrados como features `ADDON` em `backoffice_features`.

### D6. `hasPermanentSubscription` é exclusivo do Backoffice
As duas rotas de produto que alteram a flag são removidas/bloqueadas. Única via: rota backoffice existente ([platform-users/[id]/route.ts](app/api/v1/backoffice/platform-users/[id]/route.ts), já autorizada por `getBackofficeAccess()`). Toda alteração gera registro de auditoria (D7).

### D7. Trilha de auditoria: `SubscriptionChangeLog`
Nova tabela registrando toda mudança de plano/ciclo/valor/flag vitalícia/cancelamento: `profileId`, `changedByProfileId`, `changeType`, `fromValue`/`toValue` (JSON), `source` (`product|backoffice|webhook|system`), `createdAt`. Mesmo princípio do rastreio de patrocínio de contas Associadas.

### D8. Overage de e-mail: opt-in por Time, cartão obrigatório, registro rastreável
- `EmailCreditSubscription.autoChargeOverage Boolean @default(false)` — ligado/desligado pelo Manager/master do Time.
- Ativação exige **cartão de crédito válido verificado no Asaas no momento da ativação** (consulta `GET /v3/subscriptions/{id}` → `creditCard.creditCardToken` presente, ou tokenização dedicada) — não confiar em cadastro antigo.
- Nova tabela `PendingOverageCharge` (espírito do `PendingOperator`): `teamId`, `subscriptionId`, `overageCount`, `amount`, `asaasPaymentId`, `status (PENDING/CONFIRMED/FAILED)`, timestamps.
- Cobrança recusada/cartão expirado → desativa `autoChargeOverage`, notifica o Time (sonner + e-mail), nunca falha silenciosa.
- Com `autoChargeOverage` desligado e crédito estourado: **pendente decisão de negócio (pergunta (d))** — a spec assume provisoriamente **bloquear novos disparos até o reset mensal** (default conservador: nunca gerar custo não autorizado nem trabalho não cobrado).

### D9. Mudança de ciclo = `PUT` na assinatura existente
Confirmado na spec OpenAPI do Asaas: `PUT /v3/subscriptions/{id}` aceita `cycle` + `updatePendingPayments`. Não cancelar+recriar. Regras: upgrade de ciclo (mensal→trimestral etc.) entra no **próximo vencimento** (sem proração — o valor do ciclo atual já foi pago); downgrade de ciclo idem. Mudança de plano com aumento de valor no meio do ciclo: cobrança avulsa proporcional via `IncrementalBillingService` (padrão já usado para add-ons). Downgrade de valor: entra em vigor no próximo ciclo (sem reembolso parcial). Somente `master` executa (checagem explícita `isMaster`, não apenas manager delegado).

---

## Estágios de implementação

> Ordem obrigatória. Cada estágio termina com `bun run typecheck`, `bun run lint`, `bun run governance:check` (e `bun run design:check` quando houver UI) verdes, e os testes do estágio passando. Nenhum estágio aplica migration remota sem autorização do owner.

---

### Estágio 0 — Hotfix de segurança: `hasPermanentSubscription` (P0, sai antes de tudo)

**Prompt (copy-paste):**
```
No lead-flow-app, corrija o controle de acesso da flag hasPermanentSubscription:

1. DELETE a rota app/api/v1/profiles/permanent-subscription/route.ts (POST público sem auth — vulnerabilidade crítica). Remova também TogglePermanentSubscriptionUseCase e ITogglePermanentSubscriptionUseCase se não houver outro consumidor backend; atualize .governance/ai-governance.config.json se estiverem em allowlist.
2. Na rota app/api/v1/profiles/[supabaseId]/permanent-subscription/route.ts, substitua a autorização por requestingUser.isMaster por getBackofficeAccess() (app/api/v1/backoffice/utils/getBackofficeAccess.ts). Se o frontend de produto (manager-users) usa essa rota, remova o controle da UI de produto — a operação passa a existir apenas no Backoffice (que já tem rota própria em app/api/v1/backoffice/platform-users/[id]/route.ts).
3. Adicione registro em console.info com rota estável + método em toda alteração da flag, incluindo quem executou.
4. Atualize postman/Lead-Flow-API-Collection.json removendo/ajustando os endpoints alterados, e docs/PERMANENT_SUBSCRIPTION_API.md.
5. Escreva testes para o novo controle de acesso (caso permitido: backoffice; casos negados: sem auth, master de produto, operator).
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** `PaymentValidationService`, webhook, preços, frontend de assinatura.

**Aceite:** requisição não autenticada e requisição de master de produto retornam 401/403; apenas backoffice altera a flag; teste cobre os 4 cenários. **Validação manual:** via Postman, `POST /api/v1/profiles/permanent-subscription` retorna 404 (rota removida); `PUT .../permanent-subscription` sem sessão backoffice retorna 403.

---

### Estágio 1 — Fonte única de precificação (`pricingCatalog`)

**Prompt (copy-paste):**
```
No lead-flow-app, crie app/api/shared/billing/pricingCatalog.ts como fonte única de precificação:

export const PRICING_CATALOG = {
  managerBase: { name: "Plano Professional", price: 59.9, cycles: ["MONTHLY"], asaasDescription: "..." },
  extraOperator: { name: "Operador adicional", price: 19.9, ... },
  extraTeam: { name: "Time adicional", price: 29.9, ... },
  emailCredits: { starter: {...}, plus: {...}, pro: {...}, business: {...} },
  emailOverageRatePer100: { starter: 3.5, plus: 3.0, pro: 2.5, business: 2.0 },
} as const;

Mantenha BILLING_PRICES em billingConfig.ts como re-export deprecated do catálogo (compatibilidade).
Substitua TODOS os literais de preço por importes do catálogo nos arquivos:
- app/api/services/AsaasSubscription/AsaasSubscriptionService.ts (59.90/19.90)
- app/api/services/AsaasOperator/AsaasOperatorService.ts (19.90/59.90)
- app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts
- app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts (BASE_VALUE/OPERATOR_VALUE)
- app/api/useCases/managerUser/ManagerUserUseCase.ts
- app/api/useCases/CreateManagerOnboarding.ts
- app/api/v1/payments/create-card/route.ts (PLAN_PRICE)
- app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase.ts
- app/api/useCases/backoffice/BackofficeAllUsersUseCase.ts e BackofficePlatformUsersUseCase.ts (extraia helper único calcMonthlyPrice)
- app/api/useCases/email/EmailCreditUseCase.ts:182 (usar OVERAGE_RATE_PER_HUNDRED de EmailCreditService, que passa a ler do catálogo)
No frontend, remova os fallbacks hardcoded de SubscriptionCard.tsx, SubscriptionBillingBreakdownCard.tsx, ReactivateSubscriptionDialog.tsx e SubscriptionCreditsDialog.tsx: os valores devem vir do billingSummary/API; se a API não retornou, exiba Skeleton — nunca um preço chutado.
Adicione teste que importa PRICING_CATALOG e falha se qualquer arquivo listado voltar a conter os literais 59.9/19.9/29.9 (teste de grep via script ou unit test dos helpers).
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** valores em si (permanecem 59,90/19,90/29,90), schema Prisma, webhook, lógica de negócio dos use cases (somente a origem do número).

**Aceite:** `grep -rn "59\.9\|19\.9\|29\.9" app/` só encontra `pricingCatalog.ts`; UI de assinatura exibe valores vindos da API. **Validação manual:** abrir `/[supabaseId]/subscription` e conferir preços; simular add de operador no sandbox e conferir valor da cobrança = catálogo.

---

### Estágio 2 — Enum `SubscriptionCycle` + tipos fortes em `PendingOperator`

**Prompt (copy-paste):**
```
No lead-flow-app, tipifique o ciclo de assinatura:

1. Em prisma/schema.prisma: crie enum SubscriptionCycle { MONTHLY QUARTERLY SEMIANNUALLY YEARLY } (@@map subscription_cycle) e mude Profile.subscriptionCycle (e o espelho no modelo de subscription snapshot ~linha 2638) de String? para SubscriptionCycle?.
2. Crie também enums PendingPaymentStatus { PENDING CONFIRMED FAILED } e PendingPaymentMethod { PIX CREDIT_CARD } e aplique em PendingOperator.paymentStatus/paymentMethod.
3. Gere a migration com bun run db:migrate:from-prisma -- subscription-cycle-enum (NUNCA manual). A migration deve converter dados existentes: valores não reconhecidos viram MONTHLY (UPDATE ... WHERE antes do cast). Valide replay com bun run db:migrate:reset:local. NÃO aplicar no remoto sem autorização do owner.
4. Crie helper normalizeSubscriptionCycle(value: string | null | undefined): SubscriptionCycle em app/api/shared/billing/ (única tradução Asaas→enum; reutilize a lógica de normalizeAsaasCycle do IncrementalBillingService e delete a duplicata). Use-o no webhook (processAsaasWebhookEvent.ts:303), no AsaasSubscriptionSyncService e em todos os pontos que hoje gravam 'MONTHLY' literal.
5. Testes: normalização de todos os valores do Asaas (WEEKLY/BIWEEKLY/BIMONTHLY → MONTHLY com warn; QUARTERLY/SEMIANNUALLY/YEARLY → si mesmos; typo/null → MONTHLY).
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** valores de preço, fluxo de webhook além da linha de gravação do cycle, rotas.

**Aceite:** typecheck falha se alguém tentar gravar string livre; migration reaplica limpa no reset local; testes de normalização verdes. **Validação manual:** `bun run db:migrate:reset:local` + criar assinatura sandbox e conferir enum gravado.

---

### Estágio 3 — Webhook hardening (transições de estado + eventos negativos)

**Prompt (copy-paste):**
```
No lead-flow-app, endureça o processamento do webhook Asaas (app/api/services/PaymentValidation/PaymentValidationService.ts e app/api/webhooks/asaas/processAsaasWebhookEvent.ts):

1. updateProfileStatus NÃO pode mais sobrescrever subscriptionPlan com 'manager_base' fixo: derive o plano (operatorCount > 0 ? 'with_operators' : 'manager_base') e só grave se o campo atual for null. Idem no handler SUBSCRIPTION_CREATED.
2. Elimine o default 'active' em mappedStatus (linha ~122): se nem o evento nem o payload mapearem para um status conhecido, NÃO altere subscriptionStatus (log warn + return). Nenhum evento pode reativar conta suspensa implicitamente.
3. Implemente handlers para PAYMENT_REFUNDED e PAYMENT_CHARGEBACK_REQUESTED/CHARGEBACK_DISPUTE: localizar profile (subscription → customer), marcar subscriptionStatus 'past_due' (refund/chargeback de mensalidade) e registrar em SubscriptionChangeLog (estágio 5 cria a tabela; até lá, console.error estruturado + Sentry). Nunca silencioso.
4. Ao processar PAYMENT_CONFIRMED/RECEIVED de uma assinatura, atualize subscriptionNextDueDate consultando GET /v3/subscriptions/{id} (reuse AsaasSubscriptionSyncService.syncFromAsaas) — o nextDueDate local não pode depender só de SUBSCRIPTION_UPDATED.
5. Adicione máquina de transição explícita: função pura canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean em app/api/shared/billing/subscriptionStateMachine.ts (trial→active/canceled; active→past_due/suspended/canceled; past_due→active/suspended/canceled; suspended→active/canceled; canceled→active somente via fluxo de reativação explícito). Toda escrita de subscriptionStatus passa por ela; transição inválida = log + skip.
6. Testes obrigatórios (mais críticos da spec): (a) máquina de estados completa, caso a caso; (b) idempotência — processar o mesmo payload 2x não duplica efeitos (mock de prisma/asaasFetch); (c) reentrega após falha parcial não recria operador já criado (PendingOperator.operatorCreated guard); (d) REFUNDED/CHARGEBACK movem status; (e) SUBSCRIPTION_UPDATED com status desconhecido não altera nada.
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** rota HTTP do webhook (claim/ack já corretos), tabela `asaas_webhook_events`, preços, frontend.

**Aceite:** todos os testes acima verdes; nenhum caminho grava `subscriptionStatus`/`subscriptionPlan` fora da máquina de estados. **Validação manual:** sandbox — simular pagamento confirmado, overdue e estorno via painel sandbox e conferir status resultante no banco local.

---

### Estágio 4 — Cancelamento real + downgrade de add-ons

**Prompt (copy-paste):**
```
No lead-flow-app, complete o ciclo de vida de cancelamento (SubscriptionManagementUseCase.cancelSubscription, linha ~623):

1. Antes de marcar canceled localmente, chame DELETE /v3/subscriptions/{asaasSubscriptionId} no Asaas (via asaasFetch). Se o Asaas falhar, NÃO marque canceled local — retorne Output inválido com mensagem clara (fail-closed: nunca deixar estado local cancelado com Asaas cobrando, nem o inverso).
2. Trate assinaturas externas (asaasSubscriptionId null ou prefixo external-adhesion-/adhesion-): cancelamento apenas local, com log.
3. No cancelamento, defina o que acontece com operadores/times ativos: manter acesso até subscriptionEndDate (fim do período já pago) e, após, o gate central (FeatureAccessService) já bloqueia por status canceled. Documente no código.
4. Downgrade de operador (removeOperatorAndUpdateSubscription/ManagerUserUseCase): unifique as duas implementações numa única no IncrementalBillingService, usando PRICING_CATALOG; o decremento usa floor no preço base e registra a mudança (SubscriptionChangeLog quando existir).
5. Testes: cancelamento com Asaas ok, com Asaas falhando (estado local intacto), assinatura externa, remoção de operador recalculando valor.
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** webhook, enum, catálogo (só consumir), UI (estágio 7 cobre telas).

**Aceite:** cancelar no app cancela no sandbox Asaas (verificável via `GET /v3/subscriptions/{id}` → `deleted/INACTIVE`); falha do Asaas não deixa estado inconsistente. **Validação manual:** fluxo completo no sandbox.

---

### Estágio 5 — `SubscriptionChangeLog` + upgrade/downgrade/mudança de ciclo (master only)

**Prompt (copy-paste):**
```
No lead-flow-app, implemente mudança de plano/ciclo auditável:

1. Schema: model SubscriptionChangeLog { id, profileId, changedByProfileId, changeType (enum: plan_upgrade, plan_downgrade, cycle_change, cancel, reactivate, permanent_flag, addon_added, addon_removed, overage_charge), fromValue Json, toValue Json, source (enum: product, backoffice, webhook, system), createdAt } — migration via bun run db:migrate:from-prisma -- subscription-change-log.
2. Novo UseCase ChangeSubscriptionCycleUseCase (app/api/useCases/subscriptions/): valida isMaster explicitamente (TeamContext de getTeamAccess), chama PUT /v3/subscriptions/{id} com { cycle, updatePendingPayments: true } (D9: atualização in-place, confirmado na API Asaas), atualiza Profile.subscriptionCycle via enum, registra no ChangeLog. Regra: mudança de ciclo entra em vigor no próximo vencimento; nenhuma proração.
3. Upgrade manager_base → with_operators já acontece implicitamente ao adicionar operador — passe a registrar addon_added/addon_removed no ChangeLog em todos os fluxos (IncrementalBillingService, SubscriptionUpgradeUseCase, ManagerUserUseCase).
4. Nova rota POST /api/v1/subscriptions/cycle (Route → UseCase → Service → Prisma; Output; TeamContext passado adiante; 403 para não-master). Atualize postman/Lead-Flow-API-Collection.json.
5. Instrumente as escritas de hasPermanentSubscription (rota backoffice) e cancelSubscription para registrar no ChangeLog (fecha pendência do estágio 3/4).
6. Testes: permissão (master ok, manager delegado 403, operator 403), transição de ciclo válida/inválida, registro no ChangeLog em cada fluxo, idempotência (repetir a mesma mudança não duplica log de efeito).
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** preços, webhook (além do registro no ChangeLog), telas (mockup no estágio 7).

**Aceite:** toda mudança de plano/ciclo/flag gera exatamente 1 registro com quem/de-para/quando; só master muda ciclo. **Validação manual:** mudar ciclo no sandbox e conferir `GET /v3/subscriptions/{id}` refletindo `QUARTERLY` + registro no banco.

> ⚠️ Só habilitar ciclos não-mensais comercialmente após confirmação de negócio — o mecanismo fica pronto, a exposição na UI é decisão à parte.

---

### Estágio 6 — Overage de e-mail: opt-in + cartão obrigatório + `PendingOverageCharge`

**Prompt (copy-paste):**
```
No lead-flow-app, implemente cobrança automática de excedente de e-mail (opt-in por Time):

1. Schema: EmailCreditSubscription.autoChargeOverage Boolean @default(false); novo model PendingOverageCharge { id, teamId, subscriptionId (FK EmailCreditSubscription), periodStart, overageCount Int, amount Decimal(12,2), asaasPaymentId String? @unique, status PendingPaymentStatus, createdAt, updatedAt } — migration via bun run db:migrate:from-prisma -- email-overage-charge.
2. Rota PATCH /api/v1/email/credits/auto-charge (Route → UseCase → Service): só master/manager do Time. Ao ATIVAR: validar no Asaas, no momento da ativação, que o customer do master possui cartão de crédito tokenizado ativo (não confiar em cadastro antigo); sem cartão → Output inválido com instrução de cadastrar cartão primeiro.
3. No cron reset-credits (app/api/v1/email/cron/reset-credits/route.ts), substitua o log "cobrança avulsa pendente de implementação": se autoChargeOverage=true e overageCharged>0, crie PendingOverageCharge e dispare cobrança avulsa CREDIT_CARD no Asaas (valor = overage do catálogo × excedente; externalReference = pending-overage-{id}). Webhook confirma → status CONFIRMED + SubscriptionChangeLog(overage_charge). Recusa/falha → status FAILED + autoChargeOverage=false + notificação (sonner via notificação in-app + e-mail ao master). Nunca silencioso.
4. Comportamento com autoChargeOverage=false ao estourar crédito: [PENDENTE PERGUNTA (d) — implementar provisoriamente BLOQUEIO de novos disparos até reset mensal, com aviso claro na UI de campanhas; deixar a regra isolada numa função única para troca fácil].
5. Testes: ativação sem cartão bloqueada; cobrança criada com valores corretos do catálogo; webhook confirmando/recusando; recusa desativa flag e notifica; idempotência do webhook de overage; bloqueio de disparo quando estourado e flag off.
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** assinatura principal do Profile, planos de crédito em si, motor de disparo de campanhas (além do ponto único de bloqueio).

**Aceite:** ciclo completo no sandbox (estourar crédito simulado → cobrança criada → confirmada via webhook → registro rastreável). **Validação manual:** painel sandbox mostra a cobrança avulsa com descrição e valor corretos.

---

### Estágio 7 — Consolidação do feature gating + UI

**Prompt (copy-paste):**
```
No lead-flow-app:

1. Exporte ACTIVE_SUBSCRIPTION_STATUSES de um único módulo (app/api/shared/billing/) e substitua toda checagem manual de subscriptionStatus em rotas (ex: app/api/v1/teams/payments/create/route.ts:162, teams/route.ts, SubscriptionCheckService) por essa constante ou pelo FeatureAccessService.
2. Registre como features ADDON em backoffice_features (migration de dados via bun run db:migrate:new seed-billing-addons + prisma/seed-backoffice-products.ts, seguindo o Feature Registration Policy do agents.md): time adicional e cobrança de overage de e-mail, para que a UI possa exibir/ocultar por gate central.
3. UI (usar skill design-system-guard + shadcn MCP; tokens semânticos, sem hex): 
   a. Em /[supabaseId]/subscription: seção "Add-ons" com toggle de cobrança automática de excedente (Switch shadcn) — estado, cartão exigido, último período cobrado; dialog de confirmação (AlertDialog) ao ativar/desativar; botão com lock de requisição.
   b. Tela/aba "Histórico de alterações" listando SubscriptionChangeLog do master (tabela shadcn, Badge para changeType).
   c. Indicador de feature bloqueada por plano: componente único FeatureLockedBadge reutilizável.
4. Atualize postman/Lead-Flow-API-Collection.json para as rotas novas.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** lógica de cobrança dos estágios anteriores; landing page.

**Aceite:** nenhum check manual de status fora do módulo compartilhado (verificável por grep); `design:check` verde; toggles com request lock. **Validação manual:** ligar/desligar overage num Time de teste; conferir histórico de mudanças renderizando.

---

## Mockups (antes/depois)

### Tela: Assinatura — seção Add-ons (nova)

```
ANTES (hoje): não existe — overage invisível, add-ons espalhados em dialogs.

DEPOIS:
┌─ Assinatura ─────────────────────────────────────────────────────┐
│ Plano Professional            R$ 59,90/mês       [Badge: Ativa]  │
│ Próx. cobrança: 15/08/2026 · Ciclo: Mensal                       │
│──────────────────────────────────────────────────────────────────│
│ Add-ons                                                          │
│  • Operadores (3 × R$ 19,90)              R$ 59,70   [Gerenciar] │
│  • Times adicionais (1 × R$ 29,90)        R$ 29,90   [Gerenciar] │
│──────────────────────────────────────────────────────────────────│
│ Cobrança automática de excedente de e-mail          [Switch ◯—]  │
│   Cartão obrigatório · Time: Vendas SP                           │
│   Último excedente cobrado: R$ 7,00 (200 e-mails) em 01/07       │
│   ⚠ Sem cartão cadastrado → [Cadastrar cartão]                   │
└──────────────────────────────────────────────────────────────────┘
Total mensal: R$ 149,50
```

### Dialog: ativar cobrança automática de excedente (novo)

```
┌─ Ativar cobrança automática de excedente? ───────────────┐
│ Quando o Time ultrapassar os créditos do plano, o        │
│ excedente será cobrado automaticamente no cartão         │
│ final •••• 4242, à taxa do seu plano (R$ 3,00/100).      │
│                                                          │
│ Se a cobrança for recusada, a função será desativada     │
│ e você será notificado.                                  │
│                              [Cancelar]  [Ativar (lock)] │
└──────────────────────────────────────────────────────────┘
Estado sem cartão: botão "Ativar" desabilitado + link "Cadastrar cartão primeiro".
```

### Tela: mudança de ciclo (nova — habilitar só após decisão comercial)

```
┌─ Alterar período de cobrança ────────────────────────────┐
│ ( • ) Mensal      R$ 59,90/mês                           │
│ (   ) Trimestral  R$ xxx/trimestre   [pendente negócio]  │
│ (   ) Semestral   R$ xxx/semestre    [pendente negócio]  │
│                                                          │
│ A mudança vale a partir do próximo vencimento            │
│ (15/08/2026). Sem cobrança extra agora.                  │
│ Somente o titular (master) pode alterar.                 │
│                            [Cancelar]  [Confirmar (lock)]│
└──────────────────────────────────────────────────────────┘
```

### Tela: Histórico de alterações (nova)

```
┌─ Histórico da assinatura ────────────────────────────────────────┐
│ 09/07/2026  [addon_added]    Operador +1 (R$19,90)  por Matheus  │
│ 01/07/2026  [overage_charge] Excedente e-mail R$7,00   sistema   │
│ 15/06/2026  [cycle_change]   MONTHLY → MONTHLY         Matheus   │
└──────────────────────────────────────────────────────────────────┘
```

### Estados de bloqueio por plano (componente novo `FeatureLockedBadge`)

```
Sidebar / cards de feature sem acesso:
  [🔒 Requer add-on]  → tooltip: "Disponível no plano com Email Campaigns.
                         Fale com o titular da conta." → CTA p/ master: [Contratar]
```

---

## Critérios de aceite globais

1. `grep` de literais de preço fora do catálogo retorna vazio.
2. Nenhuma escrita de `subscriptionStatus` fora da máquina de estados; nenhuma escrita de `subscriptionPlan` regressiva.
3. Webhook: reentrega de qualquer evento processado é no-op comprovado por teste.
4. Cancelar no app = cancelar no Asaas (ou falha explícita, nunca divergência silenciosa).
5. `hasPermanentSubscription` só muda via Backoffice, com auditoria.
6. Toda mudança de plano/ciclo/add-on/overage tem 1 linha em `SubscriptionChangeLog`.
7. Overage só cobra com opt-in + cartão validado no ato; recusa desativa e notifica.
8. Suítes de teste dos estágios 0, 3, 5 e 6 são gate de CI (mesmo padrão `test:proxy`).

## Riscos e mitigação de rollout

- **Migração do enum de ciclo em produção:** rodar `db:migrate:push:dry-run` + conferir distribuição real de `subscriptionCycle` em produção antes (pendência (a) da auditoria).
- **Valores anômalos (`5990`) no Asaas:** investigar e corrigir as assinaturas afetadas ANTES do Estágio 1, para o catálogo não "oficializar" a comparação contra dados sujos.
- **Estágio 0 é independente e urgente** — pode (deve) ser cherry-pickado à frente de tudo.
