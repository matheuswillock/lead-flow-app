# Spec: Evolução do Módulo WhatsApp — Inbox de Leads por Time

Evolui o módulo WhatsApp existente (Evolution API, inbox por time) para o estado-alvo de plataforma de atendimento: RBAC de conversas alinhado à operação real, handoff bot↔humano sem conflito, tags, hub de gerenciamento, ações de lead no chat e desacoplamento do vendor via adapter.

**Baseada em:** `WHATSAPP_AUDIT.md` (2026-07-03). Ler antes de executar qualquer estágio.

---

## Background

O módulo já implementa: 1 número por Team (`TeamWhatsAppConfig.teamId @unique`), inbox realtime com RLS, auto-respostas com idempotência forte, atribuição de conversas com `handoffMode BOT|HUMAN`, vínculo conversa↔lead, e três páginas frontend no padrão `features/` canônico. A auditoria classificou os 6 requisitos-alvo como: multi-tenancy ✅, RBAC parcial, nome de contato parcial/bloqueado, tags inexistentes, página de gerenciamento parcial, ações no chat parciais.

### Lacunas (da auditoria)

1. Conversas inbound novas (`assignedProfileId = null`, `createdByProfileId = null`) visíveis **só ao master** — managers e operators não veem, leads novos ficam sem atendimento.
2. Envio manual de mensagem não seta `handoffMode = HUMAN` — bot pode responder por cima de humano.
3. Sem modelo de tags.
4. Sem "criar lead a partir da conversa" nem card de lead inline (Sheet).
5. `WhatsAppService` acoplado ao singleton concreto `evoApiService`; sem `IWhatsAppProvider` vendor-neutral (Meta Cloud API já planejada em `docs/WHATSAPP_CLOUD_API_IMPLEMENTATION.md`).
6. Evolution API/Baileys **não suporta** escrever nome de contato na agenda do aparelho — requisito 3 precisa de adaptação (decisão de produto pendente, ver Open Questions).
7. Delete/archive sem verificação de escopo de visibilidade; delete é hard delete sem trilha.

### Correção já aplicada fora dos estágios (2026-07-03)

O incidente de produção do health check do realtime (`WHATSAPP_AUDIT.md` §4.9 — staleness sintética → polling de fallback permanente de 12s → flicker de UI e re-download de mídia) foi **diagnosticado via HAR e corrigido em hotfix** antes do início dos estágios: saúde por transição real de status de canal, canais separados por escopo (team × conversa aberta), throttle/in-flight guard no `refreshUnreadCounts`, supressão de refetch redundante e preservação de identidade dos arrays de estado. Os estágios abaixo assumem esse comportamento como baseline; o Estágio 1 não deve reintroduzir dependências instáveis nos effects do realtime.

## Goals

### Primários (must-have)

1. **RBAC-alvo**: master e manager veem todas as conversas do time; operator vê atribuídas a ele **ou** sem responsável (`assignedProfileId = null`); master/manager podem atribuir/reatribuir operator responsável (já existe).
2. **Handoff sem conflito**: qualquer envio manual humano assume a conversa (`HUMAN` + auto-claim de assignee quando vago); ação explícita para devolver ao bot.
3. **Tags de conversa**: CRUD escopado por Team, relação N:N, filtro no inbox, gestão na página de gerenciamento.
4. **Página de gerenciamento** (`/whatsapp/configuracoes` promovida a hub): número/conexão (existente) + tags + parâmetros do módulo. Feature própria, separada do inbox (já é).
5. **Ações no chat**: criar Lead pré-preenchido a partir da conversa; associar a Lead existente (existe); abrir card do Lead em `Sheet` sem sair do chat.
6. **Adapter `IWhatsAppProvider`**: `WhatsAppService` deixa de importar `evoApiService` concreto; contratos vendor-neutral; Evolution vira uma implementação.
7. **Nome de contato (adaptado)**: resolução de display name com precedência `manual > lead/CRM > agenda do aparelho > pushName`, campo de origem, sem sobrescrita silenciosa. Push ao aparelho: fora de escopo (infactível no provider); envio opcional de vCard é fallback em avaliação (Open Question).

