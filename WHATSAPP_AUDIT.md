# WHATSAPP_AUDIT.md — Auditoria do Módulo WhatsApp (Corretor Studio)

**Data:** 2026-07-03
**Método:** auditoria código-nível (audit factual + critique arquitetural), branch `develop`
**Escopo:** inbox WhatsApp de leads por time (Evolution API), auto-respostas, RBAC de conversas, RLS/realtime, workflows N8N da Bethânia
**Referências de contexto:** `agents.md`, `.github/instructions/project-context.instructions.md`, `DESIGN.md`, `specs/studio-bot-n8n.md`, `docs/obsidian/Bethânia.md`, `docs/WHATSAPP_CLOUD_API_IMPLEMENTATION.md`

---

## 1. Sumário executivo

O módulo WhatsApp **existe e é substancial**: 23 rotas `/api/v1/teams/[teamId]/whatsapp/**`, 27 use cases, serviço Evolution com interface, repositório dedicado, 3 páginas frontend no padrão `features/` canônico, RLS para realtime e idempotência forte no webhook. A fundação arquitetural é boa — o padrão `Route → UseCase → [Service] → Prisma` com `Output` e `getTeamAccess()` é seguido de forma consistente em todas as rotas.

Contra o estado-alvo, o quadro é:

| # | Requisito | Status | Resumo |
|---|-----------|--------|--------|
| 1 | Multi-tenancy (1 número por Team) | **existe** (com nuance) | `teamId @unique` em `TeamWhatsAppConfig`; espelhamento de número entre times do mesmo master via `primaryConfigId` |
| 2 | RBAC de conversas | **parcial** | Diverge do alvo: manager NÃO vê todas; operator NÃO vê `assignee = null` genericamente |
| 3 | Sincronização de nome de contato | **parcial / bloqueado** | Leitura (pull) existe; push para o aparelho **não é suportado pela Evolution API** (limitação do protocolo Baileys) |
| 4 | Tags em conversas | **não existe** | Zero modelos, rotas ou UI |
| 5 | Página de gerenciamento separada | **parcial** | `/whatsapp/configuracoes` e `/whatsapp/auto-respostas` são features próprias separadas do inbox; falta hub com tags/RBAC |
| 6 | Ações no chat | **parcial** | Vincular lead existente ✓; criar lead manual ✗; abrir card do lead sem sair do chat ✗ |

**Riscos críticos (critique):** gap de visibilidade que deixa conversas inbound novas invisíveis para managers/operators (P1), bot podendo responder por cima de humano que não clicou "assumir" (P1), delete/archive sem verificação de escopo de visibilidade (P1), acoplamento direto ao vendor Evolution dentro do `WhatsAppService` (P2).

**Incidente confirmado em produção (2026-07-03, corrigido):** heurística de "staleness" no health check do realtime marcava canal saudável como DEGRADED após 90s sem eventos, ativando permanentemente o polling de fallback de 12s (4 requisições por ciclo + re-download de mídia + flicker da UI). Ver §4.9.

**Bloqueio identificado:** o requisito 3 como escrito ("gravar programaticamente no aparelho") é **infactível** com Evolution API/Baileys — não existe endpoint de escrita na agenda do celular; o protocolo multi-device sincroniza agenda telefone→servidor, não o inverso. Ver §4.3 e a pergunta em aberto no final.

---

## 2. Mapa do módulo (arquivos-chave)

### Backend

| Camada | Arquivos |
|--------|----------|
| Webhook inbound | `app/api/webhooks/whatsapp/evolution/[teamToken]/route.ts` |
| Rotas produto (23) | `app/api/v1/teams/[teamId]/whatsapp/**` — config, conversations (+assign, link-lead, archive, unarchive, takeover), messages (+media), contacts, sync-contacts, sync-history, sync-group-participants, auto-response-rules, unread-count, usage, reconnect, disconnect, reusable-numbers, conversation-read |
| UseCases (27) | `app/api/useCases/whatsapp/*.ts` — destaque: `ProcessEvoWebhookUseCase`, `ProcessWhatsAppInboundAutoResponseUseCase`, `SendMessageUseCase`, `AssignConversationUseCase`, `TakeoverConversationUseCase`, `LinkConversationToLeadUseCase`, `WhatsAppLeadSyncUseCase` |
| Services | `app/api/services/whatsapp/WhatsAppService.ts` (1063 linhas), `WhatsAppConversationAccessService.ts`, `WhatsAppPhonePolicy.ts`, `evo/EvoApiService.ts` + `evo/IEvoApiService.ts` |
| Repositórios | `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts` + `IWhatsAppRepository.ts`, `WhatsAppAutoResponseRepository.ts` |
| Helpers | `lib/whatsapp/*` — `conversation-access.ts`, `send-rate-limit.ts`, `auto-response-evaluation.ts`, `normalize-phone.ts`, `webhook-signature.ts`, `team-has-whatsapp-feature.ts` |

