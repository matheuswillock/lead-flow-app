# Spec: Incidente — Leads Fantasma, Milestone Inflado e Motor de Engajamento (Fase E)

**Versão:** 1.1
**Data:** 2026-08-05
**Status:** Implementado no código — aguardando deploy em produção + E6 `--apply` (com OK do owner, só depois de E1 em prod). Migration remota N/A.
**Branch:** `fix/radar-fase-e-leads-fantasma`
**Relacionado:** `specs/radar-d19-engagement-score.md`, `specs/radar-d19b-form-score-engagement-bridge.md`, `specs/radar-d19c-form-option-weight-scoring.md`

---

## Problema

No dia do deploy de D19 (motor de engajamento) + do recurso de atribuição de campanha de e-mail → formulário (2026-08-05), o usuário identificou um lead real marcado 🔥 Quente (score 100/100) sem nunca ter respondido um formulário. Investigação direta em produção (SQL + logs do Postgres via Supabase MCP) revelou uma cadeia de causas relacionadas, todas no mesmo recurso de atribuição, mais um achado técnico paralelo no webhook do Resend.

---

## Causa raiz — 5 achados, com file:line exatos (branch `develop`)

### E1. Leads fantasma: `form_viewed` cria um `Lead` completo no CRM

`ResolveEmailCampaignFormAttributionUseCase.execute()` (`app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase.ts`) chama `upsertLeadFromEmailRecipient(...)` **incondicionalmente**, sempre que resolve um `EmailLog` válido via `cs_el` — para os 3 tipos de evento (`form_viewed`, `form_started`, `form_completed`). O `eventType` só controla se grava uma `LeadActivity` extra (linha ~118); não controla se cria o lead.

Isso significa que o simples **carregamento da página do formulário** — inclusive por scanners de segurança de e-mail que pré-buscam todos os links de um e-mail recebido (Proofpoint, Mimecast, Microsoft Defender Safe Links) — já cria um `Lead` no CRM, em status `new_opportunity`, sem a pessoa nunca ter visto ou respondido nada.

**Confirmado em produção (SQL direto, projeto `wcnxwdcoambpfwxwubka`):** para o formulário `74c7fea8-9bac-4137-bc64-a02f3c674d69`, no dia do incidente: **66 `form_viewed`, 1 `form_started`, 0 `form_completed`, 0 `lead_created`** (eventos reais de métrica). Mesmo assim, dezenas de `Lead` foram criados no CRM, todos com `originChannel: "public_form"` e `originMetadata.attribution: "email_campaign"`, nascendo direto em `new_opportunity`.

**Escopo confirmado:** ver tabela na seção "Escopo do incidente" abaixo. Script de identificação criado, testado e incluído neste PR: `scripts/audit-fake-email-attribution-leads.ts` (`bun run audit:fake-email-attribution-leads`). **A causa raiz (E1) ainda não está corrigida em produção** — o script continua encontrando novos leads afetados a cada execução; a contagem abaixo é um snapshot, não um total definitivo. Rodar o script de novo imediatamente antes de qualquer ação de limpeza (E6).

**Por que é seguro remover a criação nesse ponto:** quando a pessoa de fato completa o formulário, `PublicFormSubmissionUseCase.processInBackground` resolve o lead real via `upsertLeadFromFormAnswers`/`findMatchingLead`, a partir das respostas de verdade — `resolvedLeadId = lead?.id ?? attributionResult?.leadId ?? null` usa esse lead real primeiro. `findMatchingLead` casa por e-mail/telefone/nome — se a atribuição já tivesse criado um lead antes (comportamento atual), a submissão real encontraria e reusaria o mesmo lead por e-mail. Ou seja: **não depende da criação prematura para funcionar depois.**

### E2. `lead.milestone.new_opportunity` dispara em TODO lead novo, não só numa transição real

`LeadStatus.new_opportunity` é o status padrão de **qualquer** lead criado no sistema (confirmado: `LeadUseCase.ts:1086`, `data.status ?? LeadStatus.new_opportunity`, usado por criação manual, CSV, WhatsApp, formulário — todos os canais). O enum não tem um status "anterior"/"não qualificado" — `new_opportunity` é a primeira posição.

`RadarService.appendLeadStatusEvents` (`app/api/services/radar/RadarService.ts:147-174`) grava o milestone (`lib/radar/lead-milestone-map.ts`: `LEAD_STATUS_MILESTONE_EVENT_TYPE`) sempre que o lead sincronizado está em um dos 4 status de marco — sem diferenciar "acabou de nascer nesse status" de "transicionou de verdade pra esse status". Como `new_opportunity` é o status de nascimento de todo lead, **o milestone dispara pra 100% dos leads criados**, não só os leads fantasmas — inflando o `engagementScore` de qualquer lead desde o primeiro segundo de vida (peso configurado: 12 pontos base, ×2 na janela de recência de 7 dias = 24 pontos).

