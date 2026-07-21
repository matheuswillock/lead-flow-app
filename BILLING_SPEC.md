# BILLING_SPEC.md — Spec de correção do billing completo (motor, precificação, UI, e-mails, tipos de usuário)

**Versão:** 1.0
**Base:** `BILLING_AUDIT.md` (20/07/2026). Substitui e amplia o escopo de `BILLING_ENGINE_SPEC.md` (spec anterior, baseada em `BILLING_ENGINE_AUDIT.md` de 09/07/2026) — as decisões D1-D9 daquele documento são revisadas explicitamente abaixo; onde não há menção, a decisão antiga permanece válida.

---

## Goal

Motor de cobrança correto, seguro na borda do banco, com uma única fonte de preço (banco de dados), webhook que reconhece de fato o vocabulário de eventos/status do Asaas, ciclo de vida completo da assinatura (adesão → upgrade/downgrade → cancelamento real no Asaas → transição pós-Member PRO), UI de Backoffice sem bypass de autorização nem controles decorativos, alertas de cobrança automáticos (não só manuais), e um motor de vendas que permite preço negociado por adesão sem tocar na tabela de preços central — tudo com cobertura de teste obrigatória nas transições de estado mais arriscadas.

## Non-goals

- Migrar de Asaas para outro PSP.
- Resolver todas as 10 inconsistências de `PRICING_MODEL.md`/`PRICING_TABLE.md` que são decisões comerciais puras (ex.: valores do Radar, canibalização do add-on `email`) — ficam registradas como perguntas de negócio, não como estágio de código.
- Unificar `EmailCreditSubscription` e Dialer dentro da assinatura única do `Profile` (mantido como decisão D4 do spec antigo).
- Migrar automaticamente os clientes legados (System A, R$59,90) para o catálogo novo (System B) — decisão de negócio em aberto (ver `BILLING_AUDIT.md` §10, pergunta 2); o Estágio 2 desta spec só prepara o código para que a migração, quando decidida, seja uma operação de dados e não uma reescrita.
- Reescrever o Radar/e-mail em massa (`radar-*`, `email-dispatch-*`) — fora de escopo, é catálogo ainda não implementado.

---

## Decisões arquiteturais

### D0 (novo, P0). RLS nas tabelas de billing/tipo de usuário é pré-requisito de tudo
`asaas_webhook_events`, `profile_user_types` e `profile_user_type_assignments` estão sem Row Level Security em produção (achado C-1). Nenhuma outra correção desta spec é confiável enquanto isso não for investigado e corrigido, porque qualquer coisa consertada nas camadas de aplicação pode ser contornada diretamente na API REST do Supabase. Vira o Estágio -1, antes de qualquer outro.

### D1 (revisado — supersede a Decisão D1 de `BILLING_ENGINE_SPEC.md`). Fonte única de preço: banco de dados, não código
A spec anterior propunha um catálogo versionado em código (`pricingCatalog.ts`). **O owner decidiu, durante a auditoria de 20/07/2026, que o banco de dados é a única fonte de verdade para precificação.** Justificativa do owner: preço é dado comercial, não configuração de deploy — deve poder mudar sem um deploy de código, e deve ser auditável/editável via Backoffice. O alvo é generalizar o padrão já usado por `lib/backoffice-adhesions/adhesion-pricing.ts` (`resolveProductPriceForCycle`, `resolvePaymentRule`), que já resolve preço via `BackofficeProduct`/`BackofficeProductPaymentRule`, para todo o motor de cobrança — eliminando os ~15 arquivos com literais hardcoded (System A) sem introduzir um catálogo paralelo em código.

### D2. `SubscriptionCycle` vira enum tipado (mantido de `BILLING_ENGINE_SPEC.md`)
Igual à spec anterior: `enum SubscriptionCycle { MONTHLY QUARTERLY SEMIANNUALLY YEARLY }`, substitui a `String` livre. Reforçado pelo achado de produção desta rodada (`"quarterly"` vs `"MONTHLY"` coexistindo com case diferente na mesma coluna) — a migration de normalização precisa tratar variação de case, não só valores desconhecidos.

### D3. `SubscriptionPlan` reflete a realidade — sem inventar planos (mantido)
Igual à spec anterior — `updateProfileStatus` deixa de sobrescrever o plano incondicionalmente.

### D4. Billing por módulo — decisão formalizada (mantido)
Igual à spec anterior — assinatura principal (Asaas), Email Campaigns (`EmailCreditSubscription`, por Time) e Dialer seguem como modelos separados, todos conectados ao mesmo feature gating central (D8 abaixo).

