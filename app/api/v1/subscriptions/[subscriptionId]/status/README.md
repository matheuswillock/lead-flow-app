# 📋 Subscription Status API

> Endpoint para verificar o status de pagamento de uma assinatura

## 🏗️ Arquitetura

```
Route (Controller)
    ↓
SubscriptionStatusUseCase
    ↓
SubscriptionStatusService
    ↓
Prisma (Database) + Asaas API
```

## 📂 Estrutura de Arquivos

```
app/api/
├── v1/subscriptions/[subscriptionId]/status/
│   └── route.ts                              # Controller (HTTP Layer)
├── useCases/subscriptions/
│   ├── ISubscriptionStatusUseCase.ts         # Interface
│   └── SubscriptionStatusUseCase.ts          # Business Logic
└── services/SubscriptionStatus/
    ├── ISubscriptionStatusService.ts         # Interface
    └── SubscriptionStatusService.ts          # Domain Logic
```

## 🎯 Fluxo de Verificação

### 1. **Com Profile Criado** (após sign-up)

```
Request → UseCase → Service → Database (Profile)
                                    ↓
                              Retorna status do profile
```

### 2. **Sem Profile** (antes do sign-up)

```
Request → UseCase → Service → Database (Profile não encontrado)
                                    ↓
                              Consulta Asaas API
                                    ↓
                              Verifica pagamentos
                                    ↓
                              Retorna status real
```

## 📝 Responsabilidades

### **Route (Controller)**
- ✅ Parse de parâmetros HTTP
- ✅ Chamar UseCase
- ✅ Retornar status code apropriado
- ❌ Não deve ter lógica de negócio
- ❌ Não deve acessar banco diretamente
- ❌ Não deve chamar APIs externas

### **UseCase**
- ✅ Validar entrada (subscriptionId)
- ✅ Orquestrar chamada ao Service
- ✅ Retornar Output padronizado
- ❌ Não deve acessar banco diretamente
- ❌ Não deve chamar APIs externas

### **Service**
- ✅ Buscar profile no banco (via Prisma)
- ✅ Consultar Asaas API quando necessário
- ✅ Lógica de verificação de pagamento
- ✅ Transformação de dados
- ❌ Não deve lidar com HTTP diretamente

## 🔌 Endpoint

### `GET /api/v1/subscriptions/[subscriptionId]/status`

**Descrição:** Verifica o status de pagamento de uma assinatura

**Parâmetros:**
- `subscriptionId` (path) - ID da assinatura no Asaas

**Response (Success):**

```typescript
{
  isPaid: boolean;                    // Pagamento confirmado?
  status: string;                     // Status geral
  message: string;                    // Mensagem descritiva
  subscriptionStatus?: string;        // Status do profile (se existe)
  subscriptionPlan?: string;          // Plano da assinatura
  subscriptionStartDate?: Date;       // Data de início
  subscriptionEndDate?: Date;         // Data de término
  paymentId?: string;                 // ID do pagamento (Asaas)
  paymentStatus?: string;             // Status do pagamento (Asaas)
  payments?: Array<{                  // Lista de pagamentos (quando pendente)
    id: string;
    status: string;
    value: number;
  }>;
}
```

## 📊 Casos de Uso

### 1. Profile Existe + Assinatura Ativa

```json
{
  "isPaid": true,
  "status": "active",
  "message": "Assinatura ativa",
  "subscriptionStatus": "active",
  "subscriptionPlan": "manager_base",
  "subscriptionStartDate": "2025-10-10T12:00:00Z",
  "subscriptionEndDate": "2025-11-10T12:00:00Z"
}
```

### 2. Profile Não Existe + Pagamento Confirmado

```json
{
  "isPaid": true,
  "status": "paid_pending_signup",
  "message": "Pagamento confirmado - complete seu cadastro",
  "paymentId": "pay_abc123",
  "paymentStatus": "RECEIVED"
}
```

### 3. Profile Não Existe + Pagamento Pendente

