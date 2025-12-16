# 🚀 Fluxo de Onboarding para Novos Clientes

## ✅ Implementação Completa

O fluxo de cadastro e assinatura foi atualizado para garantir que todos os novos usuários passem pelo processo de assinatura antes de acessar a plataforma.

## 📋 Fluxo Implementado

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Landing    │───▶│   Sign-Up    │───▶│  Subscribe  │───▶│   Payment    │───▶│   Sign-In   │
│   Page      │    │  (Cadastro)  │    │  (Planos)   │    │  (Webhook)   │    │   (Login)   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
```

### 1️⃣ Usuário Acessa Landing Page
- URL: `/`
- Botões:
  - **"Começar Agora"** (hero section) → `/sign-up`
  - **"Começar Agora"** (pricing section) → `/sign-up`
- ✅ Se usuário já está logado, vai direto para `/subscribe`

### 2️⃣ Cadastro (Sign-Up)
- URL: `/sign-up`
- Usuário preenche: Nome completo, Email, Telefone, Senha
- ✅ **Após cadastro bem-sucedido, SEMPRE redireciona para `/subscribe`**
- Dados são salvos em `sessionStorage` para prefill na próxima etapa
- Mensagem: "Cadastro concluído! Agora escolha seu plano e finalize sua assinatura."

### 3️⃣ Escolha do Plano (Subscribe)
- URL: `/subscribe`
- ✅ **NOVO**: Rota agora é **pública** (não requer autenticação)
- Usuário escolhe plano e forma de pagamento:
  - PIX (QR Code)
  - Boleto
  - Cartão de Crédito
- Dados do cadastro são recuperados do `sessionStorage` para prefill

### 4️⃣ Pagamento
- **PIX**: QR Code exibido + Polling para confirmação via webhook
- **Boleto**: Link para impressão + Instruções
- **Cartão**: Processamento imediato

### 5️⃣ Confirmação via Webhook
- Asaas envia webhook para `/api/webhooks/asaas`
- Sistema valida e marca assinatura como `ACTIVE`
- ✅ **NOVO**: Frontend detecta confirmação via polling

### 6️⃣ Redirecionamento para Login
- ✅ **NOVO**: Após confirmação de pagamento, usuário é redirecionado para `/sign-in`
- Mensagem: "Pagamento confirmado! Faça login para acessar sua conta."
- Usuário faz login e é redirecionado para `/{supabaseId}/board`

## 🔄 Arquivos Modificados

### 1. `app/(auth)/sign-up/features/signUpContainer.tsx`

**Antes:**
```typescript
// Lógica condicional baseada em parâmetro 'from'
const from = searchParams.get('from');
if (from === 'subscribe') {
  window.location.href = `/subscribe`;
} else {
  window.location.href = `/${result.result.supabaseId}/board`;
}
```

**Depois:**
```typescript
// SEMPRE redireciona para /subscribe
toast.success('Cadastro concluído', {
  description: 'Agora escolha seu plano e finalize sua assinatura.',
  duration: 5000,
});

setTimeout(() => {
  window.location.href = `/subscribe`;
}, 900);
```

### 2. `app/subscribe/features/components/SubscriptionSuccess.tsx`

**Antes:**
```typescript
const handlePaymentConfirmed = async () => {
  const { data: { user } } = await supabase?.auth.getUser();
  if (user?.id) {
    router.push(`/${user.id}/board`); // Ia direto para board
  } else {
    router.push('/sign-in');
  }
};
```

**Depois:**
```typescript
const handlePaymentConfirmed = async () => {
  console.info('✅ Pagamento confirmado - redirecionando para login');
  
  // Limpar dados de sessão
  sessionStorage.removeItem('subscribePrefill');
  
  // SEMPRE redireciona para login
  router.push('/sign-in');
};
```

### 3. `middleware.ts`

**Antes:**
```typescript
const protectedPrefixes = [
  "/dashboard", "/account", "/board", "/pipeline", "/manager-users"
]
// Sem lista de rotas públicas
```

**Depois:**
```typescript
const protectedPrefixes = [
  "/dashboard", "/account", "/board", "/pipeline", "/manager-users"
]

