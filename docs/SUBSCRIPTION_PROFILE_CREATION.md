# 📋 Fluxo de Assinatura e Criação de Profile

## 🎯 Objetivo
Garantir que quando um usuário assina a plataforma e completa o pagamento, seu profile seja criado com todas as informações da assinatura, incluindo `subscriptionStatus: 'active'`.

## 🔄 Fluxo Completo

### 1. **Página de Assinatura** (`/subscribe`)
- Usuário preenche formulário com dados pessoais e endereço
- Dados incluem: `fullName`, `email`, `phone`, `cpfCnpj`, `postalCode`, `address`, etc.
- Ao submeter, o sistema:
  1. Cria cliente no Asaas (`asaasCustomerId`)
  2. Cria assinatura no Asaas (`subscriptionId`)
  3. Armazena dados criptografados no `sessionStorage`
  4. Redireciona para página de confirmação PIX

### 2. **Webhook Asaas** (`/api/webhooks/asaas`)
- Asaas envia webhook quando pagamento é confirmado
- Evento: `PAYMENT_CONFIRMED`
- O webhook:
  1. Valida o pagamento
  2. Chama endpoint `/api/v1/subscriptions/{subscriptionId}/notify-payment`
  3. Salva confirmação em cache em memória

### 3. **Página de Sign-Up** (`/sign-up?from=subscription`)
- Usuário é redirecionado após pagamento
- Container recupera dados criptografados do `sessionStorage`
- Pre-preenche formulário com dados salvos
- Mostra banner de "Pagamento Confirmado"

### 4. **Criação do Profile**
Quando usuário submete o formulário de sign-up:

#### 4.1 Frontend (`signUpContainer.tsx`)
```typescript
// Adiciona dados da assinatura ao payload
(data as any).asaasCustomerId = pendingData.customerId;
(data as any).subscriptionId = pendingData.subscriptionId;
(data as any).subscriptionStatus = 'active'; // ✅ STATUS ACTIVE
(data as any).subscriptionPlan = 'manager_base';
(data as any).operatorCount = 0;
(data as any).subscriptionStartDate = new Date();
```

#### 4.2 API Route (`/api/v1/profiles/register`)
- Valida dados recebidos
- Chama `ProfileUseCase.registerUserProfile()`

#### 4.3 Use Case (`ProfileUseCase.ts`)
- Valida se usuário já existe
- Chama `ProfileRepository.createProfile()`

#### 4.4 Repository (`ProfileRepository.ts`)
- Cria usuário no Supabase Auth
- Cria registro no banco de dados Prisma
- Salva TODOS os campos, incluindo:
  - ✅ `subscriptionId`
  - ✅ `subscriptionStatus: 'active'`
  - ✅ `subscriptionPlan: 'manager_base'`
  - ✅ `subscriptionStartDate: Date`
  - ✅ `asaasCustomerId`
  - ✅ `operatorCount: 0`

## 📊 Valores Esperados no Banco

Após a criação do profile, o registro deve conter:

```prisma
Profile {
  id: "uuid"
  supabaseId: "uuid"
  fullName: "Nome do Usuário"
  email: "email@example.com"
  phone: "11999999999"
  cpfCnpj: "12345678900"
  role: "manager"
  
  // Assinatura - CAMPOS CRÍTICOS
  asaasCustomerId: "cus_xxxxx"
  subscriptionId: "sub_xxxxx"
  subscriptionStatus: "active"          // ✅ ACTIVE após pagamento
  subscriptionPlan: "manager_base"
  subscriptionStartDate: 2025-10-13T...
  operatorCount: 0
  
  // Endereço
  postalCode: "12345-678"
  address: "Rua Exemplo"
  addressNumber: "123"
  city: "São Paulo"
  state: "SP"
}
```

## 🔍 Verificação

### Como verificar se está funcionando:

1. **Logs no Console** (`F12 > Console`):
```
✅ [SignUpFormContainer] Incluindo dados da assinatura no registro
📤 [SignUpFormContainer] Payload final com assinatura
📥 [RegisterProfile Route] Body recebido
📝 [ProfileRepository] profileData final
✅ [ProfileRepository] Profile criado com sucesso
```

2. **Verificar no Banco de Dados**:
```sql
SELECT 
  id, 
  email, 
  subscriptionId, 
  subscriptionStatus, 
  subscriptionPlan,
  asaasCustomerId,
  subscriptionStartDate
FROM "Profile"
WHERE email = 'teste@example.com';
```

Deve retornar:
- `subscriptionStatus`: **'active'**
- `subscriptionId`: presente
- `asaasCustomerId`: presente
- `subscriptionStartDate`: data atual

## 🎯 Status da Assinatura

O enum `SubscriptionStatus` no Prisma:

```prisma
enum SubscriptionStatus {
  trial      // Período de teste (7-30 dias)
  active     // ✅ Ativa e paga (APÓS CONFIRMAÇÃO DO PAGAMENTO)
  past_due   // Pagamento atrasado
  suspended  // Suspensa por falta de pagamento
  canceled   // Cancelada pelo usuário
}
```

### Quando usar cada status:

- **`trial`**: Quando usuário está em período de teste gratuito (não implementado ainda)
- **`active`**: ✅ **APÓS WEBHOOK CONFIRMAR PAGAMENTO** (nosso caso)
- **`past_due`**: Quando pagamento recorrente falha mas ainda há grace period
- **`suspended`**: Quando acesso é bloqueado por falta de pagamento
- **`canceled`**: Quando usuário cancela a assinatura

## 🔒 Segurança

- Dados sensíveis armazenados criptografados no `sessionStorage`
- Dados expiram após 30 minutos
- Webhook valida token do Asaas
- Confirmação de pagamento em cache temporário

## ✅ Checklist de Implementação

- [x] Dados da assinatura incluídos no payload do sign-up
- [x] `subscriptionStatus` definido como `'active'`
- [x] `subscriptionStartDate` definido com data atual
- [x] `asaasCustomerId` e `subscriptionId` salvos
- [x] `subscriptionPlan` definido como `'manager_base'`
- [x] `operatorCount` iniciado em `0`
- [x] Logs adicionados para rastreamento
- [x] Repository aceita todos os parâmetros
- [x] Validação de dados no UseCase

## 📝 Notas Importantes

1. **Valor do Enum**: O valor `'active'` (minúsculo) é o correto conforme definido no schema Prisma
2. **Tipo de Dados**: `subscriptionStatus` é do tipo `SubscriptionStatus` (enum), não string pura
3. **Data de Início**: `subscriptionStartDate` deve ser `Date` (objeto JavaScript), não string
4. **Fallback**: Código mantém compatibilidade com método antigo de URL params

## 🚀 Próximos Passos

1. Testar fluxo completo end-to-end
2. Verificar logs em todas as camadas
3. Confirmar dados no banco após criação
4. Validar que SubscriptionGuard funciona corretamente
5. Testar renovação/atualização de assinatura