### Secundários

8. Guards de visibilidade em delete/archive + auditoria de exclusão.
9. Teste de paridade entre visibilidade TS (`buildConversationVisibilityWhere`) e SQL (`whatsapp_user_can_view_conversation`).

## Non-Goals

- **Não** migrar para Meta WhatsApp Cloud API nesta evolução (o adapter apenas prepara o seam; a implementação Meta segue `docs/WHATSAPP_CLOUD_API_IMPLEMENTATION.md` em iniciativa própria).
- **Não** tocar no domínio Bethânia/Studio Bot (`app/backoffice/(app)/studio-bot/`, `n8n/workflows/bethania-*`, `BackofficeEvoApiService`) — é módulo backoffice isolado por governança.
- **Não** reescrever o pipeline de idempotência do webhook (é ponto forte auditado).
- **Não** implementar LLM/IA de atendimento.
- **Não** alterar billing/quota de mensagens.

---

## Decisões arquiteturais

### D1 — RBAC: mudar a regra existente, sem flag de rollout

Alterar `buildConversationVisibilityWhere` e a função RLS diretamente, numa única migration + PR. **Justificativa:** a regra atual é mais restritiva que a alvo — a mudança só *amplia* visibilidade dentro do mesmo time (nunca cruza times), então o risco de vazamento é nulo e um flag/enum de transição adicionaria estado permanente para um corte único. A cláusula extra atual do operator (conversas de leads dele por telefone) **é mantida** como aditiva — remove-la reduziria visibilidade legítima.

### D2 — Handoff: `handoffMode` existente é suficiente; sem enum novo de status de conversa

Não criar `ConversationStatus` (OPEN/PENDING/RESOLVED etc.) nesta evolução. **Justificativa:** o conflito bot×humano se resolve com duas transições no enum já existente (`BOT→HUMAN` no envio manual; `HUMAN→BOT` em ação explícita "devolver ao bot"). Um workflow de status de atendimento é feature de produto separada e não é pré-requisito de nenhum dos 6 alvos; introduzi-la agora acoplaria RBAC, tags e handoff a uma máquina de estados não especificada.

### D3 — Tags: tabelas dedicadas `WhatsAppConversationTag` + join table, escopadas por `teamId`

Modelos novos `WhatsAppConversationTag` (id, teamId, name, color, sortOrder) e `WhatsAppConversationTagAssignment` (conversationId, tagId, unique composto), com FK `Team` e cascade. **Justificativa:** N:N explícito permite filtro indexado no inbox; escopo por `teamId` na tag (e não por config) sobrevive a reconexão/troca de número; cores usam tokens semânticos limitados (paleta fixa) para não violar o design system.

### D4 — Adapter: `IWhatsAppProvider` vendor-neutral em `app/api/services/whatsapp/provider/`

Nova interface com contratos neutros (connect/disconnect, sendText/sendMedia, fetchContacts, resolveMedia, webhooks normalizados) + `EvolutionWhatsAppProvider` implementando-a por delegação ao `EvoApiService` atual. `WhatsAppService` recebe o provider por injeção no construtor (mesmo padrão do `SendMessageUseCase`, que já injeta `IWhatsAppService`). **Justificativa:** `IEvoApiService` é interface *do vendor*, não do domínio — tipos `Evo*`, `instanceName` e QR vazam para o serviço. O plano Meta Cloud API existente torna o seam obrigatório antes de crescer o módulo. A referência `IVoiceProvider` citada no pedido não existe no repo; este adapter estabelece o padrão.

### D5 — Nome de contato: resolução interna com precedência e origem; sem push ao aparelho

