# Tasks — WhatsApp Inbox V3: Fase F

**Versão:** 1.0  
**Data:** 2026-07-29  
**Referência:** `requirements.md` e `design.md` (mesma pasta)

> Cada task inclui: arquivos afetados, critério de conclusão e sequência de validação obrigatória.  
> Após cada task: `bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check && bun run lint:pt-br`

---

## Grupo Alpha — Bugs críticos em produção (P1)

### Task 1 — F-01: providerTimestamp + reordenação de queries

**Esforço:** M  
**Bloqueadores:** nenhum

#### 1.1 Migration de schema

```bash
bun run db:migrate:new whatsapp-phase-f-provider-timestamp
```

Editar o arquivo gerado com:

```sql
ALTER TABLE "public"."whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "providerTimestamp" BIGINT;

DROP INDEX IF EXISTS "whatsapp_messages_conversationId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversationId_providerTimestamp_createdAt_idx"
  ON "public"."whatsapp_messages" ("conversationId", "providerTimestamp" ASC NULLS LAST, "createdAt" ASC);
```

Validar: `bun run db:migrate:reset:local`

#### 1.2 Prisma schema

**Arquivo:** `prisma/schema.prisma`

- Adicionar campo `providerTimestamp BigInt?` no model `WhatsAppMessage`
- Substituir `@@index([conversationId, createdAt(sort: Asc)])` por `@@index([conversationId, providerTimestamp(sort: Asc), createdAt(sort: Asc)])`
- Executar `bun run prisma:generate`

#### 1.3 Extração no webhook

**Arquivo:** `app/api/useCases/whatsapp/ProcessEvoWebhookUseCase.ts` (ou `parseEvoMessageContent.ts` — verificar onde `rawPayload` é montado)

Localizar o ponto de `create` de `WhatsAppMessage` e adicionar:

```typescript
providerTimestamp:
  typeof rawPayload?.messageTimestamp === "number"
    ? BigInt(rawPayload.messageTimestamp)
    : typeof rawPayload?.messageTimestamp === "string"
      ? BigInt(parseInt(rawPayload.messageTimestamp, 10)) || null
      : null,
```

#### 1.4 Reordenar queries

**Arquivo:** `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts`

- `listMessages` (~linha 618): substituir `orderBy: { createdAt: "desc" }` por `orderBy: [{ providerTimestamp: "asc" }, { createdAt: "asc" }]`
- `searchConversationMessages` (~linha 1690): mesmo padrão

**Critério de conclusão:** `bun run typecheck` passa; `bun run db:migrate:reset:local` passa; abrir conversa mostra mensagens em ordem cronológica do WhatsApp.

---

### Task 2 — F-02: throttle de Presence

**Esforço:** S  
**Bloqueadores:** nenhum

**Arquivo:** `hooks/useTeamPresence.ts`

1. Alterar constante: `const ACTIVITY_THROTTLE_MS = 30_000`
2. Adicionar listener de sistema no canal após `.subscribe()` (buscar o ponto onde `channel.subscribe()` é chamado):

```typescript
channel.on("system", {}, (payload: Record<string, unknown>) => {
  const msg = typeof payload?.message === "string" ? payload.message : "";
  if (msg.includes("rate_limit") || payload?.status === "CHANNEL_ERROR") {
    console.error("[useTeamPresence] presence_rate_limit_reached", {
      event: "presence_rate_limit_reached",
      masterId,
      ts: new Date().toISOString(),
    });
  }
});
```

**Critério de conclusão:** `bun run typecheck` passa. Em produção (após deploy), ausência de `ClientPresenceRateLimitReached` nos logs Supabase por ≥ 1h de uso normal.

---

### Task 3 — F-03: cross-team routing fix

**Esforço:** M  
**Bloqueadores:** nenhum

**Arquivo principal:** `app/api/useCases/whatsapp/ProcessEvoWebhookUseCase.ts`

#### 3.1 Extrair helper de resolução de teamId efetivo

Criar função interna (ou mover lógica de `resolveTargetTeamContext` para um helper reutilizável):