const publicRoutes = [
  "/", "/sign-in", "/sign-up", "/subscribe"
]

// No middleware:
if (publicRoutes.includes(pathname)) {
  return response; // Permite acesso sem autenticação
}
```

## 🎯 Comportamento Esperado

### Cenário 1: Novo Usuário (Fluxo Completo)

1. **Landing** → Clica em "Começar Agora"
2. **Sign-Up** → Preenche cadastro → Envia
3. ✅ Toast: "Cadastro concluído! Agora escolha seu plano..."
4. **Redirect** → `/subscribe` (automático após 900ms)
5. **Subscribe** → Escolhe plano → Preenche dados → Confirma
6. **Payment** → 
   - PIX: QR Code exibido, aguarda pagamento
   - Boleto: Link gerado, aguarda pagamento
   - Cartão: Processamento imediato
7. **Webhook** → Asaas confirma pagamento
8. ✅ Sistema detecta confirmação (polling)
9. **Redirect** → `/sign-in`
10. **Login** → Faz login com credenciais
11. **Board** → Acessa `/{supabaseId}/board`

### Cenário 2: Usuário com Cadastro Incompleto

1. **Criou conta** mas não finalizou assinatura
2. Acessa `/subscribe` diretamente
3. Sistema detecta que já tem perfil criado
4. Preenche dados automaticamente (via sessionStorage ou API)
5. Continua do passo 5 do Cenário 1

### Cenário 3: Usuário com Assinatura Ativa

1. Acessa `/subscribe`
2. Sistema detecta assinatura ativa
3. Exibe mensagem: "Você já possui uma assinatura ativa"
4. Botão "Ir para Dashboard" → Redirect para `/{supabaseId}/board`

## 🔒 Segurança e Validações

### Rota `/subscribe` (Pública)
- ✅ Aceita usuários **logados** e **não logados**
- ✅ Verifica assinatura ativa antes de exibir formulário
- ✅ Impede criação de múltiplas assinaturas

### Middleware
- ✅ Rotas públicas: `/`, `/sign-in`, `/sign-up`, `/subscribe`
- ✅ Rotas protegidas: `/dashboard`, `/board`, `/pipeline`, etc.
- ✅ Webhook routes: Sem autenticação (validação via token)

### Webhook `/api/webhooks/asaas`
- ✅ Validação de token único
- ✅ Verificação de assinatura do payload
- ✅ Atualização de status apenas para pagamentos confirmados

## 📝 Mensagens ao Usuário

### Após Cadastro
```
✅ Cadastro concluído!
Agora escolha seu plano e finalize sua assinatura.
```

### Após Escolher Plano (PIX)
```
✅ Assinatura Criada com Sucesso!
Complete o pagamento via PIX para ativar sua assinatura
[QR Code]
[Copiar código PIX]
```

### Após Confirmação de Pagamento
```
✅ Pagamento Confirmado!
Sua assinatura está ativa. Faça login para começar.
[Botão: Fazer Login]
```

### Na Página de Login
- Usuário faz login normalmente
- Após login, é redirecionado para `/{supabaseId}/board`

## 🧪 Como Testar

### Teste Manual (Sandbox Asaas)

1. **Cadastro:**
   ```bash
   # Acesse
   http://localhost:3000/sign-up
   
   # Preencha:
   - Nome: Teste User
   - Email: teste@example.com
   - Telefone: (11) 99999-9999
   - Senha: Test@123
   ```

2. **Verifique Redirect:**
   - Após cadastro, deve redirecionar para `/subscribe`
   - Toast deve aparecer com mensagem de sucesso

3. **Escolha Plano:**
   ```bash
   # Em /subscribe
   - Escolha: Plano Mensal (R$ 59,90)
   - Forma de pagamento: PIX
   - Dados devem estar preenchidos
   ```

4. **Simule Pagamento (Sandbox):**
   ```bash
   # Via Webhook Manual ou Postman
   POST http://localhost:3000/api/webhooks/asaas
   
   Headers:
   - asaas-access-token: [SEU_TOKEN]
   
   Body:
   {
     "event": "PAYMENT_RECEIVED",
     "payment": {
       "subscription": "[SUBSCRIPTION_ID]",
       "value": 59.90,
       "netValue": 59.90,
       "status": "RECEIVED"
     }
   }
   ```

5. **Verifique Confirmação:**
   - Tela deve detectar pagamento (polling)
   - Redirect automático para `/sign-in`

6. **Login:**
   - Faça login com: `teste@example.com` / `Test@123`
   - Deve redirecionar para `/{supabaseId}/board`

### Teste Automatizado (Futuro)

```typescript
// test/e2e/onboarding-flow.spec.ts
describe('New User Onboarding Flow', () => {
  it('should complete full signup to login flow', async () => {
    // 1. Sign up
    await page.goto('/sign-up');
    await fillSignUpForm();
    await page.click('[type="submit"]');
    
    // 2. Verify redirect to subscribe
    await expect(page).toHaveURL('/subscribe');
    
    // 3. Choose plan and pay
    await selectPlan('monthly');
    await selectPaymentMethod('pix');
    await page.click('[data-testid="confirm-subscription"]');
    
    // 4. Simulate webhook
    await triggerWebhook('PAYMENT_RECEIVED');
    
    // 5. Verify redirect to login
    await expect(page).toHaveURL('/sign-in');
    
    // 6. Login
    await fillLoginForm();
    await page.click('[type="submit"]');
    
    // 7. Verify redirect to board
    await expect(page).toHaveURL(/\/.*\/board/);
  });
});
```

## 🐛 Troubleshooting

### Usuário não é redirecionado para /subscribe após cadastro
- ✅ Verificar console do navegador
- ✅ Verificar se toast aparece
- ✅ Verificar se `window.location.href` está sendo executado

### Rota /subscribe retorna 404 ou redirect
- ✅ Verificar `middleware.ts` → `publicRoutes` inclui `/subscribe`
- ✅ Reiniciar servidor dev: `bun run dev`

### Pagamento não é detectado
- ✅ Verificar webhook no Asaas Dashboard
- ✅ Verificar logs em `/api/webhooks/asaas`
- ✅ Verificar polling em `useWebhookListener.ts`
- ✅ Verificar endpoint `/api/v1/subscriptions/[id]/notify-payment`

### Usuário não é redirecionado para /sign-in após pagamento
- ✅ Verificar `SubscriptionSuccess.tsx` → `handlePaymentConfirmed`
- ✅ Verificar console do navegador
- ✅ Verificar se `router.push('/sign-in')` está sendo executado

## 📚 Documentação Relacionada

- [WEBHOOK_DRIVEN_PAYMENT_FLOW.md](./WEBHOOK_DRIVEN_PAYMENT_FLOW.md) - Fluxo detalhado de pagamento
- [SUBSCRIPTION_SIGNUP_FLOW.md](./SUBSCRIPTION_SIGNUP_FLOW.md) - Fluxo de assinatura
- [NGROK_WEBHOOK_SETUP.md](./NGROK_WEBHOOK_SETUP.md) - Configuração de webhooks locais

## ✅ Checklist de Implementação

- [x] Remover lógica condicional de redirect em `signUpContainer.tsx`
- [x] Sempre redirecionar para `/subscribe` após cadastro
- [x] Atualizar `handlePaymentConfirmed` para redirecionar para `/sign-in`
- [x] Adicionar `/subscribe` às rotas públicas no middleware
- [x] Verificar que polling detecta pagamento confirmado
- [x] Limpar `sessionStorage` após confirmação de pagamento
- [x] Testar fluxo completo: sign-up → subscribe → payment → login → board

---

**Status**: 🟢 **Implementado e Pronto para Teste**