### D5 (revisado). Vocabulário de eventos/status do webhook precisa refletir o Asaas real, não um vocabulário inventado
Revisão do que a spec anterior chamava de "webhook hardening": não basta adicionar handlers para eventos que faltam — é preciso **remover/corrigir os que tratam eventos e valores de status que o Asaas nunca envia** (`SUBSCRIPTION_ACTIVATED`/`SUBSCRIPTION_SUSPENDED`/`SUBSCRIPTION_CANCELED` como eventos; `'SUSPENDED'`/`'INACTIVATED'`/`'CANCELLED'` como valores de `status`). O vocabulário correto, confirmado contra a documentação oficial do Asaas: eventos `SUBSCRIPTION_CREATED|UPDATED|INACTIVATED|DELETED`; status `ACTIVE|EXPIRED|INACTIVE`. Vira o Estágio 1 (C0), antes de qualquer outro estágio de webhook.

### D6. `hasPermanentSubscription` é exclusivo do Backoffice (mantido)
Igual à spec anterior (Estágio 0 abaixo, inalterado).

### D7. Trilha de auditoria: `SubscriptionChangeLog` (mantido, ver Estágio correspondente)

### D8. Feature gating: `FeatureAccessService` é a única resposta para "tem acesso?" (revisado)
Reforçado pelo achado novo desta rodada: `ACTIVE_SUBSCRIPTION_STATUSES` (`FeatureAccessService`) e a checagem `isActive = status === 'active'` (`SubscriptionCheckService`) são **duas definições divergentes** hoje, causando o bug de sidebar liberada + página bloqueada para `trial`/`past_due`. A unificação vira explícita e obrigatória no Estágio "Feature gating + UI" (não apenas recomendada como na spec antiga).

### D9. Mudança de ciclo = `PUT` na assinatura existente (mantido)

### D10 (novo). Motor de vendas: desconto percentual por adesão, nunca escrito na tabela de preços
Decisões do owner (20/07/2026): (a) qualquer usuário do Backoffice pode aplicar desconto até um teto percentual configurável em banco; acima do teto, exige aprovação de MANAGER/MASTER; (b) o desconto se aplica ao valor total calculado da adesão (plano + add-ons), não item a item; (c) formato percentual sobre o preço de tabela vigente — recalculado a partir do catálogo no fechamento, nunca um valor nominal congelado. `BackofficeProduct`/`BackofficeProductPaymentRule` nunca são escritos pelo motor de desconto — o override vive exclusivamente em `BackofficeAdhesion`.

### D11 (novo). Início de cobrança pós-benefício temporário (Member PRO) precisa de gatilho orientado a evento, não só cron
O cron diário `member-pro-expiration` continua existindo como rede de segurança, mas deixa de ser o único disparo — a spec adiciona uma checagem leve na primeira requisição autenticada após `accessExpiresAt`, para eliminar a janela de até 24h entre o benefício acabar e a cobrança real começar.

---

## Estágios de implementação

> Ordem obrigatória. Cada estágio termina com `bun run typecheck`, `bun run lint`, `bun run governance:check` (e `bun run design:check` quando houver UI) verdes, e os testes do estágio passando. Nenhum estágio aplica migration remota nem altera o Supabase de produção sem autorização explícita do owner — inclusive para o Estágio -1 (RLS), que mexe na borda de segurança do banco.

---

### Estágio -1 — RLS em tabelas de billing/tipo de usuário (C-1, D0)

**Prompt (copy-paste):**
```
No lead-flow-app, investigue e proponha a correção de RLS desabilitado em asaas_webhook_events, profile_user_types e profile_user_type_assignments (achado C-1 de BILLING_AUDIT.md):

1. Use o MCP do Supabase (projeto de produção, já autorizado) para listar os grants efetivos de INSERT/UPDATE/DELETE/SELECT das roles anon e authenticated nessas 3 tabelas (consulta a information_schema.role_table_grants ou equivalente, SOMENTE LEITURA).
2. Para cada tabela, desenhe as policies mínimas necessárias:
   - asaas_webhook_events: não deve ser acessível por anon nem authenticated em nenhuma operação — só o service role (usado pelo backend) precisa ler/escrever. Policy: negar tudo para anon/authenticated (RLS habilitado sem nenhuma policy permissiva já resolve isso, já que o service role ignora RLS por padrão no Supabase).
   - profile_user_types: leitura pública de catálogo (é só uma lista de tipos, não dado sensível) pode ser liberada para authenticated; escrita nunca para client-side.
   - profile_user_type_assignments: leitura restrita ao próprio profileId (auth.uid() relacionado via Profile) e a usuários do Backoffice; escrita nunca para client-side (só o backend, via service role, grava).
3. Escreva a migration via bun run db:migrate:new fix-billing-tables-rls contendo ENABLE ROW LEVEL SECURITY + as policies do item 2, idempotente (usar DROP POLICY IF EXISTS antes de CREATE POLICY).
4. NÃO aplique a migration no remoto (bun run db:migrate:push) sem autorização explícita do owner — isso inclui não rodar nenhum ALTER TABLE diretamente via MCP do Supabase.
5. Valide localmente: bun run db:migrate:reset:local, depois confirme que as rotas que hoje leem/escrevem essas tabelas via Prisma (que usa a connection string de superusuário/service role local, não anon/authenticated) continuam funcionando normalmente.
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** lógica de negócio do webhook, feature gating, nada além de RLS/policies dessas 3 tabelas.

**Aceite:** migration proposta e revisada, grants efetivos documentados no PR, nenhuma aplicação em remoto sem autorização explícita. **Validação manual:** owner revisa os grants levantados e decide se autoriza aplicar em produção — decisão de negócio/segurança, não automática.

---

### Estágio 0 — Hotfix de segurança: `hasPermanentSubscription` (P0, igual à spec anterior)

Reaproveita integralmente o Estágio 0 de `BILLING_ENGINE_SPEC.md` — prompt, aceite e validação manual inalterados: remover a rota pública `app/api/v1/profiles/permanent-subscription/route.ts`, trocar a autorização da rota autenticada de `isMaster` para `getBackofficeAccess()`, registrar log de quem alterou a flag, atualizar Postman e docs, escrever testes de autorização.

---

### Estágio 1 — Corrigir o vocabulário de eventos/status do webhook para o Asaas real (C0, D5)

**Prompt (copy-paste):**
```
No lead-flow-app, corrija o mapeamento de status/eventos do webhook Asaas para os valores REAIS da API (confirmados contra docs.asaas.com/docs/subscription-events e o schema oficial de GET /v3/subscriptions/{id} — não confiar em nenhuma lista anterior no código):

