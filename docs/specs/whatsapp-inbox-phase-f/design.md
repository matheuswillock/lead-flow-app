# Design — WhatsApp Inbox V3: Fase F

**Versão:** 1.0  
**Data:** 2026-07-29  
**Referência de requirements:** `requirements.md` (mesma pasta)

---

## 1. Arquitetura e fluxo geral

A Fase F não altera a arquitetura estabelecida nas Fases 0–4. Todos os padrões permanecem:

```
Evolution API → Webhook → after() → Outbox (WhatsAppWebhookEvent) → ProcessEvoWebhookUseCase
                                                                        ↓
                                                               Supabase (Prisma)
                                                                        ↓
                                                          Supabase Realtime (postgres_changes)
                                                                        ↓
                                                              Frontend (useWhatsAppRealtime)
```

As mudanças da Fase F atuam em pontos cirúrgicos desse fluxo:

| Item | Camada afetada |
|---|---|
| F-01 (providerTimestamp) | Schema (migration) + Webhook parse + Repository queries |
| F-02 (Presence throttle) | Frontend hook `useTeamPresence` |
| F-03 (cross-team routing) | `ProcessEvoWebhookUseCase` |
| F-04 (reagir) | `EvoApiService` + `EvolutionWhatsAppProvider` + parse inbound + write-path + UI |
| F-05 (delete for everyone) | `EvoApiService` + `EvolutionWhatsAppProvider` + UI |
| F-06 (Realtime campos extras) | `useWhatsAppRealtime` + `handleMessageUpdated` |
| F-07 (performance Context) | `WhatsAppInboxContext` + `MessageBubble` + `ConversationItem` |
| F-08 (typing indicator) | `ProcessEvoWebhookUseCase` + canal efêmero + UI |
| F-09 (Advisors DB) | Migration SQL pura |
| F-10 (visual balão) | `MessageBubble` / render paths |

---

## 2. F-01 — Schema e ordenação de mensagens

### 2.1 Migration de schema

```sql
-- supabase/migrations/<timestamp>_whatsapp-phase-f-provider-timestamp.sql
ALTER TABLE "public"."whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "providerTimestamp" BIGINT;  -- Unix epoch segundos, null = mensagem pré-migration

-- Substituir índice de ordenação
DROP INDEX IF EXISTS "whatsapp_messages_conversationId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversationId_providerTimestamp_createdAt_idx"
  ON "public"."whatsapp_messages" ("conversationId", "providerTimestamp" ASC NULLS LAST, "createdAt" ASC);
```

Gerada com: `bun run db:migrate:new whatsapp-phase-f-provider-timestamp`

### 2.2 Prisma schema

```prisma
model WhatsAppMessage {
  // campos existentes ...
  providerTimestamp  BigInt?   // Unix epoch (segundos) do messageTimestamp Evolution/Baileys
  // índice atualizado:
  @@index([conversationId, providerTimestamp(sort: Asc), createdAt(sort: Asc)])
}
```

Após atualizar o schema, gerar o cliente: `bun run prisma:generate` (sem nova migration — o SQL acima já cobre).

### 2.3 Extração no webhook

Em `parseEvoMessageContent.ts` ou na camada de persistência de `ProcessEvoWebhookUseCase`, extrair:

```typescript
// rawPayload é o objeto Baileys bruto
const providerTimestamp: number | null =
  typeof rawPayload?.messageTimestamp === "number"
    ? rawPayload.messageTimestamp
    : typeof rawPayload?.messageTimestamp === "string"
      ? parseInt(rawPayload.messageTimestamp, 10) || null
      : null;
```

O campo `messageTimestamp` já existe no `rawPayload` armazenado — confirmar com `rawPayload?.messageTimestamp` antes de gravar.

### 2.4 Queries

```typescript
// WhatsAppRepository.listMessages — orderBy atualizado
orderBy: [
  { providerTimestamp: "asc" },
  { createdAt: "asc" },   // fallback para linhas com providerTimestamp null
]

// WhatsAppRepository.searchConversationMessages — mesmo padrão
orderBy: [
  { providerTimestamp: "asc" },
  { createdAt: "asc" },
]
```

