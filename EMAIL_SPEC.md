# Spec: Evolução do Módulo de E-mail — Créditos por Time, Conformidade e Robustez de Disparo

**Data:** 2026-07-05 · **Atualizado:** 2026-08-10 (reavaliação `EMAIL_AUDIT.md` §0 — Estágios 1-7 majoritariamente já implementados; Estágios 8/9 propostos a partir do incidente §8; auditoria da conta Resend §9)
**Base:** `EMAIL_AUDIT.md` (mesma rodada + §0/§8/§9). Números de seção citados (ex.: 3.1, 8.1) referem-se ao audit.
**Status:** Estágios 1, 2, 3, 5, 6, 7 **implementados em produção** (confirmado por leitura de código em 2026-08-10 — ver `EMAIL_AUDIT.md` §0; nenhum destes tinha sido marcado como concluído no Decisions log até agora). Estágio 4 item 1 implementado; item 2 tinha ficado com desenho diferente do proposto — **decisão do owner (2026-08-10): precisamos de retry para as falhas** (ver D11/Estágio 10). Estágios 8/9/10 **propostos, não implementados** — 8 aguarda confirmação do trade-off de latência do Radar (D9); 9 e 10 podem seguir direto para implementação.

## Status de execução

| Estágio | Decisão(ões) | Estado real (2026-08-10) | Evidência |
|---|---|---|---|
| 1 — Fundação (cron unificado, estados terminais, bug CDP/Radar, timezone) | D7 | **implementado** | `EMAIL_AUDIT.md` §0 |
| 2 — Créditos por Time (migration + saldo atômico) | D1, D3, D8 | **implementado** | `EMAIL_AUDIT.md` §0 |
| 3 — Tags `team_id` obrigatórias + fim do 429 no enrichment | — | **implementado** | `EMAIL_AUDIT.md` §0 |
| 4 — Webhook hardening (dedupe por constraint + retry do provedor) | D11 | **item 1 (dedupe) implementado; item 2 (retry em falha de processamento) resolvido via D11/Estágio 10 — não implementado ainda** | `EMAIL_AUDIT.md` §0 |
| 5 — Descadastro público por Time | D5 | **implementado** | `EMAIL_AUDIT.md` §0 |
| 6 — Importação de contatos em background | D4 | **implementado (com bug ativo — ver Estágio 8/D9)** | `EMAIL_AUDIT.md` §0 e §8.1 |
| 7 — RBAC efetivo + editor HTML-only + reset-credits resiliente | D2, D6 | **implementado** | `EMAIL_AUDIT.md` §0 |
| 8 — Fila desacoplada de sync Radar do import | D9 | **proposto, não implementado** | aguarda confirmação do trade-off de latência |
| 9 — Reconcile resiliente do disparo manual | D10 | **proposto, não implementado** | pronto para implementar |
| 10 — Retry de falhas de processamento do webhook Resend | D11 | **proposto, não implementado** | pronto para implementar — decisão do owner já dada |

**Não coberto por nenhum estágio (non-goal desde julho):** cobrança real via Asaas — ver `Open questions` item 3.

---

## Background

O módulo de e-mail mistura billing (créditos, overage, ciclo mensal) com deliverability externa (Resend, webhooks, supressão). A auditoria encontrou: assinatura de crédito 1:1 por Manager conflitando com a cobrança por Time exigida; ausência total de checagem de saldo e de cobrança real; bug que impede campanhas CDP agendadas de disparar; ausência completa de opt-out do destinatário; import de contatos síncrono; e três caminhos de envio sem tag `team_id`, causando os e-mails órfãos e o 429 do Resend em produção.

### Lacunas (da auditoria)

- 3.1 Créditos por Manager, sem saldo, sem lock, sem cobrança — `não existe` o modelo por Time.
- 3.2 RBAC: operator sem escrita (ok), mas `dispatchAllowedRoles` é letra morta.
- 3.3 Cron dispatch: lock ok, mas `sent` com 0 envios, `sending` sem recuperação, janela em UTC, fora-de-janela → `failed` terminal, bug CDP.
- 3.4 Reset: idempotente por acidente, sem try/catch por item, overage nunca cobrado (TODO).
- 3.5/3.8 Supressão aplicada no envio, mas **nenhum** link de descadastro nem página pública.
- 3.6 Editor HTML: praticamente pronto (frontend já força `"html"`); resta higiene de schema e tags do teste.
- 3.7 Import: 100% síncrono, sem fila, sem retry por lote, sem notificação.
- 4.x Órfãos/429: tags ausentes em 3 caminhos de envio + enrichment síncrono por evento.
- 8.1 (incidente 2026-08-10) Import assíncrono (Estágio 6) já existe, mas o sync síncrono com o Radar dentro do lote não cabe no orçamento de tempo do cron — fila inteira trava atrás de um job lento, sem circuit breaker.
- 8.3 (incidente 2026-08-10) `reconcileManualDispatchAfterError` só tem retry para deadlock, não para timeout de pool — quando falha, perde o `totalSent` real e mostra "0 enviados" com e-mails já entregues.

## Goals

### Primários (must-have)

1. Crédito **por Time**: saldo verificado antes de todo disparo, decremento atômico sem estouro por corrida.
2. Todo e-mail de campanha com link de descadastro funcional + página pública por Time (token opaco).
3. Cron de dispatch com estados terminais corretos, recuperação de `sending` travado e fix do bug CDP.
4. Tag `team_id` obrigatória em todos os envios de produto; enrichment nunca síncrono no handler do webhook.
5. Import de contatos assíncrono (CSV + JSON) com lotes, retry isolado, `importId` em todos os logs e notificação in-app ao concluir.
6. Cobertura de testes (unit + integração) para todo UseCase, rota e cron do módulo — pré-requisito de cada estágio, padrão WhatsApp.

### Secundários

7. Webhook Resend com dedupe garantido por constraint e retry do provedor em falha interna.
8. `dispatchAllowedRoles` como fonte de verdade do RBAC de disparo (fim da letra morta).
9. Higiene do editor HTML-only: default de schema, `mailyJson` legado somente-leitura.

## Non-Goals

- **Cobrança real no Asaas** (assinatura de créditos e overage): gap reportado (audit 3.4/5.1); exige decisão comercial do owner. A spec prepara o terreno (usage por Time correto), mas não implementa cobrança nesta rodada.
- Editor visual Maily/TipTap (os 6 estágios de paridade com o Resend seguem como frente própria, não bloqueante).
- Fila externa (SQS/QStash etc.) — padrão da stack é tabela + cron Vercel.
- Migrar UseCases de e-mail para repositórios (allowlist mantida; apenas código novo segue o padrão).
- Multi-domínio por sender ou mudanças no fluxo de verificação de domínio Resend.

---

## Decisões arquiteturais

### D1 — Créditos por Time: mover FK para `teamId @unique` (recomendado), com migração de dados a decidir ⚠️

**Opção A (recomendada): `EmailCreditSubscription.teamId @unique`** — 1 assinatura por Time. Simples, consistente com todo o resto do módulo (`EmailCampaign`, `EmailTemplate`, `EmailContactList`, `EmailLog` já são por `teamId`), e o `EmailCreditUsage` continua pendurado na assinatura sem mudança.
**Opção B: tabela de junção Team↔Subscription** — só faz sentido se um pool puder ser compartilhado entre Times, que é exatamente o modelo que o requisito rejeita. Descartada salvo objeção do owner.