Adicionar `contactNameSource` (`MANUAL | LEAD | PHONE_BOOK | PUSH_NAME`) a `WhatsAppConversation`. Regra de escrita: uma fonte só sobrescreve fontes de precedência **igual ou inferior** (`MANUAL > LEAD > PHONE_BOOK > PUSH_NAME`). UI de edição manual do nome no chat. **Justificativa:** Evolution/Baileys não escreve na agenda do aparelho (limitação de protocolo, auditada); a dor real do usuário — "quem é esse número?" — se resolve exibindo o melhor nome disponível de forma estável, e corrige o bug atual de `pushName` sobrescrever o nome da agenda a cada mensagem. Envio de vCard (contato se auto-salva) fica como Open Question de produto.

### D6 — Delete/archive: exigem `assertCanAccessConversation` + log de auditoria; sem soft delete

Manter hard delete (LGPD-friendly para conversa de terceiro), mas registrar evento de auditoria (quem, quando, qual conversa/telefone) antes do cascade e passar o `access` aos use cases. **Justificativa:** soft delete de mensagens de WhatsApp cria passivo de retenção; o que falta é rastreabilidade e coerência de escopo, não retenção.

---

## Estágios de implementação

> Cada estágio é um PR independente, na ordem abaixo (1→2 são correções P1; 3→6 features; 7 hardening). Todos os prompts assumem sessão nova sem contexto. Validação obrigatória em todo estágio: `bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check && bun run lint:pt-br` (+ `bun run design:check` quando houver UI).

### Estágio 1 — RBAC-alvo de visibilidade (TS + RLS em paridade)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_AUDIT.md (seções 3.2 e 4.1/4.7). Tarefa backend, sem UI.

Alinhe a visibilidade de conversas WhatsApp ao RBAC-alvo, em DOIS lugares que devem
ficar em paridade:

1. app/api/services/whatsapp/WhatsAppConversationAccessService.ts
   (buildConversationVisibilityWhere):
   - scope "manager": retornar undefined (vê todas as conversas do time, igual master).
   - scope "operator": OR de (a) assignedProfileId = profileId,
     (b) assignedProfileId = null (conversa sem responsável),
     (c) manter as cláusulas existentes de lead (assignedTo/closerId e telefone de lead).
2. Nova migration manual: bun run db:migrate:new whatsapp-rbac-target-visibility
   Reescrever CREATE OR REPLACE FUNCTION public.whatsapp_user_can_view_conversation
   espelhando exatamente a nova regra TS (manager-like = tudo do time; operator =
   assigned OR assignedProfileId IS NULL OR cláusulas de lead existentes).
   SQL idempotente. NÃO aplicar no remoto.
3. Criar teste de paridade em lib/whatsapp/conversation-access.test.ts (ou pasta de
   testes vigente) que documente a matriz papel×conversa (master/manager/operator ×
   sem assignee/atribuída a ele/atribuída a outro/lead dele) e valide
   buildConversationVisibilityWhere para cada célula.
4. Remover o GRANT SELECT para anon adicionado em
   supabase/migrations/20260701210943_whatsapp-realtime-rls.sql via REVOKE na nova
   migration (idempotente).
5. Atualizar o comentário WHATSAPP_SYNC_HISTORY_VISIBILITY_NOTE em
   lib/whatsapp/conversation-access.ts — a nota fica obsoleta com a nova regra.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run db:migrate:reset:local
