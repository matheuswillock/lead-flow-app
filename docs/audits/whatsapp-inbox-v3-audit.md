# Auditoria de acompanhamento — WhatsApp Inbox V3 (pós-Fase 4, produção)

**Data:** 2026-07-28
**Escopo:** Backend Evolution API v3 (webhook/outbox/reconciliação), frontend do Inbox, banco de dados, infraestrutura (Vercel, Supabase Realtime, VPS Hostinger).
**Método:** Leitura de código + consulta a logs/telemetria de produção via MCP (Vercel runtime logs/errors, Supabase Realtime logs + Advisors, Hostinger VPS). Nenhuma alteração de código foi feita.

## 0. Relação com documentos anteriores

Este módulo já tem um processo de auditoria/SPEC maduro. Este documento **não substitui nem repete** o trabalho anterior — é um acompanhamento pós-implantação, feito com evidência de produção que não estava disponível na rodada anterior.

| Documento | Papel |
| --- | --- |
| [`WHATSAPP_INBOX_AUDIT.md`](../../WHATSAPP_INBOX_AUDIT.md) | Auditoria original (2026-07-23), achados `WA-001`–`WA-025`, todos endereçados nas Fases 0–4. |
| [`WHATSAPP_INBOX_SPEC.md`](../../WHATSAPP_INBOX_SPEC.md) | SPEC executada; §2.1 mostra Fases 0–4 **"concluída (código)"**, com pendências ops explícitas (migrations remotas, homologação Evolution para reagir/apagar-para-todos, gate SLO 7 dias). |
| [`whatsapp-inbox-v3-phase-4/impeccable-audit.md`](whatsapp-inbox-v3-phase-4/impeccable-audit.md) e `impeccable-critique.md` | Revisão de UX da Fase 4 (score 16/20, "Good"), confirma que reagir/apagar-para-todos ficam `CAPABILITY_UNAVAILABLE` até homologação — **não é bug, é decisão documentada**. |

**Fechamento de lacuna importante**: a auditoria original registrava em §2.5 que "o MCP do Supabase está configurado, mas suas ferramentas não foram expostas/autenticadas" e o backlog (Fase A, item 5) pedia explicitamente "Executar Advisors e matriz de grants/RLS no Supabase de produção" — isso **não tinha sido feito ainda**. Esta rodada teve acesso a Vercel MCP, Supabase MCP (logs + Advisors) e Hostinger VPS MCP, cobrindo essa lacuna (seção 6) e trazendo evidência de produção nova (seção 2-3).

Continuando a numeração da matriz de achados original (`WA-001`–`WA-025`), os achados novos desta rodada usam `WA-026` em diante.

---

## 1. Sintomas relatados nesta rodada

1. Respostas de contatos demoram a aparecer no inbox.
2. Ticks de confirmação (enviado/entregue/lido) não atualizam.
3. Reagir e "apagar para todos" não funcionam.
4. Mensagens chegam fora de ordem / "sem sentido" mesmo quando o contato responde rápido no WhatsApp.
5. Front-end "ainda feio".
6. Pergunta em aberto: vale migrar a sincronização para WebSocket próprio?

## 2. Matriz de achados novos