1. Em app/api/services/PaymentValidation/PaymentValidationService.ts:
   - subscriptionEvents (linha ~71) e mapStatusFromEvent (linhas ~95-109): os únicos eventos de assinatura reais são SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_INACTIVATED, SUBSCRIPTION_DELETED. Remova os cases para SUBSCRIPTION_ACTIVATED, SUBSCRIPTION_SUSPENDED, SUBSCRIPTION_CANCELED (nunca são emitidos pelo Asaas) e ajuste subscriptionEvents para a lista real.
   - mapStatusFromPayload (linhas ~111-117): o enum real de subscription.status é ACTIVE | EXPIRED | INACTIVE. Troque os checks de 'SUSPENDED'/'INACTIVATED'/'CANCELLED'/'CANCELED' para reconhecer 'INACTIVE' -> suspended (mapeamento de negócio: assinatura INACTIVE no Asaas = suspensa localmente) e 'EXPIRED' -> canceled (assinatura chegou ao fim do maxPayments ou período).
   - Linha ~122 (mappedStatus = mappedFromEvent ?? mappedFromPayload ?? 'active'): REMOVA o fallback para 'active'. Se nem o evento nem o status do payload mapearem para um valor conhecido, NÃO altere subscriptionStatus — log de warning estruturado + retorno sem update. Nenhum evento desconhecido pode reativar implicitamente uma conta.
2. Em app/api/webhooks/asaas/processAsaasWebhookEvent.ts (linhas ~330-333 e handlers correspondentes): mesma correção — remova os branches para SUBSCRIPTION_ACTIVATED/SUSPENDED/CANCELED, mantenha só CREATED/UPDATED/INACTIVATED/DELETED.
3. Implemente handlers para PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL (todos confirmados como eventos reais na documentação oficial). NÃO trate os dois primeiros do mesmo jeito: PAYMENT_REFUNDED (estorno total) marca subscriptionStatus 'past_due', mas PAYMENT_PARTIALLY_REFUNDED pode ser um estorno parcial/cortesia com o restante da cobrança ainda válido — NÃO marque a conta inteira como past_due automaticamente; registre o evento com log estruturado + Sentry para revisão manual (via a tela de webhooks falhos/alertas do Estágio 9) e só altere o status se o valor restante pago não cobrir mais o custo do ciclo (checar payment.value vs. originalValue/valor da assinatura). PAYMENT_CHARGEBACK_REQUESTED e PAYMENT_CHARGEBACK_DISPUTE marcam 'past_due' (aqui sim, é a cobrança inteira contestada). PAYMENT_AWAITING_CHARGEBACK_REVERSAL e o retorno a CONFIRMED/RECEIVED restauram o status anterior. Registrar em log estruturado + Sentry (SubscriptionChangeLog fica para o estágio correspondente).
4. Ao processar inadimplência prolongada (defina prolongada = X dias em past_due, configurável, sugestão inicial 15 dias), chame PUT /v3/subscriptions/{id} com { status: "INACTIVE" } via asaasFetch — o Asaas não inativa sozinho uma assinatura em atraso (confirmado na documentação oficial), então sem essa chamada o past_due local nunca se reflete de volta e a assinatura continua sendo cobrada no Asaas indefinidamente.
5. Testes obrigatórios: (a) todos os valores reais de status/evento mapeiam corretamente; (b) SUBSCRIPTION_ACTIVATED/SUSPENDED/CANCELED como evento não fazem nada (não existem mais no código, então isso vira teste de regressão do parser de evento, não de comportamento); (c) status desconhecido não altera subscriptionStatus; (d) PAYMENT_REFUNDED/CHARGEBACK_* movem o status corretamente; (e) inadimplência prolongada dispara o PUT de inativação no Asaas (mock de asaasFetch).
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** preços, rota HTTP do webhook (claim/ack já corretos), tabela `asaas_webhook_events`, frontend.