Os outros 3 milestones (`invoicePayment`, `future_sale`, `contract_finalized`) não têm esse problema — nunca são o status inicial de um lead.

### E3. Merge de perfis não recalcula o score

- **E3a** — `RadarRepository.mergeProfiles` (linhas 185-278, fundido automaticamente quando telefone e e-mail resolvem para 2 perfis diferentes, chamado de `resolveProfileForPhone`) move eventos do perfil perdedor pro vencedor e deleta o perdedor, mas nunca chama `updateEngagementScore` — o score do perfil vencedor fica desatualizado até o próximo evento novo ou o próximo ciclo do cron de backfill.
- **E3b** — O botão "Mesclar" de leads do CRM (`LeadMergeDialog.tsx` → `MergeLeadsUseCase` → `LeadRepository.mergeLeadsInTransaction`) **não importa nada do Radar** em nenhuma camada. Quando o lead perdedor é deletado, a `RadarIdentity` tipo `lead_id` que apontava pra ele fica órfã — os dois `RadarProfile` continuam separados, cada um com seu próprio score, sem nunca se fundir.

**Nota:** o caso que motivou esta investigação (2 leads da mesma empresa, e-mails de setores diferentes, mesmo telefone) **não** passou por nenhum dos dois merges — os 2 leads sempre apontaram pro mesmo perfil desde o início (resolução por telefone compartilhado). É um achado relacionado, mas de causa distinta.

### E4. Aba "Contatos" conta eventos brutos como pontos de contato, inclusive eventos internos de CRM

`RadarUseCase.getProfileTouchpoints` (`app/api/useCases/radar/RadarUseCase.ts:302-357`) agrupa eventos por prefixo de canal (`email`, `whatsapp`, `form`, `pixel`, e trata `lead`/`portfolio`/`profile` como "CRM") e soma a contagem bruta de eventos.

No perfil do caso investigado, isso produzia "18 pontos de contato": 8 de e-mail (2 disparos × 4 eventos de ciclo de vida cada — sent/delivered/opened/clicked — no mesmo minuto), 3 de formulário (3× `form.viewed`, nunca `form.started`/`form.completed`), e 7 de "CRM" (que na verdade são `lead.created` ×2, `lead.status_changed` ×2, `lead.milestone.new_opportunity` ×2, `profile.first_contact` ×1 — nenhum desses é uma interação real da pessoa, é o próprio sistema registrando eventos internos).

Isso não é um bug de cálculo (a soma bate certo com os eventos existentes) — é um problema de **definição**: contar eventos técnicos do ciclo de vida (`sent`/`delivered`) e eventos de sistema (`lead.created`) como "pontos de contato" infla artificialmente o número e sugere mais engajamento do que realmente houve.

### E5. Webhook do Resend retorna 500 em evento duplicado (achado paralelo, mesmo dia)

Confirmado nos logs do Postgres (Supabase, `get_logs` / arquivo de logs anexado pelo usuário): erros repetidos `duplicate key value violates unique constraint "corretor_studio_email_events_logId_type_occurredAt_key"`, em pares, várias vezes ao longo do dia.

Cadeia: `ResendWebhookService.processEmailLogWebhook` (linhas 25-53) faz `hasDuplicateEvent` (SELECT) e depois `applyWebhookEvent` (INSERT) — check-then-act sem lock. Resend garante entrega "at-least-once" (reenvia por natureza). `EmailLogRepository.applyWebhookEvent` (linhas 58-107) faz `tx.emailEvent.create(...)` sem try/catch. Nenhuma camada acima trata esse erro especificamente — só o catch genérico da rota (`app/api/webhooks/resend/route.ts`) pega, loga, e retorna **HTTP 500**. Resend interpreta 500 como falha e reenvia o mesmo evento — que bate na mesma constraint de novo, em ciclo.

Não há perda de dado (o primeiro insert já gravou tudo certo) — é ruído de log + consumo de retry budget do Resend, mas real.

**Achado equivalente do lado Radar não é bug:** os erros `corretor_studio_radar_events_idempotent_key` nos mesmos logs já são tratados — `appendEventIfNew`/`appendEventIfNewBySourceKey` (`RadarRepository.ts`) envolvem o `create` em `try { ... } catch { return null }`; a exceção nunca escapa pro chamador. O Postgres loga a violação no nível do próprio banco mesmo quando a exceção é capturada pelo app (é assim que o log do Postgres funciona) — aparece no log do Supabase, mas sem nenhum impacto funcional.

---

## Escopo do incidente (confirmado via SQL em produção)