| ID | Sev. | Achado | Evidência | Relacionado a |
| --- | --- | --- | --- | --- |
| WA-026 | P1 | Ordenação de mensagens usa `createdAt` (hora de inserção no banco), não o `messageTimestamp` real do WhatsApp — mensagens ficam fora de ordem quando há retry/reprocessamento assíncrono | Código | Estende decisão de §9.1 da SPEC ("índice `createdAt` permanece") |
| WA-027 | P1 | Canal Presence do Realtime estourando rate limit repetidamente em produção, degradando a via primária de sincronização do inbox | Produção (Supabase MCP) | WA-015 (saúde do Realtime invisível) — aqui é a manifestação concreta em prod |
| WA-028 | P1 | Roteamento cross-team (contas com número compartilhado) faz ACK e delete-recebido serem procurados pelo `teamId` original (não o roteado) e silenciosamente não aplicados | Código | WA-025 (contato canônico/JID) — bug distinto, no lookup pós-roteamento |
| WA-029 | P2 | Mesmo com a Evolution homologada para reagir/apagar-para-todos, a feature ainda não funcionaria: falta parse de `reactionMessage` inbound, falta write-path em `WhatsAppMessageReaction`, e a UI de reagir é um dead-end (`toast.error` incondicional) | Código | §13.7 da SPEC assume que só falta habilitar a capability — este achado mostra que não é só isso |
| WA-030 | P2 | `deletedForEveryoneAt`/`isPinned`/`isFavorite`/`isHiddenForMe` não são propagados via Realtime — outra aba/dispositivo só vê a mudança após refetch manual | Código | Estende RT-001–008 (que só cobrem status de mensagem) |
| WA-031 | P2 | `PRESENCE_UPDATE`/`GROUP_PARTICIPANTS_UPDATE` são subscritos mas caem em branch `else` (log apenas) — confirmado como ruído frequente em produção | Produção (Vercel MCP) | Novo |
| WA-032 | P2 | Contexto do Inbox sem `useMemo` (objeto novo a cada render) + zero `React.memo` em itens de lista + sem virtualização da lista de mensagens | Código | Estende WA-020 (arquivos monolíticos) com mecanismo específico de re-render em cascata |
| WA-033 | P2 | Inconsistência visual: balões de mensagem recebida aparecem sem o `bg-muted` esperado pelo `variant="secondary"` do componente `Bubble` | Captura enviada pelo usuário | Precisa reprodução ao vivo para localizar a causa exata |
| WA-034 | P2 | Advisors do Supabase (agora executados) mostram FKs sem índice de cobertura em várias tabelas `whatsapp_*` e RLS de `whatsapp_auto_response_*` reavaliando `auth.*()` por linha | Produção (Supabase MCP) | Fecha a Fase A item 5 do backlog original |
| WA-035 | P2 (ops) | Não foi possível auditar os containers Docker da Evolution API na VPS Hostinger via MCP (`Docker Manager` não suportado pelo SO da VM) — limita a confirmação de causa adicional do atraso do lado do provider | Ferramenta (Hostinger MCP) | Limitação de auditoria, não é achado de produto |

---

## 3. Achados detalhados

### WA-026 — P1 — Ordenação por hora de inserção, não por timestamp real do WhatsApp

`WhatsAppMessage` (`prisma/schema.prisma`) não guarda o `messageTimestamp` do payload Evolution/Baileys em coluna própria — só `createdAt`/`updatedAt` (controlados pelo Prisma) e `sentAt/deliveredAt/readAt/playedAt/failedAt` (só valem para ACK de outbound). O índice de suporte é `@@index([conversationId, createdAt(sort: Asc)])`, mantido deliberadamente pela SPEC (§9.1: "índice `(conversationId, createdAt ASC)` permanece").

As duas queries que alimentam a tela do inbox ordenam por essa coluna:
- `WhatsAppRepository.listMessages` (`app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts:618-652`) — `orderBy: { createdAt: "desc" }`.
- `WhatsAppRepository.searchConversationMessages` (mesmo arquivo, ~1690-1723) — mesmo padrão.

O pipeline de escrita é assíncrono e pode gravar fora da ordem cronológica real: webhook → outbox (`WhatsAppWebhookEvent`) → processamento em `after()` best-effort → cron de recuperação a cada 5 min com `OUTBOX_CONCURRENCY = 10` (sem garantia de ordem entre eventos concorrentes) → retry com backoff `[1m, 5m, 15m, 1h, 6h]`. Um evento que precisou de retry pode ser gravado minutos depois de um evento mais recente da mesma conversa que passou de primeira — e a tela, ordenando por `createdAt`, mostra a ordem de gravação, não a ordem real de envio.

Isso bate com o relato do usuário e com o print enviado (mensagens sem sequência clara).

**Correção proposta**: adicionar `providerTimestamp` (extraído do `messageTimestamp` já presente em `rawPayload`) e ordenar por ele, com fallback para `createdAt` em linhas antigas.

### WA-027 — P1 — Rate limit de Presence degradando o Realtime em produção

Vercel MCP confirma que o backend processa o webhook rapidamente (`whatsapp_webhook_to_ui_ms` entre 33ms–599ms; zero erros 4xx/5xx nas rotas WhatsApp em 7 dias). O gargalo não é o backend.

