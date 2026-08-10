# EMAIL_AUDIT.md — Auditoria do Módulo de E-mail (Corretor Studio)

**Data:** 2026-07-05 · **Atualizado:** 2026-08-10 (incidente de produção §8 + reavaliação §0 dos Estágios 1-7 + auditoria da conta Resend §9 + colisão de idempotency key na retomada de dispatch §10)
**Escopo:** Email Campaigns, Email Template Editor, crons (`dispatch-scheduled`, `reset-credits`, `process-import-jobs`), webhook Resend, créditos/billing, listas de contato, supressão e conformidade.
**Método:** `/impeccable` audit + critique — leitura factual do código confrontada contra o estado-alvo de 8 requisitos + investigação MCP (Supabase produção, Vercel runtime logs, export de logs 04–05/07 e 10/08) + API do Resend (domínios, chaves, webhooks).
**Rodada somente-leitura:** nenhum código de produção foi alterado; as chamadas à API do Resend foram todas `GET` (leitura).

---

## 0. Reavaliação 2026-08-10 — a maior parte dos Estágios 1-7 do `EMAIL_SPEC.md` já foi implementada

O usuário pediu para reauditar os Estágios 1-7 antes de tratá-los como "propostos, não implementados" (resposta anterior errada deste assistente). Comparando o código atual (branch `develop`) contra cada decisão arquitetural (D1-D8) e cada estágio da spec de julho, a maior parte **já está em produção** — só não foi refletida de volta no `EMAIL_SPEC.md` (nenhuma entrada no Decisions log desde 2026-07-06). Provavelmente implementado numa rodada de trabalho não documentada nos specs entre julho e agosto.