### Schema Prisma (`prisma/schema.prisma:2530-2821`)

- `TeamWhatsAppConfig` — 1:1 com Team (`teamId @unique`), `webhookSecret`, `primaryConfigId` (espelhamento), quota mensal, history sync
- `WhatsAppConversation` — `teamId`, `configId`, `leadId?`, `assignedProfileId?`, `createdByProfileId?`, `handoffMode (BOT|HUMAN)`, `unreadCount`, `isArchived`
- `WhatsAppMessage` — `@@unique([teamId, providerMessageId])`, `@@unique([teamId, providerEventId])`, direção/tipo/status, mídia, `rawPayload`
- `WhatsAppUsageEvent`, `WhatsAppAutoResponseRule`, `WhatsAppAutoResponseLog` (unique CAS), `TeamWhatsAppContact`
- FKs para `Team`, `Profile` e `Lead` presentes em todos os modelos relevantes ✓

### Frontend

| Página | Estrutura |
|--------|-----------|
| `/[supabaseId]/whatsapp` (inbox) | `features/{context,services,container,components,hooks,utils}` — canônico ✓, `page.tsx` thin ✓ |
| `/[supabaseId]/whatsapp/configuracoes` | `features/{context,services,container,components}` — canônico ✓, manager-only na sidebar |
| `/[supabaseId]/whatsapp/auto-respostas` | `features/{context,services,container,components}` — canônico ✓, manager-only |
| Realtime | `hooks/useWhatsAppRealtime.ts`, `hooks/useWhatsAppUnreadCount.ts` + RLS supabase |

### Infra / N8N / Bethânia

- Migrations: `supabase/migrations/20260701210943_whatsapp-realtime-rls.sql`, `20260702111737_whatsapp-realtime-rls-visibility.sql`, `20260701145209_add-autoresponse-log-unique.sql`
- Bethânia: `n8n/workflows/bethania-*.json` (9 workflows), instância Evolution **dedicada** `bethania` (`EVO_BETHANIA_INSTANCE`), domínio backoffice separado (`app/backoffice/(app)/studio-bot/`, `BackofficeEvoApiService`) — **não intercepta o inbox de leads**
- Evolution self-hosted: `docker-compose.evolution.yml`, `supabase-evolution/README.md`, `deploy/vps-bootstrap.sh`

---

## 3. AUDIT — os 6 requisitos, linha a linha

### 3.1 Multi-tenancy — `existe` (com nuance documentada)

**Evidência:**
- `TeamWhatsAppConfig.teamId String @unique` (`prisma/schema.prisma:2627`) — no máximo 1 config por Team.
- Toda conversa e mensagem carrega `teamId` com FK `onDelete: Cascade` para `Team`.
- Webhook autentica por `webhookSecret` único no path e resolve `teamId`/`configId` a partir do config (`app/api/webhooks/whatsapp/evolution/[teamToken]/route.ts:26-29`).
- `WhatsAppPhonePolicy` (`assertNoConflictingPhoneOnSameTeam`, `assertPhoneNumberCanConnect`) impede número conflitante.
- Todas as 23 rotas validam `getTeamAccess()` + `access.teamId !== teamId → 403`.

**Nuances (não violam isolamento entre masters, mas relativizam "1 número = 1 team"):**
1. **Espelhamento**: `primaryConfigId`/`mirroredConfigs` permite o mesmo número físico espelhado em múltiplos times **do mesmo master** (`ProcessEvoWebhookUseCase.handleConnectionUpdate:513-538` propaga status para mirrors).
2. **Re-roteamento cross-team**: `resolveTargetTeamContext` (`ProcessEvoWebhookUseCase.ts:419-450`) redireciona mensagem inbound para outro time do mesmo master quando o telefone bate com lead de lá. Escopado por `masterId` — sem vazamento entre masters distintos — mas significa que a conversa pode "morar" num time diferente do que recebeu o webhook.

### 3.2 RBAC de conversas — `parcial` (diverge do alvo)

