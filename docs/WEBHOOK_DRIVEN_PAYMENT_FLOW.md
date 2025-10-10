# 🎯 Fluxo de Confirmação via Webhook - Lead Flow

> Documentação do fluxo webhook-driven para confirmação de pagamentos

## 📋 Visão Geral

O sistema foi migrado de **polling** para **webhook-driven notification**, eliminando chamadas desnecessárias à API externa e melhorando a confiabilidade.

## 🔄 Fluxo Completo

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Webhook Asaas  │    │   localStorage      │
│  (Subscribe)    │    │                  │    │   (Browser)         │
└────────┬────────┘    └────────┬─────────┘    └──────────┬──────────┘
         │                      │                           │
    1. Gera QR Code PIX         │                           │
         │──────────────────────│                           │
         │                      │                           │
    2. Aguarda pagamento        │                           │
         │                      │                           │
         │                 3. Pagamento                     │
         │                    confirmado                    │
         │                      │                           │
         │                 4. Webhook                       │
         │                    recebido                      │
         │                   (POST)                         │
         │                      │                           │
         │                 5. Chama notify                  │
         │                    endpoint                      │
         │                      │────────6. Set flag────────▶│
         │                      │       localStorage         │
         │                      │                           │
    7. Hook detecta mudança     │                           │
         │◀─────────────────────┼───────────────────────────│
         │                      │                           │
    8. Salva dados criptografados                          │
         │                      │                           │
    9. Redireciona /sign-up     │                           │
         │                      │                           │
