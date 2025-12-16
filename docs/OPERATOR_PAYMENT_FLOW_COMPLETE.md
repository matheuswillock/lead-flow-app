# ✅ Fluxo de Pagamento para Adicionar Operadores - Implementação Completa

## 📋 Arquivos Criados/Modificados

### ✅ Backend - UseCase e APIs
1. **`app/api/useCases/subscriptions/ISubscriptionUpgradeUseCase.ts`** - Interface (já existia)
2. **`app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts`** - Implementação corrigida
3. **`app/api/v1/operators/add-payment/route.ts`** - Endpoint para criar pagamento (já existia)
4. **`app/api/v1/operators/payment-status/[paymentId]/route.ts`** - **NOVO** - Endpoint para polling
5. **`app/api/v1/operators/confirm-payment/route.ts`** - **NOVO** - Endpoint para confirmação manual
6. **`app/api/webhooks/asaas/route.ts`** - **ATUALIZADO** - Processa pagamentos de operadores automaticamente

### ✅ Frontend - Components
7. **`app/[supabaseId]/manager-users/features/types/index.ts`** - **ATUALIZADO** - Novos tipos
8. **`app/[supabaseId]/manager-users/features/context/useManagerUsers.ts`** - **ATUALIZADO** - Lógica de pagamento
9. **`app/[supabaseId]/manager-users/features/container/PaymentDialog.tsx`** - **NOVO** - Dialog de pagamento
10. **`app/[supabaseId]/manager-users/features/container/columns.tsx`** - **ATUALIZADO** - Coluna de status
11. **`app/[supabaseId]/manager-users/features/container/ManagerUsersContainer.tsx`** - **ATUALIZADO** - Integração
12. **`components/ui/radio-group.tsx`** - **NOVO** - Componente shadcn

### ✅ Banco de Dados
13. **`prisma/schema.prisma`** - Model PendingOperator (já migrado)
14. **Migration**: `20251116185407_add_pending_operator_table`

## 🔄 Fluxo Completo Implementado

### 1. Usuário Clica "Adicionar Operador"
- Abre `UserFormDialog`
- Preenche: Nome, Email, Role

### 2. Ao Submeter o Formulário
- Se role = "operator": 
  - Fecha UserFormDialog
  - Abre PaymentDialog
  - Salva dados em `pendingOperatorData`
- Se role = "manager":
  - Cria direto (sem pagamento)

### 3. PaymentDialog - Seleção de Método
- Mostra detalhes do operador
- Radio buttons: PIX ou Cartão de Crédito
- Preço: R$ 20,00/mês
- Botão "Gerar Pagamento"

### 4. Criar Pagamento (POST /api/v1/operators/add-payment)
```typescript
{
  managerId: string,
  operatorData: { name, email, role },
  paymentMethod: "PIX" | "CREDIT_CARD"
}
```

**Backend:**
- Valida manager
- Verifica email duplicado
- Cria cobrança no Asaas (R$ 20,00)
- Salva `PendingOperator` no banco
- Retorna: paymentId, pixQrCode, pixCopyPaste, dueDate

### 5. Exibir Dados de Pagamento
- **Se PIX:**
  - Mostra QR Code (imagem)
  - Campo "Copia e Cola" com botão de copiar
  - Data de vencimento (7 dias)
- **Se Cartão:**
  - TODO: Formulário de cartão

### 6. Polling de Status (Automático)
- A cada 5 segundos: GET `/api/v1/operators/payment-status/{paymentId}`
- Verifica status no Asaas
- Atualiza `PendingOperator.paymentStatus`
- Se CONFIRMED: Chama `confirmPaymentAndCreateOperator`

### 7. Confirmação do Pagamento (Automática via Webhook OU Polling)

**Via Webhook (Recomendado):**
```
POST /api/webhooks/asaas
```
- Asaas envia evento: PAYMENT_CONFIRMED
- Webhook detecta: `paymentId` de PendingOperator
- Chama: `confirmPaymentAndCreateOperator(paymentId)`

**Via Polling:**
- Frontend detecta status CONFIRMED
- Chama: POST `/api/v1/operators/confirm-payment`

### 8. Criar Operador (`confirmPaymentAndCreateOperator`)
1. Busca `PendingOperator` pelo paymentId
2. Verifica pagamento no Asaas (double-check)
3. **TODO:** Cria usuário no Supabase Auth (mock atual)
4. Cria `Profile` com role operator
5. Atualiza `PendingOperator`: operatorCreated = true
6. Incrementa `Profile.operatorCount` do manager
7. **TODO:** Envia email com credenciais

### 9. Feedback Visual
- Durante pagamento:
  - Badge amarelo: "Aguardando confirmação..."
  - Clock icon animado
- Após confirmação:
  - Badge verde: "Pagamento confirmado!"
  - CheckCircle icon
  - Dialog fecha automaticamente
  - Lista de operadores recarrega