| Decisão/Estágio | O que a spec pedia | Estado real encontrado no código (2026-08-10) | Veredito |
|---|---|---|---|
| D1 — créditos por Time | `EmailCreditSubscription.teamId @unique` | `prisma/schema.prisma:2936` — `teamId String @unique`. ✅ | **implementado** |
| D3 — reserva atômica com guard de saldo | `UPDATE ... WHERE creditsUsed + amount <= monthlyCredits` | `EmailCreditService.ts:83-116` — `reserveCredits`/`releaseCredits` via `$executeRaw` exatamente nesse desenho; `rowCount === 0` ⇒ sem saldo. ✅ | **implementado** |
| D7 — cron unificado no UseCase | Rota fina, delega para `EmailCampaignUseCase` | `app/api/v1/email/cron/dispatch-scheduled/route.ts` caiu de 288 para **41 linhas**; chama `useCase.dispatchScheduledCampaigns()`. ✅ | **implementado** |
| Estágio 1 — bug CDP/Radar no cron | Repassar `radarSegmentSlug` ao build de destinatários | `EmailCampaignUseCase.ts:236-302` — `radarSegmentSlug` propagado (renomeado de `cdpSegmentSlug` no rename CDP→Radar). ✅ | **implementado** |
| Estágio 1 — janela de disparo em UTC | Avaliar no timezone do master | `EmailCampaignUseCase.ts:1701,1824,2704` — `resolveTimezone(campaign.team.master.timezone)`. ✅ | **implementado** |
| Estágio 1 — recuperação de `sending` travado | Campanha presa >30 min é retomada/marcada `failed` | `STUCK_SENDING_THRESHOLD_MS = 30 min`, `recoverStuckSendingCampaigns` (`EmailCampaignUseCase.ts:86,2364`). ✅ | **implementado** |
| Estágio 1 — fora da janela vira `failed` indevidamente | Deveria permanecer `scheduled` | **Correção (review 2026-08-10, PR #728): a verificação anterior deste audit usou os identificadores errados** (`dispatchWindow`/`windowStart`, que nunca existiram). O código real é `checkDispatchWindow` em `lib/email/campaign-dispatch-guards.ts` (campos `dispatchTimeFrom`/`dispatchTimeTo`), chamado em `EmailCampaignUseCase.ts:2721-2735`: quando bloqueado com `defer: true`, a campanha volta para `status: "scheduled"` em vez de `failed`. ✅ | **implementado** |
| D5 — descadastro público por Time | Rota + página + link no e-mail | `app/email-unsubscribe/[token]/**` (página, `features/` completo), `app/api/v1/email/public/unsubscribe/**`, mais a variante `app/backoffice-email-unsubscribe/**` para o módulo backoffice (isolamento respeitado). ✅ | **implementado** |
| D6 — editor HTML-only default | `editorMode` default `"html"` | `prisma/schema.prisma:2994` — `editorMode String @default("html")`. ✅ | **implementado** |
| D2 — RBAC via `dispatchAllowedRoles` | Rotas consultam `EmailTeamSettings`, fim da letra morta | `EmailCampaignUseCase.ts:860-868` — `canDispatchEmail(ctx, teamSettings)` lê `dispatchAllowedRoles` antes de criar/disparar campanha. ✅ | **implementado** |
| Estágio 3 — tags `team_id` obrigatórias | `tracking` obrigatório em `EmailService.send` de produto | `lib/services/EmailService.ts:44-46` — tipo `tracking: EmailTrackingMeta` obrigatório, comentário explícito "exige tracking com team_id"; `EmailTemplateUseCase.ts:671` (teste de template) e o restante dos callers de produto usam `buildResendTrackingTags`/`mergeResendTrackingTags`. **Ressalva (review 2026-08-10, PR #728): não é 100%** — `app/api/services/leadDocumentRequest/LeadDocumentRequestService.ts:26,55` chama `resend.emails.send` diretamente (não via `EmailService.send`), sem nenhuma tag, apesar de `LeadDocumentRequestUseCase.ts` ter `teamId` disponível em todos os call sites. Esses e-mails (solicitação/notificação de documento do lead) ficam órfãos no webhook. | **parcial — 1 caminho de produto ainda sem tags** |
| Estágio 3 — backfill de órfãos em lote, não síncrono no webhook | Tabela `email_orphan_events` + processamento em lote | `model EmailOrphanEvent` (`prisma/schema.prisma:3286`) existe, e o equivalente do módulo backoffice (`BackofficeEmailOrphanEvent`, isolamento respeitado). ✅ | **implementado** |
| Estágio 4 — dedupe de `EmailEvent` por constraint, não check-then-act | `@@unique([logId, type, occurredAt])` + captura de `P2002` | Constraint existe (`schema.prisma:3272`) e `EmailLogRepository.ts:170-180` captura `P2002` dentro da transação e ignora como duplicata. ✅ | **implementado** |
| Estágio 4 — webhook responde 500 em erro interno (retry do provedor) | Diferenciar erro de assinatura (401) de erro de processamento (500) | `app/api/webhooks/resend/route.ts` foi para um desenho **diferente** do proposto: assinatura verificada de forma síncrona (401 se inválida), mas o processamento do evento roda em `after()` fire-and-forget com semáforo de concorrência (`MAX_CONCURRENT = 5`) e a rota **sempre responde 200** antes de saber se o processamento deu certo — erro de processamento vira só `console.error`, não gera retry do Resend. | **implementado com desenho diferente — divergência a decidir** |
| D4/Estágio 6 — import assíncrono | Tabela + cron, claim atômico, retry por lote | `EmailImportJob` + `EmailContactImportUseCase` implementados — é justamente o código que travou no incidente §8.1 (o desenho existe, mas tem um bug de performance dentro dele, não ausência de implementação). ✅ (com o bug do §8.1 pendente de correção) | **implementado (com bug ativo, ver §8.1/D9)** |
| Estágio 7 — `reset-credits` com try/catch por assinatura | Falha de uma assinatura não aborta o loop | `app/api/v1/email/cron/reset-credits/route.ts:50-85` — `for (const subscription of ...)` com `try/catch` por item. ✅ | **implementado** |

**O que isso muda:**

1. O `EMAIL_AUDIT.md`/`EMAIL_SPEC.md` de julho descrevia um estado de código que **não existe mais** — quase todo o débito técnico levantado em 3.1-3.4, 3.6-3.8 e 4.x foi pago. O único item do escopo original de julho que segue confirmadamente **sem implementação** é a cobrança real via Asaas (non-goal declarado desde o início, `Open questions` item 3). **Correção (review 2026-08-10, PR #728):** dois itens que esta reavaliação marcou como 100% implementados na verdade têm ressalva — ver as linhas atualizadas da tabela: Estágio 3 (tags obrigatórias) tem 1 caminho de produto ainda sem tags (`LeadDocumentRequestService.ts`), e a janela de disparo por horário (Estágio 1) estava correta desde já (a versão anterior deste audit tinha marcado como "feature removida" por erro de busca).
2. **Decisão do owner tomada (2026-08-10): precisamos de retry para as falhas.** O webhook (Estágio 4, item 2) tinha ficado com um desenho diferente do proposto (fire-and-forget + 200 sempre, em vez de 500 em erro de processamento) — falha transitória de processamento virava só um log, sem nova tentativa. Registrado como D11 em `EMAIL_SPEC.md`: em vez de reverter para `500` síncrono (o Resend recomenda o oposto — sempre 200 rápido, processar async), o retry passa a ser **interno** via uma fila de falhas (`ResendWebhookProcessingFailure` + cron de 5 min), mesmo padrão de outbox já usado no resto do repo. Novo Estágio 10, pronto para implementar.
3. O `EMAIL_SPEC.md` será atualizado (seção "Status de execução" nova, seguindo o padrão do `CRON_OBSERVABILITY_SPEC.md`) para não reapresentar como "proposta" algo que já está em produção.

---

## 🔴 Investigação MCP executada — achado crítico confirmado (2026-07-06)

A investigação obrigatória via MCP (Supabase + Vercel) foi executada em 2026-07-06, complementada pelo export `corretor-studio-log-export-2026-07-05T09-31-49.json` (22.522 linhas, janela de 24h: 04/07 09:30 UTC → 05/07 09:29 UTC). Números completos na seção 6. O que muda em relação à primeira versão deste relatório:

1. **Evidência nº 3 ("cron sempre reporta 0 campanhas") — resolvida, e é pior do que parecia.** A cadência do cron está correta (288 execuções em 24h = exatamente a cada 5 min, todas HTTP 200, p50 67ms, máx 1,7s — sem timeout, sem cold start mascarando falha) e **não há campanhas `scheduled` vencidas no banco hoje** (a única `scheduled` é futura, 09/07). Mas o banco mostra o que aconteceu com a última que venceu: a campanha `teste de e-mail` (agendada 04/07 21:00 UTC) foi **encontrada e morta pelo próprio cron** com `errorMessage: "Sem assinatura de créditos ativa"` — enquanto o disparo manual do mesmo Time funciona via bypass beta (`resolveEmailBetaAccess`), **que não existe no caminho do cron** (assimetria descrita em 3.1/3.3). Como produção tem **0 assinaturas de crédito ativas**, hoje **toda campanha agendada morre no primeiro run elegível**, e o cron loga apenas "0 campanhas disparadas" — o kill é silencioso (nenhuma linha de erro nas 1.164 linhas de log do cron na janela).
2. **O billing nunca contabilizou nada em produção:** 2 assinaturas (ambas canceladas), `creditsUsed` acumulado = **0**, overage acumulado = **R$ 0,00**. `deductCredits` nunca registrou um único crédito — o achado "billing fictício" (5.1) deixa de ser risco teórico e vira fato medido.
3. **Estados terminais quebrados confirmados em produção:** 3 campanhas `sent` com `totalSent = 0`; 2 dispatches presos em `sending` desde 01/07; a campanha `Convite 02/07` acumulou **6 dispatches `failed` consecutivos (378 destinatários, 0 enviados)** em 2 dias de retentativas manuais do usuário; **545 EmailLogs de campanha presos em `queued`** sem `resendEmailId` (98,5% dos logs de campanha).
4. **Órfãos e 429 quantificados:** 298 linhas de órfão / **124 dispatch IDs distintos em 24h**; 8 ocorrências de `rate_limit_exceeded` — 6 no enrichment do webhook e **2 no caminho de envio** (cron `meeting-follow-up`), confirmando que o problema de rate limit não é só do enrichment.

---

## 1. Sumário executivo

| # | Requisito-alvo | Veredito | Risco |
|---|----------------|----------|-------|
| 1 | Créditos por Time (saldo + lock atômico) | **não existe** | 🔴 crítico |
| 2 | RBAC de campanhas (master/manager/operator) | **parcial** | 🟡 médio |
| 3 | Cron dispatch — idempotência/concorrência | **parcial** | 🔴 crítico |
| 4 | Cron reset-credits — idempotência | **parcial** | 🟡 médio |
| 5 | Supressão + link de descadastro + webhook idempotente | **parcial** | 🔴 crítico (conformidade) |
| 6 | Editor de template — modo HTML apenas | **parcial (quase existe)** | 🟢 baixo |
| 7 | Importação de contatos em background | **não existe** | 🟡 médio |
| 8 | Página pública de descadastro por Time | **não existe** | 🔴 crítico (conformidade) |

**Os 5 achados estruturais mais importantes da rodada:**

1. **Conflito de schema créditos↔Time**: `EmailCreditSubscription.profileId` é `@unique` (1:1 por Manager) enquanto todo o resto do módulo é escopado por `teamId`. Não existe nenhum caminho no código que verifique saldo por Time — todos os Times de um master compartilham o mesmo pool implicitamente (`prisma/schema.prisma:1896-1913`).
2. **Não há checagem de saldo nenhuma antes do disparo**: `hasEnoughCredits()` só verifica se a assinatura está ativa — o comentário no código é explícito: *"Permite envio mesmo sem créditos (vai para overage)"*. Overage é ilimitado e **nunca é cobrado** (TODO explícito no cron de reset). O módulo de billing hoje é, na prática, um contador (`app/api/services/EmailCredit/EmailCreditService.ts:70-74`, `app/api/v1/email/cron/reset-credits/route.ts:71-76`) — e nem como contador funciona: em produção `creditsUsed` acumulado é **0** (seção 6.4).
3. **Nenhum link de descadastro em nenhum e-mail de campanha** e nenhuma página pública de opt-out. As flags de supressão são aplicadas no envio, mas o destinatário não tem como se descadastrar — só via bounce/complaint. Risco de conformidade (LGPD/CAN-SPAM) e de reputação de domínio.
4. **Causa raiz dos e-mails órfãos confirmada no código**: o caminho de campanha anexa `team_id` corretamente, mas três outros caminhos de envio **não anexam** — `EmailService.send` sem `tracking`, o envio de teste de template (tags só `templateId`/`purpose`) e o `BackofficeLeadScheduleInviteService` (payload sem `tags`). O 429 é sintoma: o enrichment busca o e-mail de volta na API do Resend, síncrono por evento de webhook, sem backoff.
5. **Campanha vira `sent` mesmo quando 0 e-mails saem**: tanto o cron quanto o disparo manual marcam `status: "sent"` incondicionalmente após o dispatch, mesmo com `result.sent === 0` (o dispatch fica `failed`, a campanha não). E não existe recuperação de campanhas presas em `sending` (timeout do Vercel no meio do lote = campanha travada para sempre). **Confirmado em produção**: 3 campanhas `sent` com `totalSent = 0`, 2 dispatches presos em `sending` há 4+ dias e 545 logs presos em `queued` (seções 6.1–6.3).

---

## 2. Mapa do módulo (arquivos-chave)

### Backend

| Camada | Arquivos |
|--------|----------|
| Rotas v1 | `app/api/v1/email/**` — 39 rotas (campaigns, templates, contact-lists, credits, settings, logs, analytics, cron) |
| Crons | `app/api/v1/email/cron/dispatch-scheduled/route.ts` (288 linhas, `*/5 * * * *`), `app/api/v1/email/cron/reset-credits/route.ts` (86 linhas, `0 3 1 * *`) — ambos em `vercel.json` |
| Webhook | `app/api/webhooks/resend/route.ts` → `ResendWebhookUseCase` → `ResendWebhookService`/`ResendEmailEnrichmentService` |
| UseCases | `app/api/useCases/email/` — Campaign (698 l), Template (979 l), ContactList (674 l), Credit (208 l), TeamSettings (745 l), TeamVariables (233 l), Analytics (125 l) |
| Services | `app/api/services/EmailCampaignDispatch/` (dispatch + recipients), `EmailCredit/`, `EmailContactList/`, `resend/` |
| Repositórios | `app/api/infra/data/repositories/emailLog/EmailLogRepository.ts`, `emailCampaignRecipient/EmailCampaignRecipientRepository.ts` |
| Libs | `lib/email/build-resend-tracking-tags.ts`, `lib/email/team-email-dispatch-logger.ts`, `lib/email/interpolate.ts`, `lib/email/inline-email-html.ts`, `lib/services/EmailService.ts` (envio transacional genérico) |

### Schema Prisma (`prisma/schema.prisma`)

- `EmailCreditSubscription` (1896) — **`profileId @unique`** — 1:1 por Profile
- `EmailCreditUsage` (1915) — `@@unique([subscriptionId, periodStart])`
- `EmailTemplate` (1932) — `teamId`, `mailyJson Json?`, `html String?`, **`editorMode String @default("blocks")`**, versionamento + aprovação
- `EmailContactList` (1997) / `EmailContact` (2021) — `@@unique([listId, email])`, flags `isUnsubscribed`/`isBounced`/`isComplained`
- `EmailCampaign` (2041) / `EmailCampaignDispatch` (2077) — escopo `teamId`, contadores agregados
- `EmailLog` (2116) — `resendEmailId @unique`, `teamId` / `EmailEvent` (2152)
- `EmailTeamSettings` (2406) — `dispatchAllowedRoles`, janela de disparo, domínio Resend

### Frontend (`app/[supabaseId]/email/`)

`campanhas/`, `templates/` + `templates/[id]/` (editor), `contatos/`, `historico/`, `configuracoes/` — todos com `features/context|services|container` ✅. Saldo de créditos em `app/[supabaseId]/subscription/features/container/EmailCreditsCard.tsx`.

### Specs existentes

`specs/email-dispatch.md` (job model `scheduled_email_jobs` — **nunca implementado**; o cron atual consulta `email_campaigns` direto), `specs/email-analytics.md` (webhook — implementado em espírito), `specs/cdp-email.md`.

---

## 3. AUDIT — os 8 requisitos, linha a linha

### 3.1 Créditos por Time — `não existe` 🔴

**O que existe hoje (tudo por Manager/master, nada por Time):**

- Schema: `EmailCreditSubscription.profileId String @unique` (`prisma/schema.prisma:1898`) — uma assinatura por Profile, sem nenhuma relação com `Team`.
- Cron: resolve `campaign.team.master.id` e verifica/decrementa por ele (`dispatch-scheduled/route.ts:106-115`, `:237`).
- Disparo manual: idem — `campaign.team.master.id` (`EmailCampaignUseCase.ts:455-456`, `:584-586`).
- **Todos os Times do mesmo master compartilham o mesmo pool** — exatamente o modelo que o estado-alvo rejeita.

**Checagem de saldo — não existe de fato:**

```typescript
// app/api/services/EmailCredit/EmailCreditService.ts:70-74
async hasEnoughCredits(profileId: string): Promise<boolean> {
  const status = await this.getStatus(profileId)
  // Permite envio mesmo sem créditos (vai para overage), mas requer assinatura ativa
  return status.hasSubscription
}
```

Um Time pode estourar 10x o plano num único disparo; tudo vira `overageCount`/`overageCharged` — que nunca é cobrado (ver 3.4).

**Race condition no decremento — real:**

`deductCredits` (`EmailCreditService.ts:76-117`) faz read-modify-write: lê `usage.creditsUsed`, calcula em memória e grava `creditsUsed: newCreditsUsed` (valor absoluto, não `increment`). Dois disparos simultâneos do mesmo master (dois Times, ou manual + cron) leem o mesmo snapshot → **lost update** (um decremento some) e cálculo de overage incorreto. Não há transação, não há `SELECT ... FOR UPDATE`, não há guard de saldo.

**Agravantes:**

- Bypass beta: `resolveEmailBetaAccess` permite disparo **sem assinatura nenhuma** (`EmailCampaignUseCase.ts:457-460`) e, quando `hasCredits === false` com beta, o `deductCredits` nem roda (`:584`) — envio sem contabilização. **Confirmado em produção**: todos os disparos que saíram até hoje saíram por esse bypass — `creditsUsed` acumulado no banco é 0 (seção 6.4).
- **O bypass beta não existe no cron** (`dispatch-scheduled/route.ts:108-115` checa só `hasEnoughCredits`) — campanha agendada de um Time beta morre com "Sem assinatura de créditos ativa" enquanto o disparo manual do mesmo Time funciona. **Confirmado em produção** (seção 6.1): foi exatamente isso que matou a última campanha agendada que venceu (04/07 21:00).
- `EmailCreditUseCase.subscribe` cria a assinatura **direto no banco, sem cobrança Asaas** — `PLAN_PRICES` existe (R$25–375/mês) mas nenhuma integração de pagamento (`EmailCreditUseCase.ts:10-100`). A "assinatura" de créditos é gratuita na prática.
- Cron de dispatch **não passa** `cdpSegmentSlug` ao `buildCampaignDispatchInput` (`dispatch-scheduled/route.ts:117-129`) — campanha agendada com segmento CDP resolve `contactListId: null` → `listActiveRecipients(teamId, null!)` → 0 destinatários → campanha marcada `failed` ("Nenhum contato ativo na lista"). **Bug funcional: campanhas CDP agendadas nunca disparam** (o fluxo manual passa o slug corretamente em `EmailCampaignUseCase.ts:465`). Este é um candidato forte a explicar parte da evidência de produção nº 3.

### 3.2 RBAC de campanhas — `parcial` 🟡

**O que existe:**

- `UserRole` = `manager | backoffice | operator` (master é `Profile.isMaster` + role `manager` no team).
- **Todas as rotas mutantes** do módulo (campanhas CRUD/send/cancel, templates, contact-lists, import, credits/subscribe, settings) usam gate `isManagerLikeRole` (`manager`/`backoffice`) — ex.: `app/api/v1/email/campaigns/[id]/send/route.ts:20-25`.
- Rotas **sem** gate de role (somente membership via `getTeamAccess`): `analytics`, `logs`, `logs/[logId]`, `credits/status` — ou seja, **operator hoje: sem acesso a nenhuma escrita, com acesso de leitura a métricas/histórico**.

**Contradição interna encontrada:** `EmailTeamSettings.dispatchAllowedRoles` (default `["manager","backoffice"]`) é verificado dentro de `EmailCampaignUseCase.send` (`:413-417`) — mas a rota já bloqueou `operator` antes de chegar lá. Configurar `dispatchAllowedRoles: ["operator", ...]` na tela de configurações **não tem efeito** (letra morta). O mesmo vale para `templateCreateRoles`. Decidir na spec: ou o setting manda (e a rota afrouxa), ou o setting sai da UI.

**Pergunta (a) do prompt — respondida pelo código:** operator hoje = leitura de analytics/logs/status, zero escrita. As opções de evolução estão na `EMAIL_SPEC.md` (Decisão D2) — não é mais bloqueante para fechar a spec, mas a granularidade final (visualizar vs. criar rascunho vs. nada) continua sendo escolha de produto.

### 3.3 Cron dispatch-scheduled — `parcial` 🔴

**O que está certo:**

- Lock atômico de transição existe e é correto: `updateMany({ where: { id, status: "scheduled" }, data: { status: "sending" } })` com checagem de `count === 0` (`dispatch-scheduled/route.ts:158-165`). Duas execuções sobrepostas não disparam a mesma campanha duas vezes.
- Envio em lotes de 50 via `resend.batch.send` com `idempotencyKey` por chunk (`campaign/{id}/{dispatchNumber}/{chunkIndex}`) (`EmailCampaignDispatchService.ts:9,67-72`) — retry seguro no nível do Resend.
- Contadores por destinatário: o resultado mapeia item a item (`:85-97`), `EmailLog` criado por destinatário enviado, `totalSent` reflete o real — **não é tudo-ou-nada**. ✅

**O que está errado:**

1. **Campanha `sent` com 0 enviados**: `dispatchStatus = result.sent === 0 ? "failed" : "completed"` — mas a campanha é atualizada para `"sent"` incondicionalmente (`route.ts:240-259`; mesmo padrão em `EmailCampaignUseCase.ts:588-608`). Falha total do Resend = dispatch `failed` + campanha `sent` com `totalSent: 0`.
2. **Sem recuperação de `sending` travado**: não há `maxDuration` exportado nem varredura de campanhas presas em `sending`. Se a function morrer por timeout no meio dos chunks, a campanha fica em `sending` para sempre — invisível para o cron (que só busca `scheduled`) e ineditável na UI ("Campanha em envio não pode ser editada").
3. **Falhados sem log no cron**: o caminho manual pré-cria `EmailLog` `queued` para todos e marca `failed` os não enviados (`EmailCampaignUseCase.ts:537-582`); o cron só cria logs dos **enviados** (`route.ts:205-235`) — destinatários que falharam no cron não deixam rastro em `email_logs`.
4. **Trabalho pesado antes do lock**: credit check + build de destinatários + validação de tokens rodam **antes** da transição de status (`:106-156`). Sobreposição de cron não duplica envio, mas duplica todo o trabalho caro. O lock deveria ser a primeira operação.
5. **Janela de horário avaliada em UTC** com comentário admitindo (`:88-96`) — times BRT têm janela deslocada em 3h.
6. **Campanha fora da janela/data bloqueada → `failed` terminal** (`:97-103`) em vez de permanecer `scheduled` para a próxima janela. Um agendamento às 20h com janela até 18h **morre** em vez de sair no dia seguinte. Candidato a explicar "0 campanhas disparadas" recorrente.
7. **Bug CDP** (detalhado em 3.1): cron não repassa `cdpSegmentSlug` → campanhas CDP agendadas sempre falham.
8. Rate limit: `batch.send` sequencial sem pausa entre chunks nem tratamento de 429 no batch (o `catch` marca o chunk inteiro como failed e segue).
9. Mapeamento resposta↔destinatário **por índice** (`items.forEach((item, idx) => chunk[idx])`) — assume que o Resend devolve na mesma ordem; frágil, sem validação.

**Evidência de produção nº 3 ("0 campanhas disparadas" em toda a janela) — RESOLVIDA (seção 6):** a causa real é a **assimetria do bypass beta** (item novo em 3.1): a única campanha agendada que venceu na janela foi encontrada pelo cron e morta com "Sem assinatura de créditos ativa"; como produção tem 0 assinaturas ativas e todos os disparos manuais saem via beta, **nenhuma campanha agendada consegue sobreviver ao cron hoje**. As demais hipóteses (bug CDP, janela UTC, `sending` travado) continuam sendo bugs reais e latentes, mas não foram o gatilho desta ocorrência — não há campanha CDP em produção ainda, e os 2 registros presos em `sending` são dispatches, não campanhas. O kill é **silencioso**: o cron loga apenas "0 campanhas disparadas nesta execução" (única mensagem distinta em 1.164 linhas/288 execuções na janela) — marcar campanha como `failed` sem nenhuma linha de log é um gap de observabilidade próprio.

### 3.4 Cron reset-credits — `parcial` 🟡

**O que está certo:**

- Guard de idempotência natural: busca `status: "active" AND currentPeriodEnd <= now` e a própria transação avança `currentPeriodEnd` — re-execução não re-reseta o mesmo período. `@@unique([subscriptionId, periodStart])` bloqueia usage duplicado. ✅
- `suspended`/`canceled` são excluídos pelo filtro `status: "active"`. ✅

**O que está errado:**

1. **`overageCharged` não gera cobrança no Asaas** — confirmado, é só contador com TODO explícito:
   ```typescript
   // reset-credits/route.ts:71-76
   // TODO: Fase 2 avançada — criar cobrança avulsa no Asaas pelo excedente
   ```
   Combinado com 3.1 (overage ilimitado + assinatura sem cobrança), o módulo inteiro de billing **não fatura nada** hoje. Pergunta (b) do prompt: **respondida — gap a reportar, não a resolver nesta rodada.**
2. **Sem try/catch por assinatura**: se uma transação falhar (ex.: colisão de unique em execução concorrente), a exceção estoura o loop inteiro → 500 → **assinaturas restantes não são renovadas naquele mês** (cron é mensal, sem retry até o mês seguinte).
3. Execução única mensal sem janela de recuperação: falha no dia 1 às 03:00 = todos os períodos ficam vencidos por um mês (com `getStatus` retornando `usage` vazio → `creditsUsed 0`/`creditsAvailable` cheio — mascarando o problema).
4. Overlap concorrente teoricamente possível (duas execuções manuais/deploy): ambas leem a mesma lista antes do primeiro update; a segunda transação falha no unique — comportamento correto por acidente, mas via exceção (ver item 2).

### 3.5 Supressão e conformidade — `parcial` 🔴

**Supressão aplicada no envio — sim, com lacunas:**

- `findActiveRecipientsForList/ForTeam` filtram `isUnsubscribed: false, isBounced: false` (`EmailCampaignRecipientRepository.ts:22-58`). ✅
- **`isComplained` não é filtrado diretamente** — mitigado porque o webhook marca `complained → isComplained + isUnsubscribed` juntos (`EmailLogRepository.ts:88-93`), mas uma flag `isComplained` setada isoladamente (import, ajuste manual) não suprime.
- Caminho CDP usa mecanismo paralelo (`email_marketable` em `lib/cdp/list-segment-recipients.ts:37`) — consentimento via CDP, não via flags de `EmailContact`. Dois sistemas de supressão coexistem sem ponte.

**Atualização de flags via webhook — funciona, com escopo global:**

- `bounced` → `updateMany({ where: { email } })` e `complained` → idem (`EmailLogRepository.ts:82-93`) — **sem escopo de time/lista**: bounce num Time marca o contato em TODAS as listas de TODOS os times. Para bounce é defensável (endereço inválido é global); para complaint conflita com o modelo de opt-out **por Time** do requisito 8.

**Link de descadastro — não existe:** grep por `unsubscribe|descadastr|List-Unsubscribe` em `app/**` e `lib/**` não encontra nem link no HTML de campanha, nem header `List-Unsubscribe`, nem rota pública. O evento `email.unsubscribed` é mapeado no webhook (`ResendWebhookService.ts:14`) mas **nada o produz** — não há caminho de opt-out para o destinatário. 🔴

**Webhook — assinatura ✅, idempotência parcial:**

- Verificação `svix` correta com secret + 3 headers (`app/api/webhooks/resend/route.ts:27-39`). ✅
- Dedupe: `hasDuplicateEvent(logId, type, occurredAt)` via `findFirst` (`EmailLogRepository.ts:32-38`) — cobre reentrega do mesmo evento, **mas é check-then-act sem constraint única** em `EmailEvent`: duas entregas concorrentes do mesmo evento passam ambas no check → evento duplicado → `totalDelivered/totalOpened` da campanha **incrementados duas vezes** (o guard `!log.deliveredAt` usa snapshot lido antes da transação).
- Regressão de status: protegida por `statusPriority` (`bounced` não volta a `sent`) (`EmailLogRepository.ts:53-59`). ✅
- **Erro engolido com 200**: o catch da rota devolve `{ received: true }, { status: 200 }` (`route.ts:44-48`) — falha de processamento não gera retry do Resend; evento perdido silenciosamente.

### 3.6 Editor de template — modo HTML — `parcial (quase existe)` 🟢

- O schema **já tem** o flag que o prompt pergunta se seria necessário: `editorMode String @default("blocks")` aceitando `"blocks" | "html"` (`schema.prisma`, `templates/route.ts:43`).
- Backend: criação default `"html"` (`EmailTemplateUseCase.ts:281` — `data.editorMode ?? "html"`).
- Frontend: `resolveEditorMode()` **retorna `"html"` incondicionalmente** (`TemplateEditorHook.ts:30-32`) — o modo visual Maily/TipTap está inacessível na UI. O fluxo colar/editar HTML → preview → teste → campanha funciona ponta a ponta sem nenhum estágio do editor visual. ✅ (confirma a correção de rumo: o plano de 6 estágios de paridade visual não é bloqueante)
- Envio usa sempre `template.html` (cron `:47`, useCase `:449` — "Template não possui HTML" se nulo); `mailyJson` é ignorado no envio. **`html` já é a fonte de verdade.** ✅
- Teste (`templates/[id]/test`): renderiza HTML puro com `inlineEmailHtml` + `interpolateEmailTemplate`, variáveis/merge tags suportadas, sem transformação Maily (`EmailTemplateUseCase.ts:540-580`). ✅

**Lacunas residuais:** (i) default do schema continua `"blocks"` — templates antigos podem carregar `mailyJson` órfão com `editorMode` incoerente; (ii) o envio de teste **não anexa `team_id` nas tags** (`:568-571` — só `templateId`/`purpose`) → cada teste vira e-mail órfão no webhook (ver seção 4); (iii) `mailyJson` sem plano de descontinuação explícito.

### 3.7 Importação de contatos em background — `não existe` 🟡

O que existe (`EmailContactListUseCase.ts:367-467` + `uploadCsv :469+`):

- **100% síncrono na request**: parse, validação, upsert em lotes de 100 sequenciais, contagem e update de `totalContacts`, tudo antes do response. Usuário precisa esperar a request; lista grande = timeout do Vercel = **import parcial sem relatório e sem retry**.
- Lotes de 100 existem (`BATCH_SIZE`), mas sem retry por lote — exceção em qualquer lote aborta o restante e devolve "Erro ao importar contatos" genérico.
- Distinção inválido vs. duplicado: **parcialmente ok** — inválidos viram `issues[]`/`skipped`, duplicados na lista viram `updated` (upsert). Retorno traz `{ imported, updated, skipped, issues }`. Mas o resumo só chega se a request sobreviver.
- **Espelhamento na lista default**: todo import em lista custom re-importa os mesmos lotes na lista "todos os contatos" do time (`:441-456`) — dobra o custo da mesma request síncrona.
- JSON: o endpoint `/import/mapped` já recebe **rows JSON** (o parse de CSV é feito no cliente), então "importar JSON" é quase gratuito — mas não há endpoint documentado para arquivo JSON `{ email, name?, customFields? }` como formato de primeira classe.
- Sem tabela de fila, sem `importId`, sem logs estruturados por lote, sem notificação in-app. `NotificationType` (`schema.prisma:433-448`) não tem `EMAIL_IMPORT_COMPLETED` — confirmado que os tipos atuais não cobrem o caso.

### 3.8 Página pública de descadastro por Time — `não existe` 🔴

Nenhuma rota pública de opt-out, nenhum token de contato, nenhum footer de descadastro no HTML das campanhas. O mecanismo interno (`isUnsubscribed`) existe e é respeitado no envio, mas **não há como o destinatário acioná-lo**. Junto com 3.5, este é o principal risco de conformidade e de reputação de domínio do módulo (complaints são o único "opt-out" disponível ao destinatário — e complaint machuca deliverability de todos os times, já que o domínio é compartilhado).

---

## 4. Evidências de produção — causa raiz no código

### 4.1 E-mails órfãos sem `team_id` (124 dispatch IDs na janela de log)

O caminho de **campanha anexa tags corretamente** (`EmailCampaignDispatchService.ts:59-64` via `buildResendTrackingTags` → `team_id`, `category`, `source_type`, `source_id`). Os órfãos vêm dos **outros caminhos de envio**:

| Caminho | Arquivo | Tags |
|---------|---------|------|
| `EmailService.send` **sem** `tracking` | `lib/services/EmailService.ts:639-646` — tags só quando `tracking` é passado pelo caller | ❌ nenhuma |
| Envio de teste de template | `EmailTemplateUseCase.ts:568-571` | ❌ só `templateId` + `purpose` (sem `team_id`) |
| Convites de agenda (backoffice) | `BackofficeLeadScheduleInviteService.ts:240-258` — payload sem campo `tags` | ❌ nenhuma |

Todo evento de webhook desses e-mails cai em `createOrphanTeamEmailLogFromResendEmail`, que loga exatamente a mensagem observada (`ResendEmailEnrichmentService.ts:56-61`). **Correção na origem** = auditar cada caller de `EmailService.send`/`resend.emails.send` e tornar as tags de rastreio obrigatórias (ou explícita e intencionalmente ausentes para e-mails backoffice, que têm fallback próprio no webhook).

**Escala medida (export 24h, seção 6.6):** 298 linhas de órfão / **124 dispatch IDs distintos**, concentradas às 11h e 17h UTC (8h/14h BRT) — o mesmo horário dos disparos de backoffice e do cron `meeting-follow-up`, consistente com a tabela acima. Na mesma janela o webhook processou **220 eventos para dispatches de backoffice e 0 eventos para `EmailLog` de produto** — ou seja, hoje praticamente todo o tráfego do webhook é backoffice, e a taxa de órfãos sobre o tráfego não-backoffice é próxima de 100%.

### 4.2 429 `rate_limit_exceeded` no enrichment

`createOrphanTeamEmailLogFromResendEmail` → `fetchEmailMetadata` → `resend.emails.get(id)` **síncrono, dentro do handler do webhook, um por evento, sem fila nem backoff** (`ResendEmailEnrichmentService.ts:24-45`, chamado de `ResendWebhookUseCase.ts:87-94`). Rajada de `delivered/opened` simultâneos → >10 req/s → 429. Nota: como 4.1 mostra, essa busca é **inútil para os órfãos atuais** — o e-mail no Resend também não tem a tag, então a chamada falha em recuperar `team_id` de qualquer forma (paga o rate limit e ainda devolve `null`). Corrigir a origem (tags no envio) elimina a causa; para o legado, fila com backoff exponencial (nunca síncrono no handler).

**Escala medida (export 24h + Vercel MCP):** 8 ocorrências de `rate_limit_exceeded` na janela, em rajadas (ex.: 5 hits entre 17:01:40–17:01:46 de 04/07). **6 no enrichment do webhook e 2 no caminho de ENVIO** do cron `meeting-follow-up` (`Erro ao enviar email: rate_limit_exceeded`) — ou seja, envios transacionais reais já estão sendo perdidos por rate limit, não só o enrichment. Qualquer correção precisa tratar o limite de 10 req/s do Resend como orçamento **global** da aplicação (envio de campanha em lote + transacionais + enrichment), não como problema local do webhook.

### 4.3 Cron "0 campanhas disparadas" — resolvido

Causa confirmada com banco + logs (detalhado em 3.3 e 6.1): a mensagem é literalmente verdadeira — não havia campanhas elegíveis na maior parte da janela — **porque o próprio cron mata silenciosamente toda campanha agendada que vence** ("Sem assinatura de créditos ativa"; produção tem 0 assinaturas ativas e o bypass beta só existe no fluxo manual). Cadência, duração e taxa de erro do cron estão saudáveis (288/288 execuções em 24h, todas 200, p50 67ms, máx 1,7s). Bug CDP e janela UTC permanecem latentes (nenhuma campanha CDP em produção ainda).

---

## 5. CRITIQUE — riscos além dos 8 requisitos

**P0/P1 (corrigir antes de evoluir):**

1. **Billing fictício** — assinatura sem cobrança Asaas + overage nunca faturado + bypass beta sem contabilização. Qualquer evolução "cobrança por Time" precisa primeiro decidir como a cobrança real entra (Asaas subscription? débito no ciclo?). Tratar o módulo como financeiro exige que exista, de fato, um financeiro.
2. **Campanhas CDP agendadas nunca disparam** (cron não repassa `cdpSegmentSlug`) — bug funcional silencioso que marca campanhas como `failed` com mensagem enganosa.
3. **Estado terminal errado** (`sent` com 0 envios; `sending` sem recuperação; fora-de-janela → `failed`).
4. **Sem opt-out do destinatário** (3.5/3.8) — conformidade.
5. **Contadores de campanha infláveis** por corrida no dedupe do webhook (sem unique constraint em `EmailEvent`).

**P2 (endereçar no ciclo):**

6. Webhook devolve 200 em erro interno → perde retry do Resend.
7. `deductCredits` com valor absoluto (lost update) — mesmo mantendo escopo atual, deveria ser `increment` atômico.
8. Supressão dupla (flags EmailContact vs. consentimento CDP) sem ponte — um opt-out CDP não marca `isUnsubscribed` e vice-versa.
9. Cron reset mensal sem retry e sem try/catch por item.
10. UseCases de e-mail fazem Prisma direto (allowlist `nonRepositoryDatabaseAccessAllowlist`) e crons fazem Prisma em rota (allowlist) — legado tolerado, mas o cron de dispatch tem 288 linhas de lógica de negócio **na rota**, duplicando o fluxo do UseCase com divergências reais (logs de falhados, CDP, restauração de status). Unificar é pré-requisito para não corrigir cada bug duas vezes.
11. Mapeamento por índice na resposta do `batch.send`.
12. `dispatchAllowedRoles`/`templateCreateRoles` letra morta (3.2).

**P3 (higiene):**

13. `EMAIL_TEST_MODE` com e-mail pessoal hardcoded como fallback (`EmailService.ts:613`).
14. `spec/email-dispatch.md` descreve um job model que nunca foi implementado — spec e código divergem; atualizar ou arquivar.
15. Cobertura de testes ~509 linhas, quase toda em utilitários puros. **Zero testes** em: `EmailCampaignUseCase`, `EmailCreditService`/`UseCase`, `EmailContactListUseCase`, ambos os crons. Para um módulo tratado como financeiro, é o débito mais barato de quitar e o que mais destrava as correções acima.

**Pontos positivos (manter):** lock atômico de status; idempotencyKey por chunk no Resend; verificação svix; proteção contra regressão de status; frontend 100% no padrão `features/`; interpolação com validação de tokens não resolvidos antes do envio; versionamento + aprovação de templates.

---

## 6. Investigação MCP — resultados (executada 2026-07-06)

**Fontes:** Supabase MCP (projeto `corretor-studio`, produção, sa-east-1), Vercel MCP (runtime logs, projeto `prj_4Hlw...`) e export `corretor-studio-log-export-2026-07-05T09-31-49.json` (22.522 linhas, 24h: 04/07 09:30 UTC → 05/07 09:29 UTC).

### 6.1 (d) Campanhas `scheduled` vencidas — **0 hoje, com kill confirmado**

`SELECT ... WHERE status = 'scheduled' AND "scheduledAt" <= now()` → **0 linhas**. A única campanha `scheduled` ("Live Agora") está agendada para 09/07 — futura. Porém o histórico completo (8 campanhas em produção) mostra o destino da última agendada que venceu:

| Campanha | Agendada para | Status | errorMessage | Recip./Enviados |
|---|---|---|---|---|
| `teste de e-mail` (763ffa02) | 04/07 21:00 UTC | **failed** | **"Sem assinatura de créditos ativa"** | 2 / 0 |
| `Live Agora` (36f1e240) | 09/07 11:55 UTC | scheduled | — | 0 / 0 |
| `Convite 02/07` (b98e72cb) | — (manual) | draft | "Erro interno durante o disparo" | 378 / 0 |
| `Campanha nova` (7f513f2f) | — (manual) | **failed** | "Erro interno durante o disparo" | 4 / **4** |
| `teste de e-mail` (eb2229ce) | — (manual) | **failed** | "Erro interno durante o disparo" | 4 / **4** |
| `teste 2`, `Ola mundo`, `19.06.26` | — (manual) | **sent** | — | 2/0, 2/0, 0/0 |

Leituras diretas: (i) o kill por créditos no cron **aconteceu** — e o mesmo Time disparou manualmente com sucesso via bypass beta; (ii) duas campanhas estão `failed` com `errorMessage` de erro interno **apesar de terem enviado 4 e-mails** (erro pós-envio no fluxo manual sobrescreve o resultado real); (iii) três campanhas `sent` com `totalSent = 0` — confirmação do achado 3.3-1.

### 6.2 Dispatches — retentativas em série e `sending` eterno

| Padrão | Evidência |
|---|---|
| **6 dispatches `failed` consecutivos** | `Convite 02/07`: dispatchNumber 1–6 entre 01/07 19:45 e 02/07 12:14, todos 378 destinatários / 0 enviados — usuário retentou 6× em 2 dias sem nenhuma mensagem útil |
| **`sending` sem recuperação** | dispatch nº 2 de `Campanha nova` e de `teste de e-mail` presos em `sending` desde 01/07 (4+ dias) — confirma 3.3-2 no nível de dispatch |
| **`completed` com 0 enviados** | dispatches de `teste 2`, `Ola mundo`, `19.06.26` estão `completed` com `totalSent = 0` |

### 6.3 `email_logs` — 98,5% dos logs de campanha presos em `queued`

| categoria/status | total | sem `resendEmailId` |
|---|---|---|
| campaign / **queued** | **545** | 545 |
| campaign / sent+delivered+opened+clicked | 8 | 0 |
| meeting_invite / sent+delivered | 2 | 0 |

Os 545 `queued` são os logs pré-criados pelo fluxo manual (`createQueuedTeamEmailLogs`) de dispatches que falharam — o `markTeamEmailLogFailed` só roda se o `dispatchBatch` retorna; exceção no meio deixa tudo `queued` para sempre. Nenhum log órfão foi criado pelo backfill do webhook (o enrichment falha sem `team_id`, como previsto em 4.2) — os 124 órfãos simplesmente **não existem** em `email_logs`.

### 6.4 Créditos — o billing nunca contabilizou nada

| Métrica | Valor em produção |
|---|---|
| Assinaturas de crédito | 2 (ambas `canceled`, **0 ativas**) |
| `creditsUsed` acumulado (todas as usages) | **0** |
| `overageCharged` acumulado | **R$ 0,00** |
| Contatos | 1.114 (0 unsubscribed, 0 bounced, 0 complained) |
| `email_events` | 13 |

Todo envio que já saiu, saiu por bypass beta sem contabilização. O cron `reset-credits` não aparece na janela do export (roda dia 1 do mês — cadência não observável nesta amostra).

### 6.5 Cron `dispatch-scheduled` (Vercel) — cadência saudável, kill silencioso

- **288 execuções distintas em 24h** = exatamente `*/5 * * * *` conforme `vercel.json`. ✅
- 100% HTTP 200; duração p50 **67ms**, máx **1,7s** — sem timeouts nem cold starts mascarando falhas. ✅
- **Única mensagem distinta em 1.164 linhas:** `[EmailCronDispatch] 0 campanhas disparadas nesta execução` — inclusive na execução que marcou a campanha 763ffa02 como `failed`. Matar campanha sem logar nada é gap de observabilidade (3.3).

### 6.6 Webhook Resend + órfãos + 429 (24h)

- 306 requests no webhook, todos 200.
- **298 linhas de órfão / 124 dispatch IDs distintos** (`E-mail órfão sem team_id nas tags`), concentrados às 11h e 17h UTC — janelas dos envios de backoffice/`meeting-follow-up` (bate com a tabela de caminhos sem tags em 4.1).
- Eventos processados: **220 para dispatches de backoffice, 0 para `EmailLog` de produto**, 86 "Registro não encontrado".
- **8× `rate_limit_exceeded`**: 6 no enrichment do webhook (rajadas de até 5 hits em 6s) e **2 no caminho de envio** do cron `meeting-follow-up` — envio transacional real sendo perdido por 429, não só enrichment.

---

## 7. Débito técnico consolidado

| Item | Onde | Classe |
|------|------|--------|
| Assinatura de créditos por Profile, não por Time | schema + 3 call sites | arquitetural |
| Sem checagem de saldo, overage sem teto e sem cobrança | EmailCreditService + reset cron | financeiro |
| Cron de dispatch duplica UseCase com divergências | dispatch-scheduled/route.ts | arquitetural |
| Sem opt-out público + sem link de descadastro | módulo inteiro | conformidade |
| Import síncrono sem fila/retry/notificação | EmailContactListUseCase | escala |
| Tags de rastreio opcionais nos caminhos não-campanha | EmailService + 2 services | observabilidade |
| Enrichment síncrono na API do Resend por evento | ResendEmailEnrichmentService | rate limit |
| Dedupe de eventos sem constraint única | EmailEvent | integridade |
| Zero testes nos fluxos de crédito/campanha/cron | módulo | qualidade |

---

## 8. Incidente de produção 2026-08-10 — fila de import travada + reconcile de disparo perde estado real

**Gatilho:** export de log de produção (`corretor-studio-log-export-2026-08-10T13-39-42.json`, 34.980 linhas, janela 01:47→13:38 UTC de 10/08 — já pós-deploy do fix do `CRON_OBSERVABILITY_SPEC.md`) + screenshots do usuário mostrando listas de contato do time **Kathrein Antunes** presas em "Importando (lote X/Y)" com contador `0`, e campanhas ("Golden Cross", "Médicos") com falhas confusas na UI. Investigado via Vercel MCP (`get_runtime_errors`), Supabase MCP (`execute_sql` no projeto `wcnxwdcoambpfwxwubka`) e leitura de código. Nenhum destes achados é regressão do fix do cron observability — são bugs pré-existentes, agora visíveis porque os crons voltaram a rodar de verdade.

### 8.1 (E1) Fila de import de e-mail travada — um job lento bloqueia todos os outros times 🔴

**Evidência (SQL em produção, 2026-08-10 ~13:55 UTC):** 49 jobs em `status: pending` na tabela `corretor_studio_email_import_jobs`, somando **48.378 linhas** nunca tocadas, o mais antigo esperando desde `2026-08-09 21:17:14` (~16h30). Times afetados: Kathrein Antunes, Evous Corretora, Avalanche de Vendas Unipessoal Ltda, entre outros.

**Causa raiz — fila serial + timeout sem checkpoint:**

- `processPendingJobs()` reivindica **um único job por execução de cron**, o mais antigo primeiro (`app/api/useCases/email/EmailContactImportUseCase.ts:437-450`). Enquanto um job não termina, os outros 48 nem são tentados.
- Dentro de um job, cada lote de 500 contatos sincroniza cada contato com o Radar **sequencialmente** (2 por vez, aguardando um a um — mesmo padrão N+1 do achado B4 do `RADAR_AUDIT.md` §9, agora numa segunda rotina): `EmailContactImportUseCase.ts:526-586`, chamando `syncEmailContactToRadarUseCase.execute()` → `RadarService.syncFromEmail` → `processEmailContactForRadar` (`RadarService.ts:680-734`), que faz 5+ round-trips sequenciais ao Postgres por contato (resolver perfil, 2× `upsertIdentity`, `upsertSourceLink`, `upsertConsent`).
- Esse trabalho não cabe no orçamento de `MAX_PROCESSING_MS = 45_000` (`ts:22`). Quando o tempo estoura **no meio do laço de sync do Radar** (`ts:538-559`), o job é reagendado (`status: "pending"`) **sem persistir quais contatos daquele lote já foram sincronizados** — `processedRows` só avança em `ts:588`, depois de todo o laço de Radar do lote terminar. O próximo tick do cron refaz o lote inteiro do zero.
- Esse caminho de timeout **não passa pelo `catch` de `ts:600-618`**, então `attemptsByBatch`/`failedBatches` nunca incrementam — confirmado no banco (`attemptsByBatch: {}`, `failedBatches: []]` nos 3 jobs consultados). **Não existe circuit breaker** para essa condição — só para exceções explícitas.

**Quantificação (histórico completo de `backoffice_cron_executions`, `cronKey = 'email-import'`, 02:20→13:55 UTC de 10/08):**

| Job (`importId`) | Linhas | Início→fim | Duração | Observação |
|---|---|---|---|---|
| `5b740d37` | 2.000 | 02:20→02:45 | 25 min | mais rápido da amostra (poucos lotes) |
| `2ce5eb7f` | 15.000 (updated) | 02:50→05:20 | 2h30 | preso em "lote 4" por 1h35 (11 execuções seguidas sem avançar) |
| `6073743f` | 41.000 (updated) | 03:20→12:20 | **9h00** | lote 7 sozinho levou 1h45 (09:15→11:00); lote 8, mais 1h |
| `9e9623c5` (Kathrein / lista "Médicos", 4.000 linhas) | em andamento | desde 12:25 | **>1h30 e contando** | preso no lote 5/8 desde 13:01 (14 execuções sem avançar até o fim da amostra) |

O campo `updatedCount` cresce muito além de `totalRows` (ex.: job `6073743f`, 41.000 updates para uma lista de 4.000 linhas) porque cada retomada de lote **refaz upserts que já tinham sido feitos** na tentativa anterior — trabalho de banco desperdiçado a cada 5 minutos, indefinidamente, sem nenhum limite.

**Impacto:** listas de contato ficam "travadas" na UI por horas (visto pelo usuário como "0" preso em "Importando (lote 1/10)"); qualquer time cujo job entrou na fila depois de um job lento de outro time fica bloqueado sem nenhuma relação causal visível — a fila de 49 jobs pendentes hoje representa múltiplos times esperando há mais de 16h sem qualquer sinal de erro (o cron sempre reporta `success` porque tecnicamente não lança exceção, só não termina).

### 8.2 (E2) Cota mensal do Resend esgotada — hoje é a maior fonte de erro de e-mail em produção 🔴 (operacional, não é bug de código)

**Evidência:** 179 dos 250 erros pós-deploy do cron observability são `statusCode: 429, name: 'monthly_quota_exceeded'` — 129 em `dispatch-scheduled`, 50 em `meeting-follow-up`. Campanha "Golden Cross (parte 1/2)" (time Kathrein Antunes, `campaignId 2608daaa-45a1-4813-bd89-23c40ff54d7f`): 135 tentativas de envio entre 11:10:37 e 11:41:22, **100% rejeitadas** pelo Resend por cota; `recoverStuckSendingCampaigns` (`EmailCampaignUseCase.ts:2364`, limiar `STUCK_SENDING_THRESHOLD_MS = 30 min`) marcou a campanha como `failed` às 11:45:26 com `totalSent: 0` — mensagem correta desta vez (`STUCK_SENDING`, não a genérica `INTERNAL`).

**Não é um bug a corrigir no código** — é decisão de negócio (upgrade do plano Resend ou aguardar reset do ciclo mensal). Registrado aqui porque explica a maior parte do volume de erro observado e porque lembretes de reunião reais (`meeting-follow-up`) também estão sendo bloqueados pela mesma causa.

### 8.3 (E3) Reconcile de disparo manual perde o total real quando falha por erro transitório de banco 🔴

**Evidência (SQL em produção, `corretor_studio_email_campaign_dispatches` join `corretor_studio_email_logs`):** 3 dispatches históricos com `status: failed`, `totalSent: 0`, `errorMessage: "Erro interno durante o disparo"` — mas os `EmailLog` reais do mesmo `dispatchId` mostram e-mails genuinamente enviados:

| Campanha | Time | `totalRecipients` | `totalSent` gravado | E-mails realmente `sent`/`delivered`/… |
|---|---|---|---|---|
| Rede D'Or . 001 | MultiSkill | 1.998 | **0** | **1.001** |
| LISTA FRIA - BRUNO (parte 12/12) | Meu studio | 914 | **0** | **795** |
| 17.07 | MultiSkill | 3.570 | **0** | **2.279** |

**Causa raiz:** `completeManualDispatch` (`EmailCampaignUseCase.ts:2000-2213`) chama `dispatchService.dispatchBatch(...)` de fato enviando os e-mails; se algo lançar exceção **depois** que alguns lotes já saíram (ex.: um erro transitório de conexão ao banco durante a escrita de `commitDispatchTerminalState`), o `catch` (`ts:2173`) chama `reconcileManualDispatchAfterError(job)` (`ts:2298-2353`), pensado exatamente para recuperar esse cenário contando o `EmailLog` real. O problema: essa própria função grava no banco via `commitDispatchTerminalState`, que só tem retry para deadlock/conflito de transação (`withDeadlockRetry`, `lib/email/with-deadlock-retry.ts:7-33` — cobre só `40P01`/`P2034`) — **não** para timeout de pool de conexão (`P1001`/`P2024`, a mesma classe de erro documentada no achado B2 do `RADAR_AUDIT.md` §9). Se o reconcile falhar por essa razão, a exceção é engolida silenciosamente (`.catch(() => null)`, `ts:2176-2179`) e o código cai no caminho genérico (`ts:2185-2213`) que marca `status: failed` + `errorMessage: "Erro interno durante o disparo"` **sem nunca gravar `totalSent`** — perdendo a informação de que a maior parte (ou quase tudo) já tinha sido enviado.

**Mitigação de risco já existente:** o critério de elegibilidade para "Reenviar apenas as falhas" (`lib/email/campaign-failed-recipients.ts:47-81`) usa o `status` por destinatário no `EmailLog`, não o agregado `totalSent` do dispatch — então **não há risco de duplicar envio** por causa deste bug; o problema é só a contagem/mensagem enganosas na UI (usuário lê "0 enviados" quando na real >50% já recebeu).

### 8.4 `url.parse()` DeprecationWarning — cosmético, baixa prioridade

`(node:N) [DEP0169] DeprecationWarning: url.parse()...` aparece 1x por cold-start em rotas sem relação entre si (`lead-form`, `leads`, `campaigns`, vários crons) — sinal de origem em processo/dependência carregada globalmente, não em código próprio (`grep "url.parse("` no repo não encontra ocorrência). Não causa nenhuma falha observada; não é bloqueante.

---

## 9. Auditoria da conta Resend (2026-08-10)

Consulta direta à API do Resend (`GET /domains`, `GET /api-keys`, `GET /webhooks`) usando a `RESEND_API_KEY` de produção do ambiente — só leitura, nenhuma alteração.

### 9.1 Domínios — 2 de 5 com CNAME de tracking falho; 1 time com disparo de campanha bloqueado 🔴

| Domínio | Região | Status | DKIM | SPF | Tracking (CNAME) | `open_tracking`/`click_tracking` |
|---|---|---|---|---|---|---|
| `corretorstudio.com` | sa-east-1 | `verified` | ok | ok | ok | — |
| `corretorstudio.com.br` | sa-east-1 | `verified` | ok | ok | ok | — |
| `perttoconsultoria.com.br` | us-east-1 | `verified` | ok | ok | ok | — |
| `mail.libercorretora.com.br` | sa-east-1 | **`partially_failed`** | ok | ok | **`failed`** | desligado (`false`/`false`) — inofensivo |
| `backstageclub.com.br` | sa-east-1 | **`partially_failed`** | ok | ok | **`failed`** | **ligado** (`true`/`true`) 🔴 |

**Achado (Resend, nível de provedor):** em ambos os domínios "partially_failed", DKIM e SPF estão verificados no Resend — o único registro que falha lá é o `CNAME` de tracking (`links.<domínio>` → `links1.resend-dns.com`), provavelmente porque o DNS nunca foi criado no provedor do cliente.

**Correção (review 2026-08-10, PR #728) — a frase "o envio funciona normalmente" acima estava errada para o time cujo status persistido bate com o do Resend.** `isResendDomainSendCapable` (`lib/email/campaign-dispatch-guards.ts:10-12`) só aceita `"verified"`/`"partially_verified"` — **não** aceita `"partially_failed"`. `EmailCampaignUseCase.ts:1765-1776` usa esse guard para bloquear o disparo manual inteiro (não só o tracking) com a mensagem "Domínio de e-mail não verificado no Resend". Conferido direto no banco (`email_team_settings`):

| Domínio | `resendDomainStatus` persistido no time | Efeito real |
|---|---|---|
| `backstageclub.com.br` (teamId `7b577c22-…`) | `partially_failed` (igual ao Resend) | **Disparo de campanha bloqueado agora** — não é só tracking quebrado, é a feature inteira indisponível para esse time, apesar de DKIM/SPF ok e do envio funcionar perfeitamente a nível de provedor. |
| `mail.libercorretora.com.br` (teamId `b874694b-…`) | `verified` (**dessincronizado do Resend**, que já mostra `partially_failed`) | Disparo segue liberado hoje (falso "ok" por status desatualizado) — mas se algo re-sincronizar esse status do Resend para o time, esse time também trava. |

**Duas ações, não uma:** (1) o guard da aplicação deveria distinguir capacidade de envio (DKIM/SPF) de tracking — hoje trata qualquer coisa que não seja `verified`/`partially_verified` como "não posso enviar", quando na real o Resend permite enviar com `partially_failed` (só o tracking que falha); (2) desligar tracking nesses domínios (ou orientar o cliente a criar o CNAME) resolve a causa raiz de qualquer forma. Recomendação: tratar em SPEC como um novo estágio — ajustar `isResendDomainSendCapable` para aceitar `partially_failed` (permitir envio, só avisar sobre tracking degradado) em vez de bloquear a funcionalidade inteira.

### 9.2 API keys — 6 chaves, metade sem uso recente 🟡 (higiene)

| Nome | Criada em | Último uso |
|---|---|---|
| `API key - Production` | 2026-07-21 | hoje (ativa) |
| `API Key - development` | 2026-07-21 | hoje (ativa) |
| `Corretor-Studio-AI-Integration` | 2026-06-03 | 2026-07-04 (>1 mês parada) |
| `Vercel - production` | 2026-07-20 | 2026-07-21 (não usada desde então) |
| `Vercel-production-2026-07-21` | 2026-07-21 | **nunca usada** |
| `Vercel - Homol` | 2026-07-20 | **nunca usada** |

**Achado:** duas chaves nomeadas "produção" (`Vercel - production` e `Vercel-production-2026-07-21`) não estão em uso — sugere rotação de chave feita sem revogar a anterior. Nenhum incidente decorre disso hoje, mas cada chave sem uso é superfície de risco desnecessária (se vazar, ainda funciona). Recomendação: revogar as 3 chaves sem uso recente (`Corretor-Studio-AI-Integration`, `Vercel - production`, `Vercel-production-2026-07-21`, `Vercel - Homol`) após confirmar com o dono que nenhum ambiente externo depende delas.

### 9.3 Webhooks — configuração de produção correta; 1 endpoint de dev esquecido ligado como `disabled` (ok)

Webhook de produção (`https://www.corretorstudio.com/api/webhooks/resend`) está `enabled`, assinando todos os eventos relevantes — incluindo `email.suppressed`, que a seção 3.5 do audit original cobra como parte da supressão. Existe um segundo endpoint apontando para um túnel `ngrok` de desenvolvimento, mas está `disabled` — não representa risco, só é lixo de configuração que pode ser removido.

### 9.4 Cota/uso mensal — não exposto pela API pública do Resend

Não existe endpoint público do Resend para consultar quota/uso restante — essa informação só está disponível no dashboard. A evidência de cota esgotada (achado 8.2) veio dos erros `429 monthly_quota_exceeded` observados nos logs de produção, não de uma consulta direta de saldo. Recomendação operacional: verificar o uso atual em `resend.com/settings/billing` e decidir sobre upgrade de plano — segue como decisão do dono (mesma nota do achado 8.2).

---

## 10. Incidente de produção 2026-08-10 — reenvio de falhas quebrado por colisão de idempotency key na retomada de dispatch travado

**Gatilho:** usuário reportou, com screenshots da tela de campanhas do time Kathrein Antunes, que a campanha "Maternidade" (parte 4/4) mostra o erro `Campanha já foi processada anteriormente. Se o problema persistir, entre em contato com o suporte.` no lugar de `Erro interno durante o disparo`, e perguntou se isso impede o botão "Reenviar apenas falhas". Investigado por leitura de código — a mesma tela mostrava, para referência, outras duas classes de erro em campanhas do mesmo time: `Erro interno durante o disparo` (Médicos, Advogados — coberto pelo achado E3/§8.3, já corrigido no Estágio 9) e `Disparo interrompido: tempo limite de envio excedido (30 min)` (Golden Cross — mesma causa do achado 8.2, cota mensal do Resend esgotada, operacional, não é bug de código).

### E4 — `resumeOrphanSendingDispatches` reindexa `chunkIndex` do zero na retomada, colidindo com a idempotency key da tentativa original 🔴

**Causa raiz confirmada em código:** a chave de idempotência de cada lote de envio ao Resend é `campaign/{dispatchId}/{chunkIndex}` (`app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService.ts:188-192`), onde `chunkIndex` é a posição do lote de 100 destinatários (`BATCH_SIZE`) **dentro da lista de destinatários daquela chamada específica** de `dispatchBatch`.

Quando um dispatch fica preso em `sending` por mais de 30 minutos (function do Vercel encerrada no meio do processamento), `resumeOrphanSendingDispatches` (`app/api/useCases/email/EmailCampaignUseCase.ts:2518+`) o retoma: reconstrói o `job` com **o mesmo `dispatchId`** da tentativa original, mas com uma lista de destinatários **diferente** — só os que ainda estão `EmailLog.status = "queued"` (`ts:2598-2604`, via `rebuildRecipientsForOrphanResume`), ou seja, um subconjunto menor dos originais (quem já foi processado com sucesso ou falha na tentativa anterior não entra de novo). Essa lista menor é refatiada em lotes de 100 **do zero** dentro de `dispatchBatch` — o `chunkIndex 0` da retomada contém destinatários **diferentes** do `chunkIndex 0` da tentativa original, mas usa a **mesma** idempotency key (`campaign/{dispatchId}/0`), que o Resend já tinha aceitado com o payload original.

**Resultado:** o Resend detecta a mesma chave com payload diferente e responde `409` com `idempotency` na mensagem (`EmailCampaignDispatchService.ts:42-44` traduz isso para `Campanha já foi processada anteriormente. Se o problema persistir, entre em contato com o suporte.`). Esse `409` não é tratado como retryable (`is-retryable-resend-batch-error.ts` — não foi conferido neste incidente se `409` está na lista de códigos retryable, mas mesmo que estivesse, re-tentar com a mesma chave e o mesmo payload menor continuaria colidindo).

**Por que "Reenviar apenas falhas" fica bloqueado, não só a retomada automática:** o botão "Reenviar apenas falhas" (`retryFailedOnly`, `EmailCampaignUseCase.ts:1792-1806`) cria um **novo** `dispatchId` (`randomUUID()`, `ts:1883-1884`) — em princípio livre de colisão. Mas a composição de destinatários do reenvio de falhas também é recalculada a cada clique (`resolveFailedRetryRecipientEmails`) e refatiada em `chunkIndex` do zero a partir de 0 — se essa lista de "falhas" também precisar ser retomada por timeout no meio do caminho (o mesmo dispatch de reenvio pode ficar `sending` e cair no mesmo `resumeOrphanSendingDispatches`), o mesmo padrão de colisão se repete dentro do **novo** dispatch. Ou seja, o bug não é exclusivo do dispatch original — qualquer dispatch (original ou de reenvio de falhas) que precise ser retomado após ficar preso em `sending` está exposto à mesma colisão.

**Escopo do achado:** confirmado por leitura de código, não reproduzido em teste automatizado nesta rodada — recomenda-se cobrir com teste de integração antes de corrigir (ver `EMAIL_SPEC.md`).
