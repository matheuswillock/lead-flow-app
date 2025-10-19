# 🔍 Guia de Teste - Fluxo de Assinatura com Status ACTIVE

## 🎯 Objetivo
Testar o fluxo completo de assinatura e verificar se o profile é criado com `subscriptionStatus: 'active'`.

## 📋 Pré-requisitos

1. **Servidor rodando**:
   ```bash
   # Terminal 1
   bun dev
   
   # Terminal 2 (opcional, se testar com webhook)
   bun dev:ngrok
   ```

2. **Console do navegador aberto** (F12)
   - Aba "Console" para ver logs
   - Aba "Application > Session Storage" para ver dados salvos

3. **Ambiente Sandbox Asaas configurado**

## 🧪 Passo a Passo do Teste

### 1. Limpar Dados Anteriores

Antes de começar, limpe o sessionStorage:

```javascript
// No console do navegador (F12 > Console)
sessionStorage.clear();
console.log('SessionStorage limpo');
```

### 2. Acessar Página de Assinatura

1. Acesse: `http://localhost:3000/subscribe`
2. **Verifique logs no console**:
   ```
   [SubscriptionFormMultiStep] Componente montado
   ```

### 3. Preencher Formulário

Preencha todos os campos:
- Nome completo
- Email
- CPF/CNPJ
- Telefone
- CEP (com busca automática)
- Endereço completo
- Método de pagamento: **PIX**

### 4. Submeter e Criar Assinatura

1. Clique em "Finalizar Assinatura"
2. **Verifique logs no console**:
   ```
   📤 [CreateSubscriptionService] Enviando dados para API
   ✅ [CreateSubscriptionService] Assinatura criada com sucesso
   subscriptionId: sub_xxxxx
   customerId: cus_xxxxx
   ```

### 5. Ver QR Code PIX

1. Aguarde exibição do QR Code
2. **Copie o código PIX** (Pix Copia e Cola)
3. **Verifique o subscriptionId** no console

### 6. Pagar no Sandbox Asaas

**Opção A: Site Asaas (Recomendado)**
1. Acesse: `https://sandbox.asaas.com`
2. Faça login com suas credenciais de teste
3. Vá em "Cobranças" ou "Assinaturas"
4. Encontre a cobrança PIX
5. Clique em "Simular Pagamento"
6. Confirme o pagamento

**Opção B: API Asaas (Avançado)**
```bash
# Simular pagamento via API
curl -X POST \
  https://sandbox.asaas.com/api/v3/payments/{paymentId}/receiveInCash \
  -H 'access_token: SEU_TOKEN_ASAAS' \
  -H 'Content-Type: application/json' \
  -d '{
    "paymentDate": "2025-10-13",
    "value": 59.90,
    "notifyCustomer": false
  }'
```

### 7. Aguardar Webhook (15-30 segundos)

**O que deve acontecer:**

1. **Webhook recebe notificação** (ver logs do servidor):
   ```
   🎯 [Webhook Asaas] Requisição recebida
   📨 [Webhook Asaas] Evento recebido: PAYMENT_RECEIVED
   ✅ [PaymentValidationService] Pagamento CONFIRMADO!
   💾 [Webhook Asaas] Notificando frontend para subscriptionId
   ```

2. **Frontend detecta pagamento** (ver logs do console do navegador):
   ```
   👂 [useWebhookListener] Escutando confirmação para: sub_xxxxx
   ✅ [useWebhookListener] Pagamento confirmado via webhook!
   🎉 [SubscriptionFormMultiStep] Pagamento confirmado via webhook!
   ```

3. **Dados são salvos** (ver logs do console):
   ```
   💾 [SubscriptionFormMultiStep] Preparando dados para salvar
   🔐 [Crypto] Salvando dados criptografados com chave: pendingSignUp
   📦 [Crypto] Dados a serem salvos:
     - hasSubscriptionId: true
     - subscriptionId: sub_xxxxx
     - customerId: cus_xxxxx
   ✅ [Crypto] Dados salvos com sucesso
   ✅ [SubscriptionFormMultiStep] Dados salvos e verificados
   ```

4. **Toast de confirmação** aparece:
   - "Pagamento confirmado!"
   - "Redirecionando para completar seu cadastro..."

5. **Redirecionamento automático** para `/sign-up?from=subscription`

### 8. Completar Cadastro (Sign-Up)

