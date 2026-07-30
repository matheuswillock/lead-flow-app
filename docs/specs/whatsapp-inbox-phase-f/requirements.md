# Requirements — WhatsApp Inbox V3: Fase F (confiabilidade pós-produção)

**Versão:** 1.0  
**Data:** 2026-07-29  
**Origem:** Auditoria pós-Fase-4 com evidência de produção (`docs/audits/whatsapp-inbox-v3-audit.md`)  
**Numeração de achados:** WA-026–WA-035 (continuação de `WHATSAPP_INBOX_AUDIT.md`)  
**SPEC base:** `WHATSAPP_INBOX_SPEC.md` (Fases 0–4 concluídas em código)

## 1. Contexto

As Fases 0–4 foram concluídas em código e aprovadas pela revisão Impeccable (score 16/20). Esta Fase F ataca exclusivamente os problemas diagnosticados por telemetria de produção (Vercel MCP + Supabase MCP) e leitura de código, sem introduzir features de negócio novas.

Quatro sintomas relatados em produção têm causa-raiz confirmada:

| Sintoma | Causa confirmada | Achado |
|---|---|---|
| Mensagens fora de ordem | Ordenação por `createdAt` (hora de inserção), não por timestamp real do WhatsApp | WA-026 |
| Respostas demoram a aparecer | `ClientPresenceRateLimitReached` degradando canal `postgres_changes` | WA-027 |
| Ticks não atualizam (contas master) | ACK/delete buscados pelo `teamId` original, não pelo roteado | WA-028 |
| Reagir / apagar para todos indisponíveis | Feature incompleta ponta-a-ponta; Evolution API v2 **tem** os endpoints | WA-029 |

Dois achados adicionais fecham lacunas de qualidade:

- **WA-030**: `deletedForEveryoneAt`, `isPinned`, `isFavorite`, `isHiddenForMe` não propagam via Realtime.
- **WA-031**: `PRESENCE_UPDATE` subscrito mas sem handler — confirmado como ruído frequente em produção; decidido implementar indicador "digitando...".
- **WA-032**: Contexto do Inbox sem `useMemo`, sem `React.memo` em itens de lista, sem virtualização.
- **WA-033**: Inconsistência visual nos balões de mensagem recebida (precisa reprodução ao vivo).
- **WA-034**: FKs sem índice de cobertura e RLS não otimizado em tabelas `whatsapp_*` (Advisors do Supabase).

---

## 2. Prioridade e agrupamento

| Grupo | Itens | Prioridade |
|---|---|---|
| **Alpha** — bugs críticos em produção | F-01, F-02, F-03 | P1 — entram primeiro, bloqueiam os demais |
| **Beta** — features incompletas (Evolution homologada) | F-04, F-05, F-06 | P1 — confirmado pela doc oficial Evolution API v2 |
| **Gamma** — qualidade e infraestrutura | F-07, F-08, F-09, F-10 | P2 — sem bloqueador externo |

> **WA-035** (diagnóstico da VPS via SSH): ação de ops, fora do escopo deste SPEC.

---

## 3. Requisitos por história

### F-01 — Ordenação por timestamp real do WhatsApp (WA-026)

**Contexto:** `WhatsAppMessage` não persiste `messageTimestamp` do payload Evolution/Baileys em coluna própria. Queries ordenam por `createdAt` (hora de inserção no banco). O pipeline assíncrono com retry `[1m, 5m, 15m, 1h, 6h]` e `OUTBOX_CONCURRENCY=10` pode gravar eventos fora de ordem cronológica.