Logs do Supabase Realtime (MCP, projeto `wcnxwdcoambpfwxwubka`) mostram **múltiplas ocorrências** de `ClientPresenceRateLimitReached: :client_rate_limit_exceeded` ao longo de várias horas — o canal de Presence (`hooks/useTeamPresence.ts`) excede o limite do tenant. O tenant também é desligado por inatividade e precisa reinicializar a conexão de replicação (~100–250ms) quando o próximo usuário conecta.

WA-015 (auditoria original) já apontava que "a saúde do Realtime é invisível" — o frontend hoje modela isso via `CONNECTING|LIVE|DEGRADED|OFFLINE` (RT-001 da SPEC) e cai em polling degradado a cada 12s quando o canal falha. Este achado mostra a causa concreta, em produção, de por que o canal cai para esse modo degradado: rate limit de Presence, não falta de infraestrutura.

**Correção proposta**: reduzir frequência/throttle de updates de presença; considerar alerta específico para `ClientPresenceRateLimitReached` (hoje só aparece em log bruto).

### WA-028 — P1 — Roteamento cross-team quebra ACK e delete-recebido

Em contas com número compartilhado entre sub-times (`Team.masterId`), `handleMessagesUpsert` roteia a mensagem para o `teamId` do sub-time dono do lead (`resolveTargetTeamContext`, `ProcessEvoWebhookUseCase.ts:566-597`). Mas `handleMessagesUpdate` (ACK), `handleSendMessage` (ACK) e `handleMessagesDelete` continuam buscando a mensagem pelo `teamId` **original** do webhook — não encontram, e o update é silenciosamente ignorado (sem erro, sem log de falha).

Isso é o candidato mais provável para "ticks não atualizam" em contas master, fora da degradação geral do item WA-027.

Adicional: o matching de telefone usado para decidir o roteamento (`findLeadTeamIdByPhoneForMaster`, `WhatsAppRepository.ts:1302-1325`) usa `contains(últimos 11 dígitos)` — não é exato, com risco de rotear para o time errado em caso de sufixos coincidentes. Relacionado à confusão de identidade já registrada em WA-025.

**Correção proposta**: propagar o `teamId` roteado para os handlers de ACK/delete do mesmo evento, ou fazê-los resolver o roteamento antes de buscar a mensagem.

### WA-029 — P2 — Reagir/apagar-para-todos: gap além da capability gate

A SPEC (§13.7) e a auditoria de Fase 4 já documentam que reagir e apagar-para-todos retornam `CAPABILITY_UNAVAILABLE` porque a Evolution API ainda não foi homologada para esses métodos — isso é intencional, não um bug. Porém, esta rodada encontrou que **mesmo homologando a Evolution amanhã, a feature ainda não funcionaria**:

- `EvoApiService.ts` não tem nenhum método HTTP para reação (nem para apagar mensagem individual — só existe `deleteInstance`, que apaga a instância inteira).
- `parseEvoMessageContent.ts` não tem branch para `reactionMessage` (o formato Baileys de reação recebida) — uma reação do contato hoje seria persistida como mensagem vazia tipo `UNKNOWN`, poluindo a conversa.
- Não existe nenhum código que escreva na tabela `WhatsAppMessageReaction` (schema pronto, só há leitura em `getMessageActionsState`).
- No front, o case `REACT` de `handleAction` (`MessageBubble.tsx`) executa `toast.error("Ação indisponível neste provedor")` **incondicionalmente**, e o campo `reactions` buscado do backend é descartado (não há onde renderizar — o tipo `WhatsAppMessage` do front não tem esse campo).

**Correção proposta**: tratar como trabalho de implementação completo (não só "ligar uma flag"): método Evolution de reação + parse inbound + write-path + UI (emoji picker real usando `BubbleReactions`, já existente em `components/ui/bubble.tsx` mas não utilizado).

### WA-030 — P2 — Ações locais não propagam via Realtime entre abas