**Sem backfill obrigatório:** linhas antigas terão `providerTimestamp = null` e serão ordenadas depois das com timestamp (NULLS LAST no índice). Para conversas com muito histórico antigo e retries, o comportamento melhorará progressivamente à medida que novas mensagens chegam.

---

## 3. F-02 — Throttle de Presence

### 3.1 Constante

```typescript
// hooks/useTeamPresence.ts
const ACTIVITY_THROTTLE_MS = 30_000;  // antes: 5_000
```

A lógica de `shouldThrottle` já existe e funciona — só o valor muda.

### 3.2 Log estruturado para rate limit

O canal de Presence é criado em `useTeamPresence.ts`. Para capturar o erro de rate limit, adicionar listener no canal após `.subscribe()`:

```typescript
channel.on("system", {}, (payload) => {
  if (payload?.message?.includes("rate_limit") || payload?.status === "CHANNEL_ERROR") {
    console.error("[useTeamPresence] presence_rate_limit_reached", {
      event: "presence_rate_limit_reached",
      masterId,
      timestamp: new Date().toISOString(),
    });
  }
});
```

> Supabase Realtime não emite um evento tipado específico para `ClientPresenceRateLimitReached` no cliente JS — o log estruturado via `system` channel é a abordagem mais próxima disponível sem SDK customizado.

---

## 4. F-03 — Cross-team routing fix

### 4.1 Interface: `resolveTargetTeamContext`

A função em `ProcessEvoWebhookUseCase.ts:566-597` já resolve o `teamId` correto para `handleMessagesUpsert`. O mesmo resolve deve ser chamado nos handlers de ACK/delete.

```typescript
// Padrão atual (BUG):
async function handleMessagesUpdate(input: { teamId: string; ... }) {
  // busca mensagem diretamente por input.teamId
}

// Padrão corrigido:
async function handleMessagesUpdate(input: { teamId: string; remoteJid: string; ... }) {
  const effectiveTeamId = await resolveEffectiveTeamId(input.teamId, input.remoteJid);
  // busca mensagem por effectiveTeamId
}
```

### 4.2 `findLeadTeamIdByPhoneForMaster` — matching exato

```typescript
// Antes: contains(últimos 11 dígitos) — pode ter falsos positivos
// Depois: normalizar ambos os lados para E.164 e comparar diretamente

function normalizePhoneForMatching(phone: string): string {
  // remove tudo que não é dígito, pega últimos 11
  return phone.replace(/\D/g, "").slice(-11);
}

// Query Prisma: usar equals após normalização, ou filtrar por suffixo de forma determinística
```

### 4.3 Tratamento gracioso

```typescript
if (!effectiveTeamId) {
  console.error("[ProcessEvoWebhookUseCase][cross-team-routing-failed]", {
    event: eventType,
    remoteJidSuffix: remoteJid.slice(-4),  // não logar JID completo (PII)
  });
  return;  // skip silencioso, não lança exceção
}
```

---

## 5. F-04 — Reagir a mensagem

### 5.1 EvoApiService — novo método

```typescript
// IEvoApiService.ts — adicionar à interface
sendReaction(params: {
  instanceName: string;
  key: { remoteJid: string; fromMe: boolean; id: string };
  reaction: string;  // emoji string ou "" para remover
}): Promise<void>;

// EvoApiService.ts — implementação
async sendReaction(params: { ... }): Promise<void> {
  const url = `${base}/message/sendReaction/${encodeURIComponent(params.instanceName)}`;
  await fetch(url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ key: params.key, reaction: params.reaction }),
  });
}
```

### 5.2 EvolutionWhatsAppProvider

```typescript
getMessageActionCapabilities() {
  return {
    react: true,           // antes: false
    deleteForEveryone: true,
  };
}

async reactToMessage(params: { key; emoji }) {
  await this.evoApiService.sendReaction({ ... });
}

async unreactToMessage(params: { key }) {
  await this.evoApiService.sendReaction({ ..., reaction: "" });
}
```

### 5.3 Parse inbound de reationMessage

```typescript
// parseEvoMessageContent.ts — adicionar branch
if (message.reactionMessage) {
  return {
    type: "REACT",
    text: message.reactionMessage.text ?? "",          // o emoji
    referencedMessageId: message.reactionMessage.key?.id ?? null,
    senderJid: message.reactionMessage.key?.remoteJid ?? null,
  };
}
```