```

**Não tocar:** rotas, use cases de atribuição (`AssignConversationUseCase`/`TakeoverConversationUseCase`), frontend, `ProcessEvoWebhookUseCase`, qualquer push remoto de migration.

**Critérios de aceite:**
- Manager lista todas as conversas do time via `GET /conversations` (antes: subset).
- Operator lista conversas com `assignedProfileId = null` (antes: só se telefone batesse com lead dele).
- Função SQL e where Prisma retornam o mesmo resultado para toda a matriz do teste.
- `db:migrate:reset:local` re-aplica todas as migrations sem erro.

**Validação manual:** com 3 usuários locais (master/manager/operator), enviar mensagem de um número desconhecido para o WhatsApp do time → conversa aparece para os três; atribuir a outro operator → some do operator não-atribuído (API e realtime).

### Estágio 2 — Handoff sem conflito + guards de delete/archive

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_AUDIT.md (seções 4.2 e 4.4). Tarefa backend + um botão de UI.

1. Handoff no envio manual: em app/api/services/whatsapp/WhatsAppService.ts
   (sendMessage) ou no SendMessageUseCase (escolher o ponto onde a conversa já foi
   carregada), após envio bem-sucedido de mensagem humana (NÃO auto-resposta):
   - se conversation.handoffMode === "BOT" → set "HUMAN";
   - se assignedProfileId === null → atribuir ao sentByProfileId (auto-claim).
   Uma única query de update condicional; não introduzir novo lookup de profile
   (TeamContext já resolvido).
2. Devolver ao bot: novo endpoint
   POST /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/handoff
   body { mode: "BOT" | "HUMAN" } → novo SetConversationHandoffUseCase retornando
   Output, com assertCanAccessConversation. mode BOT limpa assignedProfileId? NÃO —
   mantém assignee, só reativa auto-respostas.
3. Guards: DeleteConversationUseCase e ArchiveConversationUseCase passam a receber
   access: TeamAccess e chamar assertCanAccessConversation (rotas já têm o access —
   propagar). Em delete, logar console.info com teamId, conversationId,
   normalizedPhone e profileId do executor antes do delete.
4. UI mínima: no menu ConversationActionsMenu
   (app/[supabaseId]/whatsapp/features/components/ConversationActionsMenu.tsx),
   item "Devolver ao bot" (visível quando handoffMode === "HUMAN") e "Assumir
   conversa" (quando BOT) chamando o serviço do inbox (IWhatsAppInboxService +
   WhatsAppInboxService + context). Ícone lucide Bot/UserCheck, lock de request no
   clique.
5. Atualizar postman/Lead-Flow-API-Collection.json com o endpoint novo.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check
```

**Não tocar:** `ProcessWhatsAppInboundAutoResponseUseCase` (a checagem `handoffMode === "HUMAN"` existente já bloqueia o bot), pipeline de idempotência, RLS, página de configurações.

**Critérios de aceite:**
- Operador responde manualmente uma conversa `BOT` sem assignee → conversa fica `HUMAN` e atribuída a ele; keyword subsequente do contato **não** dispara auto-resposta.
- "Devolver ao bot" reativa auto-respostas mantendo o assignee.
- Manager não consegue excluir conversa fora do seu escopo (agora escopo = time inteiro, mas o guard fica correto por construção).
- Auto-respostas continuam funcionando em conversas `BOT` intocadas.

**Validação manual:** ativar regra KEYWORD; responder manualmente de um segundo aparelho → mandar keyword → sem auto-resposta; devolver ao bot → keyword → auto-resposta volta.

### Estágio 3 — Tags de conversa (schema + API + gestão + filtro)

**Prompt (copy-paste):**