**Aceite:** nenhum caminho do código reconhece mais `SUBSCRIPTION_ACTIVATED`/`SUBSCRIPTION_SUSPENDED`/`SUBSCRIPTION_CANCELED` como evento real; `mapStatusFromPayload` reconhece `ACTIVE|EXPIRED|INACTIVE`; refund/chargeback têm handler; inadimplência prolongada chama o Asaas. **Validação manual:** sandbox — simular `SUBSCRIPTION_UPDATED` com `status: "INACTIVE"` e confirmar que o perfil vira `suspended` (não `active`); simular um estorno e confirmar `past_due`.

---

### Estágio 2 — Fonte única de precificação em banco (substitui o Estágio 1 do spec antigo)

**Prompt (copy-paste):**
```
No lead-flow-app, migre a precificação hardcoded (System A) para ler de BackofficeProduct/BackofficeProductPaymentRule (System B), generalizando o padrão de lib/backoffice-adhesions/adhesion-pricing.ts:

1. Crie um helper único (ex.: app/api/shared/billing/resolvePrice.ts) que recebe (featureSlug, cycle, paymentMethod) e retorna o preço resolvido do banco, usando a mesma ordem de resolução já documentada em PRICING_MODEL.md §1 (payment rule > preço base do produto > lifetime). Reaproveite resolveProductPriceForCycle/resolvePaymentRule de adhesion-pricing.ts em vez de duplicar a lógica. IMPORTANTE: resolver por featureSlug: "crm" sozinho retorna a variante isDefault do catálogo novo (R$89,90) — isso NÃO pode ser usado para os clientes do System A (assinatura legada a R$59,90), ou a troca de literais por esse helper aumentaria a cobrança deles na próxima renovação, violando o Non-goal desta spec. Antes de substituir qualquer literal de System A, crie um segundo BackofficeProduct (ex.: featureSlug: "crm-legacy", isDefault: false, isActive: true) com os valores 59,90/19,90/29,90 via migration de dados (bun run db:migrate:new seed-crm-legacy-product), e faça o helper aceitar um discriminador explícito (ex.: um parâmetro catalogVariant ou a leitura de qual featureSlug o Profile legado já usa) para resolver "crm-legacy" para contas System A e "crm" só para contas System B. Só depois disso os literais do item 2 podem ser substituídos com segurança.
2. Substitua os literais hardcoded (59.90/19.90/29.90 e variantes) nos arquivos listados em BILLING_ENGINE_AUDIT.md item 1 e BILLING_AUDIT.md §2.3 por chamadas ao helper do item 1, usando o discriminador "crm-legacy"/"extra-team-legacy"/"extra-user-legacy" (ou equivalente) para contas System A e o featureSlug normal (crm, extra-team, extra-user) só para contas já no catálogo novo. Para os clientes do System A, o valor resolvido deve continuar sendo 59,90/19,90/29,90 — a mudança aqui é SÓ na origem do número, não no valor cobrado de quem já está na assinatura legada.
3. No frontend, remova os fallbacks hardcoded (SubscriptionCard.tsx, SubscriptionBillingBreakdownCard.tsx, ReactivateSubscriptionDialog.tsx, SubscriptionCreditsDialog.tsx): valores vêm sempre da API (billingSummary); se a API não retornou, exiba Skeleton, nunca um preço chutado.
4. Corrija a divergência de produção encontrada nesta auditoria: BackofficeProduct tem 2 variantes de CRM (R$150,00 fixo; R$120/89,90/79,90/100) cadastradas só no banco, fora de prisma/seed-backoffice-products.ts. bun run db:migrate:reset:local roda supabase db reset --local --no-seed (package.json:67) — o Prisma seed NUNCA é executado por esse comando, então só adicionar ao arquivo de seed NÃO garante que o reset local reproduza essas variantes. Cadastre-as via migration de dados SQL (bun run db:migrate:new seed-crm-variants, idempotente com ON CONFLICT DO NOTHING), que É replayada pelo reset; opcionalmente também atualize prisma/seed-backoffice-products.ts para manter os dois caminhos consistentes, mas a migration é o que garante reprodutibilidade real. Ou confirme com o owner se as variantes são obsoletas e marque isActive:false pela mesma via.
5. Investigue se app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts (createSubscriptionCheckout, linha ~207, hardcoda value: 59.90) ainda é chamado por alguma rota ativa (grep não encontrou chamador nesta auditoria). Se estiver morto, remova. Se estiver ativo, ajuste para resolver o preço do mesmo jeito (item 1) e alinhe com a decisão de negócio sobre clientes novos vs. legados.
6. Teste que falha se qualquer um dos arquivos da lista voltar a conter os literais 59.9/19.9/29.9 fora do próprio helper de resolução.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** valor cobrado de clientes já na assinatura legada (System A) — só a origem do número muda, e o novo produto/discriminador "crm-legacy" garante isso; webhook (Estágio 1 já resolvido); schema além das migrations de dados deste estágio.

**Aceite:** `grep -rn "59\.9\|19\.9\|29\.9" app/` só encontra o helper de resolução e a migration de seed do produto legado; UI de assinatura exibe valores vindos da API; uma conta System A resolvida pelo helper continua retornando 59,90/19,90/29,90; `db:migrate:reset:local` reproduz as variantes de CRM porque vieram por migration, não só pelo arquivo de seed. **Validação manual:** abrir `/[supabaseId]/subscription` com uma conta legada e conferir que o preço exibido continua 59,90; rodar `db:migrate:reset:local` (sem seed) e conferir que as variantes de CRM já aparecem no Backoffice mesmo assim.

---

### Estágio 3 — Enum `SubscriptionCycle` + tipos fortes em `PendingOperator` (igual ao Estágio 2 do spec antigo, com ajuste)

Reaproveita o prompt de `BILLING_ENGINE_SPEC.md` Estágio 2, com um ajuste: a migration de normalização de dados existentes precisa tratar variação de **case** além de valores desconhecidos, porque a produção já tem `"quarterly"` (minúsculo) e `"MONTHLY"` (maiúsculo) coexistindo para o mesmo conceito (confirmado nesta auditoria) — normalizar para maiúsculo antes de mapear para o enum, não só tratar valores fora do vocabulário esperado.

---

### Estágio 4 — Cancelamento real + downgrade de add-ons (igual ao Estágio 4 do spec antigo)

Reaproveita integralmente: chamar `DELETE /v3/subscriptions/{id}` antes de marcar `canceled` local, fail-closed se o Asaas falhar, tratar assinaturas externas, unificar downgrade de operador. Corrige de quebra os dois outros `TODO`s do mesmo arquivo encontrados nesta auditoria: `updatePaymentMethod()` (linhas 722-733) e `retryPayment()` (linhas 781-789) — ambos hoje retornam `success:true` sem chamar o Asaas de verdade; implemente a chamada real ou, se não for prioridade imediata, faça-os retornar `Output(false, ...)` explicitamente em vez de mentir sucesso ao usuário. Adicione também a rota `POST /api/v1/subscription-management/invoices/retry` que o frontend já chama (`SubscriptionService.ts:139-144`) mas que não existe hoje.

---

### Estágio 5 — `SubscriptionChangeLog` + upgrade/downgrade/mudança de ciclo (igual ao Estágio 5 do spec antigo)

Reaproveita integralmente o prompt, schema e critérios de aceite de `BILLING_ENGINE_SPEC.md` Estágio 5.

---

### Estágio 6 — Overage de e-mail: opt-in + cartão obrigatório (igual ao Estágio 6 do spec antigo)

Reaproveita integralmente o prompt, schema e critérios de aceite de `BILLING_ENGINE_SPEC.md` Estágio 6.

---

### Estágio 7 (novo) — Motor de vendas: preço negociado por adesão (D10)

**Prompt (copy-paste):**
```
No lead-flow-app, implemente preço negociado por adesão no Backoffice:

1. Schema: adicione a BackofficeAdhesion os campos discountPercent Decimal(5,2)?, discountReason String?, discountAppliedByProfileId String? @db.Uuid, discountApprovedByProfileId String? @db.Uuid (nulo quando dentro do teto, preenchido só quando exigiu aprovação). Crie também uma configuração de teto percentual em banco (verifique primeiro se já existe algum singleton de configuração global do Backoffice reaproveitável antes de criar tabela nova; se não existir, crie BackofficeBillingSettings com maxDiscountPercentWithoutApproval Decimal(5,2), editável só por MASTER). Migration via bun run db:migrate:from-prisma -- adhesion-discount.
2. Em lib/backoffice-adhesions/adhesion-pricing.ts, adicione um parâmetro opcional discountPercent a calculateBackofficeAdhesionPricing: aplicado sobre monthlyTotalAmount/totalAmount (e os equivalentes de PIX/cartão) JÁ calculados a partir do catálogo — nunca escreva de volta em BackofficeProduct/BackofficeProductPaymentRule. O resultado retorna também o valor de tabela original (sem desconto) para a UI exibir os dois lado a lado.
3. Modele a aprovação como uma AÇÃO separada, nunca como um campo que o operador preenche livremente na mesma requisição que cria/edita a adesão — caso contrário, um operador pode simplesmente informar o UUID de um MANAGER/MASTER conhecido em discountApprovedByProfileId sem que essa pessoa tenha aprovado nada. Fluxo correto: (a) se discountPercent > maxDiscountPercentWithoutApproval, a criação/edição da adesão com esse desconto fica em status "pending_approval" (não aplica o desconto ainda); (b) uma rota dedicada POST /api/v1/backoffice/adhesions/[id]/approve-discount, autenticada, extrai o profileId de quem está chamando a partir da sessão (getBackofficeAccess), NUNCA do corpo da requisição, verifica que esse profile autenticado tem papel MANAGER/MASTER, e só então grava discountApprovedByProfileId = <profileId da sessão> e libera o desconto. Um operador não pode chamar essa rota fazendo-se passar por outro usuário porque a autorização vem da sessão, não de um campo do payload.
4. UI (usar shadcn MCP; tokens semânticos, sem hex): campo de desconto percentual na tela de criação/edição de adesão, mostrando sempre "preço de tabela" (riscado) ao lado do "preço negociado", e quem aplicou/aprovou visível na tela.
5. Testes: cálculo correto do desconto sobre o total; bloqueio de desconto acima do teto sem aprovação; aprovação por MANAGER/MASTER libera; BackofficeProduct/BackofficeProductPaymentRule nunca são escritos por este fluxo.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** `BackofficeProduct`/`BackofficeProductPaymentRule` (só leitura), motor de cobrança do Asaas em si (o desconto afeta o valor cobrado, não o mecanismo de cobrança).