**Migração de dados (pergunta bloqueante (c) — opções para o owner):**

| Estratégia | O que faz | Trade-off |
|---|---|---|
| **M1 (recomendada)** | Realoca a assinatura existente para o **Time ativo** do master (ou único Time, quando só há um); demais Times ficam sem assinatura até contratar | Preserva ciclo e uso corrente; masters multi-time precisam assinar para os outros Times — comunicar antes |
| M2 | Clona a assinatura para **cada** Time do master, dividindo `monthlyCredits` igualmente | Nenhum Time fica sem envio, mas muda o valor contratado sem consentimento e complica o `creditsUsed` corrente |
| M3 | Zera tudo e recomeça o ciclo no dia da migração | Mais simples, porém perde histórico do período e "presenteia" crédito cheio no meio do mês |

Como hoje **não há cobrança real** (audit 3.1/3.4), o custo de M1 é baixo: nenhuma fatura é afetada. Decisão registrada no Decisions log ao fechar.

### D2 — RBAC de operator: leitura mantida, escrita governada por `dispatchAllowedRoles` ⚠️

Hoje (audit 3.2): operator lê analytics/logs/status e não escreve nada; `dispatchAllowedRoles`/`templateCreateRoles` não têm efeito. Opções para o owner:

- **O1 (recomendada):** rotas de disparo/criação passam a consultar `EmailTeamSettings` (com default atual `manager,backoffice`) — o master decide por Time se operator dispara/cria. Zero mudança de comportamento default; o setting deixa de ser letra morta.
- O2: operator permanece leitura-somente e os settings de roles saem da UI de configurações.
- O3: operator sem acesso nenhum ao módulo (esconder do sidebar via featureSlug).

### D3 — Lock de crédito: decremento condicional atômico + verificação de saldo real

`hasEnoughCredits` passa a comparar `monthlyCredits - creditsUsed >= totalRecipients` (por Time). O decremento vira um único statement condicional dentro do fluxo de disparo, escopado por `teamId`:

```sql
UPDATE corretor_studio_email_credit_usages u
SET "creditsUsed" = u."creditsUsed" + $amount
FROM corretor_studio_email_credit_subscriptions s
WHERE u."subscriptionId" = s.id AND s."teamId" = $teamId
  AND u."periodStart" <= now() AND u."periodEnd" >= now()
  AND u."creditsUsed" + $amount <= s."monthlyCredits"   -- guard de saldo no próprio UPDATE
```

`rowCount === 0` ⇒ sem saldo ⇒ disparo bloqueado **antes** de qualquer chamada ao Resend. Reserva-se `totalRecipients` antes do envio e devolve-se a diferença (`totalRecipients - sent`) no `finally` — dois disparos simultâneos do mesmo Time nunca passam ambos com saldo insuficiente. Overage deixa de ser automático: sem saldo = bloqueio (até existir cobrança real, ver Non-Goals).

### D4 — Import assíncrono: tabela `email_import_jobs` + cron (mesmo padrão da stack)

Sem worker dedicado. Tabela com `status pending/processing/completed/failed`, payload em storage (não inline quando grande), `importId` único, contadores por lote, `attempts` por lote. Cron a cada minuto\* faz claim atômico (`UPDATE ... WHERE status='pending'` com `count` check — mesma disciplina do lock de campanha) e processa N lotes por invocação, re-enfileirando o job se não terminar (evita timeout). Lote com falha técnica: retry só daquele lote (máx. 3); linha inválida/duplicada: contabiliza, não retenta. (\*Vercel cron mínimo é 1/min; se o plano limitar, usar o cron de 5 min existente.)

### D5 — Token público de descadastro: HMAC opaco, sem IDs crus

Rota `app/email-unsubscribe/[token]/page.tsx` + `POST /api/v1/email/public/unsubscribe`. Token = `base64url(contactId + teamId + HMAC-SHA256(secret, contactId|teamId))` gerado no momento do envio e interpolado no footer. Página pública sem `getTeamAccess`; o UseCase valida o HMAC antes de qualquer escrita e marca `isUnsubscribed = true` no `EmailContact` — mesmo mecanismo de supressão do envio, sem caminho paralelo. Footer + header `List-Unsubscribe`/`List-Unsubscribe-Post` injetados em todo envio de campanha.

### D6 — Editor HTML-only: `editorMode` default `"html"`, `mailyJson` legado congelado

Schema muda o default para `"html"`; templates legados com `mailyJson` permanecem legíveis mas o campo não é mais gravado por nenhum fluxo novo. `html` é a única fonte de verdade de envio (já é hoje — audit 3.6).

### D7 — Cron de dispatch unificado no UseCase

A rota do cron (288 linhas de negócio) passa a chamar o mesmo caminho do disparo manual (`EmailCampaignUseCase.send` parametrizado para contexto de sistema), eliminando as divergências já encontradas (CDP, logs de falhados, restauração de status). Rota fica fina: auth do `CRON_SECRET` + seleção de campanhas + loop.

### D8 — Beta = isenção total de créditos e cobrança (decisão do owner, 2026-07-06)

**Regra:** se a funcionalidade está com a tag **Beta habilitada** (`betaEnabled` na feature `email-campaigns`/`email` do backoffice, resolvida por `resolveEmailBetaAccess` com herança via `inheritParentSettings`), o disparo **não gera nenhuma cobrança e não valida créditos** — em **todos** os caminhos (disparo manual, cron de agendadas e qualquer fluxo futuro que consuma envio).

Consequências normativas:

1. **Sem validação:** o gate de saldo (D3) é completamente pulado quando beta — nada de `hasEnoughCredits`, nada de guard de saldo.
2. **Sem débito nem contabilização de créditos:** `reserveCredits`/`releaseCredits` não são chamados; nenhuma escrita em `EmailCreditUsage` (nem `creditsUsed`, nem `overageCount`, nem `overageCharged`). O consumo permanece observável via `email_logs`/analytics — que já registram cada envio por Time — sem passar pelo contador de billing.
3. **Sem cobrança:** nenhuma fatura/overage pode ser derivado de envios feitos sob beta, inclusive retroativamente quando a cobrança real Asaas existir.
4. **Ordem do gate em todo caminho de disparo:** `resolveEmailBetaAccess` primeiro; se beta ⇒ segue sem tocar no subsistema de créditos; senão ⇒ D3 (saldo + reserva atômica).
5. **UI:** Time beta não vê barra de saldo nem CTA de assinatura (comportamento atual do `CreditBalanceBar` é mantido); `EmailCreditUseCase.subscribe` continua recusando assinatura de usuário beta (comportamento atual).
6. Ao **desligar** o beta da feature, os Times voltam imediatamente para a regra padrão (sem assinatura ativa = disparo bloqueado) — comunicar antes de desligar.

### D9 — Sync do Radar no import de contatos vira fila desacoplada (outbox), fire-and-forget do lote ⚠️ decisão do owner

**Motivo:** achado E1 (`EMAIL_AUDIT.md` §8.1) — sincronizar cada contato com o Radar dentro do próprio laço de import é a causa raiz da fila travada (um job pode levar de 25 min a 9h; hoje há 49 jobs de múltiplos times esperando há 16h+ atrás de um único job lento). O código atual tem um comentário justificando o desenho síncrono atual (`EmailContactImportUseCase.ts:526-531`, referências a decisões "D6"/"I3" não localizadas em nenhum spec vigente): *"já deve constar na lista de segmentos assim que for importado" exige que o job só marque o import como concluído depois que os perfis existirem*.