**Snapshot em 2026-08-05 ~20:00 UTC** (última execução de `scripts/audit-fake-email-attribution-leads.ts` antes da publicação deste spec — a causa raiz E1 ainda não está corrigida, então este número cresce a cada novo `form_viewed` recebido; re-rodar o script antes de qualquer limpeza):

| Time | Leads afetados | Primeiro | Último |
|---|---|---|---|
| Kathrein Antunes | 52 | 12:01:35 | 14:47:59 |
| Avalanche de Vendas Unipessoal Ltda | 1 | 18:49:15 | 18:49:15 |
| MultiSkill | 1 | 19:21:52 | 19:21:52 |
| On \| Select 1.0 | 1 | 19:57:39 | 19:57:39 |
| **Total** | **55** | | |

Todos criados no mesmo dia do deploy do recurso de atribuição — sem histórico anterior (a feature é nova). O 4º time (`On | Select 1.0`) apareceu numa reverificação posterior à primeira contagem (que havia registrado 54 em 3 times) — confirma que o incidente está ativo e continua gerando leads novos até E1 ser corrigido.

---

## Correções propostas

### E1 — Só criar `Lead` quando o formulário é de fato completado

Em `upsertLeadFromEmailRecipient`, restringir o bloco de criação (`leadUseCase.createLead(...)`) para rodar só quando `eventType === "form_completed"`. `findMatchingLead` continua rodando sempre (mesmo em `form_viewed`) — se já existir um lead real, ele é encontrado e atualizado normalmente; só a **criação** de um lead novo fica restrita à conclusão real.

**Correção corequisito, sem a qual o Radar perde a identidade do visitante:** `SyncPublicFormMetricToRadarUseCase.resolveProfileId` (`app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase.ts:76-89`) hoje só tem 2 branches — `leadId` presente → resolve por identidade `lead_id`; senão → `resolveProfileForVisitorSession` (100% anônimo, só sessão). Com E1, `form_viewed`/`form_started` passam a chegar aqui com `leadId: null`, e cairiam direto no branch anônimo — **mesmo já sabendo exatamente quem é o destinatário** (o `emailLogId` já foi resolvido para um `EmailLog.recipientEmail` dentro de `ResolveEmailCampaignFormAttributionUseCase.execute`, linha 93: `enrichedOrigin.emailLogId = log.id`, isso já roda incondicionalmente, independente do `eventType`). Sem corrigir isso, o evento vira um perfil de sessão anônima desconectado do perfil real da pessoa — quando ela completar o formulário depois, `syncLeadToRadarUseCase` resolve o perfil real por telefone/e-mail (`resolveProfileForPhone`/`resolveProfileForEmail`, já existentes desde D4), que é **um perfil diferente** do anônimo criado pelo clique — perdendo o histórico de abertura/clique.

Correção: (1) `ResolveEmailCampaignFormAttributionUseCase` passa a incluir `recipientEmail: log.recipientEmail` no `enrichedOrigin` sempre que resolve o `EmailLog` (não só quando cria/atualiza lead); (2) `SyncPublicFormMetricToRadarUseCase.resolveProfileId` ganha um branch novo, entre o de `leadId` e o de `visitorSessionId`: se não há `leadId` mas `origin.recipientEmail` está presente, resolver via `radarRepository.resolveProfileForEmail({ teamId, normalizedEmail, emailValue: origin.recipientEmail, ... })` (mesma função já usada por `syncFromEmail`/`handleEmailWebhookEvent` desde D4) — landing no MESMO perfil que a submissão real vai usar depois, em vez de um perfil de sessão anônima descartável.

### E2 — Milestone `new_opportunity` só em transição real

Usar a heurística já disponível: se `lead.createdAt.getTime() === lead.statusEnteredAt.getTime()`, o lead nasceu direto nesse status (não é transição). Em `appendLeadStatusEvents`, suprimir especificamente o milestone `new_opportunity` nesse caso. `lead.status_changed` continua gravando sempre. Os outros 3 milestones não mudam.

### E3 — Merge recalcula/funde score

- **E3a:** adicionar `updateEngagementScore(winningProfileId, teamId)` ao final de `mergeProfiles` (o método já existe, só falta a chamada).
- **E3b:** em `MergeLeadsUseCase`, depois do merge de leads bem-sucedido, resolver os `RadarProfile` dos dois leads via identidade `lead_id`; se forem perfis diferentes, reusar `mergeProfiles` (virar método público) pra fundir — mesmo código do caminho automático, novo call site.

### E4 — Pontos de contato por dia, CRM fora da contagem

Redefinir "ponto de contato" como **canal × dia calendário distinto**, não evento bruto — 8 eventos de e-mail no mesmo dia = 1 ponto de contato (com os eventos brutos disponíveis como timeline expansível dentro do card). Remover `lead`/`portfolio`/`profile` do mapeamento de canais — eventos de CRM continuam visíveis na aba "Resumo"/"Timeline" (já aparecem lá), mas saem da contagem/lista de "Contatos".