```text
Leia agents.md, DESIGN.md e WHATSAPP_AUDIT.md (seção 3.4). Feature nova full-stack.

1. Schema (prisma/schema.prisma, seção WhatsApp):
   model WhatsAppConversationTag { id uuid, teamId uuid FK Team cascade, name text,
     color text (token key, não hex), sortOrder int default 0, timestamps,
     @@unique([teamId, name]), @@map("whatsapp_conversation_tags") }
   model WhatsAppConversationTagAssignment { id uuid, conversationId FK cascade,
     tagId FK cascade, createdAt, @@unique([conversationId, tagId]),
     @@index([tagId]), @@map("whatsapp_conversation_tag_assignments") }
   Migration: bun run db:migrate:from-prisma -- whatsapp-conversation-tags
   (requer Supabase local na 55322). Revisar SQL. NÃO aplicar no remoto.
2. Backend (padrão Route → UseCase → Prisma, Output, getTeamAccess, access
   propagado):
   - GET/POST /api/v1/teams/[teamId]/whatsapp/tags (listar/criar — criar é
     manager/master via canManageWhatsAppInfrastructure)
   - PATCH/DELETE /api/v1/teams/[teamId]/whatsapp/tags/[tagId]
   - PUT /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/tags
     body { tagIds: string[] } — substitui o conjunto; requer
     assertCanAccessConversation; valida que todas as tags pertencem ao teamId.
   - ListConversationsUseCase + WhatsAppRepository.listConversations: filtro
     opcional tagIds (some/in) e select das tags da conversa (select, não include).
3. Frontend:
   - Gestão de tags na página /whatsapp/configuracoes (seção própria no container,
     componente features/components/TagManagerCard.tsx): CRUD com Dialog, paleta
     fixa de cores por tokens semânticos, Badge para preview. Antes de criar
     markup, buscar componentes no shadcn MCP (badge, popover, command se precisar).
   - Inbox: Badge(s) de tag no ConversationItem; no MessagePanel um controle para
     atribuir/remover tags da conversa (Popover + lista com checkboxes); filtro por
     tag na ConversationList (services + context + types do inbox).
4. Postman: adicionar os endpoints novos.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check && bun run db:migrate:reset:local
```

**Não tocar:** RLS (tags não entram no realtime nesta fase), visibilidade de conversas, auto-respostas, webhook, domínio Bethânia/backoffice.

**Critérios de aceite:**
- Tag é única por `(teamId, name)`; conversa aceita N tags; excluir tag remove assignments (cascade).
- Operator vê e atribui tags nas conversas que enxerga; só manager/master criam/editam/excluem tags do time.
- Filtro por tag no inbox reduz a lista corretamente; sem hex hardcoded em TSX.
- Tags de um time nunca aparecem em outro (validação de `teamId` na API).

**Validação manual:** criar 2 tags, taguear conversa, filtrar, excluir tag e conferir que some da conversa; testar com segundo time que nada vaza.

### Estágio 4 — Ações de Lead no chat (criar lead + card em Sheet)

**Prompt (copy-paste):**

```text
Leia agents.md, DESIGN.md e WHATSAPP_AUDIT.md (seção 3.6). Feature frontend + 1
endpoint.

1. Criar Lead a partir da conversa:
   - Backend: POST /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/create-lead
     → novo CreateLeadFromConversationUseCase (Output): assertCanAccessConversation;
     recusa se conversation.leadId já preenchido; cria Lead reutilizando o serviço/
     repositório de leads existente (procurar padrão em app/api/useCases/lead* antes
     de escrever) com phone = contactPhone/normalizedPhone e name do body; vincula
     leadId à conversa na mesma transação.
   - Frontend: no menu ConversationActionsMenu e/ou header do MessagePanel, ação
     "Criar lead" abrindo Dialog pré-preenchido (nome = contactName, telefone =
     contactPhone, ambos editáveis). FieldGroup + Field, lock no submit.
2. Card do lead sem sair do chat:
   - Sheet (workflow shadcn MCP antes de código custom) aberto do header do
     MessagePanel quando leadId != null, exibindo o card do lead. Reutilizar
     componente existente de detalhe de lead se houver um desacoplado (procurar em
     app/[supabaseId]/components/LeadDialog.tsx e board/features antes de criar);
     caso contrário, criar features/components/LeadDetailsSheet.tsx buscando o lead
     via serviço do inbox (novo método no IWhatsAppInboxService ou reuso de serviço
     de leads existente na feature). Nunca navegar para outra rota.
   - SheetTitle obrigatório; conteúdo com scroll.
3. LinkLeadDialog: quando já vinculado, mostrar o nome do lead vinculado e oferecer
   "Trocar lead" e "Abrir card" (abre o Sheet).
4. Postman: endpoint novo.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check
```

**Não tocar:** `WhatsAppLeadSyncUseCase` (criação automática do welcome continua), visibilidade, tags, webhook, board/kanban (apenas ler componentes para reuso).