**Aceite:** desconto aplicado ao total, nunca item a item; teto configurável em banco, não hardcoded; acima do teto a adesão fica `pending_approval` até uma chamada autenticada e autorizada à rota de aprovação (nunca um `discountApprovedByProfileId` aceito direto no payload de criação/edição); tabela de preços central nunca é alterada por este fluxo. **Validação manual:** criar uma adesão de teste com 5% de desconto (abaixo do teto, sem aprovação) e outra com 30% (acima do teto); confirmar que a segunda só libera o desconto depois de chamar a rota de aprovação autenticada como MANAGER/MASTER, e que tentar informar `discountApprovedByProfileId` manualmente no payload de criação não tem efeito algum.

---

### Estágio 8 (novo) — Backoffice UI: autorização e controles decorativos

**Prompt (copy-paste):**
```
No lead-flow-app, corrija os achados de UI/autorização do Backoffice de billing:

1. app/api/v1/backoffice/payments/route.ts (POST): adicione requireManagerAccess(result.access) logo após getBackofficeAccess(), no mesmo padrão de app/api/v1/backoffice/pricing/route.ts:30. Hoje qualquer operador pode criar cobranças reais via chamada direta à rota.
2. BackofficeClientInvoiceDetailsContainer.tsx: os itens "Compartilhar fatura", "Confirmar recebimento em dinheiro" e "Remover cobrança" chamam handleNoopAction ou têm onSelect vazio. Para cada um: implemente a ação real SE fizer parte deste estágio, ou remova o item do menu (não deixe um controle destrutivo/financeiro visível sem função). Priorize remover "Remover cobrança" e "Confirmar recebimento em dinheiro" se a implementação completa não couber neste estágio — não deixar affordance de dinheiro sem função é mais importante que implementar tudo agora.
3. BackofficeClientDetailsContainer.tsx: adicione um AlertDialog de confirmação ao alternar "Tornar cliente vitalício"/"Remover plano vitalício" (linhas ~262-277, 863-885), seguindo o padrão já usado em BackofficeProductDeleteDialog.tsx.
4. BackofficePaymentsContainer.tsx: adicione o wrapper max-h-[90vh] flex flex-col + overflow-y-auto (padrão do projeto) ao DialogContent do dialog "Nova Cobrança" (linha ~240) e ao dialog do QR Code PIX (linha ~76).
5. Atualize postman/Lead-Flow-API-Collection.json se algum contrato de rota mudar.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** motor de cobrança/webhook, precificação.

**Aceite:** `POST /api/v1/backoffice/payments` retorna 403 para operador sem papel de manager; nenhum controle de menu chama uma função vazia; toggle vitalício exige confirmação; os dois dialogs têm o wrapper de scroll. **Validação manual:** tentar criar uma cobrança logado como operador (deve falhar); abrir os dois dialogs corrigidos em viewport curto (mobile) e confirmar que rolam corretamente.

---

### Estágio 9 (novo) — E-mails e alertas automáticos de cobrança

**Prompt (copy-paste):**
```
No lead-flow-app, adicione automação e visibilidade aos alertas de cobrança:

1. Cron novo (app/api/v1/billing/cron/overdue-reminder/route.ts, seguindo o padrão de autorização do member-pro-expiration/route.ts com CRON_SECRET): identifica contas em subscriptionStatus 'past_due' e dispara o e-mail equivalente ao que hoje só existe como botão manual (notifyMasterUserInvoiceStatusEmail, BackofficePlatformUsersUseCase.ts) automaticamente, com uma janela de reenvio (ex.: a cada 3 dias em atraso, até um limite) para não spammar. Registre em vercel.json.
2. Tela nova no Backoffice listando eventos de asaas_webhook_events com status 'failed', com botão de reprocessar (reenfileira o evento para processAsaasWebhookEvent), seguindo o padrão já existente para falhas de webhook do WhatsApp (lib/whatsapp/whatsapp-webhook-failure-alert.ts + página /backoffice/integracoes).
3. Dashboard/lista no Backoffice agregando contas subscriptionStatus IN ('past_due', 'canceled') across todos os clientes, não só por cliente individual.
4. Em PaymentValidationService.processWebhook, torne o envio de sendSubscriptionConfirmationEmail rastreável: mesmo continuando fire-and-forget para não bloquear o webhook, registre falha de envio em um lugar visível (reaproveitar EmailLog se fizer sentido para e-mails de billing, ou um log estruturado com alerta Sentry em caso de falha) em vez de só console.warn.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** o e-mail manual existente continua funcionando como está, esta é uma automação adicional, não uma substituição.

**Aceite:** cron de lembrete automático roda e não duplica envio dentro da janela definida; tela de webhooks falhos lista e permite reprocessar; dashboard de contas em risco existe. **Validação manual:** simular uma conta `past_due` no ambiente local e confirmar que o cron dispara o e-mail; simular um webhook falho e confirmar que aparece na tela nova.

---

### Estágio 10 (novo) — Início de cobrança pós-Member PRO (D11)

**Prompt (copy-paste):**
```
No lead-flow-app, elimine a janela de até 24h e a falta de checagem prévia na transição Member PRO -> cliente pagante:

1. Gatilho orientado a evento: no bootstrap autenticado (lib/bootstrap/getAuthenticatedLayoutBootstrapData.ts, que roda numa rota/handler Next.js), quando o profile tem ProfileUserTypeAssignment com slug member_pro e accessExpiresAt já passado, agende memberProBillingUseCase.syncUsageToSubscription(profileId, "member_pro_expiration") usando after() do next/server (o mesmo mecanismo já usado em app/api/webhooks/asaas/route.ts para processamento pós-resposta) — NÃO um `void promise sem await` solto. Runtime serverless (Vercel) pode congelar/matar a função assim que a resposta HTTP é enviada; um fire-and-forget "cru" não tem garantia de terminar, o que violaria o próprio critério de aceite deste estágio (sincronizar na mesma sessão). `after()` garante que o trabalho roda até o fim antes do runtime ser finalizado. Evite disparar a cada request usando um lock/marker simples (ex.: comparar accessExpiresAt com um campo lastSyncedAt) para não sincronizar em toda navegação. O cron diário member-pro-expiration continua existindo como rede de segurança para contas que não fazem login logo após a expiração.
2. Validação prévia: ao conceder member_pro via upsertUserTypeAssignment (BackofficeAllUsersRepository.ts), se o profile ainda não tiver asaasCustomerId nem dados cadastrais mínimos (nome, CPF/CNPJ, e-mail), grave um aviso visível na tela de concessão do Backoffice ("este cliente não tem dados de cobrança - ao expirar, a cobrança pode falhar") em vez de permitir a concessão silenciosamente sem alertar o operador.
3. Falhas de processExpiredMemberProAccounts (MemberProBillingUseCase.ts) e de syncUsageToSubscription passam a reportar para Sentry (Sentry.captureException), não só console.error - inclua o profileId no contexto do erro.
4. Ajuste a copy do e-mail (MemberProBillingUseCase.ts:159-163): diferencie "sua assinatura foi atualizada" (havia assinatura antes) de "sua cobrança foi iniciada pela primeira vez" (não havia asaasSubscriptionId antes da expiração) - a lógica já sabe qual dos dois casos é (ensureOrSyncRecurringSubscription cria vs. sincroniza), só falta propagar essa informação até o texto do e-mail.
5. Testes: gatilho de evento dispara sync via after() (não um fire-and-forget não aguardado) sem duplicar quando o cron já processou; validação prévia sinaliza cliente sem dados cadastrais na concessão; falha de sync aparece no Sentry (mock); e-mail usa a copy correta para os dois casos.
Rode bun run typecheck, bun run lint, bun run governance:check.
```

**Não tocar:** regras de negócio de quem pode conceder Member PRO, valor cobrado (isso é o catálogo, Estágio 2).