**O que o alvo pede:** master/manager veem **todas**; operator vê **atribuídas a ele OU sem responsável** (`assignee = null`).

**O que existe** (`app/api/services/whatsAppConversationAccessService.ts` → `buildConversationVisibilityWhere`, espelhado em SQL na função `whatsapp_user_can_view_conversation` de `20260702111737_whatsapp-realtime-rls-visibility.sql`):

| Papel | Visibilidade atual | Diferença vs alvo |
|-------|--------------------|--------------------|
| master | tudo (`undefined` where) | ✓ conforme |
| manager | apenas: atribuídas/criadas por ele + atribuídas/criadas por operators + conversas com mensagem enviada por operator | ✗ **não vê tudo** — conversas inbound novas (`createdByProfileId = null`, sem assignee) são invisíveis |
| operator | atribuídas a ele OU lead dele (`assignedTo`/`closerId`) OU sem lead com telefone de lead dele | ✗ **não vê `assignee = null`** de contatos desconhecidos |

Consequência prática documentada no próprio código (`lib/whatsapp/conversation-access.ts:23-28`): *"Conversas importadas por sync-history ficam visíveis ao master até envolvimento de operator"* — e o mesmo vale para **qualquer conversa inbound orgânica de número desconhecido**: só o master a vê até atribuí-la. Num time onde o master não opera o inbox, leads novos ficam sem atendimento.

**Atribuição/reatribuição — conforme:**
- `AssignConversationUseCase`: master/manager atribuem a qualquer membro do time (valida membership); operator só a si mesmo e apenas se `assignedProfileId` for `null` ou dele. Atribuir seta `handoffMode: "HUMAN"` ✓.
- `TakeoverConversationUseCase`: "assumir" = assignee + `HUMAN` ✓.
- `getTeamAccess()` usado em 23/23 rotas; `getBackofficeAccess()` não aparece no módulo ✓.

### 3.3 Sincronização de nome de contato — `parcial`; push ao aparelho `bloqueado por limitação do provider`

**O que existe (direção aparelho → Corretor Studio):**
- `pushName` do webhook atualiza `conversation.contactName` a cada mensagem (`ProcessEvoWebhookUseCase.applyConversationSideEffects:386-388`).
- Eventos `CONTACTS_UPSERT`/`CONTACTS_UPDATE` atualizam nome com precedência `profileName ?? pushName` (`handleContactsUpsert:698-702`) — `profileName` = nome salvo na agenda do celular.
- `SyncWhatsAppContactsUseCase` + `TeamWhatsAppContact` importam a agenda do aparelho para o banco.

**O que NÃO existe:**
- **Push programático de nome para o aparelho.** `IEvoApiService` não tem endpoint de escrita de contato — só `findContacts` (leitura), `sendContact` (envia vCard como mensagem) e `updateProfileName` (nome do próprio perfil da instância). A Evolution API (baseada em Baileys) **não expõe** endpoint para criar/editar contato na agenda do celular vinculado; o protocolo WhatsApp multi-device sincroniza a agenda telefone→servidor, nunca o inverso. O requisito 3 como escrito é infactível com o provider atual (seria factível apenas via WhatsApp Business Cloud API + integração externa de contatos, que também não escreve na agenda do aparelho).
- **Regra "não sobrescrever nome já salvo":** hoje o `pushName` (nome que o próprio contato escolheu) **sobrescreve** o `contactName` a cada mensagem, inclusive por cima do `profileName` da agenda aplicado por `CONTACTS_UPSERT` — churn silencioso na direção errada. Não há campo de origem do nome (`contactNameSource`) nem edição manual de nome na UI.
- Nenhum uso do nome do lead/CRM como fonte de display name da conversa (o vínculo `leadId` existe, mas a UI mostra `contactName`).

### 3.4 Tags em conversas — `não existe`

- Nenhum modelo `*Tag*` relacionado a WhatsApp no schema (única ocorrência de "tag" é `transferTagUsed` em outro domínio, `prisma/schema.prisma:1874`).
- Nenhuma rota, use case, repositório ou componente de tag no módulo.

### 3.5 Página de gerenciamento separada do inbox — `parcial`

