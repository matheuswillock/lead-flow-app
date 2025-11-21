# 📧 Fluxo de Onboarding por E-mail para Novos Operadores

## 🎯 Visão Geral

Este documento descreve o fluxo completo de onboarding de novos operadores via e-mail, desde a criação do pagamento até o primeiro acesso à plataforma.

## 🔄 Fluxo Completo

### 1. Manager Adiciona Novo Operador
```
Manager → Formulário "Adicionar Usuário" → Preenche dados do operador → Pagamento Asaas
```

### 2. Webhook Confirma Pagamento
```
Asaas → Webhook /api/webhooks/asaas → Cria usuário no Supabase
```

### 3. Supabase Envia E-mail Automático
```
Supabase Auth → Email de Convite → Operador recebe no email
```

**Conteúdo do E-mail:**
- Assunto: "Você foi convidado para o Corretor Studio"
- Corpo: Template padrão do Supabase com link mágico
- Link: `http://localhost:3000/set-password#access_token=...&type=invite`

### 4. Operador Clica no Link
```
Email → Link com token → Página /set-password
```

### 5. Operador Define Senha
```
Formulário de senha → Validações → Senha cadastrada → Redirecionamento
```

### 6. Redirecionamento Automático
```
/set-password → /{supabaseId}/dashboard (após 2 segundos)
```

---

## 🛠️ Implementação Técnica

### Arquivos Modificados

#### 1. **SubscriptionUpgradeUseCase.ts**
**Método modificado:** `createSupabaseUser()`

**Antes:**
```typescript
await supabase.auth.admin.createUser({
  email,
  password: randomPassword,
  email_confirm: true
})
```

**Depois:**
```typescript
await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  data: { 
    name,
    invited: true,
    first_access: true 
  }
})
```

**Mudança:** Ao invés de criar usuário com senha aleatória, agora envia convite por e-mail.

---

#### 2. **app/set-password/page.tsx** (NOVO)
Página responsável por capturar o token do e-mail e permitir que o usuário defina sua senha.

**Funcionalidades:**
- ✅ Extrai token da URL (hash params)
- ✅ Valida senha (mínimo 8 caracteres, maiúsculas, minúsculas, números)
- ✅ Confirma senha (match)
- ✅ Atualiza senha via `supabase.auth.updateUser()`
- ✅ Busca perfil do usuário
- ✅ Redireciona para dashboard

**Validações de Senha:**
```typescript
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número
```

---

#### 3. **middleware.ts**
**Adicionado:** `/set-password` na lista de rotas públicas

```typescript
const publicRoutes = [
  "/", 
  "/sign-in", 
  "/sign-up", 
  "/subscribe", 
  "/checkout-return", 
  "/operator-confirmed", 
  "/pix-confirmed",
  "/set-password"  // ✅ NOVO
]
```

---

#### 4. **.env**
**Adicionado:** Variável de ambiente para URL da aplicação

```env
# App URL (for email redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Produção:**
```env
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

---

## 📧 Configuração do Supabase

### Template de E-mail (Invite User)

Para personalizar o e-mail, acesse:
```
Supabase Dashboard → Authentication → Email Templates → Invite User
```

**Template Sugerido:**
```html
<h2>Bem-vindo ao Corretor Studio!</h2>

<p>Olá,</p>

<p>Você foi convidado para fazer parte da equipe no <strong>Corretor Studio</strong>, 
a plataforma completa para gestão de leads de planos de saúde.</p>

<p>Para começar a usar a plataforma, clique no botão abaixo e defina sua senha:</p>

<a href="{{ .ConfirmationURL }}" style="padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; display: inline-block;">
  Definir Senha e Acessar
</a>

<p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
<p>{{ .ConfirmationURL }}</p>

<p>Este link expira em 24 horas.</p>

<p>Atenciosamente,<br>
Equipe Corretor Studio</p>
```

### Configuração da URL de Redirect

```
Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
```

**Adicionar:**
```
http://localhost:3000/set-password
https://seu-dominio.com/set-password
```

---

## 🔐 Fluxo de Segurança

### Token de Convite
```
1. Supabase gera token único e seguro
2. Token enviado via e-mail (válido por 24h)
3. Token usado uma única vez
4. Após definir senha, token é invalidado
```