**Trade-off que esta decisão reverte (⚠️ requer confirmação explícita do owner, não é escolha técnica):** com a fila desacoplada, o import de contatos passa a concluir (e notificar) **antes** de os perfis Radar existirem — o contato aparece em segmentos do Radar com um atraso de até alguns minutos (ciclo do novo cron), não instantaneamente.

**Desenho recomendado (segue o padrão de outbox já usado no repo — `TeamWebhookOutbox`, `prisma/schema.prisma:2739-2759`):**

1. Novo model `EmailContactRadarSyncOutbox`: `id`, `emailContactId`, `teamId`, `emailImportJobId` (FK opcional para `EmailImportJob`, nulo quando o gatilho não é um import em lote — ex. contato criado via API), `status` (`pending|processing|sent|failed`), `attemptCount Int @default(0)`, `nextAttemptAt`, `lastError String?`, `createdAt`/`updatedAt`. Índices `[status, nextAttemptAt]`, `[emailImportJobId, status]` e `[emailContactId]` (unique — um contato tem no máximo uma linha de outbox por vez).
2. `EmailContactImportUseCase.processPendingJobs()` **para de chamar o Radar diretamente**: após `upsertContactsBatch`, faz um **upsert** (não `createMany`/`skipDuplicates`) por `emailContactId` no outbox — contato novo cria a linha `pending`; contato já existente (reimport, atualização de `name`/`customFields`) **volta para `pending`** com `attemptCount: 0` e `emailImportJobId` atualizado para o job atual, mesmo que a linha anterior estivesse `sent`/`failed`. `createMany`/`skipDuplicates` deixaria uma linha `sent` de um import anterior parada para sempre e o Radar nunca receberia a atualização. `processedRows` avança imediatamente após o upsert — sem esperar Radar. Isso, sozinho, já reduz um job de horas para segundos (upsert de 500 linhas é rápido; o gargalo era só o Radar).
3. Novo cron `/api/v1/radar/cron/sync-email-contacts` (registrar em `vercel.json`, `*/5 * * * *`, `withCronAudit`): reivindica um lote de outbox (`updateMany` `pending→processing`, mesmo padrão de claim atômico do resto da stack), processa com concorrência limitada (ex. 5-10, não 2 sequenciais) via `RADAR_SYNC_CONCURRENCY` maior já que agora está isolado, marca `sent`/`failed` por linha com `attemptCount`/`lastError`; falha definitiva após N tentativas fica `failed` (visível, não trava nada).
4. `finalizeJob`/notificação de import concluído passam a informar quantos contatos **deste job** (`emailImportJobId = job.id`, não a lista inteira — um import anterior da mesma lista pode ter linhas pendentes independentes) aguardam sync do Radar; não bloqueia a notificação por isso.

**Alternativa (se o owner rejeitar o trade-off de latência):** manter síncrono, mas eliminar o N+1 — carregar `loadEngagementWeightsAndConfig` **uma vez por lote** (não por contato) e trocar os 5 round-trips sequenciais de `processEmailContactForRadar` por operações em lote (`createMany`/`upsertMany` quando o Prisma permitir, ou ao menos `Promise.all` com concorrência maior). Reduz a duração do lote mas não elimina o acoplamento — se a lista tiver múltiplos milhares de contatos, ainda pode estourar o orçamento de um cron. **Não recomendada como solução única**, mas pode ser aplicada em conjunto com D9 para o próprio consumidor do outbox.

### D10 — Reconcile de disparo manual resiliente a erro transitório de banco

**Motivo:** achado E3 (`EMAIL_AUDIT.md` §8.3) — `reconcileManualDispatchAfterError` (`EmailCampaignUseCase.ts:2298`) só recupera o `totalSent` real quando sua própria escrita no banco funciona de primeira; timeout de pool de conexão durante essa escrita apaga a evidência de que os e-mails já saíram.

1. `commitDispatchTerminalState` (`ts:2237`) passa a envolver a operação com `withPrismaRetry` (já existe em `app/api/infra/data/prisma.ts`, usado em `ProfileRepository`/`public-stats.ts`) além do `withDeadlockRetry` atual — cobrindo `P1001`/`P2024`/erros de conexão transitórios, não só deadlock.
2. Se, mesmo com retry, o reconcile falhar, o fallback genérico (`ts:2185-2213`) passa a tentar **uma leitura simples e isolada** de `emailLog.count(status in sucesso)` (sem transação, sem `$transaction`) só para popular `totalSent` corretamente antes de marcar `failed` — nunca gravar `totalSent: 0` quando existe log de sucesso para aquele `dispatchId`.
3. **Correção dos 3 registros históricos já incorretos** (`EMAIL_AUDIT.md` §8.3 — Rede D'Or . 001, LISTA FRIA - BRUNO parte 12/12, 17.07): script one-off (`bun run` local, não migration) que recalcula `totalSent`/`status` desses 3 dispatches a partir do `EmailLog` real. **Só roda com autorização explícita do owner** (escreve em produção) — reportar antes de executar.

### D11 — Retry de falhas de processamento do webhook Resend via fila interna (não via HTTP 500) — decisão do owner: **sim, precisamos de retry** (2026-08-10)

**Motivo:** achado `EMAIL_AUDIT.md` §0, linha do Estágio 4 item 2 — o webhook (`app/api/webhooks/resend/route.ts`) verifica a assinatura de forma síncrona (401 se inválida) mas processa o evento em `after()` fire-and-forget, sempre respondendo `200` antes de saber se o processamento deu certo. Se `resendWebhookUseCase.handle()` falhar por um erro transitório (timeout de pool, por exemplo — mesma classe de erro do achado B2/E3), o evento é perdido: só vira um `console.error`, e como já respondemos `200`, o Resend nunca tenta de novo.

**Por que NÃO simplesmente trocar para `500` em erro de processamento (reverter para o desenho original do Estágio 4):** a própria documentação do Resend recomenda o oposto — "Always return 200 quickly, then process asynchronously if needed" e lista "Returning non-200 status for valid webhooks" como erro comum a evitar. Responder `500` para um webhook que **foi recebido e é válido** (só falhou no nosso processamento interno) sujeita o endpoint ao retry automático do Resend (7 tentativas em até 10h, agendamento fixo, fora do nosso controle) e pode fazer o Resend nos marcar como endpoint problemático se isso acontecer com frequência (ex.: durante uma janela real de sobrecarga de banco, toda a fila de eventos daquele período entraria no retry schedule do Resend simultaneamente).

**Desenho recomendado (mesmo padrão de outbox já usado no repo — `TeamWebhookOutbox`, `BackofficeEmailOrphanEvent`, e o outbox proposto no D9):** retry **interno**, não dependente do Resend re-entregar.

1. Novo model `ResendWebhookProcessingFailure`: `id`, `svixId String @unique` (idempotência — uma falha por entrega, mesmo que o `after()` rode mais de uma vez), `eventType String`, `payload Json` (o evento já verificado, para reprocessar sem depender do Resend reenviar), `status` (`pending|processing|resolved|failed`), `attemptCount Int @default(1)`, `nextAttemptAt`, `lastError String?`, `createdAt`/`updatedAt`. Índice `[status, nextAttemptAt]`.
2. `app/api/webhooks/resend/route.ts`: no `catch` do `after()` (hoje só `console.error`), fazer upsert por `svixId` em `ResendWebhookProcessingFailure` com o payload já verificado e o erro.
3. Novo cron `/api/v1/email/cron/retry-resend-webhook-failures` (registrar em `vercel.json`, `*/5 * * * *`, `withCronAudit`): reivindica um lote `pending` (`updateMany` atômico), chama `resendWebhookUseCase.handle({ event: JSON.parse(payload) as ResendWebhookPayload, svixId })` de novo — seguro porque o dedupe por `EmailEvent.@@unique([logId, type, occurredAt])` já garante idempotência mesmo se parte do processamento anterior tiver aplicado antes de falhar. Sucesso → `resolved` (ou apaga a linha); falha → incrementa `attemptCount`/`lastError`, backoff simples, até um teto (ex. 5 tentativas) → `failed` (dead-letter visível, não trava nada).
4. Sem mudança no contrato HTTP do webhook: continua sempre `200` para evento válido (mantendo a recomendação do Resend), `401` para assinatura inválida, `400` para headers ausentes, `503` quando o semáforo de concorrência está cheio (o Resend já retenta `503` pelo próprio retry schedule — esse caso não precisa do outbox).

---

## Estágios de implementação

> Regras transversais (valem para todos): `Route → UseCase → [Service] → Prisma`; UseCase retorna `Output`; `TeamContext` resolvido uma vez via `getTeamAccess()`; migrations só via `bun run db:migrate:from-prisma`/`db:migrate:new` (remoto só com autorização do owner); testes unit + integração **antes de considerar o estágio concluído**; validação `typecheck → lint → governance:check → lint:pt-br` (+ `design:check` quando tocar UI); atualizar Postman a cada rota nova; tokens semânticos, sem hex em TSX.

### Estágio 1 — Fundação: testes de caracterização + cron unificado + estados terminais

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seções 3.3, 5) e agents.md. No módulo de e-mail do lead-flow-app:

1. Crie testes de caracterização (bun test) para EmailCampaignUseCase.send,
   EmailCreditService (getStatus/hasEnoughCredits/deductCredits) e para a lógica do cron
   app/api/v1/email/cron/dispatch-scheduled/route.ts, cobrindo o comportamento ATUAL
   (inclusive os bugs) antes de qualquer mudança.
2. Extraia o corpo do cron para o EmailCampaignUseCase (método dispatchScheduled ou
   send parametrizado com contexto de sistema), deixando a rota apenas com: auth via
   CRON_SECRET, seleção de campanhas elegíveis e loop com try/catch por campanha.
   O caminho unificado DEVE: repassar cdpSegmentSlug ao buildCampaignDispatchInput
   (fix do bug que mata campanhas CDP agendadas); aplicar o MESMO gate de créditos do
   fluxo manual — hasEnoughCredits OU resolveEmailBetaAccess — em vez de só
   hasEnoughCredits (fix do kill silencioso confirmado em produção: audit 6.1 —
   toda campanha agendada morre com "Sem assinatura de créditos ativa" enquanto o
   disparo manual do mesmo Time funciona); logar console.error com campaignId e motivo
   sempre que uma campanha for marcada failed pelo cron; pré-criar EmailLog queued para
   todos os destinatários e marcar failed os não enviados (paridade com o manual).
3. Corrija os estados terminais: campanha só vira "sent" se result.sent > 0 — caso
   contrário "failed" com errorMessage; campanha fora da janela de horário ou em data
   bloqueada PERMANECE "scheduled" (log informativo), não vira "failed"; adicione
   recuperação de travadas: campanha em "sending" com updatedAt > 30 min é retomada ou
   marcada "failed" no início de cada execução do cron (transição atômica via updateMany).
4. Mova o lock scheduled→sending para ANTES do credit check e do build de destinatários.
5. Exporte maxDuration adequado nas rotas de cron.
6. Avalie a janela de disparo no timezone do master (resolveTimezone), não em UTC.
Atualize os testes para o comportamento novo. Rode a sequência de validação completa.
```

**Não tocar:** schema Prisma; EmailCreditService (escopo/assinatura — Estágio 2); webhook Resend; frontend.

**Aceite:** campanha CDP agendada dispara; campanha agendada de Time beta (sem assinatura) dispara — paridade com o manual; `sent` nunca ocorre com `totalSent === 0`; campanha fora de janela dispara na janela seguinte; nenhuma campanha vira `failed` sem linha de log com o motivo; execução dupla simulada do cron não duplica envio nem trabalho pesado; testes verdes cobrindo cada caso.
**Validação manual:** agendar campanha CDP e campanha com lista para daqui a 5 min em ambiente local; rodar o cron duas vezes em paralelo (`curl` concorrente); conferir `email_campaigns`/`email_logs`.

### Estágio 2 — Créditos por Time (migration + saldo real + lock atômico) ⚠️ depende de D1

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 3.1) e a decisão D1/M1 registrada em EMAIL_SPEC.md. Então:

1. Schema: em prisma/schema.prisma, troque EmailCreditSubscription.profileId @unique por
   teamId @unique (relação com Team). Gere a migration com
   bun run db:migrate:from-prisma -- email-credit-subscription-per-team.
   NÃO aplique no remoto sem autorização do owner.
2. Migration de dados (bun run db:migrate:new migrate-email-credit-to-team): SQL
   idempotente que realoca cada assinatura existente para o Time ativo do master
   (Profile.activeTeamId; fallback: primeiro Team onde masterId = profileId),
   preservando plano, período e usages.
3. EmailCreditService: todos os métodos passam a receber teamId. hasEnoughCredits(teamId,
   requiredAmount) retorna true somente se houver assinatura ativa E
   monthlyCredits - creditsUsed >= requiredAmount no período corrente.
   deductCredits vira reserveCredits(teamId, amount): UPDATE condicional atômico
   ($executeRaw) com guard de saldo no WHERE, conforme D3 da spec; rowCount 0 = sem
   saldo. Adicione releaseCredits(teamId, amount) para devolver a diferença
   (reservado - efetivamente enviado) no finally do disparo.
4. EmailCampaignUseCase e cron (já unificados no Estágio 1): reservar
   totalRecipients antes do dispatchBatch, liberar a sobra depois; sem saldo =>
   Output inválido "Créditos insuficientes para N destinatários. Saldo: X" sem chamar
   o Resend. Beta = isenção TOTAL (D8): quando resolveEmailBetaAccess for true,
   pular o subsistema de créditos inteiro — sem hasEnoughCredits, sem
   reserveCredits/releaseCredits, nenhuma escrita em EmailCreditUsage. O gate beta
   é avaliado ANTES de qualquer lógica de saldo, em todos os caminhos de disparo.
5. EmailCreditUseCase.subscribe/status/cancel: escopo teamId (ctx.teamId); reset-credits
   cron: ajuste o include (team em vez de profile) mantendo o TZ do master; adicione
   try/catch por assinatura no loop.
6. Frontend: EmailCreditsCard (subscription) e a página de campanhas exibem o saldo do
   TIME ativo (GET credits/status já escopado). Testes unit para o guard de saldo, o
   release e a corrida (duas reservas concorrentes via Promise.all com transações reais).
Atualize Postman. Rode a validação completa.
```

**Não tocar:** cobrança Asaas (non-goal); webhook; import de contatos; templates.