**Critérios de aceite:**
- Conversa sem lead → "Criar lead" gera lead com telefone da conversa e vincula; conversa com lead → ação indisponível (e API recusa).
- Card do lead abre em Sheet sobre o chat; fechar devolve ao chat no mesmo scroll.
- Duplo clique no submit não cria dois leads (lock + recusa no backend).

**Validação manual:** fluxo completo criar → abrir card → trocar lead → abrir card do novo lead, sem sair de `/whatsapp`.

### Estágio 5 — Adapter `IWhatsAppProvider` (desacoplar Evolution)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_AUDIT.md (seções 4.5 e D4 da WHATSAPP_SPEC.md). Refactor
backend puro, zero mudança de comportamento.

1. Criar app/api/services/whatsapp/provider/IWhatsAppProvider.ts com contratos
   vendor-neutral derivados do uso real em WhatsAppService.ts (mapear todos os
   call-sites de evoApiService antes de desenhar): connectInstance, getConnectionInfo,
   getQrCode, sendText, sendMedia, resolveMediaBase64, fetchContacts,
   fetchGroupParticipants, fetchChats, fetchMessagesSince, fetchProfilePictureUrl,
   setWebhook, disconnect, delete. Tipos próprios (WhatsAppProviderMessageResult
   etc.), sem prefixo Evo, sem leak de instanceName no nome dos tipos (pode existir
   como parâmetro "providerInstanceId").
2. Criar app/api/services/whatsapp/provider/EvolutionWhatsAppProvider.ts
   implementando a interface por delegação a EvoApiService (mover mapeamentos de
   tipo para cá). EvoApiService/IEvoApiService permanecem como cliente HTTP do
   vendor.
3. WhatsAppService passa a receber IWhatsAppProvider por injeção no construtor
   (default: instância EvolutionWhatsAppProvider), removendo o import direto de
   evoApiService. Mesmo padrão para SyncWhatsAppHistoryUseCase,
   SyncWhatsAppContactsUseCase, SyncWhatsAppGroupParticipantsUseCase,
   GetMessageMediaUseCase e demais call-sites diretos de evoApiService fora do
   provider (mapear com grep antes).
4. ProcessEvoWebhookUseCase fica como está nesta fase (payload parsing é
   vendor-specific por natureza) — apenas documentar no topo do arquivo que é o
   par inbound do EvolutionWhatsAppProvider.
5. Manter EvoApiService.send.test.ts verde; adicionar teste de contrato mínimo do
   EvolutionWhatsAppProvider (mapeamento de tipos) se houver harness de teste.

Zero mudança de payloads HTTP, zero mudança de schema. Validar:
bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br
```

**Não tocar:** rotas, schema, frontend, webhook route, comportamento de envio/reconexão (refactor transparente), domínio Bethânia (`BackofficeEvoApiService` fica fora — módulo isolado).

**Critérios de aceite:**
- `grep -r "evoApiService" app/api --include="*.ts"` só retorna hits dentro de `provider/` e do próprio `EvoApiService`.
- Nenhum tipo `Evo*` importado por `WhatsAppService` ou use cases.
- Envio de texto/mídia, QR, reconexão e syncs funcionam idênticos (smoke manual).

**Validação manual:** conectar instância local, enviar texto + imagem, receber mensagem, baixar mídia, desconectar/reconectar.

### Estágio 6 — Nome de contato: precedência, origem e edição manual

> **Pré-requisito:** resposta da Open Question 1 (adaptação aprovada).

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_AUDIT.md (seções 3.3, 4.3, D5). Full-stack.

1. Schema: enum WhatsAppContactNameSource { MANUAL LEAD PHONE_BOOK PUSH_NAME } e
   campo contactNameSource WhatsAppContactNameSource @default(PUSH_NAME) em
   WhatsAppConversation. Migration via
   bun run db:migrate:from-prisma -- whatsapp-contact-name-source. NÃO aplicar remoto.
2. Regra de precedência (MANUAL > LEAD > PHONE_BOOK > PUSH_NAME) centralizada em
   lib/whatsapp/contact-name.ts (função pura canApplyContactName(currentSource,
   incomingSource) + resolveDisplayName) com testes unitários.
3. Aplicar a regra nos pontos de escrita de contactName:
   - ProcessEvoWebhookUseCase.applyConversationSideEffects e
     healConversationSideEffectsIfNeeded: pushName só aplica se
     canApplyContactName(atual, "PUSH_NAME").
   - ProcessEvoWebhookUseCase.handleContactsUpsert: profileName aplica como
     PHONE_BOOK; pushName como PUSH_NAME.
   - LinkConversationToLeadUseCase e CreateLeadFromConversationUseCase: ao vincular
     lead com nome, aplicar como LEAD.
4. Edição manual: PATCH /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]
   aceitar { contactName } (assertCanAccessConversation) gravando source MANUAL.
   UI: editar nome no header do MessagePanel (ícone lápis, Dialog simples).
5. Backfill na migration: setar contactNameSource = 'PUSH_NAME' onde null (default
   cobre, mas garantir idempotência).
6. Postman: atualizar PATCH.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check && bun run db:migrate:reset:local
```

