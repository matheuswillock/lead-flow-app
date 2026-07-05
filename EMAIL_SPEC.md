# Spec: Evolução do Módulo de E-mail — Créditos por Time, Conformidade e Robustez de Disparo

**Data:** 2026-07-05
**Base:** `EMAIL_AUDIT.md` (mesma rodada). Números de seção citados (ex.: 3.1) referem-se ao audit.
**Status:** proposta — aguarda decisões D1/D2 do owner antes do Estágio 2.

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
   (fix do bug que mata campanhas CDP agendadas); pré-criar EmailLog queued para todos
   os destinatários e marcar failed os não enviados (paridade com o manual).
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

**Aceite:** campanha CDP agendada dispara; `sent` nunca ocorre com `totalSent === 0`; campanha fora de janela dispara na janela seguinte; execução dupla simulada do cron não duplica envio nem trabalho pesado; testes verdes cobrindo cada caso.
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
   o Resend. O bypass beta (resolveEmailBetaAccess) continua válido mas passa a
   registrar consumo via reserveCredits com guard desativado (contabiliza sem bloquear).
5. EmailCreditUseCase.subscribe/status/cancel: escopo teamId (ctx.teamId); reset-credits
   cron: ajuste o include (team em vez de profile) mantendo o TZ do master; adicione
   try/catch por assinatura no loop.
6. Frontend: EmailCreditsCard (subscription) e a página de campanhas exibem o saldo do
   TIME ativo (GET credits/status já escopado). Testes unit para o guard de saldo, o
   release e a corrida (duas reservas concorrentes via Promise.all com transações reais).
Atualize Postman. Rode a validação completa.
```

**Não tocar:** cobrança Asaas (non-goal); webhook; import de contatos; templates.

**Aceite:** duas requisições de disparo simultâneas do mesmo Time com saldo para apenas uma → exatamente uma passa; Time sem assinatura não dispara; Time B do mesmo master não consome saldo do Time A; migration replay ok em `db:migrate:reset:local`; testes de concorrência verdes.
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

1. Zero e-mails órfãos novos após Estágio 3 (query da seção 6 do audit tende a 0 em janela de 7 dias).
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
4. Resultado das queries MCP (seção 6 do audit): se existirem campanhas `scheduled` vencidas no banco, priorizar hotfix do Estágio 1 antes de qualquer outro estágio.

## Decisions log

- 2026-07-05 — Auditoria concluída; spec proposta. D1=A/M1 e D2=O1 recomendadas, pendentes de confirmação do owner. Cobrança Asaas declarada non-goal desta rodada (gap reportado no audit 3.4).