### Validação de Senha
```typescript
const validatePassword = (pwd: string): string | null => {
  if (pwd.length < 8) return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(pwd)) return 'Pelo menos 1 maiúscula'
  if (!/[a-z]/.test(pwd)) return 'Pelo menos 1 minúscula'
  if (!/[0-9]/.test(pwd)) return 'Pelo menos 1 número'
  return null
}
```

### Atualização de Senha
```typescript
const { error } = await supabase.auth.updateUser({
  password: password
})
```

---

## 🧪 Testando o Fluxo

### 1. Criar Novo Operador
```bash
1. Login como Manager
2. Ir para /manager-users
3. Clicar em "Adicionar Usuário"
4. Preencher: Nome, Email, Role (Operator)
5. Concluir pagamento (PIX ou Cartão)
```

### 2. Confirmar Pagamento (Webhook)
```bash
# Sandbox Asaas - Simular pagamento
1. Acessar painel Asaas Sandbox
2. Localizar cobrança
3. Marcar como "Confirmado"
4. Webhook é disparado automaticamente
```

### 3. Verificar E-mail
```bash
1. Abrir inbox do email do operador
2. Verificar e-mail "Você foi convidado para o Corretor Studio"
3. Clicar no link "Definir Senha e Acessar"
```

### 4. Definir Senha
```bash
1. Página /set-password carrega
2. Email aparece no topo
3. Preencher senha (mínimo 8 caracteres)
4. Confirmar senha
5. Clicar em "Definir Senha e Acessar"
```

### 5. Primeiro Acesso
```bash
1. Senha definida com sucesso
2. Mensagem de sucesso exibida
3. Redirecionamento automático para dashboard
4. Usuário autenticado e operacional
```

---

## 🐛 Troubleshooting

### E-mail não chega
**Possíveis causas:**
- ✅ Verificar se email está na caixa de spam
- ✅ Verificar configuração SMTP do Supabase
- ✅ Verificar template de e-mail está ativo
- ✅ Verificar logs do Supabase

**Solução temporária:**
```typescript
// Buscar link de confirmação nos logs do servidor
console.info('🔗 [createSupabaseUser] Confirmation URL:', user.confirmation_url)
```

### Redirect URL não funciona
**Verificar:**
- ✅ URL está na lista de Redirect URLs do Supabase
- ✅ `NEXT_PUBLIC_APP_URL` está definida no .env
- ✅ URL não tem trailing slash

### Senha não aceita
**Validar:**
- ✅ Mínimo 8 caracteres
- ✅ Pelo menos 1 maiúscula (A-Z)
- ✅ Pelo menos 1 minúscula (a-z)
- ✅ Pelo menos 1 número (0-9)

### Token expirado
**Solução:**
- Manager pode reenviar convite
- Ou criar novo operador (sistema detecta email duplicado)

---

## 📊 Logs e Monitoramento

### Logs do Servidor
```typescript
// UseCase logs
🔐 [createSupabaseUser] Iniciando criação de usuário
✅ [createSupabaseUser] Cliente Supabase Admin criado
📧 [createSupabaseUser] Enviando convite para: email@example.com
🔗 [createSupabaseUser] Redirect URL: http://localhost:3000/set-password
✅ [createSupabaseUser] Convite enviado com sucesso
```

### Logs do Cliente
```typescript
// Browser console
Verificando token de convite...
Email extraído: operator@email.com
Definindo senha...
Senha definida com sucesso!
Redirecionando para dashboard...
```

### Supabase Dashboard
```
Authentication → Users → Buscar por email
- Status: "Invited" → "Confirmed" (após definir senha)
- Last Sign In: timestamp do primeiro acesso
```

---

## 🚀 Próximas Melhorias

### Curto Prazo
- [ ] Personalizar template de e-mail com logo da empresa
- [ ] Adicionar força da senha em tempo real (progress bar)
- [ ] Permitir reenvio de convite caso expire

### Médio Prazo
- [ ] Onboarding tutorial no primeiro acesso
- [ ] Tour guiado pela plataforma
- [ ] Vídeo de boas-vindas

### Longo Prazo
- [ ] Múltiplos templates de e-mail por tipo de usuário
- [ ] Personalização de e-mail por manager
- [ ] Analytics de onboarding (taxa de conversão)

---

## 📚 Referências

- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Lead Flow Architecture Guide](./ARCHITECTURE_GUIDE.md)

---

**Última atualização:** 20 de novembro de 2025
**Versão:** 1.0.0
**Responsável:** Implementação Lead Flow Team