1. **Página /sign-up carrega**
2. **Verifique logs no console**:
   ```
   🏁 [SignUpFormContainer] Componente renderizado
   🔍 [SignUpFormContainer] searchParams: from=subscription
   🔍 [SignUpFormContainer] Buscando dados criptografados...
   🔓 [Crypto] Recuperando dados criptografados com chave: pendingSignUp
   ✅ [Crypto] Dados encontrados. Tamanho: XXX chars
   ✅ [Crypto] Dados descriptografados com sucesso
   ✅ [SignUpFormContainer] Dados encontrados!
   📦 [SignUpFormContainer] subscriptionId: sub_xxxxx
   📦 [SignUpFormContainer] customerId: cus_xxxxx
   ```

3. **Formulário pre-preenchido**:
   - Nome, email, telefone devem estar preenchidos
   - Campos devem estar **readonly** (não editáveis)

4. **Banner verde** deve aparecer:
   - "✅ Pagamento Confirmado"
   - "Complete seu cadastro para acessar a plataforma"

5. **Preencha apenas a senha** (2x para confirmação)

6. Clique em "Criar Conta"

### 9. Verificar Criação do Profile

**No console do navegador**:
```
🚀 [SignUpFormContainer] onSubmit iniciado
📦 [SignUpFormContainer] pendingData: {...}
✅ [SignUpFormContainer] Incluindo dados da assinatura no registro
🔑 [SignUpFormContainer] subscriptionId: sub_xxxxx
🔑 [SignUpFormContainer] customerId: cus_xxxxx
📤 [SignUpFormContainer] Payload final com assinatura:
  - hasSubscriptionId: true  ✅
  - hasCustomerId: true  ✅
  - subscriptionPlan: manager_base
  - operatorCount: 0
```

**Nos logs do servidor**:
```
📥 [RegisterProfile Route] Body recebido:
  - hasSubscriptionId: true  ✅
  - hasAsaasCustomerId: true  ✅
  - subscriptionStatus: active  ✅
  - subscriptionPlan: manager_base

🎯 [ProfileUseCase] registerUserProfile iniciado
📦 [ProfileUseCase] Input recebido:
  - hasSubscriptionId: true  ✅
  - subscriptionStatus: active  ✅

💾 [ProfileRepository] createProfile iniciado
📝 [ProfileRepository] profileData final:
  - hasSubscriptionId: true  ✅
  - subscriptionId: sub_xxxxx
  - subscriptionStatus: active  ✅
  - asaasCustomerId: cus_xxxxx

✅ [ProfileRepository] Profile criado com sucesso:
  - subscriptionId: sub_xxxxx  ✅
  - subscriptionStatus: active  ✅
  - subscriptionPlan: manager_base  ✅
  - asaasCustomerId: cus_xxxxx  ✅
```

### 10. Verificar no Banco de Dados

```sql
SELECT 
  id,
  email,
  fullName,
  subscriptionId,
  subscriptionStatus,
  subscriptionPlan,
  asaasCustomerId,
  subscriptionStartDate,
  operatorCount,
  createdAt
FROM "Profile"
WHERE email = 'seu-email@example.com';
```

**Valores esperados**:
- `subscriptionId`: `sub_xxxxx` ✅
- `subscriptionStatus`: **`active`** ✅
- `subscriptionPlan`: `manager_base` ✅
- `asaasCustomerId`: `cus_xxxxx` ✅
- `subscriptionStartDate`: data/hora atual ✅
- `operatorCount`: `0` ✅

### 11. Verificar Acesso à Plataforma

1. Após criar conta, deve ser **redirecionado automaticamente** para:
   `/[supabaseId]/board`

2. **Acesso liberado** - NÃO deve ver:
   - ❌ Overlay de assinatura inativa
   - ❌ Mensagem de bloqueio

3. **Deve ter acesso a**:
   - ✅ Dashboard
   - ✅ Board (Kanban)
   - ✅ Pipeline
   - ✅ Gerenciar Usuários

## ❌ Problemas Comuns

### Problema 1: "Dados não encontrados ou inválidos"

**Sintoma**: Toast de aviso no sign-up
```
⚠️ Nenhuma assinatura pendente
Você pode fazer seu cadastro normalmente
```

**Causa**: Dados não foram salvos ou expiraram