Perfis com múltiplas identidades do mesmo tipo (ex.: 2 e-mails, caso investigado, fundidos por telefone compartilhado) já mostram ambos na aba "Identidades" — falta só o cabeçalho da Sheet (hoje mostra 1 e-mail) refletir a pluralidade.

### E5 — Webhook do Resend idempotente de verdade

Trocar `tx.emailEvent.create(...)` por `tx.emailEvent.upsert({ where: { logId_type_occurredAt: {...} }, create: {...}, update: {} })` — evento duplicado vira no-op sem exceção, sem 500, sem retry loop do Resend.

### E6 — Correção dos leads já criados

**Decisão do usuário:** esses registros não devem existir como `Lead` no CRM — o sinal de clique/visualização de e-mail deve alimentar só o Radar. Os dados já capturados (e-mail, telefone, eventos) continuam existindo via `RadarProfile`/`RadarEvent`, que não são tocados por essa correção.

Só executar **depois de E1 estar em produção** (senão o script de correção limpa e o bug recria os mesmos leads na hora seguinte). Escopo: apenas leads do dia do incidente (`originMetadata.attribution = "email_campaign"` sem `PublicFormSubmission` real vinculada, `createdAt` no dia do deploy). Rodar em dry-run primeiro; aplicar só com confirmação explícita nova, dado que mutação toca dados reais de 3 times pagantes.

---

## O que NÃO muda

- O sistema de score por pergunta/opção de formulário (D19-C) — não relacionado a este incidente.
- A bridge formulário → temperatura (D19-B-bis) — não relacionada.
- `form_completed` continua criando/atualizando lead normalmente, com todo o gate de qualidade já existente (`extractLeadDataFromSnapshot`, `findMatchingLead`).
- O caminho de identidade anônima do Radar (D8/D9) — usado sem alteração pelo E1.

---

## Testes necessários

| Caso | Assert |
|---|---|
| `form_viewed` com `cs_el` válido, sem submissão real | nenhum `Lead` novo no CRM; `RadarEvent` gravado no perfil resolvido por e-mail (não num perfil de sessão anônima) |
| `form_completed` real, mesmo `emailLogId` de um `form_viewed` anterior | `Lead` criado/atualizado normalmente; perfil Radar é o MESMO já usado pelo `form_viewed` (histórico de abertura/clique preservado, não fica órfão num perfil anônimo) |
| `form_viewed` quando já existe lead real (mesmo e-mail) | lead é encontrado e atualizado, nota de "iniciou formulário" anexada quando `form_started` |
| Lead criado direto em `new_opportunity` | `lead.status_changed` sim, `lead.milestone.new_opportunity` não |
| Lead que transiciona de outro status pra `new_opportunity` | ambos os eventos |
| Merge de 2 perfis Radar (telefone+e-mail colidindo) | `engagementScore` do vencedor reflete eventos dos dois |
| Merge de 2 leads no CRM com perfis Radar diferentes | os 2 perfis Radar viram 1 |
| Perfil com 8 eventos de e-mail + 3 `form.viewed`, mesmo dia | aba Contatos mostra 1 + 1, não 8 + 3; CRM fora da lista/total |
| Webhook duplicado do Resend (mesmo `logId`+`type`+`occurredAt`) | HTTP 200, sem erro novo no log |

---

## Critérios de aceitação

- `governance:check`/`governance:check-api-masking` verdes; sem allowlist novo.
- `bun run test:integration` verde com os casos novos.
- Nenhuma mudança de contrato de rota HTTP.
- Diff de E1-E5 restrito aos arquivos listados; nenhuma migration necessária (schema já suporta tudo).
- Script de correção (E6) roda em dry-run antes de qualquer `--apply`; escopado só ao dia do incidente.

---

## Estado da implementação (2026-08-05)

| Item | Status |
|---|---|
| E1 — sem Lead em `form_viewed` + resolve Radar por e-mail | ✅ Código |
| E1 follow-up — nome+telefone válidos na criação por atribuição | ✅ Código |
| E2 — milestone `new_opportunity` só em transição | ✅ Código (+ asserts D5 no integration test) |
| E3 — mergeProfiles score + MergeLeads Radar | ✅ Código |
| E4 — touchpoints canal×dia, CRM fora | ✅ Código |
| E5 — Resend upsert idempotente | ✅ Código |
| E6 — script cleanup dry-run | ✅ Código (dry-run only) |
| Deploy produção | ⏳ Aguardando |
| E6 `--apply` | ⏳ Bloqueado até E1 em prod + OK do owner |
| Migration remota | N/A (sem mudança de schema) |