**Conforme estruturalmente:**
- Inbox (`/whatsapp`), Configurações (`/whatsapp/configuracoes`) e Auto-respostas (`/whatsapp/auto-respostas`) são **três features distintas**, cada uma com `features/context|services|container` completo — nada é aba dentro do inbox ✓.
- Sidebar separa os itens com `managerOnly: true` para configurações/auto-respostas e feature slugs próprios (`FEATURE_SLUGS.WHATSAPP`, `WHATSAPP_SETTINGS`, `WHATSAPP_AUTO_RESPONSES`) (`components/app-sidebar.tsx:144-147`).

**Incompleto funcionalmente:**
- A página de configurações cobre apenas conexão do número (QR, status, disconnect/reconnect, sync). O alvo pede um hub de gerenciamento que inclua também **tags** (não existem) e **parâmetros de RBAC** (não existem — a visibilidade é hardcoded).

### 3.6 Ações no chat — `parcial`

| Ação do alvo | Status | Evidência |
|--------------|--------|-----------|
| Associar conversa a lead existente (busca/seleção) | ✓ existe | `LinkLeadDialog.tsx` (busca com debounce 400ms, lock `isLinkingLead`), acionado no header do `MessagePanel.tsx:118`; backend `LinkConversationToLeadUseCase` com `assertCanAccessConversation` ✓ |
| Criar novo Lead a partir da conversa (pré-preenchido) | ✗ não existe | Nenhuma ação manual. Existe apenas criação automática via `WhatsAppLeadSyncUseCase` disparada pelo fluxo de boas-vindas do auto-responder |
| Abrir card do Lead sem sair do chat (Sheet/Dialog) | ✗ não existe | Quando vinculado, o botão vira "Lead vinculado" mas reabre o mesmo dialog de busca; não há painel lateral, nem sequer link de navegação para o lead |
| Menu de ações da conversa | parcial | `ConversationActionsMenu.tsx` tem só Arquivar/Desarquivar/Excluir (com `AlertDialog` de confirmação ✓) |

---

## 4. CRITIQUE — riscos arquiteturais

### P1 — corrigir antes de evoluir o módulo

**4.1 Gap de visibilidade deixa conversas novas órfãs (funcional + operacional).**
Conversa inbound de número desconhecido nasce com `assignedProfileId = null` e `createdByProfileId = null` → visível **apenas ao master** (§3.2). Em times onde o master não opera o inbox, mensagens de leads novos ficam sem atendimento e sem alerta. É também a divergência central vs o RBAC-alvo. A correção exige mudar **dois lugares em sincronia**: `buildConversationVisibilityWhere` (TS) e `whatsapp_user_can_view_conversation` (SQL/RLS) — ver risco 4.7.

**4.2 Bot pode responder por cima de humano não-"assumido".**
As auto-respostas respeitam `handoffMode === "HUMAN"` (`ProcessWhatsAppInboundAutoResponseUseCase.ts:95-97`) e tanto assign quanto takeover setam `HUMAN` ✓. Porém **enviar mensagem manual não altera `handoffMode`** (`SendMessageUseCase` / `WhatsAppService.sendMessage` não tocam no campo). Cenário concreto: operador responde uma conversa sem clicar "assumir" → conversa continua `BOT` → próxima mensagem do contato com keyword dispara auto-resposta por cima do atendimento humano. Não há tampouco caminho de volta `HUMAN → BOT` na UI (devolver ao bot após resolver).

**4.3 Requisito de nome no aparelho é infactível com Evolution API.**
Detalhado em §3.3. Decisão de produto necessária (pergunta em aberto no final). A spec propõe adaptação: resolução de display name dentro do Corretor Studio com precedência e proteção contra sobrescrita + envio opcional de vCard.

**4.4 Delete/Archive ignoram o escopo de visibilidade e delete é destrutivo sem trilha.**
`DeleteConversationUseCase` e `ArchiveConversationUseCase` validam apenas `findConversationByIdForTeam` (team certo), **sem** `assertCanAccessConversation`. As rotas restringem a manager/master, mas um manager pode excluir conversas **fora do seu próprio escopo de visibilidade** (que hoje é restrito, §3.2) — inconsistência de modelo. Excluir é hard delete com cascade de todas as mensagens, sem soft delete nem registro de auditoria de quem excluiu.

### P2 — endereçar no ciclo de evolução