```
WHEN o backend persiste uma mensagem recebida via webhook da Evolution API
THE SYSTEM SHALL extrair messageTimestamp do rawPayload Baileys
AND persistir o valor em coluna providerTimestamp (BigInt, Unix epoch em segundos)
AND usar NULL para mensagens anteriores à migration (sem backfill obrigatório)

WHEN WhatsAppRepository.listMessages é chamado para uma conversa
THE SYSTEM SHALL ordenar resultados por providerTimestamp ASC
AND usar createdAt como fallback quando providerTimestamp IS NULL

WHEN WhatsAppRepository.searchConversationMessages é chamado
THE SYSTEM SHALL aplicar o mesmo critério de ordenação (providerTimestamp ASC, fallback createdAt)

WHERE o índice de suporte em whatsapp_messages existe
THE SYSTEM SHALL substituir @@index([conversationId, createdAt]) por @@index([conversationId, providerTimestamp, createdAt])
```

**Critério de aceite:** após migration + deploy, abrir uma conversa com histórico retrabalhado por retry mostra as mensagens na ordem cronológica real do WhatsApp.

---

### F-02 — Throttle de Presence para proteger o canal Realtime (WA-027)

**Contexto:** `useTeamPresence.ts` usa `ACTIVITY_THROTTLE_MS = 5_000` ms. Com múltiplos operadores simultâneos no mesmo tenant Supabase, a taxa agregada de `channel.track()` ultrapassa o limite, gerando `ClientPresenceRateLimitReached` e degradando o canal `postgres_changes` do inbox para polling de 12s.

```
WHEN useTeamPresence envia uma atualização de presença (channel.track)
THE SYSTEM SHALL aplicar throttle mínimo de 30_000 ms por cliente (antes: 5_000 ms)
AND eventos de visibilitychange (aba oculta → online/away) SHALL continuar sendo enviados com force: true, sem throttle

WHEN ClientPresenceRateLimitReached é recebido pelo canal de Presence
THE SYSTEM SHALL registrar um log estruturado com level error e campo event: "presence_rate_limit_reached"
AND incrementar um contador de métricas (console.error com payload estruturado, suficiente para monitorar via Vercel logs)

WHEN o tenant Realtime é desligado por inatividade e reinicia
THE SYSTEM SHALL reconectar automaticamente (comportamento já existente via CONNECTING state)
AND não é necessária ação adicional para este sub-caso
```

**Critério de aceite:** em sessão com ≥ 3 operadores simultâneos, os logs de produção Supabase não exibem `ClientPresenceRateLimitReached` por ≥ 1h de uso normal.

---

### F-03 — Roteamento cross-team: ACK e delete usam teamId roteado (WA-028)

**Contexto:** em contas master com número compartilhado, `handleMessagesUpsert` roteia a mensagem para o `teamId` do sub-time dono do lead (`resolveTargetTeamContext`). Mas `handleMessagesUpdate` (ACK), `handleSendMessage` (ACK) e `handleMessagesDelete` buscam a mensagem pelo `teamId` original do webhook e silenciosamente não encontram nada.

```
WHEN ProcessEvoWebhookUseCase recebe um evento MESSAGES.UPDATE (ACK) para uma conta master
THE SYSTEM SHALL resolver o teamId roteado pelo mesmo critério de resolveTargetTeamContext
AND buscar a mensagem usando o teamId roteado, não o teamId original do webhook

WHEN ProcessEvoWebhookUseCase recebe um evento MESSAGES.DELETE para uma conta master
THE SYSTEM SHALL aplicar o mesmo critério acima

WHEN findLeadTeamIdByPhoneForMaster realiza matching de telefone
THE SYSTEM SHALL usar correspondência exata (E.164 ou últimos 11 dígitos normalizados de forma determinística)
AND NOT usar contains() parcial que pode casar números com sufixo coincidente

WHEN o teamId roteado não puder ser resolvido
THE SYSTEM SHALL registrar console.error com [ProcessEvoWebhookUseCase][cross-team-routing-failed] e o remoteJid (sem PII completo)
AND não lançar exceção — tratamento gracioso para não quebrar processamento de outros eventos
```

**Critério de aceite:** em conta master com dois sub-times, enviar uma mensagem pelo Studio e receber resposta do contato mostra ticks corretos em ambos os sub-times.

---

### F-04 — Reagir a mensagem: implementação completa (WA-029)