**Aceite:** duas requisições de disparo simultâneas do mesmo Time com saldo para apenas uma → exatamente uma passa; Time sem assinatura não dispara (**exceto beta — D8**); Time com beta habilitado dispara sem nenhuma escrita em `EmailCreditUsage`; Time B do mesmo master não consome saldo do Time A; migration replay ok em `db:migrate:reset:local`; testes de concorrência verdes (incluindo o caso beta: disparo concorrente beta + não-beta não interfere no saldo).
**Validação manual:** criar dois Times para o mesmo master local, assinar em um só, verificar disparo bloqueado no outro; `Promise.all` de dois sends com saldo unitário.

**Mockup — Campanhas (antes/depois):**

```
ANTES  ┌ Campanhas ───────────────────────────────┐   (saldo só na página Assinaturas,
       │ [Nova campanha]                          │    pool único do Manager)
       │ Lista de campanhas…                      │
       └──────────────────────────────────────────┘

DEPOIS ┌ Campanhas ───────────────────────────────┐
       │ [Nova campanha]   Créditos do time:      │  ← Badge com saldo do TIME ativo
       │                   3.412 / 5.000 · Renova │    (token semântico, Badge shadcn)
       │                   em 01/08               │
       │ Lista de campanhas…                      │
       │ (Disparar desabilitado + tooltip quando  │
       │  destinatários > saldo)                  │
       └──────────────────────────────────────────┘
```

### Estágio 3 — Tags obrigatórias + fim do 429 (órfãos na origem)

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 4). Correção na origem dos e-mails órfãos e do 429:

1. lib/services/EmailService.ts: torne o parâmetro tracking obrigatório no tipo de
   options para chamadas de produto (crie uma sobrecarga explícita untracked() para os
   raros envios intencionalmente sem time, com comentário justificando). Corrija TODOS
   os callers que hoje não passam tracking — mapeie-os com grep antes.
2. EmailTemplateUseCase.sendTest: incluir buildResendTrackingTags({ teamId: ctx.teamId,
   category: "transactional", sourceType: "template-test", sourceId: id }) preservando
   as tags atuais.
3. BackofficeLeadScheduleInviteService: anexar tags equivalentes do módulo backoffice
   (sem team_id de produto — usar as tags que o BackofficeEmailDispatch já sabe ler),
   mantendo o isolamento de módulos do agents.md.
4. ResendEmailEnrichmentService: remova a chamada síncrona resend.emails.get do fluxo
   do webhook. O backfill de órfãos legados vira best-effort fora do handler: se o
   evento não tem tags e o log não existe, registre em uma tabela
   email_orphan_events (migration via db:migrate:new) e processe em lote no cron de
   5 min existente com no máximo 8 req/s e backoff exponencial em 429.
5. Testes: unit para cada caminho de envio garantindo presença de team_id nas tags
   (asserção no payload passado ao Resend mockado); teste do backfill com 429 simulado.
Rode a validação completa. Atualize Postman se criar rota.
```

**Não tocar:** fluxo de campanha (`EmailCampaignDispatchService` já anexa tags corretas); schema de EmailLog; webhook signature/dedupe (Estágio 4).

**Aceite:** grep de `resend.emails.send`/`batch.send` no repo → 100% dos call sites de produto com `team_id`; webhook nunca chama `emails.get` inline; zero `[ResendEmailEnrichmentService] Falha ao buscar e-mail: 429` em teste de rajada (50 eventos simultâneos mockados).
**Validação manual:** enviar teste de template local e conferir tags no dashboard do Resend (ou mock); disparar rajada de webhooks assinados contra o handler local.

### Estágio 4 — Webhook hardening (idempotência garantida + retry do provedor)

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 3.5). No webhook do Resend:

1. Migration (bun run db:migrate:from-prisma): adicione svixId String? @db.Text a
   EmailEvent com @@unique([logId, type, occurredAt]) — dedupe vira constraint, não
   check-then-act. applyWebhookEvent captura P2002 e trata como duplicado silencioso
   (os incrementos de campanha ficam DENTRO da mesma transação do create do evento,
   condicionados ao sucesso do insert).
2. app/api/webhooks/resend/route.ts: erro interno de processamento passa a responder
   500 (o Resend faz retry); assinatura inválida continua 401; secret ausente continua
   200 com console.error (não há o que retryar).
3. Adicione isComplained: false ao filtro de findActiveRecipientsForList/ForTeam.
4. Escopo de supressão: bounce continua global por e-mail (endereço inválido é global);
   complaint passa a marcar isComplained/isUnsubscribed apenas nas listas de times cujo
   teamId aparece em EmailLog do destinatário — documente a regra no código.
5. Testes: reentrega duplicada concorrente (Promise.all) não duplica EmailEvent nem
   infla totalDelivered; bounced não regride para sent; retry pós-500 reprocessa com
   sucesso.
Rode a validação completa.
```

**Não tocar:** fluxo backoffice do webhook (`backofficeEmailDispatchUseCase`); CDP handler (apenas mantenha o try/catch existente).

**Aceite:** teste de corrida verde; contadores de campanha estáveis sob reentrega; evento com falha de banco gera retry do Resend em vez de sumir.
**Validação manual:** reenviar o mesmo payload svix 3x contra o handler local e conferir `email_events`/contadores.

### Estágio 5 — Descadastro público por Time (página + link + headers)

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seções 3.5/3.8) e D5 da spec. Implemente o opt-out público:

1. lib/email/unsubscribe-token.ts: gerar/validar token HMAC-SHA256 opaco
   (payload contactId+teamId, secret EMAIL_UNSUBSCRIBE_SECRET, base64url, sem expor
   UUIDs crus). Testes unit de gerar/validar/tamper.
2. Rota pública POST /api/v1/email/public/unsubscribe: Route → UnsubscribeUseCase
   (Output) → marca isUnsubscribed = true no EmailContact do token válido; token
   inválido = 400 genérico sem vazar existência. Sem getTeamAccess (página pública);
   rate-limit simples por IP. GET /api/v1/email/public/unsubscribe/[token]/info retorna
   nome do time e e-mail mascarado para a página.
3. Página app/email-unsubscribe/[token]/page.tsx com features/context|services|container
   (padrão do projeto), shadcn via MCP, tokens semânticos, PT-BR: confirma o
   descadastro daquele TIME com um clique e mostra estado de sucesso/erro.
4. Injeção no envio: em EmailCampaignDispatchService.dispatchBatch, para cada
   destinatário, anexar footer com link {APP_URL}/email-unsubscribe/{token} (usar
   getFullUrl()) e headers List-Unsubscribe + List-Unsubscribe-Post: List-Unsubscribe=One-Click
   (o POST one-click cai na mesma rota). Footer entra após o inlineEmailHtml, antes do
   interpolate, com texto padrão em PT-BR.
5. Testes: integração do fluxo token → POST → contato suprimido → próximo disparo
   exclui o contato; e-mail de campanha renderizado contém o link.