### 5.4 Write-path em WhatsAppMessageReaction

```typescript
// WhatsAppRepository — novo método (ou extensão do existente)
async upsertMessageReaction(params: {
  teamId: string;
  messageId: string;
  profileId: string | null;      // null se é reação do contato
  remoteJid: string | null;      // null se é reação da equipe
  emoji: string;
  removedAt: Date | null;
}): Promise<void>
```

### 5.5 UI — emoji picker + BubbleReactions

```typescript
// MessageBubble.tsx — no lugar do toast.error incondicional para REACT:
case "REACT": {
  if (!capabilities.react) {
    toast.error("Ação indisponível neste provedor");
    return;
  }
  // abrir emoji picker com emojis rápidos: 👍 ❤️ 😂 😮 😢 🙏
  openEmojiPicker(message);
  return;
}

// Renderizar reações abaixo da bolha:
<BubbleReactions side="bottom" align={isOutbound ? "end" : "start"}>
  {message.reactions?.map(r => (
    <button key={r.emoji} onClick={() => handleReact(r.emoji)}>
      {r.emoji} {r.count > 1 && r.count}
    </button>
  ))}
</BubbleReactions>
```

O componente `BubbleReactions` já existe em `components/ui/bubble.tsx` — apenas usar.

---

## 6. F-05 — Apagar para todos

### 6.1 EvoApiService — novo método

O endpoint exato da Evolution API v2 para delete de mensagem é parte do Chat Controller. Verificar no Swagger/Postman da instância local durante implementação. Body provável:

```typescript
async deleteMessage(params: {
  instanceName: string;
  remoteJid: string;
  messageId: string;     // id do provider (remoteMessageId)
  fromMe: boolean;
}): Promise<void>
```

### 6.2 EvolutionWhatsAppProvider

```typescript
async deleteForEveryone(params: { remoteJid; messageId; fromMe }) {
  await this.evoApiService.deleteMessage({ ... });
}
```

### 6.3 Otimismo local

```typescript
// MessageActionUseCase — ao chamar deleteForEveryone:
// 1. Atualizar deletedForEveryoneAt no banco local imediatamente
// 2. Propagar via Realtime (F-06 cobre)
// 3. Se Evolution falhar, reverter e exibir toast.error
```

---

## 7. F-06 — Realtime de campos extras

### 7.1 handleMessageUpdated em useWhatsAppRealtime.ts

```typescript
function handleMessageUpdated(payload: RealtimePostgresUpdatePayload<WhatsAppMessageRow>) {
  const updated = payload.new;
  setMessages(prev => prev.map(msg => {
    if (msg.id !== updated.id) return msg;
    return {
      ...msg,
      // campos existentes:
      status: updated.status ?? msg.status,
      deliveredAt: updated.deliveredAt ?? msg.deliveredAt,
      readAt: updated.readAt ?? msg.readAt,
      failedAt: updated.failedAt ?? msg.failedAt,
      // campos novos (F-06):
      deletedForEveryoneAt: updated.deletedForEveryoneAt ?? msg.deletedForEveryoneAt,
      isPinned: updated.isPinned ?? msg.isPinned,
      isFavorite: updated.isFavorite ?? msg.isFavorite,
      isHiddenForMe: updated.isHiddenForMe ?? msg.isHiddenForMe,
      // media (já existentes):
      mediaStatus: updated.mediaStatus ?? msg.mediaStatus,
    };
  }));
}
```

Nenhuma mudança de canal necessária — `postgres_changes` já escuta UPDATE em `whatsapp_messages` com todos os campos.

---

## 8. F-07 — Performance de Context e render

### 8.1 useMemo no Context

```typescript
// WhatsAppInboxContext.tsx
const contextValue = useMemo(
  () => hookValue,
  [
    // dependências estáveis que mudam com menos frequência:
    conversations, activeConversation, messages, isLoadingMessages,
    // ... enumerar explicitamente, não usar spread
  ]
);
return <WhatsAppInboxContext.Provider value={contextValue}>{children}</WhatsAppInboxContext.Provider>;
```

### 8.2 React.memo em itens de lista