`useWhatsAppRealtime.ts`/`handleMessageUpdated` só atualiza `status/deliveredAt/readAt/failedAt/media*` no merge de UPDATE — não inclui `deletedForEveryoneAt`, `isPinned`, `isFavorite`, `isHiddenForMe`. Uma ação de apagar-para-todos (quando habilitada) ou pin/favorito feita em uma aba não aparece em outra aba/dispositivo até um refetch manual. As regras RT-001–008 da SPEC cobrem status de mensagem, não esse conjunto de ações locais.

### WA-031 — P2 — Eventos subscritos sem handler, confirmados como ruído em produção

A Evolution está configurada para enviar `PRESENCE_UPDATE` e `GROUP_PARTICIPANTS_UPDATE` (`WHATSAPP_EVO_WEBHOOK_EVENTS`), mas `ProcessEvoWebhookUseCase.execute` só loga ("Unhandled event type") para os dois. Confirmado em produção (Vercel MCP): `PRESENCE.UPDATE` aparece com frequência alta nos logs. Não é causa de atraso, mas é invocação de função e ruído de log desnecessários — vale decidir entre implementar (ex. indicador de "digitando...", que a SPEC já cogita em Fase E item 4 como "Presença/typing somente com sinal confiável") ou parar de subscrever.

### WA-032 — P2 — Re-render em cascata no Inbox

`WhatsAppInboxContext.tsx` passa o valor de `useWhatsAppInbox()` (2061 linhas, ~35 `useState`) **sem `useMemo`** — qualquer mudança de estado recria a referência do Context e re-renderiza toda a árvore de consumidores (lista de conversas, cada `MessageBubble` visível, composer). Não há `React.memo` em `MessageBubble`/`ConversationItem`. A lista de mensagens não é virtualizada (`messages.map` puro) e só cresce com "carregar mais antigas". `MessageBubble.tsx` refaz `loadActionsState()` a cada abertura do menu de contexto, sem cache.

Isso estende WA-020 ("arquivos monolíticos... elevam regressão") com o mecanismo concreto de impacto em performance percebida de UI, que é parte do "front-end feio/lento" relatado.

**Correção proposta**: `useMemo` no valor do Context (ou dividir o hook em contexts por domínio), `React.memo` nos itens de lista, avaliar virtualização, cache de `loadActionsState()` por sessão.

### WA-033 — P2 — Inconsistência visual observada no balão recebido

No print enviado, balões de mensagem recebida aparecem sem background visível. O código (`components/ui/bubble.tsx:17-35`) define `variant="secondary"` = `bg-muted text-foreground` para inbound (`MessagingMessageBubble.tsx:201`), então deveria haver fundo visível. **Hipótese não confirmada**: essas mensagens específicas podem estar passando por um caminho de render diferente (ex. resposta de botão/lista interativa), ou há problema de resolução do token `--muted` num contexto específico. Precisa reprodução ao vivo no browser antes de apontar causa exata — não incluir no SPEC sem essa verificação.

### WA-034 — P2 — Advisors do Supabase (lacuna da auditoria original agora fechada)

Executado via Supabase MCP no projeto `wcnxwdcoambpfwxwubka` (item pendente desde a Fase A do backlog original):

- **FKs sem índice de cobertura**: `whatsapp_messages` (`configId`, `leadId`, `deletedByProfileId`, `autoResponseRuleId`), `whatsapp_conversations.contactId`, `whatsapp_outbound_commands.conversationId`, `whatsapp_sync_jobs.configId`, `whatsapp_webhook_events.teamId`, `whatsapp_message_reactions.profileId`, `whatsapp_message_favorites.profileId`, `whatsapp_message_pins.pinnedByProfileId`/`teamId`, `whatsapp_message_visibility.profileId`, `whatsapp_message_action_commands.profileId`, `whatsapp_audit_events.actorProfileId`, `whatsapp_auto_response_logs.ruleId`, `team_whatsapp_configs.createdByProfileId`/`updatedByProfileId`, `whatsapp_contact_identities.contactId`.
- **RLS não otimizado**: `whatsapp_auto_response_rules`/`whatsapp_auto_response_logs` reavaliam `auth.*()`/`current_setting()` por linha em vez do padrão `(select auth.uid())`.
- **Índices nunca usados** (candidatos a remoção): `whatsapp_conversation_tag_assignments_tagId_idx`, `team_whatsapp_contacts_teamId_opaqueId_idx`, `team_whatsapp_contacts_team_search_text_idx`, `whatsapp_outbound_commands_reconcile_idx`, `whatsapp_contact_identities_config_kind_seen_idx`, `whatsapp_messages_quotedMessageId_idx`, `whatsapp_message_reactions_teamId_createdAt_idx`, `whatsapp_message_favorites_teamId_profileId_idx`, `whatsapp_message_pins_conversationId_removedAt_idx`, `whatsapp_message_visibility_teamId_profileId_idx`, `whatsapp_message_action_commands_messageId_kind_status_idx`, `whatsapp_audit_events_conversation_idx`; e duplicata em `whatsapp_auto_response_logs` (dois índices idênticos).