Atualize Postman (2 rotas novas). Rode a validação completa incluindo design:check.
```

**Não tocar:** mecanismo de flags (reutilizar `isUnsubscribed` — nenhum caminho paralelo); envios transacionais/backoffice (fora do escopo de campanha); CDP consent (ponte fica para rodada futura, registrada como débito).

**Aceite:** todo HTML de campanha contém o link; clique descadastra só daquele Time; token adulterado = 400; contato descadastrado não recebe o próximo disparo (teste de integração).
**Validação manual:** disparar campanha local para si mesmo, clicar no link, confirmar página e conferir flag + exclusão no disparo seguinte.

**Mockup — página pública (nova):**

```
┌ corretorstudio.com/email-unsubscribe/<token> ─────────┐
│                                                       │
│   ✉️  Descadastrar de e-mails de [Nome do Time]        │
│                                                       │
│   Você (m•••@exemplo.com) deixará de receber          │
│   campanhas de e-mail deste time.                     │
│                                                       │
│   [ Confirmar descadastro ]        (Button destructive)│
│                                                       │
│   ── após confirmar ──                                │
│   ✓ Pronto. Você não receberá mais e-mails deste time.│
└───────────────────────────────────────────────────────┘
```

### Estágio 6 — Importação de contatos em background (CSV + JSON)

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 3.7) e D4 da spec. Torne a importação assíncrona:

1. Schema (bun run db:migrate:from-prisma): model EmailImportJob — id, importId (curto,
   único, para logs), teamId, listId, requestedBy, sourceFormat (csv|json), storagePath,
   status (pending|processing|completed|completed_with_errors|failed), totalRows,
   processedRows, importedCount, updatedCount, skippedCount, failedBatches Json,
   batchSize, attemptsByBatch Json, createdAt/updatedAt. Enum novo
   EMAIL_IMPORT_COMPLETED em NotificationType (migration + seed se aplicável).
2. Rotas import (mapped e upload) passam a: validar formato, subir o arquivo para
   storage, criar o job pending e responder 202 com { importId } imediatamente.
   Aceitar também JSON (lista de { email, name?, customFields? }) com a MESMA validação
   Zod do mapped. Gate isManagerLikeRole mantido.
3. Cron (novo endpoint /api/v1/email/cron/process-import-jobs no vercel.json, ou o de
   5 min existente): claim atômico do job (updateMany pending→processing, count check —
   job nunca processado 2x em cron sobreposto); processa lotes de 500 (validar contra
   limite de duração do Vercel; ajustar constante) retomando de processedRows; lote com
   erro técnico: retry até 3 com backoff, só daquele lote; linha inválida/duplicada:
   contabiliza como skipped/updated, nunca retry. Se o tempo estourar, re-enfileira
   (processing→pending com cursor salvo). Ao final: totalContacts recalculado e
   Notification EMAIL_IMPORT_COMPLETED para requestedBy com resumo
   (X importados, Y ignorados, Z lotes falhos).
4. Logs por lote no padrão do módulo:
   [EmailContactImport][<importId>] Lote 3/12 — 500 contatos — sucesso
   [EmailContactImport][<importId>] Lote 7/12 — falha, tentativa 2/3 — <motivo>
5. Frontend contatos: submit mostra toast sonner "Processando importação em segundo
   plano" e libera a tela (sem barra de progresso bloqueante); status do job visível
   na lista (badge). Botão com lock de request (disable até finally).
6. Testes: claim concorrente; retry isolado de lote; distinção skip vs falha técnica;
   retomada após "timeout" simulado; notificação criada com resumo correto.
Atualize Postman e vercel.json. Rode a validação completa incluindo design:check.
```

**Não tocar:** espelhamento na lista default (manter comportamento, agora dentro do job); modelo `EmailContact` e unique `[listId, email]`; rotas de CRUD de listas.

**Aceite:** request de import responde em < 2s independente do tamanho; matar o cron no meio e re-rodar não duplica contatos nem reprocessa lotes concluídos; notificação in-app chega com o resumo; logs do job filtráveis por `importId`.
**Validação manual:** importar CSV de 5k linhas com 200 inválidas + 100 duplicadas local; acompanhar logs; conferir notificação e `totalContacts`.

**Mockup — Contatos / import (antes/depois):**

```
ANTES  [Importar CSV] → modal → spinner preso até o fim da request (ou timeout)

DEPOIS [Importar CSV/JSON] → modal → [Iniciar importação]
       └ toast: "Processando importação em segundo plano" (sonner)
       Lista de listas:
       │ Minha lista   1.240 contatos   ⏳ Importando (lote 3/12)…  │ ← Badge
       │ …                                                          │
       🔔 Notificações: "Importação concluída: 4.700 importados,
          200 ignorados (formato), 100 atualizados, 0 lotes com falha"
```

### Estágio 7 — RBAC efetivo + higiene do editor HTML + reset-credits

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seções 3.2, 3.4, 3.6) e as decisões D2/D6 da spec. Então:

1. (Conforme D2/O1, se confirmada) Rotas de send/create de campanha e template passam a
   delegar o gate de role a um helper canDispatchEmail(ctx, teamSettings) /
   canCreateEmailTemplate(...) que honra dispatchAllowedRoles/templateCreateRoles com
   default atual. Remova o check duplicado dentro do UseCase.send OU o da rota — um
   único ponto de verdade, testado.
2. Editor HTML-only (D6): migration alterando default de editorMode para "html";
   nenhum fluxo novo grava mailyJson (backend rejeita mailyJson quando
   editorMode === "html"); badge "HTML" no editor. resolveEditorMode permanece "html".
3. reset-credits: já com try/catch por item (Estágio 2) — adicione idempotência
   explícita: pular assinatura cujo usage do novo período já exista (verificação por
   @@unique já garante; capture P2002 como skip com log info, não erro).
4. Testes de RBAC por role (manager, backoffice, operator) para cada rota mutante do
   módulo, e teste do reset com execução dupla.
Rode a validação completa.
```

**Não tocar:** cobrança Asaas; editor visual Maily (arquivos permanecem, apenas inacessíveis); featureSlugs existentes.

**Aceite:** matriz de RBAC testada e igual à decisão D2; execução dupla do reset não duplica usage nem loga erro; template novo nunca persiste `mailyJson`.
**Validação manual:** logar como operator local e confirmar a matriz (leitura ok, escrita conforme D2); rodar reset 2x seguidas.

**Mockup — Editor de template (antes/depois):**

```
ANTES  ┌ Editor ───────────────────────────────┐  (modo visual existe no código,
       │ [tabs internas do estúdio]            │   inacessível mas ambíguo no schema)
DEPOIS ┌ Editor ───────────────── [HTML] ──────┐  ← Badge de modo fixo
       │ <html> … </html>   | Preview ao lado  │  fluxo: colar HTML → preview →
       │ [Enviar teste] [Publicar]             │  teste (com team_id nas tags) →
       └───────────────────────────────────────┘  campanha