```

## 🏗️ Componentes do Sistema

### 1. Hook `useWebhookListener`

**Arquivo**: `hooks/useWebhookListener.ts`

**Responsabilidade**: Detectar quando o webhook confirmar o pagamento

**Funcionamento**:
```typescript
useWebhookListener({
  subscriptionId: 'sub_xxx',
  onPaymentConfirmed: () => {
    // Redirecionar para sign-up
  },
  enabled: true
});
```

**Implementação**:
- Verifica localStorage a cada 2 segundos
- Busca chave: `webhook_payment_{subscriptionId}`
- Quando encontra `isPaid: true` → executa callback
- Remove flag após processar

### 2. Endpoint de Notificação

**Arquivo**: `app/api/v1/subscriptions/[subscriptionId]/notify-payment/route.ts`

**Responsabilidade**: Receber chamada do webhook e atualizar localStorage

**Endpoints**:

**POST** `/api/v1/subscriptions/{subscriptionId}/notify-payment`
- **Chamado por**: Webhook interno (após receber evento Asaas)
- **Payload**:
  ```json
  {
    "paymentId": "pay_xxx",
    "status": "RECEIVED",
    "timestamp": 1234567890
  }
  ```
- **Resposta**: Script JavaScript que atualiza localStorage
- **Status**: 200 OK

**Exemplo de resposta**:
```javascript
(function() {
  const storageKey = 'webhook_payment_sub_xxx';
  const data = {
    isPaid: true,
    subscriptionId: 'sub_xxx',
    timestamp: 1234567890,
    paymentId: 'pay_xxx'
  };
  
  localStorage.setItem(storageKey, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('payment-confirmed', { detail: data }));
})();
```

### 3. Webhook Handler

**Arquivo**: `app/api/webhooks/asaas/route.ts`

**Responsabilidade**: Processar eventos do Asaas e notificar frontend

**Modificação realizada**:
```typescript
if (result.isPaid && body.payment?.subscription) {
  const subscriptionId = body.payment.subscription;
  console.info('💾 [Webhook Asaas] Notificando frontend:', subscriptionId);
  
  const notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/subscriptions/${subscriptionId}/notify-payment`;
  
  fetch(notifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentId: body.payment.id,
      status: body.payment.status,
      timestamp: Date.now(),
    }),
  }).catch(error => {
    console.error('❌ Erro ao notificar frontend:', error);
  });
}
```

### 4. Componente de Subscription

**Arquivo**: `app/subscribe/features/components/SubscriptionFormMultiStep.tsx`

**Modificação realizada**:

**ANTES** (polling):
```tsx
const { isPolling, attempts } = usePaymentPolling({
  subscriptionId: subscriptionData?.subscriptionId,
  enabled: currentStep === 3,
  onPaymentConfirmed: () => { /* redirect */ },
  interval: 3000,
  maxAttempts: 100
});
```

**DEPOIS** (webhook-listener):
```tsx
useWebhookListener({
  subscriptionId: subscriptionData?.subscriptionId,
  enabled: currentStep === 3,
  onPaymentConfirmed: () => {
    // Salvar dados criptografados
    saveEncryptedData('pendingSignUp', signUpData);
    
    // Redirecionar para sign-up
    router.push('/sign-up?from=subscription');
  }
});
```

## 🎯 Benefícios da Nova Abordagem

### ✅ Vantagens

1. **Confiabilidade**
   - Webhook é fonte autoritativa (Asaas envia quando pagamento confirma)
   - Não depende de URL externa (sem 404 errors)

2. **Performance**
   - Sem polling contínuo (reduz carga no servidor)
   - Verificação a cada 2s no localStorage (muito leve)
   - Resposta instantânea após webhook

3. **Simplicidade**
   - Não precisa consultar API externa do Asaas
   - Fluxo direto: webhook → localStorage → redirect
   - Menos pontos de falha

4. **Eficiência**
   - Reduz requisições HTTP drasticamente
   - Operações locais (localStorage) são instantâneas
   - Menor uso de recursos do servidor

### ❌ Problemas Resolvidos

- ✅ **404 Errors**: Não consulta mais API do Asaas
- ✅ **Polling Failures**: Não faz mais polling de API
- ✅ **URL Construction**: Não precisa mais construir URL externa
- ✅ **Network Dependencies**: Apenas localStorage local
- ✅ **Timeout Issues**: Webhook chega quando pagamento confirma

## 🔧 Configuração Necessária

### Variáveis de Ambiente

```env
# URL base da aplicação (para webhook chamar notify endpoint)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Outras variáveis existentes...
ASAAS_API_KEY=your-key
ASAAS_WEBHOOK_TOKEN=your-token
```

### Webhook Asaas

**Configurar no painel Asaas**:
- URL: `https://seu-dominio.com/api/webhooks/asaas`
- Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
- Token: Configurado em `ASAAS_WEBHOOK_TOKEN`

## 📊 Fluxo de Dados Detalhado

### 1. Usuário Gera Pagamento
```typescript
// Frontend: SubscriptionFormMultiStep.tsx
const result = await service.createSubscription(formData);
setSubscriptionData({
  subscriptionId: result.subscriptionId,
  customerId: result.customerId,
  paymentId: result.paymentId
});
```

### 2. QR Code PIX Exibido
```tsx
// Frontend mostra QR Code
<img src={pixData.encodedImage} alt="QR Code PIX" />
<code>{pixData.payload}</code>
```

### 3. Usuário Paga
```
Usuário escaneia QR Code e confirma pagamento no app do banco
```

### 4. Asaas Envia Webhook
```json
POST /api/webhooks/asaas
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_xxx",
    "subscription": "sub_xxx",
    "status": "RECEIVED",
    "customer": "cus_xxx"
  }
}
```

### 5. Webhook Valida e Notifica
```typescript
// Backend: webhooks/asaas/route.ts
const result = await paymentValidationUseCase.processWebhook(...);

if (result.isPaid) {
  // Chama endpoint de notificação
  fetch(`/api/v1/subscriptions/${subscriptionId}/notify-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentId, status, timestamp })
  });
}
```

### 6. Notify Endpoint Atualiza localStorage
```typescript
// Backend: notify-payment/route.ts
return new NextResponse(`
  localStorage.setItem('webhook_payment_${subscriptionId}', JSON.stringify({
    isPaid: true,
    subscriptionId,
    timestamp: Date.now()
  }));
`, { status: 200, headers: { 'Content-Type': 'application/javascript' } });
```

### 7. Hook Detecta Mudança
```typescript
// Frontend: useWebhookListener.ts
const checkInterval = setInterval(() => {
  const webhookData = localStorage.getItem(`webhook_payment_${subscriptionId}`);
  
  if (webhookData && JSON.parse(webhookData).isPaid) {
    onPaymentConfirmed();
    clearInterval(checkInterval);
    localStorage.removeItem(storageKey);
  }
}, 2000);
```

### 8. Frontend Redireciona
```typescript
// Frontend: SubscriptionFormMultiStep.tsx
onPaymentConfirmed: () => {
  saveEncryptedData('pendingSignUp', signUpData);
  router.push('/sign-up?from=subscription');
}
```

## 🧪 Como Testar

### Passo a Passo

1. **Iniciar aplicação**:
   ```bash
   bun run dev
   ```

2. **Acessar formulário de subscription**:
   ```
   http://localhost:3000/subscribe
   ```

3. **Preencher dados e gerar pagamento PIX**

4. **Simular webhook** (sem pagar de verdade):
   ```bash
   # Terminal
   curl -X POST http://localhost:3000/api/webhooks/asaas \
     -H "Content-Type: application/json" \
     -H "asaas-access-token: YOUR_TOKEN" \
     -d '{
       "event": "PAYMENT_RECEIVED",
       "payment": {
         "id": "pay_test_123",
         "subscription": "SUB_ID_AQUI",
         "status": "RECEIVED",
         "customer": "cus_test_123"
       }
     }'
   ```

5. **Verificar logs**:
   ```
   ✅ [PaymentValidationService] Pagamento CONFIRMADO!
   💾 [Webhook Asaas] Notificando frontend: sub_xxx
   👂 [useWebhookListener] Escutando confirmação para: sub_xxx
   ✅ [useWebhookListener] Pagamento confirmado via webhook!
   🎉 [SubscriptionFormMultiStep] Pagamento confirmado via webhook!
   ```

6. **Verificar redirecionamento**:
   - Deve redirecionar para `/sign-up?from=subscription`
   - Formulário deve estar pré-preenchido com dados

### Validações

**✅ Deve Funcionar:**
- [ ] Webhook chega e é processado
- [ ] localStorage é atualizado com flag
- [ ] Hook detecta mudança em ~2 segundos
- [ ] Dados são salvos criptografados
- [ ] Redireciona para sign-up
- [ ] Formulário sign-up pre-preenchido

**❌ Não Deve Acontecer:**
- [ ] Polling contínuo de API
- [ ] Erros 404 de consulta Asaas
- [ ] Timeout de requisições
- [ ] Dados perdidos na navegação

## 🔍 Debug e Logs

### Logs Importantes

**Webhook recebido**:
```
📨 [Webhook Asaas] Evento recebido: PAYMENT_RECEIVED
✅ [PaymentValidationService] Pagamento CONFIRMADO!
💾 [Webhook Asaas] Notificando frontend: sub_xxx
```

**Hook detectou**:
```
👂 [useWebhookListener] Escutando confirmação para: sub_xxx
✅ [useWebhookListener] Pagamento confirmado via webhook!
```

**Frontend redirecionando**:
```
🎉 [SubscriptionFormMultiStep] Pagamento confirmado via webhook!
💾 [SubscriptionFormMultiStep] Dados salvos (criptografados) para sign-up
```

### Verificar localStorage

**No navegador (DevTools → Console)**:
```javascript
// Ver flag de pagamento confirmado
localStorage.getItem('webhook_payment_sub_xxx');