**Contexto:** Evolution API v2 tem o endpoint `POST /message/sendReaction/{instance}` com body `{ key: { remoteJid, fromMe, id }, reaction: "🚀" }`. Falta implementação em `EvoApiService`, `EvolutionWhatsAppProvider`, parse inbound de `reactionMessage`, write-path em `WhatsAppMessageReaction` e UI.

```
WHEN o usuário seleciona uma reação para uma mensagem no inbox
THE SYSTEM SHALL chamar EvoApiService.sendReaction com key (remoteJid, fromMe, id) e o emoji selecionado
AND persistir a reação localmente em WhatsAppMessageReaction (write-path até hoje ausente)
AND exibir o emoji usando o componente BubbleReactions existente (components/ui/bubble.tsx)

WHEN o contato reage a uma mensagem no WhatsApp (webhook reactionMessage)
THE SYSTEM SHALL parsear o campo reactionMessage do payload Baileys em parseEvoMessageContent
AND persistir em WhatsAppMessageReaction com o emoji e o remoteJid do contato
AND exibir a reação na bolha correspondente sem intervenção do usuário

WHEN o usuário remove uma reação (envia reaction: "")
THE SYSTEM SHALL chamar EvoApiService.sendReaction com reaction: ""
AND remover ou marcar como inativa a reação em WhatsAppMessageReaction

WHEN EvolutionWhatsAppProvider.getMessageActionCapabilities é chamado
THE SYSTEM SHALL retornar react: true (antes: false)
AND remover o comentário "not yet homologated" do código

WHERE o emoji picker é exibido ao usuário
THE SYSTEM SHALL apresentar no mínimo os emojis mais comuns do WhatsApp (👍 ❤️ 😂 😮 😢 🙏)
AND usar o componente BubbleReactions de components/ui/bubble.tsx como container de exibição das reações recebidas
```

**Critério de aceite:** usuário reage com 👍, contato vê a reação no WhatsApp; contato reage com ❤️, Studio exibe ❤️ na bolha.

---

### F-05 — Apagar para todos: implementação completa (WA-029)

**Contexto:** Evolution API v2 tem endpoint de delete para mensagens. `EvolutionWhatsAppProvider.deleteForEveryone` hoje lança `WhatsAppProviderCapabilityError`. Falta o método HTTP em `EvoApiService` e a atualização de `deletedForEveryoneAt` via Realtime.

```
WHEN o usuário escolhe "Apagar para todos" em uma mensagem enviada
THE SYSTEM SHALL chamar EvoApiService.deleteMessage com o messageId do provider
AND atualizar deletedForEveryoneAt localmente (otimismo)
AND propagar deletedForEveryoneAt via Realtime para outras abas (ver F-06)

WHEN o contato apaga uma mensagem para todos (webhook MESSAGES.DELETE já funciona)
THE SYSTEM SHALL continuar o comportamento existente (handleMessagesDelete)
AND incluir o fix do F-03 para contas master

WHEN EvolutionWhatsAppProvider.getMessageActionCapabilities é chamado
THE SYSTEM SHALL retornar deleteForEveryone: true (antes: false)
```

**Critério de aceite:** usuário apaga mensagem pelo Studio, contato vê "Esta mensagem foi apagada" no WhatsApp.

---

### F-06 — Propagação Realtime de ações locais (WA-030)

**Contexto:** `handleMessageUpdated` em `useWhatsAppRealtime.ts` só faz merge de `status/deliveredAt/readAt/failedAt/media*`. Campos `deletedForEveryoneAt`, `isPinned`, `isFavorite`, `isHiddenForMe` não são propagados entre abas/dispositivos.

```
WHEN deletedForEveryoneAt, isPinned, isFavorite ou isHiddenForMe de uma WhatsAppMessage muda no banco
THE SYSTEM SHALL incluir esses campos no merge de handleMessageUpdated em useWhatsAppRealtime.ts
AND o canal postgres_changes (evento UPDATE em whatsapp_messages) SHALL já propagar a mudança (nenhuma config adicional necessária)
AND a bolha SHALL refletir o novo estado sem refetch manual
```