```typescript
async function resolveEffectiveTeamId(
  originalTeamId: string,
  remoteJid: string,
  repo: WhatsAppRepository
): Promise<string> {
  const routed = await repo.findLeadTeamIdByPhoneForMaster(originalTeamId, remoteJid);
  return routed ?? originalTeamId;
}
```

#### 3.2 Aplicar em handleMessagesUpdate e handleMessagesDelete

Para cada handler que hoje usa `input.teamId` diretamente na busca de mensagem:

```typescript
const effectiveTeamId = await resolveEffectiveTeamId(input.teamId, input.remoteJid, repo);
// substituir input.teamId por effectiveTeamId nas queries de busca
```

#### 3.3 Corrigir matching de telefone em WhatsAppRepository

**Arquivo:** `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts`

`findLeadTeamIdByPhoneForMaster` (~linha 1302): substituir `contains()` por:

```typescript
// Normalizar para os últimos 11 dígitos e usar endsWith determinístico
const normalized = phone.replace(/\D/g, "").slice(-11);
where: {
  phoneE164: { endsWith: normalized }  // ou equals se já está normalizado
}
```

#### 3.4 Tratamento gracioso

```typescript
if (!effectiveTeamId) {
  console.error("[ProcessEvoWebhookUseCase][cross-team-routing-failed]", {
    event: eventType,
    suffix: remoteJid.slice(-4),
  });
  return;
}
```

**Critério de conclusão:** `bun run typecheck` passa. Smoke manual: em conta master com dois sub-times, ticks atualizam corretamente após envio de mensagem.

---

## Grupo Beta — Features incompletas (P1)

> **Pré-condição confirmada:** Evolution API v2 tem `POST /message/sendReaction/{instance}` e endpoint de delete de mensagem. Capabilities elevadas para P1.

### Task 4 — F-04: reagir a mensagem (ponta a ponta)

**Esforço:** L  
**Bloqueadores:** nenhum (Evolution homologada)

#### 4.1 IEvoApiService + EvoApiService

**Arquivos:** `app/api/services/whatsapp/evo/IEvoApiService.ts` e `EvoApiService.ts`

Adicionar à interface e implementar:

```typescript
sendReaction(params: {
  instanceName: string;
  key: { remoteJid: string; fromMe: boolean; id: string };
  reaction: string;
}): Promise<void>;
```

Implementação em `EvoApiService.ts`:

```typescript
async sendReaction(params): Promise<void> {
  const apiKey = getApiKey();
  const base = resolveEvoApiBaseUrl();
  const url = `${base}/message/sendReaction/${encodeURIComponent(params.instanceName)}`;
  await fetch(url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ key: params.key, reaction: params.reaction }),
  });
}
```

#### 4.2 EvolutionWhatsAppProvider

**Arquivo:** `app/api/services/whatsapp/provider/EvolutionWhatsAppProvider.ts`

- `getMessageActionCapabilities()`: `react: true` (remover comentário "not yet homologated")
- Implementar `reactToMessage` e `unreactToMessage` usando `this.evoApiService.sendReaction`

#### 4.3 parseEvoMessageContent — parse inbound

**Arquivo:** `app/api/services/whatsapp/evo/parseEvoMessageContent.ts`

Adicionar branch antes do fallback `UNKNOWN`:

```typescript
if (message.reactionMessage) {
  return {
    type: "REACT" as const,
    text: message.reactionMessage.text ?? "",
    referencedMessageId: message.reactionMessage.key?.id ?? null,
    senderJid: message.reactionMessage.key?.remoteJid ?? null,
  };
}
```

#### 4.4 WhatsAppRepository — upsertMessageReaction

**Arquivo:** `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts`

Adicionar método para escrever na tabela `WhatsAppMessageReaction` (hoje só lida):

```typescript
async upsertMessageReaction(params: {
  teamId: string;
  messageId: string;
  profileId?: string;
  remoteJid?: string;
  emoji: string;
  removedAt?: Date | null;
}): Promise<void>
```

#### 4.5 ProcessEvoWebhookUseCase — handler de reação inbound

