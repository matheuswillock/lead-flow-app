# 🚀 Guia Rápido de Início

Este é um guia passo a passo para colocar o Lead Flow funcionando em sua máquina local em menos de 10 minutos.

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- [x] **Node.js** (versão 20 ou superior) - [Download](https://nodejs.org/)
- [x] **Bun** (recomendado) - [Instalação](https://bun.sh/)
- [x] **Git** - [Download](https://git-scm.com/)
- [x] Conta no **Supabase** (gratuita) - [Criar conta](https://supabase.com/)
- [x] Conta no **Asaas Sandbox** (gratuita) - [Criar conta](https://sandbox.asaas.com/)

## 📦 Instalação Rápida

### 1. Clone o Repositório

```bash
git clone https://github.com/matheuswillock/lead-flow-app.git
cd lead-flow-app
```

### 2. Instale as Dependências

```bash
bun install
```

### 3. Configure o Supabase

1. Crie um novo projeto no [Supabase Dashboard](https://app.supabase.com/)
2. Vá em **Settings** > **API**
3. Copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Vá em **Settings** > **Database**
5. Copie a connection string:
   - **Transaction pooler** → `DATABASE_URL`
   - **Session pooler** → `DIRECT_URL`

### 4. Configure o Asaas

1. Faça login em [Sandbox Asaas](https://sandbox.asaas.com/)
2. Vá em **Configurações** > **Integrações** > **API**
3. Copie sua API Key → `ASAAS_API_KEY`
4. Gere um token para webhook:
   ```bash
   openssl rand -hex 32
   ```
   Use o resultado em `ASAAS_WEBHOOK_TOKEN`

### 5. Configure as Variáveis de Ambiente

Copie o arquivo de exemplo e edite:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais copiadas nos passos anteriores.

### 6. Configure o Banco de Dados

```bash
# Gerar cliente Prisma
bun run prisma:generate

# Executar migrações
bun run prisma:migrate

# (Opcional) Popular com dados de teste
bun run prisma:seed
```

### 7. Inicie a Aplicação

**Terminal 1 - Next.js:**
```bash
bun run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 🌐 Setup do Ngrok (Para Webhooks)

O Ngrok é necessário apenas se você quiser testar pagamentos PIX localmente.

**Terminal 2 - Ngrok:**

1. **Instale:**
   ```bash
   npm install -g ngrok
   ```

2. **Configure:**
   ```bash
   # Crie conta em: https://dashboard.ngrok.com/signup
   # Copie seu authtoken e execute:
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```

3. **Inicie:**
   ```bash
   ngrok http 3000
   ```

4. **Copie a URL gerada** (ex: `https://abc123.ngrok-free.app`)

5. **Configure no Asaas:**
   - Vá em **Integrações** > **Webhooks** > **Criar Webhook**
   - URL: `https://sua-url.ngrok-free.app/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
   - Token: O mesmo do `.env` (`ASAAS_WEBHOOK_TOKEN`)

6. **Monitore:** Abra [http://127.0.0.1:4040](http://127.0.0.1:4040)

## 🎯 Primeiros Passos na Aplicação

### 1. Criar Conta

1. Acesse [http://localhost:3000/sign-up](http://localhost:3000/sign-up)
2. Preencha seus dados
3. Crie uma conta de Manager

### 2. Criar seu Primeiro Lead

1. Vá para o Board
2. Clique em **+ Novo Lead**
3. Preencha as informações
4. Arraste entre as colunas do Kanban

### 3. Testar Pagamento PIX (Com Ngrok)

1. Acesse [http://localhost:3000/subscribe](http://localhost:3000/subscribe)
2. Preencha o formulário de assinatura
3. Escolha **PIX** como forma de pagamento
4. Use o QR Code de teste do Asaas Sandbox
5. Clique em **Validar Pagamento**
6. Será redirecionado para completar cadastro

## 📚 Comandos Úteis

```bash
# Desenvolvimento
bun run dev              # Servidor de desenvolvimento
bun run build            # Build de produção
bun run start            # Iniciar produção

# Database
bun run prisma:studio    # Interface visual do banco
bun run prisma:migrate   # Aplicar migrações
bun run prisma:generate  # Gerar cliente

# Qualidade
bun run typecheck        # Verificar tipos
bun run lint             # Verificar código
```

## 🐛 Problemas Comuns

### ❌ Erro: "authentication failed" (Ngrok)
**Solução:** Configure o authtoken do ngrok
```bash
ngrok config add-authtoken SEU_TOKEN
```

### ❌ Erro: Database connection failed
**Solução:** Verifique se as URLs do Supabase estão corretas no `.env`

### ❌ Webhook não recebe eventos
**Solução:** 
1. Confirme que o ngrok está rodando
2. Verifique se a URL no Asaas está correta
3. Confirme que o token é o mesmo no Asaas e no `.env`

### ❌ Erro ao criar assinatura
**Solução:**
1. Verifique se `ASAAS_API_KEY` está configurada
2. Use a URL do sandbox: `https://sandbox.asaas.com/api/v3`

## 🎓 Próximos Passos

1. ✅ Explore o Dashboard
2. ✅ Adicione operadores à sua equipe
3. ✅ Configure o pipeline de vendas
4. ✅ Teste o fluxo completo de pagamento
5. ✅ Personalize temas e preferências

## 📖 Documentação Adicional

- **Webhooks**: [`docs/WEBHOOK_SETUP.md`](./WEBHOOK_SETUP.md)
- **Arquitetura**: [`docs/ARCHITECTURE_GUIDE.md`](./ARCHITECTURE_GUIDE.md)
- **Pagamentos**: [`docs/SUBSCRIPTION_PAYMENT_GUIDE.md`](./SUBSCRIPTION_PAYMENT_GUIDE.md)

## 💬 Suporte

Problemas ou dúvidas? Abra uma [Issue no GitHub](https://github.com/matheuswillock/lead-flow-app/issues)

---

**Tempo estimado de setup:** 5-10 minutos ⏱️

Feito com ❤️ por [Matheus Willock](https://github.com/matheuswillock)