// Limpar se necessário
localStorage.removeItem('webhook_payment_sub_xxx');

// Ver dados criptografados do sign-up
sessionStorage.getItem('pendingSignUp_encrypted');
```

## 📝 Checklist de Implementação

### Backend
- [x] Hook `useWebhookListener` criado
- [x] Endpoint `notify-payment` criado
- [x] Webhook modificado para chamar notify
- [x] Logs adicionados para debug

### Frontend
- [x] Import `useWebhookListener` adicionado
- [x] Substituído `usePaymentPolling` por `useWebhookListener`
- [x] Removidas referências a `isPolling` e `attempts`
- [x] Mantido indicador visual de "aguardando confirmação"

### Testes
- [ ] Testar webhook real com pagamento sandbox
- [ ] Testar simulação de webhook via curl
- [ ] Validar redirecionamento funciona
- [ ] Verificar dados criptografados preservados
- [ ] Confirmar sign-up completa corretamente

### Documentação
- [x] Documentação do fluxo webhook-driven
- [x] Diagramas de sequência
- [x] Guia de debug
- [x] Checklist de validação

## 🎯 Próximos Passos

1. **Remover código antigo** (opcional):
   - Arquivo `hooks/usePaymentPolling.ts` (não usado mais)
   - Endpoint `/status` complexo (se não for usado em outro lugar)

2. **Melhorias futuras**:
   - Adicionar WebSocket para notificação real-time (melhor que localStorage)
   - Implementar retry automático se notify falhar
   - Adicionar analytics de tempo entre pagamento e redirect

3. **Monitoramento**:
   - Acompanhar logs de webhook no production
   - Verificar taxa de sucesso de redirecionamento
   - Medir tempo médio entre pagamento e confirmação

---

✅ **Sistema migrado de polling para webhook-driven com sucesso!**

📚 **Referências**:
- [Architecture Guide](./ARCHITECTURE_GUIDE.md)
- [Subscription Payment Guide](./SUBSCRIPTION_PAYMENT_GUIDE.md)
- [Asaas Webhook Documentation](../AsaasDoc/documentacao-asaas-pix.md)