```typescript
// MessageBubble.tsx
export const MessageBubble = React.memo(
  function MessageBubble(props: MessageBubbleProps) { ... },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.deletedForEveryoneAt === next.message.deletedForEveryoneAt &&
    prev.message.reactions?.length === next.message.reactions?.length
);

// ConversationItem.tsx — mesmo padrão
export const ConversationItem = React.memo(...);
```

### 8.3 Virtualização da lista de mensagens

Usar `@tanstack/react-virtual` (verificar se já está no `package.json`; se não, instalar com `bun add @tanstack/react-virtual`).

```typescript
// MessageList.tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 80,           // altura média de uma bolha
  overscan: 10,
});
```

Threshold de ativação: `messages.length > 100` (para conversas menores, renderização direta é mais simples e sem overhead de medição).

### 8.4 Cache de loadActionsState por sessão

```typescript
// MessageBubble.tsx — substituir chamada direta por cache em ref/Map
const actionsStateCache = useRef<Map<string, WhatsAppMessageActionsState>>(new Map());

async function getActionsState(messageId: string) {
  if (actionsStateCache.current.has(messageId)) {
    return actionsStateCache.current.get(messageId)!;
  }
  const state = await loadActionsState(messageId);
  actionsStateCache.current.set(messageId, state);
  return state;
}
```

---

## 9. F-08 — Indicador "digitando..."

### 9.1 Estratégia: canal efêmero Supabase Broadcast

O dado de presença do contato é efêmero — não deve ir para o banco. A abordagem mais simples dentro da arquitetura atual:

```
Evolution → PRESENCE_UPDATE webhook → ProcessEvoWebhookUseCase → Supabase Broadcast
  → Frontend (useWhatsAppRealtime) escuta Broadcast → exibe indicador na thread ativa
```

```typescript
// ProcessEvoWebhookUseCase — novo branch para PRESENCE_UPDATE
case "PRESENCE_UPDATE": {
  const presenceData = input.data as { remoteJid: string; presenceType: string };
  const isTyping = presenceData.presenceType === "composing" || presenceData.presenceType === "recording";
  
  // Broadcast para o canal do time (já existe para outros fins)
  await supabase
    .channel(`whatsapp-presence:${input.teamId}`)
    .send({
      type: "broadcast",
      event: "contact_typing",
      payload: {
        remoteJid: presenceData.remoteJid,
        isTyping,
        ts: Date.now(),
      },
    });
  return;
}
```

### 9.2 Frontend — escuta e exibição

```typescript
// useWhatsAppRealtime.ts — adicionar listener de broadcast
channel
  .on("broadcast", { event: "contact_typing" }, ({ payload }) => {
    const { remoteJid, isTyping } = payload;
    if (remoteJid === activeConversation?.remoteJid) {
      setContactIsTyping(isTyping);
      // debounce: limpar após 5s sem novo evento
      clearTimeout(typingTimeoutRef.current);
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => setContactIsTyping(false), 5_000);
      }
    }
  });
```

```typescript
// MessageComposer.tsx ou thread footer — exibir indicador
{contactIsTyping && (
  <span className="text-xs text-muted-foreground animate-pulse">digitando...</span>
)}
```

> **Nota de segurança:** `remoteJid` não deve ser logado em produção (PII). No Broadcast payload, incluir apenas sufixo dos últimos 4 dígitos para debug se necessário.

---

## 10. F-09 — Advisors: índices e RLS

### 10.1 Migration

Gerada com: `bun run db:migrate:new whatsapp-phase-f-advisors`

O arquivo gerado deve conter (forma resumida — ver lista completa em WA-034 da auditoria):

```sql
-- Índices FK ausentes (exemplos; lista completa no achado WA-034)
CREATE INDEX IF NOT EXISTS "whatsapp_messages_configId_idx"
  ON "public"."whatsapp_messages" ("configId");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_leadId_idx"
  ON "public"."whatsapp_messages" ("leadId");
-- ... demais FKs listadas no WA-034

-- RLS otimizado (whatsapp_auto_response_rules, whatsapp_auto_response_logs)
-- Usar (select auth.uid()) no lugar de auth.uid() nas policies

-- Remoção de índices sem uso (após validação local):
DROP INDEX IF EXISTS "whatsapp_conversation_tag_assignments_tagId_idx";
DROP INDEX IF EXISTS "team_whatsapp_contacts_teamId_opaqueId_idx";
-- ... demais listados no WA-034
```