Quando `parseEvoMessageContent` retornar `type: "REACT"`, chamar `upsertMessageReaction` em vez de criar uma `WhatsAppMessage` nova.

#### 4.6 UI — emoji picker + BubbleReactions

**Arquivo:** `app/[supabaseId]/whatsapp/features/components/MessageBubble.tsx`

- `case "REACT"`: substituir `toast.error` incondicional por verificação de `capabilities.react`
- Implementar picker inline (6 emojis: `👍 ❤️ 😂 😮 😢 🙏`) usando componente simples (não instalar biblioteca externa se não necessário)
- Renderizar `<BubbleReactions>` abaixo da bolha quando `message.reactions?.length > 0`

**Critério de conclusão:** usuário reage com 👍, aparece na bolha; contato reage com ❤️, aparece na bolha após webhook. `bun run typecheck` + `bun run lint` passam.

---

### Task 5 — F-05: apagar para todos (ponta a ponta)

**Esforço:** M  
**Bloqueadores:** Task 6 (F-06) deve ser feita em paralelo ou antes, para que `deletedForEveryoneAt` propague via Realtime

#### 5.1 IEvoApiService + EvoApiService

Adicionar e implementar `deleteMessage`:

```typescript
deleteMessage(params: {
  instanceName: string;
  remoteJid: string;
  messageId: string;
  fromMe: boolean;
}): Promise<void>;
```

> **Nota:** Verificar o endpoint exato do Chat Controller da instância Evolution local (Swagger em `http://localhost:8080/docs` ou equivalente) durante implementação. Corpo provável: `{ key: { remoteJid, fromMe, id } }`.

#### 5.2 EvolutionWhatsAppProvider

- `getMessageActionCapabilities()`: `deleteForEveryone: true`
- Implementar `deleteForEveryone` usando `this.evoApiService.deleteMessage`

#### 5.3 MessageActionUseCase — otimismo local

No path de `deleteForEveryone`: após chamar o provider, atualizar `deletedForEveryoneAt` no banco local. Se o provider falhar, reverter e exibir `toast.error`.

**Critério de conclusão:** mensagem apagada no Studio → contato vê "Esta mensagem foi apagada" no WhatsApp.

---

### Task 6 — F-06: propagação Realtime de ações locais

**Esforço:** S  
**Bloqueadores:** nenhum (paralelo à Task 5)

**Arquivo:** `hooks/useWhatsAppRealtime.ts`

Adicionar os campos ao merge de `handleMessageUpdated`:

```typescript
deletedForEveryoneAt: updated.deletedForEveryoneAt ?? msg.deletedForEveryoneAt,
isPinned: updated.isPinned ?? msg.isPinned,
isFavorite: updated.isFavorite ?? msg.isFavorite,
isHiddenForMe: updated.isHiddenForMe ?? msg.isHiddenForMe,
```

**Critério de conclusão:** apagar mensagem na aba A → aba B exibe bolha apagada sem reload. `bun run typecheck` passa.

---

## Grupo Gamma — Qualidade e infraestrutura (P2)

### Task 7 — F-07: performance de render do Inbox

**Esforço:** L  
**Bloqueadores:** nenhum

#### 7.1 useMemo no Context

**Arquivo:** `app/[supabaseId]/whatsapp/features/context/WhatsAppInboxContext.tsx`

Envolver o valor retornado por `useWhatsAppInbox()` em `useMemo` com dependências explícitas listadas. Não usar spread — enumerar cada campo para que o lint de dependências consiga verificar.

#### 7.2 React.memo em MessageBubble

**Arquivo:** `app/[supabaseId]/whatsapp/features/components/MessageBubble.tsx`

Envolver o componente em `React.memo` com função de comparação:

```typescript
export const MessageBubble = React.memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.deletedForEveryoneAt === next.message.deletedForEveryoneAt &&
    (prev.message.reactions?.length ?? 0) === (next.message.reactions?.length ?? 0)
);
```

#### 7.3 React.memo em ConversationItem

**Arquivo:** localizar o componente de item da lista de conversas e aplicar `React.memo`.

#### 7.4 Virtualização da lista de mensagens