Não é causa dos sintomas relatados, mas fecha item pendente do backlog e é ganho de performance de baixo risco.

### WA-035 — P2 (ops) — Limitação de auditoria na VPS Hostinger

A VM que hospeda a Evolution API (`srv1799450`, IP `187.77.226.253`, compose em `/opt/lead-flow-bot`) não pôde ser inspecionada via Hostinger MCP: `[VPS:2044] Currently installed operating system does not support Docker Manager`. Não foi possível confirmar ou descartar fila interna, reconexão de sessão Baileys, ou uso de CPU/memória do container como causa adicional do atraso "chega rápido no app, demora no Studio". **Próximo passo**: inspecionar via SSH direto (credenciais já documentadas) os logs do container durante uma janela de atraso reproduzido.

### Nota — erro ativo confirmado (relacionado a WA-005)

Cron `ingest-media` registrou falha `provider_request_failed` (HTTP 400) em `getBase64FromMediaMessage` durante a janela observada. O pipeline já tem retry (até 5 tentativas), mas vale monitorar taxa de falha — mídia nunca resolvida fica `mediaStatus: FAILED`.

---

## 4. Resposta à pergunta sobre WebSocket

**Não recomendado migrar para um servidor WebSocket próprio.** O projeto já usa Supabase Realtime (`postgres_changes`) como canal primário — que é, por baixo, um WebSocket gerenciado, já integrado com auth JWT e usado por outras features (atividades de lead, notificações, presença). Funções serverless da Vercel não sustentam WebSocket de longa duração — introduzir um servidor próprio exigiria infraestrutura nova fora do Vercel, um custo de arquitetura desproporcional ao problema real.

O problema medido (WA-026, WA-027) não é "falta de WebSocket" — é degradação do canal existente (rate limit de Presence) e ordenação incorreta dos dados que chegam por ele. Corrigir esses dois pontos resolve o sintoma sem trocar de tecnologia.

---

## 5. Backlog recomendado (continuação das Fases A–E da auditoria original)

### Fase F — correção pós-produção (esta rodada)

1. `providerTimestamp` real + reordenar queries de mensagem (WA-026).
2. Investigar/reduzir rate limit de Presence; alertar em `ClientPresenceRateLimitReached` (WA-027).
3. Corrigir lookup de ACK/delete para usar `teamId` roteado em contas master (WA-028).
4. Decidir e implementar reagir/apagar-para-todos ponta a ponta (Evolution + parse inbound + write-path + UI) — não tratar como "só habilitar flag" (WA-029).
5. Propagar `deletedForEveryoneAt`/`isPinned`/`isFavorite`/`isHiddenForMe` via Realtime (WA-030).
6. `useMemo` no Context do Inbox + `React.memo` em itens de lista + avaliar virtualização (WA-032).
7. Reproduzir ao vivo e corrigir inconsistência visual do balão recebido (WA-033).
8. Aplicar correções de índice/RLS do Advisors (WA-034) — baixo risco, pode entrar isolado.
9. Handler explícito (ou remoção de subscrição) para `PRESENCE_UPDATE`/`GROUP_PARTICIPANTS_UPDATE` (WA-031).
10. Investigação via SSH da VPS Evolution durante janela de atraso reproduzido (WA-035) — ação de diagnóstico, não de código.

Prioridade para o SPEC: WA-026, WA-027 e WA-028 atacam diretamente os sintomas relatados pelo usuário e devem vir primeiro.