**Antes de remover qualquer índice**, executar localmente:
```bash
bun run db:migrate:reset:local
# verificar que testes passam e que bun run typecheck + lint continuam ok
```

---

## 11. F-10 — Inconsistência visual do balão recebido

### 11.1 Diagnóstico antes do fix

**Pré-requisito:** reproduzir ao vivo no browser. Checklist:

1. Abrir a thread de uma conversa com mensagens do contato.
2. Inspecionar elemento DOM de um balão inbound → verificar se `data-variant="secondary"` está presente.
3. Verificar no DevTools → Computed Styles se `--muted` está resolvido com um valor visível.
4. Identificar se o problema é exclusivo de um tipo de mensagem (botão interativo, lista, mídia).

### 11.2 Fix provável

Se `data-variant` está correto mas `bg-muted` não aparece: problema de token CSS não resolvido no contexto do inbox (wallpaper ou container com `overflow: hidden` ou `backdrop-filter` pode sobrescrever). Fix: verificar o `z-index` ou contexto de stacking do wallpaper SVG.

Se `data-variant` está incorreto ou ausente: algum render path não passa `variant="secondary"` ao `Bubble`. Fix: rastrear os tipos de mensagem sem background e garantir que todos chamam `<Bubble variant="secondary">`.

---

## 12. TypeScript interfaces novas/alteradas

```typescript
// prisma schema → tipo gerado
type WhatsAppMessage = {
  // existentes ...
  providerTimestamp: bigint | null;   // F-01
};

// IEvoApiService.ts
interface IEvoApiService {
  // existentes ...
  sendReaction(params: {
    instanceName: string;
    key: { remoteJid: string; fromMe: boolean; id: string };
    reaction: string;
  }): Promise<void>;

  deleteMessage(params: {
    instanceName: string;
    remoteJid: string;
    messageId: string;
    fromMe: boolean;
  }): Promise<void>;
}

// IWhatsAppProvider.ts — capability flags
interface WhatsAppMessageActionCapabilities {
  react: boolean;            // F-04: passa para true
  deleteForEveryone: boolean; // F-05: passa para true
}

// useWhatsAppRealtime — estado novo
type RealtimeState = {
  contactIsTyping: boolean;       // F-08
};

// WhatsAppInboxContext — campo novo exposto ao frontend
type WhatsAppInboxContextValue = {
  // existentes ...
  contactIsTyping: boolean;   // F-08
};
```

---

## 13. Diagrama de fluxo — F-04 (reagir)

```
Usuário clica "Reagir" na bolha
  └─ capabilities.react === true?
       ├─ false → toast.error (comportamento legado, não deve acontecer após F-04)
       └─ true → abrir EmojiPicker (inline, 6 emojis rápidos)
                  └─ usuário seleciona emoji
                       └─ MessageActionUseCase.reactToMessage(messageId, emoji)
                            └─ EvolutionWhatsAppProvider.reactToMessage
                                 └─ EvoApiService.sendReaction(instanceName, key, emoji)
                                      └─ POST /message/sendReaction/{instance} → Evolution API
                            └─ WhatsAppRepository.upsertMessageReaction (write-path local)
                            └─ UI: BubbleReactions exibe emoji otimistamente

Contato reage (webhook MESSAGES.UPSERT com reactionMessage)
  └─ parseEvoMessageContent → type: "REACT", emoji, referencedMessageId
       └─ ProcessEvoWebhookUseCase → upsertMessageReaction
            └─ Supabase Realtime (postgres_changes UPDATE em whatsapp_message_reactions)
                 └─ handleMessageUpdated → atualiza reactions na bolha
```

---

## 14. Diagrama de fluxo — F-08 (typing)

```
Contato digita no WhatsApp
  └─ Evolution API → PRESENCE_UPDATE webhook
       └─ ProcessEvoWebhookUseCase (novo branch)
            └─ Supabase Broadcast → canal whatsapp-presence:{teamId}
                 └─ useWhatsAppRealtime escuta broadcast "contact_typing"
                      └─ setContactIsTyping(true)
                           └─ MessageComposer exibe "digitando..."
                                └─ debounce 5s → setContactIsTyping(false)
```
