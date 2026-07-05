# EMAIL_AUDIT.md — Auditoria do Módulo de E-mail (Corretor Studio)

**Data:** 2026-07-05
**Escopo:** Email Campaigns, Email Template Editor, crons (`dispatch-scheduled`, `reset-credits`), webhook Resend, créditos/billing, listas de contato, supressão e conformidade.
**Método:** `/impeccable` audit + critique — leitura factual do código confrontada contra o estado-alvo de 8 requisitos.
**Rodada somente-leitura:** nenhum código de produção foi alterado.

---

## ⚠️ Investigação MCP bloqueada nesta sessão

Os servidores MCP **Supabase**, **Vercel** e **Asaas** exigem autorização OAuth e não estão autenticados nesta sessão não-interativa. A investigação obrigatória (campanhas `scheduled` vencidas, taxa de e-mails órfãos, cadência real do cron) **não pôde ser executada**. As queries prontas estão na seção 6 — basta autorizar os conectores nas configurações de conectores do claude.ai (ou via `/mcp` em sessão interativa) e reexecutar.

Consequência direta: **a evidência de produção nº 3 ("cron sempre reporta 0 campanhas") permanece inconclusiva** — as três hipóteses (ausência real de campanhas, campanhas presas em `sending`, campanhas marcadas `failed` por bloqueio de janela) estão descritas em 3.3 e só o banco desempata.

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
2. **Não há checagem de saldo nenhuma antes do disparo**: `hasEnoughCredits()` só verifica se a assinatura está ativa — o comentário no código é explícito: *"Permite envio mesmo sem créditos (vai para overage)"*. Overage é ilimitado e **nunca é cobrado** (TODO explícito no cron de reset). O módulo de billing hoje é, na prática, um contador (`app/api/services/EmailCredit/EmailCreditService.ts:70-74`, `app/api/v1/email/cron/reset-credits/route.ts:71-76`).
3. **Nenhum link de descadastro em nenhum e-mail de campanha** e nenhuma página pública de opt-out. As flags de supressão são aplicadas no envio, mas o destinatário não tem como se descadastrar — só via bounce/complaint. Risco de conformidade (LGPD/CAN-SPAM) e de reputação de domínio.
4. **Causa raiz dos e-mails órfãos confirmada no código**: o caminho de campanha anexa `team_id` corretamente, mas três outros caminhos de envio **não anexam** — `EmailService.send` sem `tracking`, o envio de teste de template (tags só `templateId`/`purpose`) e o `BackofficeLeadScheduleInviteService` (payload sem `tags`). O 429 é sintoma: o enrichment busca o e-mail de volta na API do Resend, síncrono por evento de webhook, sem backoff.
5. **Campanha vira `sent` mesmo quando 0 e-mails saem**: tanto o cron quanto o disparo manual marcam `status: "sent"` incondicionalmente após o dispatch, mesmo com `result.sent === 0` (o dispatch fica `failed`, a campanha não). E não existe recuperação de campanhas presas em `sending` (timeout do Vercel no meio do lote = campanha travada para sempre).

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

- Bypass beta: `resolveEmailBetaAccess` permite disparo **sem assinatura nenhuma** (`EmailCampaignUseCase.ts:457-460`) e, quando `hasCredits === false` com beta, o `deductCredits` nem roda (`:584`) — envio sem contabilização.
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

**Evidência de produção nº 3 ("0 campanhas disparadas" em toda a janela)** — inconclusiva sem banco. Hipóteses ordenadas por plausibilidade dado o código: (a) campanhas CDP agendadas falhando no primeiro run e saindo do funil (`failed`); (b) campanhas mortas por janela UTC/data bloqueada; (c) campanhas presas em `sending` de execução anterior; (d) simplesmente não havia campanhas elegíveis. Queries na seção 6.

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

### 4.2 429 `rate_limit_exceeded` no enrichment

`createOrphanTeamEmailLogFromResendEmail` → `fetchEmailMetadata` → `resend.emails.get(id)` **síncrono, dentro do handler do webhook, um por evento, sem fila nem backoff** (`ResendEmailEnrichmentService.ts:24-45`, chamado de `ResendWebhookUseCase.ts:87-94`). Rajada de `delivered/opened` simultâneos → >10 req/s → 429. Nota: como 4.1 mostra, essa busca é **inútil para os órfãos atuais** — o e-mail no Resend também não tem a tag, então a chamada falha em recuperar `team_id` de qualquer forma (paga o rate limit e ainda devolve `null`). Corrigir a origem (tags no envio) elimina a causa; para o legado, fila com backoff exponencial (nunca síncrono no handler).

### 4.3 Cron "0 campanhas disparadas"

Inconclusivo sem banco (seção 6). Candidatos identificados no código, em ordem: bug CDP do cron (3.1/3.3-7), campanhas mortas por janela UTC/bloqueio (3.3-5/6), campanhas presas em `sending` (3.3-2).

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

## 6. Queries pendentes (executar quando o MCP for autorizado)

```sql
-- (d) Campanhas scheduled vencidas que o cron não processou — ACHADO CRÍTICO se > 0
SELECT id, "teamId", name, status, "scheduledAt", "cdpSegmentSlug", "errorMessage", "updatedAt"
FROM corretor_studio_email_campaigns
WHERE status = 'scheduled' AND "scheduledAt" <= now()
ORDER BY "scheduledAt";

-- Campanhas presas em sending (hipótese 3.3-2)
SELECT id, "teamId", name, "updatedAt"
FROM corretor_studio_email_campaigns
WHERE status = 'sending' AND "updatedAt" < now() - interval '30 minutes';

-- Campanhas CDP mortas pelo bug do cron (hipótese 3.1)
SELECT id, name, "cdpSegmentSlug", "errorMessage", "updatedAt"
FROM corretor_studio_email_campaigns
WHERE status = 'failed' AND "cdpSegmentSlug" IS NOT NULL;

-- Escala dos órfãos: logs criados pelo caminho de backfill vs. total
SELECT count(*) FILTER (WHERE "campaignId" IS NULL AND category = 'other') AS possiveis_orfaos,
       count(*) AS total,
       round(100.0 * count(*) FILTER (WHERE "campaignId" IS NULL AND category = 'other') / count(*), 2) AS pct
FROM corretor_studio_email_logs
WHERE "createdAt" >= now() - interval '7 days';
```

Vercel MCP: histórico de execuções de `/api/v1/email/cron/dispatch-scheduled` (cadência real, timeouts, cold starts) e frequência dos 429 em `/api/webhooks/resend`.

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