**4.5 Acoplamento direto ao vendor Evolution.**
`IEvoApiService` existe (interface + implementação ✓), mas: `WhatsAppService` importa o **singleton concreto** `evoApiService` (`WhatsAppService.ts:4`) em vez de receber a interface por injeção; os tipos `Evo*` e conceitos do vendor (instanceName, QR, remoteJid) vazam para o serviço de domínio; `enum WhatsAppProvider` tem só `EVOLUTION` e nenhum seam para segundo provider. `docs/WHATSAPP_CLOUD_API_IMPLEMENTATION.md` já planeja Meta Cloud API — sem um `IWhatsAppProvider` vendor-neutral, essa entrada será um segundo caminho paralelo. *(Nota: o padrão `IVoiceProvider` citado como referência no pedido de auditoria não existe no repositório atual — a referência interna real de adapter é o próprio `IEvoApiService`, que precisa subir um nível de abstração.)*

**4.6 Webhook autenticado só por secret na URL.**
`webhookSecret` no path é a única autenticação (`[teamToken]/route.ts:24-29`); `isValidEvoWebhookPayload` valida estrutura, não assinatura. URLs vazam em logs de proxy/CDN e histórico. A Evolution API suporta header de apikey no webhook; não há HMAC do corpo. Mitigado por: secret rotacionável por config, lookup indexado, idempotência forte a jusante. **Idempotência, aliás, é ponto forte**: unique `[teamId, providerMessageId]` + healing de redelivery + CAS `claimWelcomeSlot` + claim-log com unique `[conversationId, ruleType, inboundMessageId]` antes do envio. Detalhe: `providerEventId` tem unique index mas **nunca é populado** em `createMessage` — índice morto.

**4.7 Lógica de visibilidade duplicada em TS e SQL.**
`buildConversationVisibilityWhere` (Prisma) e `whatsapp_user_can_view_conversation` (RLS SECURITY DEFINER) implementam a mesma regra em duas linguagens. Qualquer evolução de RBAC (inclusive a correção 4.1) precisa alterar ambas na mesma mudança, ou o realtime mostrará conversas que a API nega (ou vice-versa). Não há teste que compare as duas.

**4.8 Rate limit de envio é in-memory.**
`lib/whatsapp/send-rate-limit.ts` usa `Map` no processo — em serverless (Vercel) cada instância tem seu contador, tornando o limite de 30/min por time inefetivo sob escala horizontal. Quota mensal (usage events no banco) está correta.

### P1 resolvido — incidente de produção (2026-07-03)

**4.9 [CORRIGIDO] Health check sintético degradava realtime saudável e ativava polling permanente.**
Confirmado em produção via HAR: 4 requisições em bloco a cada 12s exatos (lista de conversas, mensagens da conversa aberta e 2 variações `hasUnread`) durante toda a sessão, com o canal realtime recebendo eventos normalmente. Cadeia da causa raiz:
1. `useWhatsAppRealtime.publishHealth` marcava o canal como DEGRADED quando inscrito há >90s **sem eventos há >90s** ("stale") — inbox quieta era indistinguível de canal morto.
2. O `WhatsAppInboxHook` reagia ao estado degradado com polling de fallback a cada 12s (`loadConversations` + `loadMessages` + `refreshUnreadCounts`).
3. O polling não atualizava `lastEventAtRef` (só evento postgres_changes real), então o estado "degradado" se autoalimentava até chegar um evento real — daí o flapping `Health: DEGRADED (stale)` ↔ `OK` no console sem transição real de conectividade.

Agravantes no mesmo caminho: (a) o effect único do realtime dependia de `selectedConversationId`, derrubando e recriando **ambos** os canais a cada clique em conversa; (b) `refreshUnreadCounts` sem in-flight guard/throttle, chamado por todo evento UPDATE de conversa e em duplicidade após `markConversationRead`; (c) refetch completo de mensagens redundante quando o INSERT já tinha chegado via realtime; (d) refetch substituía a identidade dos arrays mesmo sem mudança → re-render em cascata + re-download de mídia (o "piscar" da UI). Violação direta da regra de governança "useEffect Request Discipline".

**Correção aplicada** (mesma data): saúde derivada só de transições reais de status do canal (staleness removida; `CLOSED` inesperado agora reconecta, com guarda de geração); canais separados por escopo (conversas por team, mensagens por conversa aberta); throttle de 4s + in-flight guard no `refreshUnreadCounts`; supressão do refetch de heal quando o merge incremental já ocorreu; preservação de identidade dos arrays quando o refetch devolve dados equivalentes. Arquivos: `hooks/useWhatsAppRealtime.ts`, `app/[supabaseId]/whatsapp/features/context/WhatsAppInboxHook.ts`.

### P3 — higiene