- Se falha:
  - Badge vermelho: "Pagamento falhou"
  - XCircle icon
  - Opção de tentar novamente

### 10. Coluna de Status na Tabela
- **Ativo** (verde): Operador criado e funcionando
- **Aguardando Pagamento** (amarelo): PendingOperator com status PENDING
- **Pagamento Falhou** (vermelho): PendingOperator com status FAILED

## 🎯 Endpoints Criados

### POST /api/v1/operators/add-payment
Cria pagamento para novo operador
- Body: { managerId, operatorData, paymentMethod }
- Response: SubscriptionUpgradeResult

### GET /api/v1/operators/payment-status/[paymentId]
Verifica status do pagamento
- Response: { paymentStatus, operatorCreated, operatorId }

### POST /api/v1/operators/confirm-payment
Confirma pagamento manualmente (backup do webhook)
- Body: { paymentId }
- Response: SubscriptionUpgradeResult

## 📊 Model PendingOperator

```prisma
model PendingOperator {
  id              String   @id @default(uuid())
  managerId       String   @db.Uuid
  name            String   @db.Text
  email           String   @db.Text
  role            String   @db.Text
  paymentId       String   @unique @db.Text
  paymentStatus   String   @db.Text // PENDING, CONFIRMED, FAILED
  paymentMethod   String   @db.Text // PIX, CREDIT_CARD
  operatorCreated Boolean  @default(false)
  operatorId      String?  @db.Uuid
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  manager Profile @relation("PendingOperatorManager", fields: [managerId], references: [id])
  
  @@index([managerId])
  @@index([paymentId])
  @@index([email])
}
```

## 🔧 Componentes Frontend

### PaymentDialog Props
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  operatorData: { name, email, role } | null
  managerId: string
  onPaymentCreated: (paymentData) => void
  onPaymentConfirmed: () => void
}
```

### useManagerUsers - Novos Métodos
```typescript
{
  // Estados
  isPaymentDialogOpen: boolean
  pendingOperatorData: CreateManagerUserFormData | null
  currentPayment: OperatorPaymentData | null
  
  // Ações
  openPaymentDialog: (operatorData) => void
  closePaymentDialog: () => void
  handlePaymentCreated: (paymentData) => void
  handlePaymentConfirmed: () => void
}
```

## 🚀 Como Testar

### 1. Criar Pagamento PIX
```bash
# 1. Acessar página de operadores
http://localhost:3000/{supabaseId}/manager-users

# 2. Clicar "Adicionar Operador"
# 3. Preencher dados
# 4. Selecionar role "Operator"
# 5. Submeter formulário
# 6. Dialog de pagamento abre
# 7. Selecionar PIX
# 8. Clicar "Gerar Pagamento"
# 9. QR Code e código copia-e-cola aparecem
```

### 2. Testar Webhook (via Ngrok)
```bash
# Terminal 1: Rodar app
bun run dev

# Terminal 2: Ngrok
ngrok http 3000

# Configurar webhook no Asaas:
# URL: https://xxx.ngrok.io/api/webhooks/asaas
# Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED
```

### 3. Simular Pagamento no Sandbox
```bash
# No dashboard Asaas Sandbox:
# 1. Ir em Cobranças
# 2. Buscar cobrança criada
# 3. Marcar como PAGA manualmente
# 4. Webhook será disparado
# 5. Operador será criado automaticamente
```

## ⚠️ TODO / Melhorias Futuras

### Prioridade Alta
- [ ] Implementar `createSupabaseUser()` real (Supabase Admin SDK)
- [ ] Enviar email com credenciais para operador
- [ ] Formulário de cartão de crédito
- [ ] Testes unitários para UseCase

### Prioridade Média
- [ ] Retry de pagamento para FAILED
- [ ] Cancelar pagamento pendente
- [ ] Histórico de tentativas de pagamento
- [ ] Notificação push quando pagamento confirmado

### Prioridade Baixa
- [ ] Export de relatório de operadores
- [ ] Filtros na tabela (ativo, pendente, falho)
- [ ] Bulk actions (criar múltiplos operadores)
- [ ] Dashboard de métricas de pagamentos

## 🐛 Troubleshooting

### Pagamento não aparece no polling
- Verificar se `paymentId` está correto
- Checar logs do backend: `console.info('[Webhook Asaas]')`
- Validar se Asaas Sandbox está ativo

### Operador não é criado após pagamento
- Verificar se webhook está configurado
- Checar tabela `PendingOperator` no banco
- Ver logs do `confirmPaymentAndCreateOperator`

### QR Code não aparece
- Validar se `pixQrCode` está vindo da API Asaas
- Checar se método é PIX (não CREDIT_CARD)
- Verificar resposta do endpoint `/add-payment`

## 📚 Referências
- [Asaas API - Cobranças](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Asaas API - Webhooks](https://docs.asaas.com/reference/webhooks)
- [Prisma - Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [Shadcn - Radio Group](https://ui.shadcn.com/docs/components/radio-group)