```

### Estágio 8 — Fila desacoplada de sincronização Radar do import de contatos ⚠️ depende de D9

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 8.1) e a decisão D9 registrada em EMAIL_SPEC.md. Confirme
com o dono do projeto o trade-off de latência do D9 antes de implementar (import
conclui antes do sync Radar existir). Então:

1. Schema (bun run db:migrate:from-prisma -- email-contact-radar-sync-outbox):
   model EmailContactRadarSyncOutbox conforme desenhado em D9 (id, emailContactId,
   teamId, emailImportJobId String? com relation para EmailImportJob, status
   pending|processing|sent|failed, attemptCount, nextAttemptAt, lastError,
   createdAt/updatedAt), unique em emailContactId, índices [status, nextAttemptAt]
   e [emailImportJobId, status]. NÃO aplique no remoto sem autorização do owner.
2. EmailContactImportUseCase.processPendingJobs: remova o laço de sync do Radar
   (linhas 526-586 hoje) de dentro do processamento de lote. Após upsertContactsBatch,
   faça upsert (NÃO createMany/skipDuplicates) por emailContactId no outbox para os
   contatos do lote (só quando teamHasRadarFeature): contato novo cria pending;
   contato já existente (reimport/atualização) volta para pending com attemptCount
   zerado e emailImportJobId apontando para o job atual — nunca deixe uma linha
   sent/failed de um import anterior impedir a criação/reativação. processedRows
   avança logo após o upsert de contatos.
3. Novo endpoint app/api/v1/radar/cron/sync-email-contacts/route.ts, registrado em
   vercel.json (*/5 * * * *), usando withCronAudit (padrão de
   CRON_OBSERVABILITY_SPEC.md — nunca gatear a execução na criação do registro de
   auditoria). Reivindica um lote do outbox via updateMany atômico
   (pending->processing, count check), processa com concorrência limitada
   (Promise.all em chunks, ex. 5-10 simultâneos — reaproveite
   syncEmailContactToRadarUseCase por contato), marca sent ou incrementa
   attemptCount/lastError e volta pending (backoff simples) até um teto (ex. 5
   tentativas), aí marca failed definitivo.
4. Notificação EMAIL_IMPORT_COMPLETED (finalizeJob): inclua quantos contatos DESTE
   job (contagem do outbox filtrada por emailImportJobId = job.id, nunca por listId
   inteira — um import anterior da mesma lista pode ter linhas pendentes próprias)
   aguardam sync do Radar, sem bloquear a notificação por isso.
5. Testes: import de 1500 contatos conclui e notifica sem tocar no Radar
   síncronamente (mock do outbox); cron do outbox processa em lotes, respeita
   concorrência, retenta com backoff e marca failed após o teto; reimportar um
   contato cuja linha de outbox já está sent/failed reativa a mesma linha para
   pending (não fica parada); contagem da notificação reflete só o job atual quando
   há outbox pendente de um import anterior da mesma lista.
Atualize vercel.json e a validação completa (typecheck/lint/governance:check/
governance:check-api-masking/lint:pt-br).
```

**Não tocar:** `RadarService.syncFromEmail`/`processEmailContactForRadar` (lógica de sync em si, só muda quem chama e quando); `RadarEngagementBackfillUseCase` (achado B4 do Radar, já tratado à parte); demais crons de e-mail.

**Aceite:** import de uma lista de 4.000+ contatos com Radar habilitado conclui em segundos, não horas (medir contra os ~9h observados no incidente); fila de 49 jobs pendentes (estado do incidente) esvazia sem um job lento bloquear os demais; outbox nunca cresce sem limite — falha definitiva vira `failed` visível, não retry infinito; teste de concorrência do claim do outbox verde.
**Validação manual:** reproduzir localmente um import de lista grande com Radar habilitado; conferir que a lista sai de "Importando" rapidamente e que os perfis Radar aparecem no outbox e depois em `RadarProfile` nos minutos seguintes.

### Estágio 9 — Resiliência do reconcile de disparo manual ⚠️ depende de D10

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 8.3) e a decisão D10 registrada em EMAIL_SPEC.md. Então:

1. lib/email/with-deadlock-retry.ts (ou um novo helper ao lado): garanta que
   commitDispatchTerminalState (EmailCampaignUseCase.ts:2237) também tenha retry
   para erro transitório de conexão (P1001/P2024 e mensagens de pool timeout),
   reaproveitando withPrismaRetry de app/api/infra/data/prisma.ts — não crie uma
   segunda implementação de retry.
2. reconcileManualDispatchAfterError (ts:2298): se a escrita via
   commitDispatchTerminalState falhar mesmo após o retry, faça uma leitura isolada
   (sem transação) de emailLog.count(status em sucesso) para aquele dispatchId
   ANTES de cair no caminho genérico de failed, e grave esse totalSent real mesmo
   que o resto do estado (campanha) não seja atualizável no momento — nunca deixe
   totalSent em 0 quando existe log de sucesso.
3. Testes: simular timeout de pool na escrita do commitDispatchTerminalState
   (mock do prisma lançando erro P1001) com emailLog já tendo entradas sent;
   asserir que o dispatch final NUNCA fica com totalSent: 0 nesse cenário.
4. Script one-off (não migration, não roda em CI) para corrigir os 3 registros
   históricos listados em EMAIL_AUDIT.md 8.3 recalculando totalSent a partir do
   EmailLog real. Reporte o resultado antes de rodar contra produção — só executa
   com autorização explícita do owner.
Rode a validação completa.
```

**Não tocar:** critério de elegibilidade de retry (`campaign-failed-recipients.ts` já está correto — usa `EmailLog` por destinatário, não o agregado); fluxo do cron `dispatch-scheduled` (usa `STUCK_SENDING`, não esse caminho).

**Aceite:** teste de timeout simulado prova que `totalSent` nunca perde a contagem real; os 3 dispatches históricos corrigidos (após autorização) refletem o `EmailLog` real.
**Validação manual:** conferir no Supabase que os 3 dispatches citados no audit passam a ter `totalSent` correspondente aos `EmailLog` reais.

### Estágio 10 — Retry de falhas de processamento do webhook Resend (D11 — decisão do owner já dada: sim)

**Prompt (copy-paste):**

```text
Leia EMAIL_AUDIT.md (seção 0, linha do Estágio 4) e a decisão D11 registrada em
EMAIL_SPEC.md. Implemente o retry interno de falhas do webhook do Resend:

1. Schema (bun run db:migrate:from-prisma -- resend-webhook-processing-failure):
   model ResendWebhookProcessingFailure conforme desenhado em D11 (id, svixId
   @unique, eventType, payload Json, status pending|processing|resolved|failed,
   attemptCount, nextAttemptAt, lastError, createdAt/updatedAt), índice
   [status, nextAttemptAt]. NÃO aplique no remoto sem autorização do owner.
2. app/api/webhooks/resend/route.ts: NÃO mude o contrato HTTP (continua 200 para
   evento válido, 401/400/503 como hoje). No catch do after() (hoje só
   console.error), faça upsert por svixId em ResendWebhookProcessingFailure com o
   payload do evento já verificado e a mensagem de erro.
3. Novo endpoint app/api/v1/email/cron/retry-resend-webhook-failures/route.ts,
   registrado em vercel.json (*/5 * * * *), usando withCronAudit. Reivindica um
   lote pending (updateMany atômico pending->processing, count check), chama
   resendWebhookUseCase.handle({ event: JSON.parse(payload), svixId }) de novo
   por linha — o dedupe existente em EmailEvent (@@unique([logId, type,
   occurredAt])) garante que reprocessar não duplica efeito mesmo se parte do
   processamento anterior já tiver sido aplicada. Sucesso: status resolved (ou
   apaga a linha). Falha: incrementa attemptCount/lastError, backoff simples até
   um teto (ex. 5 tentativas), aí marca failed (dead-letter, visível em logs, não
   trava nada).
4. Testes: simular resendWebhookUseCase.handle lançando erro transitório — a
   linha do outbox é criada; simular sucesso na retentativa — vira resolved;
   simular N falhas seguidas — vira failed após o teto, sem loop infinito.