**Não tocar:** `TeamWhatsAppContact`/sync de contatos (continua sendo o espelho da agenda), auto-respostas, RLS, provider (nenhuma chamada nova ao vendor).

**Critérios de aceite:**
- Nome definido manualmente nunca é sobrescrito por webhook.
- Nome vindo da agenda (`CONTACTS_UPSERT` com `name`) não é mais sobrescrito por `pushName` de mensagem.
- Vincular lead com nome atualiza o display name da conversa (se fonte atual for PHONE_BOOK/PUSH_NAME).
- Matriz de precedência coberta por teste unitário.

**Validação manual:** receber mensagem (pushName aparece) → vincular lead com outro nome (nome muda) → editar manualmente (nome muda) → nova mensagem inbound (nome NÃO volta ao pushName).

### Estágio 7 — Hardening (webhook, rate limit, índice morto)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_AUDIT.md (seções 4.6, 4.8 e débito técnico). Backend puro.

1. Webhook: adicionar verificação de header apikey/HMAC no
   app/api/webhooks/whatsapp/evolution/[teamToken]/route.ts — Evolution permite
   configurar headers do webhook por instância; enviar um segundo segredo
   (WHATSAPP_WEBHOOK_HEADER_SECRET por config ou derivado do webhookSecret) no
   setWebhook do provider e validar no route (401 se ausente/inválido), com fase de
   tolerância configurável por env para instâncias antigas (log warn em vez de 401
   quando WHATSAPP_WEBHOOK_HEADER_ENFORCE=false).
2. Rate limit de envio: substituir lib/whatsapp/send-rate-limit.ts (Map in-memory)
   por implementação persistente. Preferência: contagem sobre whatsapp_usage_events
   (janela de 60s via query indexada) para não introduzir infra nova; documentar
   trade-off no próprio arquivo.
3. providerEventId: decidir por remoção — dropar o campo e o unique
   @@unique([teamId, providerEventId]) de WhatsAppMessage (migration from-prisma),
   OU populá-lo no createMessage a partir do id do evento Evolution se disponível
   no payload. Investigar payload real antes; default: popular, não remover.
4. Webhook 500-loop: quando o Output falhar por payload estruturalmente inválido
   de tipo conhecido (não erro transitório), retornar 200 com { processed: false }
   para não reciclar para sempre; manter 500 para erros transitórios (DB etc.).
5. Teste da saúde do realtime: extrair a decisão de saúde de
   hooks/useWhatsAppRealtime.ts (função pura status→healthy, hoje inline em
   publishHealth) para lib/whatsapp/realtime-health.ts e cobrir com teste
   unitário a matriz de status (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED,
   pendente, sem conversa aberta). Motivo: incidente §4.9 do WHATSAPP_AUDIT.md
   passou sem detecção por falta de cobertura. NÃO reintroduzir heurística de
   staleness por ausência de eventos.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run db:migrate:reset:local