**Aceite:** um usuário que loga logo após a expiração do Member PRO tem a cobrança sincronizada na mesma sessão, sem esperar o cron do dia seguinte; concessão de Member PRO sem dados cadastrais é sinalizada; falhas aparecem no Sentry. **Validação manual:** conceder Member PRO com `accessExpiresAt` no passado a uma conta de teste, fazer login com ela e confirmar que a assinatura é criada/sincronizada na mesma requisição, sem esperar o cron.

---

### Estágio 11 — Consolidação do feature gating (igual ao Estágio 7 do spec antigo, com o achado novo)

**Prompt (copy-paste):**
```
No lead-flow-app:

1. Exporte ACTIVE_SUBSCRIPTION_STATUSES de um único módulo (app/api/shared/billing/) e substitua toda checagem manual de subscriptionStatus em rotas por essa constante ou pelo FeatureAccessService.
2. Corrija a divergência confirmada nesta auditoria: SubscriptionCheckService.ts (linha ~105 e ~182) usa isActive = subscriptionStatus === 'active', enquanto FeatureAccessService usa {active, trial, past_due}. Unifique as duas para a mesma definição (usar a constante do item 1 nos dois lugares) - hoje contas trial/past_due veem a sidebar liberada mas a página bloqueada pelo SubscriptionGuard, simultaneamente.
3. Registre como features ADDON em backoffice_features (migration de dados via bun run db:migrate:new seed-billing-addons + prisma/seed-backoffice-products.ts): time adicional e cobrança de overage de e-mail.
4. UI: seção "Add-ons" na tela de assinatura com toggle de cobrança automática de excedente, histórico de alterações (SubscriptionChangeLog), indicador de feature bloqueada por plano (componente FeatureLockedBadge).
5. Atualize postman/Lead-Flow-API-Collection.json.
Rode bun run typecheck, bun run lint, bun run governance:check, bun run design:check.
```

**Não tocar:** lógica de cobrança dos estágios anteriores; landing page.

**Aceite:** nenhum check manual de status fora do módulo compartilhado; `SubscriptionCheckService` e `FeatureAccessService` usam a mesma definição de "ativo"; `design:check` verde. **Validação manual:** logar com uma conta `trial`/`past_due` de teste e confirmar que sidebar e página concordam sobre o acesso (as duas bloqueiam, ou as duas liberam — nunca uma de cada).

---

## Critérios de aceite globais

1. `grep` de literais de preço fora do helper de resolução em banco retorna vazio.
2. Nenhuma escrita de `subscriptionStatus` fora dos handlers corrigidos do Estágio 1; nenhuma escrita de `subscriptionPlan` regressiva.
3. Webhook: reentrega de qualquer evento processado é no-op comprovado por teste; nenhum evento/status inexistente no Asaas real é tratado como se existisse.
4. Cancelar no app = cancelar no Asaas (ou falha explícita, nunca divergência silenciosa).
5. `hasPermanentSubscription` só muda via Backoffice, com auditoria (`SubscriptionChangeLog`).
6. RLS ativo com policies corretas em `asaas_webhook_events`/`profile_user_types`/`profile_user_type_assignments` — ou, no mínimo, grants confirmados e documentados como seguros.
7. Preço negociado por adesão nunca altera `BackofficeProduct`/`BackofficeProductPaymentRule`; nunca ultrapassa o teto sem aprovação registrada.
8. `POST /api/v1/backoffice/payments` exige papel de manager; nenhum controle de menu do Backoffice de billing chama uma função vazia.
9. Transição Member PRO → cobrança real não depende exclusivamente do cron diário.
10. Suítes de teste dos estágios -1, 1, 5, 6, 7 e 10 são gate de CI.

## Riscos e mitigação de rollout

- **RLS (Estágio -1):** ativar RLS sem confirmar todos os pontos de acesso legítimo (inclusive integrações externas que porventura usem a `anon key` para essas tabelas) pode quebrar produção — validar exaustivamente antes de aplicar, e aplicar fora de horário de pico com plano de rollback (`DISABLE ROW LEVEL SECURITY` imediato se algo quebrar).
- **Migração do enum de ciclo em produção:** confirmar a distribuição real de `subscriptionCycle` (incluindo variação de case, já confirmada) antes de rodar a migration definitiva.
- **Valores anômalos (`5990`) no sandbox Asaas:** investigar antes do Estágio 2, para o helper de preço não "oficializar" a comparação contra dados sujos.
- **Estágios -1 e 0 são independentes e urgentes** — podem (devem) ser cherry-pickados à frente de tudo, inclusive em paralelo entre si.
- **Migração dos clientes legados (System A → System B):** fora de escopo desta spec (Non-goal) — decisão de negócio pendente; o Estágio 2 só evita que o problema piore, não resolve a convivência dos dois sistemas.
