# Módulo WhatsApp — Resumo da Sessão

**Branch:** `claude/nifty-shannon-c60t9b`
**Base:** `develop`

---

## Features implementadas

### Prioridades originais

| # | Feature | Arquivos principais |
|---|---------|-------------------|
| P1 | Paginação de conversas — botão "Carregar mais", append em vez de substituir, deduplicação via Map | `WhatsAppInboxHook.ts`, `ConversationList.tsx`, `WhatsAppInboxTypes.ts` |
| P2 | Polling automático do QR code — `setInterval` de 5 s enquanto status é `QR_READY` ou `PENDING`, para após 24 ciclos (~2 min) | `WhatsAppSettingsHook.ts` |
| P3 | Indicadores de status de entrega — `PENDING→SENT→DELIVERED→READ→FAILED` com ícones Lucide + botão "Reenviar" em falha | `MessageBubble.tsx`, `WhatsAppInboxHook.ts`, `WhatsAppInboxTypes.ts` |

### Backlog

| # | Feature | Arquivos principais |
|---|---------|-------------------|
| B1 | Paginação de mensagens antigas — scroll reverso, prepend com deduplicação | `WhatsAppInboxHook.ts`, `MessagePanel.tsx` |
| B2 | Arquivar / desarquivar conversas — use case + rotas `POST .../archive` e `.../unarchive` + menu na UI | `ArchiveConversationUseCase.ts`, `archive/route.ts`, `unarchive/route.ts`, `ConversationActionsMenu.tsx` |
| B3 | Contador de caracteres no composer — indicador visual ao se aproximar do limite de 4096 chars | `MessageComposer.tsx` |
| B4 | Empty states contextuais por filtro — mensagens diferentes para Todas / Não lidas / Minhas / Arquivadas | `ConversationList.tsx` |
| B5 | Nome do operador nas mensagens OUTBOUND — resolve `sentByProfileId` via `teamMembers` do contexto | `MessageBubble.tsx`, `WhatsAppInboxHook.ts` |
| B6 | Ícone de lead vinculado no `ConversationItem` — badge quando `leadId !== null` | `ConversationItem.tsx` |
| B7 | Avatar com iniciais do responsável atribuído — `Avatar` shadcn `size-5` com fallback "Atribuída" | `ConversationItem.tsx` |
| B8 | Excluir conversa — rota `DELETE .../conversations/:id` + `AlertDialog` de confirmação destrutiva | `DeleteConversationUseCase.ts`, `conversations/[conversationId]/route.ts`, `ConversationActionsMenu.tsx` |
| B9 | Player de áudio inline — renderiza `<audio controls>` quando `mediaUrl` presente; mantém ícone `Mic` sem URL | `MessageBubble.tsx`, `WhatsAppInboxTypes.ts` |
| B10 | Resync de `contactName` via `pushName` — atualização condicional no `handleMessagesUpsert` do webhook | `ProcessEvoWebhookUseCase.ts` |
| B11 | Deduplicação de conversas — constraint `@@unique([configId, externalChatId])` já existia no schema ✅ |  |

---

## Bugs corrigidos (segunda auditoria)

1. **Conversas arquivadas apareciam em todas as views** — `listConversations` não tinha filtro `isArchived`; adicionado `isArchived: params.isArchived ?? false` ao WHERE e passado via query param da rota e do serviço.
2. **Aba "Arquivadas" ausente** — adicionada ao `FILTER_TABS` em `ConversationList.tsx` e ao empty state correspondente.
3. **Ordem das mensagens invertida** — `orderBy` estava `asc` no repositório, retornando mensagens antigas primeiro para página 1 e novas para "carregar mais" (errado). Corrigido para `desc` + `.slice().reverse()` no hook para exibição correta.
4. **Campo `caption` ignorado em toda a stack** — adicionado ao tipo `WhatsAppMessage`, ao `WhatsAppMessageRealtimeRow`, ao `handleMessageInserted`, à mensagem otimista e ao render do `MessageBubble`.

---

## Auditoria UI ↔ Backend

- Contrato bem alinhado em todos os endpoints.
- **Único gap real:** campo morto `configId?: string` em `WhatsAppInboxTypes.WhatsAppConfig` — o backend nunca retorna esse campo (`toConfigOutput()` não expõe o `id`). Campo removido.
- Restrições de unicidade em `WhatsAppConversation` (`configId + externalChatId`) e `WhatsAppUsageEvent` (`teamId + providerMessageId + eventType`) já existiam no schema — comentários do revisor automatizado eram improcedentes.

---

## Arquivos criados

| Arquivo | Propósito |
|---------|-----------|
| `app/api/useCases/whatsapp/ArchiveConversationUseCase.ts` | Arquivar/desarquivar via `isArchived` |
| `app/api/useCases/whatsapp/DeleteConversationUseCase.ts` | Excluir conversa com cascade |
| `app/api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/archive/route.ts` | `POST` arquivar |
| `app/api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/unarchive/route.ts` | `POST` desarquivar |
| `app/api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/route.ts` | `DELETE` excluir |
| `app/[supabaseId]/whatsapp/features/components/ConversationActionsMenu.tsx` | Menu `⋮` com arquivar/excluir |

## Arquivos principais modificados

| Arquivo | O que mudou |
|---------|-------------|
| `WhatsAppInboxTypes.ts` | `WhatsAppMessageStatus`, `hasMoreConversations`, `isArchiving`, `isDeleting`, `isLoadingOlderMessages`, `hasMoreMessages`, `mediaUrl`, `caption`, remoção de `configId?` |
| `WhatsAppInboxHook.ts` | Append em paginação, `performSend` compartilhado, `FAILED` persistente, `resendMessage`, `archiveConversation`, `unarchiveConversation`, `deleteConversation`, `mediaUrl`/`caption` no Realtime |
| `WhatsAppRepository.ts` | `deleteConversation`, `isArchived` no WHERE de `listConversations`, `orderBy: desc` em `listMessages` |
| `IWhatsAppRepository.ts` | `deleteConversation`, `isArchived` em `listConversations` |
| `ListConversationsUseCase.ts` | `isArchived` no input |
| `conversations/route.ts` | Lê e passa `isArchived` do query param |
| `ProcessEvoWebhookUseCase.ts` | Resync de `contactName` via `pushName` |
| `MessageBubble.tsx` | `StatusIndicator`, player de áudio, caption, nome do operador |
| `ConversationItem.tsx` | Avatar com iniciais do atribuído, badge de lead |
| `ConversationList.tsx` | Botão "Carregar mais", aba Arquivadas, empty states contextuais |
| `MessageComposer.tsx` | Contador de caracteres |
| `WhatsAppSettingsHook.ts` | Polling do QR code |
| `useWhatsAppRealtime.ts` | `mediaUrl`, `caption` no `WhatsAppMessageRealtimeRow` |
| `WhatsAppInboxService.ts` / `IWhatsAppInboxService.ts` | `archiveConversation`, `unarchiveConversation`, `deleteConversation`, `isArchived` em `fetchConversations` |
| `MessagePanel.tsx` | `ConversationActionsMenu` no header |

---

## Merge final

`origin/develop` → `claude/nifty-shannon-c60t9b`: 130 arquivos integrados (email, board, backoffice, migrations) sem nenhum conflito.