**Solução**:
1. Verificar se webhook foi recebido (logs do servidor)
2. Verificar se `useWebhookListener` está ativo (logs do console)
3. Verificar sessionStorage no navegador:
   ```javascript
   // No console
   console.log(sessionStorage.getItem('pendingSignUp'));
   ```

### Problema 2: Profile criado SEM dados de assinatura

**Sintoma**: Logs mostram `subscriptionId: null`

**Causa**: Dados não foram incluídos no payload do sign-up

**Solução**:
1. Verificar logs do `SignUpFormContainer.onSubmit`
2. Verificar se `pendingData` está populado:
   ```
   📦 [SignUpFormContainer] pendingData: {...}
   ```
3. Se `pendingData` for `null`, voltar ao Problema 1

### Problema 3: Webhook não é recebido

**Sintoma**: Polling continua indefinidamente

**Causa**: Ngrok não está rodando ou URL não está configurada

**Solução**:
1. Verificar se Ngrok está rodando:
   ```bash
   bun dev:ngrok
   ```
2. Verificar URL no painel Asaas:
   - Configurações > Webhooks
   - URL deve ser: `https://seu-dominio.ngrok-free.dev/api/webhooks/asaas`
3. Testar webhook manualmente no painel Asaas

### Problema 4: subscriptionStatus está NULL no banco

**Sintoma**: Query SQL retorna `subscriptionStatus: null`

**Causa**: Valor não está sendo salvo corretamente

**Solução**:
1. Verificar logs do `ProfileRepository`:
   ```
   📝 [ProfileRepository] profileData final:
     - subscriptionStatus: active  ✅ DEVE APARECER
   ```
2. Se aparecer `undefined`, verificar payload do sign-up
3. Verificar se tipo do enum está correto no Prisma

## ✅ Checklist Final

Após o teste completo, verificar:

- [ ] Webhook foi recebido pelo servidor
- [ ] Frontend detectou confirmação do pagamento
- [ ] Dados foram salvos criptografados
- [ ] Toast de confirmação apareceu
- [ ] Redirecionamento para /sign-up ocorreu
- [ ] Formulário foi pre-preenchido
- [ ] Banner verde de confirmação apareceu
- [ ] Logs mostraram `hasSubscriptionId: true`
- [ ] Profile foi criado com todos os campos
- [ ] `subscriptionStatus` está como `'active'` no banco
- [ ] Usuário tem acesso completo à plataforma
- [ ] SubscriptionGuard NÃO bloqueia o acesso

## 📊 Dados de Teste Sugeridos

```json
{
  "fullName": "João Silva Teste",
  "email": "teste.joao@example.com",
  "cpfCnpj": "123.456.789-00",
  "phone": "(11) 98765-4321",
  "postalCode": "01310-100",
  "address": "Av. Paulista",
  "addressNumber": "1000",
  "city": "São Paulo",
  "state": "SP",
  "billingType": "PIX"
}
```

## 🐛 Debug Avançado

### Ver todos os dados do sessionStorage

```javascript
// No console do navegador
Object.keys(sessionStorage).forEach(key => {
  console.log(`${key}:`, sessionStorage.getItem(key));
});
```

### Descriptografar manualmente

```javascript
// Copiar função do crypto.ts no console
function decryptData(encryptedData) {
  const key = 'lead-flow-default-key-2025';
  const encrypted = atob(encryptedData);
  let decrypted = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decrypted += String.fromCharCode(charCode);
  }
  return JSON.parse(decrypted);
}

// Usar
const encrypted = sessionStorage.getItem('pendingSignUp');
const data = decryptData(encrypted);
console.log('Dados descriptografados:', data);
```

### Forçar salvamento manual

```javascript
// Se precisar salvar dados manualmente para teste
const testData = {
  fullName: "Teste Manual",
  email: "teste@example.com",
  phone: "11999999999",
  cpfCnpj: "12345678900",
  subscriptionId: "sub_test123",
  customerId: "cus_test123",
  subscriptionConfirmed: true,
  timestamp: new Date().toISOString()
};

// Salvar
function encryptData(data) {
  const jsonString = JSON.stringify(data);
  const key = 'lead-flow-default-key-2025';
  let encrypted = '';
  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  return btoa(encrypted);
}

sessionStorage.setItem('pendingSignUp', encryptData(testData));
console.log('Dados salvos manualmente');
```

---

**Próximos Passos**: Se todos os testes passarem, fazer commit e documentar o fluxo funcionando!