**Critério de aceite:** apagar para todos em aba A mostra a mensagem como apagada na aba B sem recarregar.

---

### F-07 — Performance de render do Inbox (WA-032)

**Contexto:** `WhatsAppInboxContext.tsx` passa objeto sem `useMemo`; `WhatsAppInboxHook.ts` tem ~35 `useState` em 2061 linhas. Qualquer mudança de estado (digitar na busca, badge de não-lido) re-renderiza toda a árvore. Sem `React.memo` em `MessageBubble`/`ConversationItem`. Sem virtualização.

```
WHEN o valor do WhatsAppInboxContext é calculado
THE SYSTEM SHALL envolvê-lo em useMemo com dependências explícitas
AND NOT usar object literal direto como value do Provider

WHEN MessageBubble é renderizado em uma lista de mensagens
THE SYSTEM SHALL ser envolto em React.memo com função de comparação customizada
AND NOT re-renderizar quando apenas estado de busca ou conversas muda

WHEN ConversationItem é renderizado na lista de conversas
THE SYSTEM SHALL ser envolto em React.memo

WHEN a lista de mensagens de uma conversa contém mais de 100 itens
THE SYSTEM SHALL usar virtualização (TanStack Virtual ou equivalente já presente no projeto)
AND manter scroll position ao carregar mensagens mais antigas (prepend sem salto)

WHEN loadActionsState() é chamado ao abrir o ContextMenu de uma mensagem
THE SYSTEM SHALL usar cache por messageId dentro da sessão atual
AND NOT refazer a chamada se o estado já foi carregado para aquele messageId
```

**Critério de aceite:** com 200 mensagens na conversa, abrir o ContextMenu de uma bolha não causa flash de re-render visível nas bolhas adjacentes (verificar com React DevTools Profiler).

---

### F-08 — Indicador "digitando..." via PRESENCE_UPDATE (WA-031)

**Contexto:** `PRESENCE_UPDATE` é subscrito na Evolution API mas cai em branch `else` (`Unhandled event type`) em `ProcessEvoWebhookUseCase`. Confirmado em produção como ruído frequente. Decisão: implementar indicador "digitando..." no frontend.

```
WHEN ProcessEvoWebhookUseCase recebe um evento PRESENCE_UPDATE da Evolution API
THE SYSTEM SHALL extrair remoteJid e presenceType (composing | recording | paused | available | unavailable) do payload
AND persistir estado de presença em memória do servidor OU propagar diretamente via canal Supabase Realtime (ver design)
AND NOT criar uma nova tabela de banco para estado de presença (dado é efêmero)

WHEN presenceType = "composing" é recebido para um remoteJid
THE SYSTEM SHALL exibir indicador "digitando..." na thread da conversa correspondente
AND usar debounce de 5_000 ms para ocultar o indicador se nenhum novo "composing" chegar

WHEN presenceType = "paused" | "available" | "unavailable" é recebido
THE SYSTEM SHALL ocultar o indicador "digitando..."

WHEN o usuário não está na thread daquela conversa
THE SYSTEM SHALL não exibir o indicador (sem efeito)
```

**Critério de aceite:** contato começa a digitar no WhatsApp → inbox mostra "digitando..." em ≤ 3s; contato para de digitar → indicador desaparece em ≤ 5s.

---

### F-09 — Índices FK e RLS: aplicar Advisors do Supabase (WA-034)

**Contexto:** Advisors do Supabase (executados via MCP nesta rodada) identificaram FKs sem índice de cobertura em múltiplas tabelas `whatsapp_*`, RLS de `whatsapp_auto_response_*` reavaliando `auth.*()` por linha, e vários índices sem uso.

