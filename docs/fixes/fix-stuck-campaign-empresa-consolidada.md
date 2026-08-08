# Fix: Reenvio de Campanha Travada - Empresa Consolidada

**Data:** 2026-08-07
**Prioridade:** CRÍTICA
**Status:** ✅ RESOLVIDO

## Problema Reportado

O usuário reportou que o reenvio da campanha "Empresa Consolidada" não estava funcionando. Ao clicar em "Reenviar apenas falhas", recebia o erro:

```
Disparo de 'Empresa Consolidada — Empresa Consolidada 06' falhou: 
Disparo interrompido: tempo limite de envio excedido (30 min)
```

## Diagnóstico

### Investigação no Banco de Dados

**Campanha Problema:**
- **ID:** `8000b454-0ecc-4292-bdf7-2dad9cc8ed65`
- **Nome:** "Empresa Consolidada — Empresa Consolidada 06"
- **Status:** `failed`
- **Total Recipients:** 206
- **Total Sent:** 0
- **Error Message:** "Disparo interrompido: tempo limite de envio excedido (30 min)"
- **Dispatches:** 0 (❌ SEM DISPATCH!)
- **EmailLogs:** 0 (❌ SEM LOGS!)

### Root Cause Analysis

1. **O que aconteceu:**
   - O `startManualDispatch` começou a executar
   - Colocou a campanha em status `"sending"` (lock inicial)
   - Algo falhou ANTES de criar o `EmailCampaignDispatch` ou os `EmailLog`
   - A função foi interrompida (provável timeout do Vercel 300s)
   - A campanha ficou órfã em estado `"sending"` sem dispatch associado

2. **Recovery automático problemático:**
   - Após 30 minutos, o cron `recoverStuckSendingCampaigns` executou
   - Marcou a campanha como `"failed"` com erro de timeout
   - **Mas a campanha não tinha dispatch nem logs!**

3. **Por que o reenvio falhava:**
   - O botão "Reenviar apenas falhas" chama `startManualDispatch` com `retryFailedOnly: true`
   - O código busca emails que falharam via `resolveFailedRetryRecipientEmails(campaignId)`
   - Essa função procura por `EmailLog` com status de falha
   - Como não havia logs, retornava lista vazia
   - Sistema retornava: "Não há destinatários com falha para reenviar"

## Solução Implementada

### 1. Fix Imediato (Executado)

**Script:** `scripts/fix-stuck-campaign-empresa-consolidada.ts`

Resetou manualmente o status da campanha de `"failed"` para `"draft"`, permitindo um novo disparo:

```typescript
await prisma.emailCampaign.update({
  where: { id: CAMPAIGN_ID },
  data: {
    status: "draft",
    errorMessage: null,
  },
})
```

**Resultado:** ✅ Campanha desbloqueada. O usuário pode agora disparar normalmente.

### 2. Fix Permanente (Código Atualizado)

**Arquivo:** `app/api/useCases/email/EmailCampaignUseCase.ts`

Melhorado o método `recoverStuckSendingCampaigns()` para:

1. **Detectar campanhas órfãs** (em "sending" sem dispatch):
   ```typescript
   const orphanCampaigns = await prisma.emailCampaign.findMany({
     where: {
       status: "sending",
       updatedAt: { lt: threshold },
     },
     select: {
       id: true,
       name: true,
       _count: { select: { dispatches: true } },
     },
   })

   const orphanCampaignsWithoutDispatches = orphanCampaigns.filter(
     (c) => c._count.dispatches === 0
   )
   ```

2. **Reverter campanhas órfãs para "draft"** (não marcá-las como "failed"):
   ```typescript
   await prisma.emailCampaign.updateMany({
     where: {
       id: { in: orphanCampaignsWithoutDispatches.map((c) => c.id) },
     },
     data: {
       status: "draft",
       errorMessage:
         "Disparo interrompido antes de criar o registro de envio. A campanha foi revertida para rascunho.",
     },
   })
   ```

3. **Apenas depois**, marcar como "failed" campanhas com dispatch travado (comportamento original)

## Prevenção Futura

O fix permanente garante que:

1. **Campanhas órfãas** (sem dispatch) são **revertidas para "draft"**, não marcadas como "failed"
2. Usuários podem **redisparar** essas campanhas normalmente
3. Não há mais casos de "Reenviar apenas falhas" falhando por ausência de logs
4. O sistema diferencia entre:
   - **Campanha órfã** (falha antes de criar dispatch) → reverte para "draft"
   - **Dispatch travado** (timeout durante envio) → marca como "failed"

## Logs e Monitoramento

O recovery agora loga detalhadamente:

```
[EmailCampaignUseCase][recoverStuckSendingCampaigns] 
Recovery concluído: 
- X órfã(s) revertida(s)
- Y campanha(s) marcada(s) como failed (timeout 30 min)
- Z dispatch(es) atualizado(s)
```

## Validação

- ✅ Typecheck passou
- ✅ Lint passou
- ✅ Campanha problema desbloqueada
- ✅ Código de recovery melhorado
- ✅ Logs aprimorados

## Próximos Passos Recomendados

1. **Notificar o usuário** que a campanha foi desbloqueada
2. **Monitorar logs** do cron de recovery nas próximas 24h
3. **Considerar:** Adicionar retry automático em `startManualDispatch` se falhar antes do dispatch
4. **Considerar:** Adicionar telemetria (Sentry) para detectar falhas antes do dispatch

## Arquivos Alterados

- `app/api/useCases/email/EmailCampaignUseCase.ts` - Recovery melhorado
- `scripts/fix-stuck-campaign-empresa-consolidada.ts` - Fix imediato (one-time)

## Referências

- PR #704 (cancelamento de emails em fase de entrega)
- `EMAIL_AUDIT.md` (seções 6.1-6.3 sobre dispatches travados)
- `EMAIL_SPEC.md` (linha 151 sobre recovery de travadas)