**Verificar:** `bun list | grep tanstack` — se `@tanstack/react-virtual` não estiver instalado, `bun add @tanstack/react-virtual`.

**Arquivo:** componente que renderiza `messages.map(...)` na thread.

- Ativar virtualização quando `messages.length > 100`
- Manter scroll no final ao receber nova mensagem (scroll-to-bottom)
- Manter scroll position ao carregar mensagens mais antigas (prepend sem salto visual)

#### 7.5 Cache de loadActionsState

**Arquivo:** `app/[supabaseId]/whatsapp/features/components/MessageBubble.tsx`

Substituir chamada direta por cache em `useRef<Map<string, ActionsState>>`. Invalidar o cache quando `message.status` muda.

**Critério de conclusão:** React DevTools Profiler mostra que alterar o campo de busca não re-renderiza `MessageBubble`. `bun run typecheck` + `bun run lint` passam.

---

### Task 8 — F-08: indicador "digitando..." via PRESENCE_UPDATE

**Esforço:** M  
**Bloqueadores:** nenhum

#### 8.1 ProcessEvoWebhookUseCase — branch PRESENCE_UPDATE

**Arquivo:** `app/api/useCases/whatsapp/ProcessEvoWebhookUseCase.ts`

Substituir o `else` genérico por case específico:

```typescript
case "PRESENCE_UPDATE": {
  const data = input.data as { remoteJid?: string; presenceType?: string };
  if (!data.remoteJid) return output.success([]);
  const isTyping =
    data.presenceType === "composing" || data.presenceType === "recording";
  // Broadcast efêmero para o canal do time
  const supabase = getPrismaClient(); // ou supabaseAdmin — verificar padrão existente
  await supabase
    .from("whatsapp_typing_presence") // canal fictício — usar Broadcast, não tabela
    // Ajustar para o padrão de broadcast da codebase
    .channel(`whatsapp-presence:${input.teamId}`)
    .send({
      type: "broadcast",
      event: "contact_typing",
      payload: { remoteJid: data.remoteJid, isTyping, ts: Date.now() },
    });
  return output.success([]);
}
```

> **Atenção:** verificar como o Supabase Admin client é instanciado no backend para chamadas de Broadcast. Usar o padrão já existente na codebase (buscar `supabaseAdmin` ou equivalente).

#### 8.2 useWhatsAppRealtime — escuta broadcast

**Arquivo:** `hooks/useWhatsAppRealtime.ts`

Adicionar ao canal existente (ou criar canal separado de broadcast):

```typescript
.on("broadcast", { event: "contact_typing" }, ({ payload }) => {
  const { remoteJid, isTyping } = payload as { remoteJid: string; isTyping: boolean };
  if (remoteJid !== activeConversation?.remoteJid) return;
  setContactIsTyping(isTyping);
  clearTimeout(typingTimeoutRef.current);
  if (isTyping) {
    typingTimeoutRef.current = window.setTimeout(
      () => setContactIsTyping(false),
      5_000
    );
  }
})
```

#### 8.3 Context — expor contactIsTyping

**Arquivo:** `app/[supabaseId]/whatsapp/features/context/WhatsAppInboxHook.ts`

Adicionar `contactIsTyping: boolean` ao estado e ao valor retornado.

#### 8.4 UI — exibir indicador

**Arquivo:** `app/[supabaseId]/whatsapp/features/components/MessageComposer.tsx` (ou footer da thread)

```tsx
{contactIsTyping && (
  <p className="text-xs text-muted-foreground animate-pulse px-4 pb-1">
    digitando...
  </p>
)}
```

**Critério de conclusão:** contato digita no WhatsApp → inbox mostra "digitando..." em ≤ 3s; para de digitar → desaparece em ≤ 5s. `bun run typecheck` + `bun run lint:pt-br` passam.

---

### Task 9 — F-09: Advisors — índices FK e RLS

**Esforço:** M  
**Bloqueadores:** nenhum (migration SQL pura, sem dependência de código)

```bash
bun run db:migrate:new whatsapp-phase-f-advisors
```

Editar o arquivo gerado com o SQL completo da seção `§10.1` de `design.md`:

1. `CREATE INDEX IF NOT EXISTS` para cada FK sem índice listada em WA-034.
2. Recrear policies RLS de `whatsapp_auto_response_rules` e `whatsapp_auto_response_logs` com `(select auth.uid())`.
3. `DROP INDEX IF EXISTS` para índices sem uso (após validação local).

Validar:

```bash
bun run db:migrate:reset:local
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
```

**Critério de conclusão:** migration aplica sem erro; `\d+ whatsapp_messages` no psql local mostra os novos índices.

---

### Task 10 — F-10: inconsistência visual do balão recebido

**Esforço:** S  
**Bloqueadores:** reprodução ao vivo no browser (pré-requisito)

#### 10.1 Diagnóstico

1. Iniciar o dev server: `bun run dev`
2. Abrir o inbox em light mode e dark mode
3. Inspecionar um balão inbound: verificar `data-variant` e computed style de `background-color`
4. Repetir para: texto simples, resposta de botão, mensagem de lista interativa, mídia

#### 10.2 Fix (após diagnóstico confirmar a causa)

Dependendo do resultado:

- **Caso A** — `data-variant` ausente ou errado: rastrear o render path do tipo de mensagem problemático e garantir `<Bubble variant="secondary">` em todos os branches.
- **Caso B** — `data-variant` correto mas token não resolve: verificar se o container do wallpaper SVG cria contexto isolado que sobrescreve `--muted`. Ajustar a camada de z-index ou a forma como o token é declarado.

Após fix: `bun run design:check` — se falhar, `bun run design:sync` e comitar o resultado.

**Critério de conclusão:** screenshot do inbox em light e dark mode com todos os tipos de mensagem inbound mostrando fundo visível.

---

## Sequência de implementação recomendada

```
Sprint 1 (Alpha — máximo impacto nos sintomas relatados):
  Task 1 (F-01) → Task 2 (F-02) → Task 3 (F-03)
  Paralelo: Task 6 (F-06) — sem dependência

Sprint 2 (Beta — features completas):
  Task 4 (F-04) → Task 5 (F-05)
  Task 6 deve estar concluída antes de Task 5 ir para produção

Sprint 3 (Gamma — qualidade):
  Task 7 (F-07) → Task 8 (F-08)
  Task 9 (F-09) — pode ser em paralelo com qualquer sprint
  Task 10 (F-10) — requer diagnóstico ao vivo; pode ser na Sprint 3
```

---

## Checklist de PR por task

Para cada task, antes de abrir PR:

- [ ] Seguiu `agents.md`?
- [ ] `bun run typecheck 2>&1 | head -20` — zero erros?
- [ ] `bun run lint` — zero erros?
- [ ] `bun run governance:check` — zero violações?
- [ ] `bun run lint:pt-br` — zero erros?
- [ ] Tasks com mudança de UI: `bun run design:check` (e `bun run design:sync` se falhar)?
- [ ] Tasks 1, 9: migration criada com `db:migrate:new`, SQL idempotente, `db:migrate:reset:local` passou?
- [ ] Postman atualizado se novo endpoint foi criado (Tasks 4, 5)?
- [ ] Nenhuma migration remota aplicada sem autorização explícita do owner?

---

## Estimativas de esforço

| Task | Item | Esforço | Sprint |
|---|---|---|---|
| 1 | F-01 providerTimestamp | M (1–2 dias) | 1 |
| 2 | F-02 Presence throttle | S (horas) | 1 |
| 3 | F-03 cross-team routing | M (1 dia) | 1 |
| 4 | F-04 reagir (ponta a ponta) | L (3–4 dias) | 2 |
| 5 | F-05 apagar para todos | M (1–2 dias) | 2 |
| 6 | F-06 Realtime extras | S (horas) | 1/2 |
| 7 | F-07 performance Context | L (2–3 dias) | 3 |
| 8 | F-08 digitando... | M (1–2 dias) | 3 |
| 9 | F-09 Advisors SQL | M (1 dia) | qualquer |
| 10 | F-10 visual balão | S (após diagnóstico) | 3 |
| **Total** | | **~15–20 dias-dev** | 3 sprints |