```

**Não tocar:** idempotência existente, RBAC, UI, quota mensal/billing.

**Critérios de aceite:**
- Webhook sem header válido → 401 (com enforcement ligado); instâncias reconfiguradas continuam entregando.
- Rate limit efetivo com múltiplas instâncias (testável forçando 31 envios/min).
- Sem índice único morto em `whatsapp_messages`.

**Validação manual:** disparar webhook via curl sem header (401) e com header (200); rajada de envios até bloquear.

---

## Edge cases & error handling (transversais)

- Conversa re-roteada por `resolveTargetTeamContext` para outro time do master: tags e assignee pertencem ao time de destino; RBAC-alvo do Estágio 1 se aplica lá.
- Grupo (`isGroupChat`): auto-claim de handoff (Estágio 2) aplica normalmente; criação de lead a partir de grupo (Estágio 4) deve ser bloqueada (sem telefone individual).
- Lead excluído com conversa vinculada: `onDelete: SetNull` já limpa `leadId`; display name fonte LEAD permanece até nova escrita de precedência ≥ (aceitável, documentar).
- Redelivery de webhook após Estágio 6: healing path também passa pela regra de precedência (coberto no prompt).

## Security & privacy

- Nenhum estágio altera o isolamento entre masters; Estágio 1 apenas amplia visibilidade **dentro** do time.
- RLS continua espelhando a API (Estágio 1 muda ambos na mesma PR + teste de paridade).
- Push de migrations ao remoto **sempre** requer autorização explícita do owner (`bun run db:migrate:push:dry-run` antes).
- Auditoria de exclusão (Estágio 2) registra o executor.

## Success criteria (módulo)

1. Os 6 requisitos-alvo classificados como `existe` numa re-auditoria.
2. Zero divergência entre visibilidade TS e RLS (teste de paridade verde).
3. Nenhum import de `evoApiService` fora de `provider/`.
4. Bot nunca responde conversa com atendimento humano ativo (handoff automático).
5. `governance:check`, `typecheck`, `lint`, `design:check` verdes em todos os PRs.

## Open questions

1. **[BLOQUEANTE p/ Estágio 6]** A adaptação do requisito 3 (nome resolvido internamente com precedência, sem push ao aparelho — D5) atende o produto? Alternativa complementar: enviar vCard ao contato para que ele mesmo salve o número do time (suportado pela Evolution), útil como CTA de onboarding — incluir?
2. Estágio 3: tags devem aparecer no realtime (payload da conversa via RLS) ou só via fetch da API? Proposta: só API na v1 (evita mexer em RLS/publication).
3. Estágio 7, item 4: existe requisito de alerta (Sentry) quando webhooks de um config falham consecutivamente (número banido/instância morta)? Proposta: sim, capturar após N falhas seguidas.

## Decisions log

| Data | Decisão | Referência |
|------|---------|------------|
| 2026-07-03 | RBAC-alvo sem flag de rollout (mudança só amplia visibilidade intra-time) | D1 |
| 2026-07-03 | Sem enum novo de status de conversa; handoff usa `WhatsAppHandoffMode` existente | D2 |
| 2026-07-03 | Tags escopadas por `teamId` (não por config) | D3 |
| 2026-07-03 | Adapter `IWhatsAppProvider` vendor-neutral; `IEvoApiService` rebaixado a cliente HTTP do vendor | D4 |
| 2026-07-03 | Push de nome ao aparelho descartado (limitação Baileys); resolução interna com precedência | D5 |
| 2026-07-03 | Hard delete mantido + auditoria; sem soft delete | D6 |
| 2026-07-03 | Saúde do realtime = transições reais de status do canal; heurística de staleness proibida (hotfix do incidente §4.9 do audit) | hotfix |