- **RLS**: `GRANT SELECT ... TO anon` na migration `20260701210943` sem policy para `anon` (efeito zero, mas grant desnecessário — remover).
- **Churn de `contactName`**: `pushName` sobrescreve nome vindo da agenda a cada mensagem (§3.3).
- **`resolveTargetTeamContext`** roda 2-3 queries extras por mensagem inbound; indexado, mas é hot path do webhook.
- **Webhook retorna 500 quando `Output.isValid === false`** → Evolution reenvia; bom para retry transitório, mas payload estruturalmente inválido de tipo conhecido reciclaria para sempre (mitigado por idempotência).

---

## 5. Conformidade com governança (amostra auditada)

| Regra | Status |
|-------|--------|
| `Route → UseCase → [Service] → Prisma` | ✓ nas rotas amostradas (messages, conversations, assign, link-lead, archive, delete, webhook) |
| UseCase retorna `Output` | ✓ em todos os 27 use cases amostrados |
| `getTeamAccess()` único ponto de resolução | ✓ 23/23 rotas; `access` propagado como parâmetro aos use cases |
| RLS via migration Supabase (não SQL Editor) | ✓ duas migrations versionadas |
| Frontend `page → features/context|services|container` | ✓ nas 3 páginas; services com interface + implementação ✓ |
| shadcn + tokens semânticos | ✓ nos componentes amostrados (`LinkLeadDialog`, `ConversationActionsMenu`: Dialog com `max-h-[90vh] flex flex-col`, `AlertDialog` para destrutivo, tokens `text-muted-foreground`/`bg-destructive`, ícones lucide) |
| Postman atualizado | ✓ `postman/Lead-Flow-API-Collection.json` contém endpoints WhatsApp |
| Logs `[Rota][MÉTODO]` | ✓ padrão seguido |

**Débito técnico registrado:**
1. `providerEventId` nunca populado (índice único morto em `whatsapp_messages`).
2. Duplicação TS/SQL da regra de visibilidade sem teste de paridade.
3. `WhatsAppService` com 1063 linhas concentrando conexão, envio, mídia e usage — candidato a split quando o adapter for extraído.
4. Rate limit in-memory.
5. Sem soft delete/auditoria de exclusão de conversa.
6. `EvoApiService.send.test.ts` é o único teste do módulo — RBAC (`buildConversationVisibilityWhere`), auto-response evaluation e a lógica de saúde/reconexão do realtime (`useWhatsAppRealtime`) não têm cobertura. A ausência de teste no health check foi fator direto do incidente §4.9.

## 6. Pontos positivos (manter e replicar)

- **Idempotência do pipeline inbound é exemplar** — unique constraints + healing + CAS + claim-before-send no auto-responder (com comentários explicando a intenção).
- Aderência disciplinada à arquitetura de governança em backend e frontend — o módulo pode ser evoluído sem refatoração estrutural.
- Separação limpa Bethânia (instância `bethania`, domínio backoffice) × inbox de leads (config por team) — sem contaminação de domínios, como exigido pela spec `studio-bot-n8n.md`.
- RLS de realtime espelhando a visibilidade da API (mesmo que duplicada, a intenção de paridade existe e está comentada na migration).
- Sanitização de texto de entrada (`sanitize-db-text`), progressão monotônica de status de mensagem, quota mensal com usage events bilhetáveis.
- **Read receipts outbound (ticks do corretor):** status de mensagens enviadas via webhook `MESSAGES_UPDATE` + UI em `MessagingMessageBubble`.
- **Read receipts inbound (contato vê ✓✓ azul):** `MarkConversationReadUseCase` + `POST conversation-read` enviam `markMessageAsRead` à Evolution quando a instância está `CONNECTED` (gatilhos já existentes no inbox: abrir conversa e inbound com chat aberto). Campo `readAt` em mensagens INBOUND registra receipt enviado; em OUTBOUND continua significando leitura pelo contato.

---

## 7. Pergunta em aberto (bloqueante para o requisito 3)

A Evolution API (Baileys) não expõe endpoint para gravar/editar contato na agenda do aparelho — o requisito "gravar programaticamente no aparelho" não pode ser implementado como escrito. A `WHATSAPP_SPEC.md` propõe a adaptação (resolução de nome interna com precedência manual > lead/CRM > agenda > pushName, campo de origem do nome, e envio opcional de vCard para o contato salvar). **Confirmar se essa adaptação atende o produto ou se o requisito deve ser redefinido.**