Atualize vercel.json e a validação completa.
```

**Não tocar:** verificação de assinatura svix (já correta); contrato HTTP de resposta do webhook (200/401/400/503 continuam como estão — só o `catch` interno do processamento ganha o outbox).

**Aceite:** falha transitória de processamento de um evento válido é reprocessada automaticamente em até 5 min, sem depender do Resend reentregar; falha permanente (ex. evento malformado) não fica retentando para sempre; nenhuma duplicação de efeito em `EmailEvent`/contadores de campanha quando o retry reprocessa um evento parcialmente aplicado.
**Validação manual:** simular localmente um erro no `resendWebhookUseCase.handle` (mock de exceção), confirmar que a linha aparece em `ResendWebhookProcessingFailure` e que o cron a resolve na tentativa seguinte.

---

## Edge cases & error handling (transversais)

- Disparo com `totalRecipients` mudando entre reserva e envio (lista editada): reservar pelo count do momento e liberar sobra — nunca reservar duas vezes.
- Time sem `EmailTeamSettings`: manter fallbacks atuais de from/reply-to.
- Token de descadastro de contato já removido da lista: responder sucesso idempotente (não vazar existência).
- Job de import cujo arquivo sumiu do storage: `failed` com motivo claro + notificação.
- Webhook de e-mail de teste (`template-test`): eventos não devem inflar contadores de campanha (sem `campaignId` — já é o caso; cobrir com teste).

## Security & privacy

- Token HMAC com secret dedicado (`EMAIL_UNSUBSCRIBE_SECRET`), sem UUIDs crus em URL pública; comparação constant-time.
- Rota pública com rate-limit e respostas genéricas (não confirmar existência de e-mail/lista).
- `CRON_SECRET` continua obrigatório nos crons (inclusive o novo de import).
- Import: arquivo no storage privado do time; conteúdo nunca logado (só contagens e motivo técnico).

## Success criteria (módulo)

1. Zero e-mails órfãos novos após Estágio 3 (métrica do audit 6.6 — hoje 124 IDs distintos/24h — tende a 0 em janela de 7 dias).
2. Zero 429 do Resend no enrichment em produção.
3. Nenhuma campanha `sent` com `totalSent = 0`; nenhuma `sending` > 30 min.
4. Saldo por Time nunca negativo; corrida de disparo comprovadamente serializada por teste.
5. 100% das campanhas com link de descadastro funcional; opt-out refletido no disparo seguinte.
6. Import de 10k contatos sem timeout, com notificação e relatório corretos.
7. Cobertura de testes: todo UseCase/rota/cron do módulo com unit + integração (padrão WhatsApp).

## Open questions

1. **D1 — estratégia de migração de dados (M1/M2/M3)** — recomendação M1; aguarda owner.
2. **D2 — nível de acesso do operator (O1/O2/O3)** — recomendação O1; aguarda owner.
3. Cobrança real (assinatura + overage no Asaas): quando entrar, define se overage volta a ser permitido com teto ou permanece bloqueio rígido.
4. ~~Resultado das queries MCP~~ **Resolvida (2026-07-06)**: investigação MCP executada (audit seção 6). Não há campanhas `scheduled` vencidas hoje, mas confirmou-se que o cron **mata silenciosamente** toda campanha agendada que vence (0 assinaturas ativas + bypass beta ausente no cron). O Estágio 1 é hotfix prioritário — a correção do gate de créditos do cron foi incorporada ao prompt do estágio.
5. **D9 — trade-off de latência do sync Radar (import conclui antes do perfil Radar existir)** — aguarda confirmação do owner antes do Estágio 8. A alternativa (otimizar mantendo síncrono) está registrada em D9 caso o trade-off seja rejeitado.
6. Origem das decisões "D6"/"I3" citadas no comentário de `EmailContactImportUseCase.ts:526-531` não foi localizada em nenhum spec vigente (grep em `*.md`/`specs/*.md`) — tratado como requisito real encontrado no código, não como spec formal; D9 propõe supersedê-lo explicitamente mediante confirmação do owner.

## Decisions log

- 2026-07-05 — Auditoria concluída; spec proposta. D1=A/M1 e D2=O1 recomendadas, pendentes de confirmação do owner. Cobrança Asaas declarada non-goal desta rodada (gap reportado no audit 3.4).
- 2026-07-06 — Investigação MCP executada (Supabase produção + Vercel + export de logs 24h). Confirmados em produção: kill silencioso de campanhas agendadas pelo gate de créditos do cron (sem bypass beta), billing com `creditsUsed = 0` acumulado, 3 campanhas `sent` com 0 envios, 2 dispatches presos em `sending`, 545 logs `queued` órfãos, 124 dispatch IDs órfãos/24h, 429 também no caminho de envio. Estágio 1 promovido a hotfix prioritário e prompt atualizado com o fix do gate de créditos + log obrigatório de kill.
- 2026-07-06 — **Decisão do owner (D8):** funcionalidade com tag **Beta habilitada** = isenção total — não gera nenhuma cobrança e não valida créditos, em todos os caminhos de disparo. Substituída a proposta anterior do Estágio 2 de "contabilizar sem bloquear" para beta: agora beta não escreve nada em `EmailCreditUsage`. Prompt do Estágio 2 e critérios de aceite atualizados.
- 2026-08-10 — Incidente de produção investigado via Vercel/Sentry/Supabase MCP (`EMAIL_AUDIT.md` §8, pós-deploy do `CRON_OBSERVABILITY_SPEC.md`). Confirmados: fila de import com 49 jobs/48.378 linhas travados há 16h+ atrás de um único job lento (causa: sync Radar síncrono dentro do lote sem checkpoint nem circuit breaker — D9/Estágio 8 propostos); cota mensal do Resend esgotada explicando 179/250 erros pós-deploy (operacional, não código); 3 dispatches históricos com `totalSent: 0` gravado apesar de 795-2.279 e-mails realmente enviados, por falha silenciosa do reconcile de erro transitório (D10/Estágio 9 propostos). Estágios 8/9 aguardam confirmação do owner (D9 tem trade-off de produto; D10 inclui correção de dados históricos que só roda com autorização).
- 2026-08-10 — **Reavaliação completa dos Estágios 1-7** a pedido do owner (`EMAIL_AUDIT.md` §0): leitura de código confirmou que D1, D3, D5, D6, D7, D8 e os Estágios 1, 2, 3, 5, 6, 7 já estão implementados em produção — o Decisions log nunca tinha sido atualizado para refletir esse trabalho. Único desvio: Estágio 4 item 2 (webhook responder 500 em erro de processamento) foi implementado com um desenho diferente (fire-and-forget + 200 sempre) — funciona para idempotência, mas não aciona retry automático do Resend em falha transitória; marcado como pendente de decisão do owner, não como bug. Auditoria adicional da conta Resend via API (`EMAIL_AUDIT.md` §9): 2 de 5 domínios com CNAME de tracking falho (1 deles com tracking ligado mesmo assim — afeta métricas de abertura/clique do time `backstageclub.com.br`), 3 API keys sem uso recente (candidatas a revogação), 1 webhook de dev esquecido (já `disabled`, sem risco). Cobrança real Asaas segue como único non-goal do escopo original ainda pendente.
- 2026-08-10 — **Decisão do owner sobre o Estágio 4 item 2: precisamos de retry para as falhas.** Registrada como D11 — em vez de reverter para `500` síncrono (o que a própria documentação do Resend desaconselha para eventos válidos processados async), o desenho escolhido é retry **interno** via outbox (`ResendWebhookProcessingFailure` + cron `retry-resend-webhook-failures`), mesmo padrão já usado no repo. Novo Estágio 10 adicionado, pronto para implementar (não depende de mais nenhuma decisão do owner).