```json
{
  "isPaid": false,
  "status": "pending",
  "message": "Aguardando confirmação do pagamento",
  "payments": [
    {
      "id": "pay_abc123",
      "status": "PENDING",
      "value": 59.90
    }
  ]
}
```

### 4. Erro ao Consultar

```json
{
  "isPaid": false,
  "status": "error",
  "message": "Erro ao verificar assinatura no Asaas"
}
```

## 🔍 Validação de Pagamento

### Status Asaas que Confirmam Pagamento:
- ✅ `RECEIVED` - Pagamento recebido
- ✅ `CONFIRMED` - Pagamento confirmado

### Status Asaas Pendentes:
- ⏳ `PENDING` - Aguardando pagamento
- ⏳ `AWAITING_RISK_ANALYSIS` - Em análise de risco

### Status Asaas Negativos:
- ❌ `OVERDUE` - Vencido
- ❌ `REFUNDED` - Reembolsado
- ❌ `RECEIVED_IN_CASH` - Recebido em dinheiro (não aplicável)

## 🔄 Integração com Polling

O frontend usa o hook `usePaymentPolling` que:

1. Faz polling a cada 3 segundos
2. Verifica este endpoint
3. Para quando `isPaid: true`
4. Redireciona para sign-up

```typescript
// Frontend
const { isPolling, attempts } = usePaymentPolling({
  subscriptionId,
  onPaymentConfirmed: () => {
    // Salvar dados criptografados
    // Redirecionar para /sign-up
  }
});
```

## 🧪 Testes

### Teste Manual

1. **Criar assinatura:**
   ```bash
   POST /api/v1/subscriptions/create
   ```

2. **Verificar status (antes do pagamento):**
   ```bash
   GET /api/v1/subscriptions/sub_xxx/status
   # Deve retornar isPaid: false
   ```

3. **Pagar no Asaas sandbox**

4. **Verificar status (após pagamento):**
   ```bash
   GET /api/v1/subscriptions/sub_xxx/status
   # Deve retornar isPaid: true
   ```

### Logs Esperados

```
🎯 [StatusController] GET /api/v1/subscriptions/[subscriptionId]/status
📋 [SubscriptionStatusUseCase] Verificando status: sub_xxx
🔍 [SubscriptionStatusService] Buscando profile no banco...
⚠️ [SubscriptionStatusService] Profile não encontrado - consultando Asaas
📋 [SubscriptionStatusService] Assinatura encontrada: { id: 'sub_xxx', status: 'ACTIVE' }
💰 [SubscriptionStatusService] Pagamentos encontrados: { total: 1, statuses: ['RECEIVED'] }
✅ [SubscriptionStatusService] Pagamento confirmado encontrado: { id: 'pay_xxx', status: 'RECEIVED' }
✅ [SubscriptionStatusUseCase] Status verificado: { isPaid: true, status: 'paid_pending_signup' }
```

## 🐛 Troubleshooting

### Problema: Retorna `isPaid: false` mesmo após pagamento

**Verificar:**
1. Webhook foi recebido? (verificar logs do webhook)
2. Evento é `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`?
3. Status do pagamento é `RECEIVED` ou `CONFIRMED`?
4. Assinatura ID está correta?

**Solução:**
- Simular webhook manualmente
- Verificar configuração do webhook no Asaas
- Verificar logs do `PaymentValidationService`

### Problema: Erro "Cannot find module"

**Causa:** Imports incorretos ou arquivos não criados

**Solução:**
```bash
# Verificar estrutura de arquivos
ls app/api/services/SubscriptionStatus/
ls app/api/useCases/subscriptions/

# Reiniciar TypeScript server no VSCode
Ctrl+Shift+P > "TypeScript: Restart TS Server"
```

## 📚 Referências

- [Lead Flow Architecture Guide](../../docs/ARCHITECTURE_GUIDE.md)
- [Subscription Flow Documentation](../../docs/SUBSCRIPTION_SIGNUP_FLOW.md)
- [Webhook Setup Guide](../../docs/WEBHOOK_SETUP.md)
- [Asaas API Documentation](../../AsaasDoc/)