```
WHEN o banco executa queries envolvendo FKs em tabelas whatsapp_*
THE SYSTEM SHALL ter índices de cobertura para: whatsapp_messages (configId, leadId, deletedByProfileId, autoResponseRuleId), whatsapp_conversations (contactId), whatsapp_outbound_commands (conversationId), whatsapp_sync_jobs (configId), whatsapp_webhook_events (teamId), whatsapp_message_reactions (profileId), whatsapp_message_favorites (profileId), whatsapp_message_pins (pinnedByProfileId, teamId), whatsapp_message_visibility (profileId), whatsapp_message_action_commands (profileId), whatsapp_audit_events (actorProfileId), whatsapp_auto_response_logs (ruleId), team_whatsapp_configs (createdByProfileId, updatedByProfileId), whatsapp_contact_identities (contactId)

WHEN as policies RLS de whatsapp_auto_response_rules e whatsapp_auto_response_logs são avaliadas
THE SYSTEM SHALL usar (select auth.uid()) em vez de auth.uid() diretamente nas expressões USING e WITH CHECK
AND aplicar o mesmo padrão a current_setting() onde presente

WHEN índices identificados como nunca usados nos Advisors existem no banco
THE SYSTEM SHALL removê-los após validação local
AND a lista de candidatos está na seção §3.WA-034 da auditoria

WHEN a migration é criada
THE SYSTEM SHALL usar bun run db:migrate:new whatsapp-phase-f-advisors
AND o SQL SHALL ser idempotente (CREATE INDEX IF NOT EXISTS, DROP INDEX IF EXISTS)
```

**Critério de aceite:** após migration aplicada localmente, `bun run db:migrate:reset:local` passa sem erro; os índices FK aparecem em `\d+ tabela` no psql local.

---

### F-10 — Inconsistência visual do balão recebido (WA-033)

**Contexto:** print do usuário mostra balões inbound sem background visível. `Bubble` com `variant="secondary"` deve renderizar `bg-muted text-foreground`. Hipótese: mensagens de tipo interativo (botão/lista) podem seguir caminho de render diferente.

```
WHEN uma mensagem inbound de qualquer tipo (texto, resposta de botão, lista interativa, mídia, reação) é exibida
THE SYSTEM SHALL aplicar variant="secondary" (bg-muted text-foreground) ao componente Bubble de forma consistente
AND NOT depender do tipo de conteúdo para escolher o variant

WHEN o token CSS --muted é resolvido no contexto do inbox (wallpaper, dark mode, light mode)
THE SYSTEM SHALL garantir que o valor é visível (contraste suficiente com o fundo da thread)

GIVEN que a causa exata não foi confirmada sem reprodução ao vivo no browser
THE SYSTEM SHALL exigir verificação no browser antes de qualquer fix ser marcado como concluído
```

**Critério de aceite:** abrir qualquer conversa no inbox em light mode e dark mode, mensagens do contato têm fundo visível em todos os tipos de mensagem.

---

## 4. Não escopo desta Fase F

- Novos tipos de mensagem (polls, stickers, documentos interativos além do já implementado).
- Integrações com outros providers além da Evolution API.
- Bacas de conta Backoffice (escopo isolado, governance §4).
- Diagnóstico da VPS Evolution via SSH (WA-035) — ação de ops, não de código.
- Homologação em produção de migrations remotas — requer autorização explícita do owner (CLAUDE.md §Migration Policy).

---

## 5. Dependências entre itens

```
F-01 independente (migration de schema + ajuste de queries)
F-02 independente (hook useTeamPresence)
F-03 independente (ProcessEvoWebhookUseCase)
F-04 depende de nenhum bloqueador de código (Evolution homologada)
F-05 depende de F-06 (Realtime de deletedForEveryoneAt)
F-06 independente (useWhatsAppRealtime)
F-07 independente (Context + memoização)
F-08 independente (ProcessEvoWebhookUseCase + frontend)
F-09 independente (migration SQL pura)
F-10 depende de reprodução ao vivo (diagnóstico antes do fix)
```
