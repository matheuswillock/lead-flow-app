# Fluxo de Notificação por Email para Novos Usuários

## 📋 Visão Geral

Este documento descreve o fluxo completo de convite por email para novos usuários do Lead Flow. O sistema permite que managers convidem novos usuários (operators ou outros managers) através de um email de confirmação, onde o usuário deve completar o cadastro criando sua senha.

## 🔄 Fluxo do Processo

### 1. **Criação do Convite**
- Manager acessa a seção de gestão de usuários
- Preenche nome, email e role do novo usuário
- Sistema cria um registro pendente no banco de dados
- Gera token único de confirmação com expiração de 24h
- Envia email de convite automaticamente

### 2. **Email de Convite**
- Email responsivo com design profissional
- Link de ativação único e temporário
- Informações sobre quem enviou o convite
- Instruções claras para o próximo passo

### 3. **Confirmação da Conta**
- Usuário clica no link do email
- Acessa página de configuração inicial
- Completa dados pessoais e define senha
- Sistema valida token e cria conta no Supabase Auth
- Redireciona automaticamente para login

### 4. **Primeiro Login**
- Usuário pode fazer login normalmente
- Acesso às funcionalidades conforme role definido

## 🛠️ Componentes Implementados

### Schema do Banco (Prisma)
```prisma
model Profile {
  // ... campos existentes
  confirmationToken    String?   @unique @db.Text
  confirmationTokenExp DateTime? @db.Timestamptz(6)
  isConfirmed          Boolean   @default(false)
  // ...
}
```

### API Endpoints

#### `POST /api/v1/manager/[supabaseId]/users`
- **Propósito**: Criar novo usuário com convite por email
- **Autenticação**: Apenas managers
- **Função**: Cria usuário pendente e envia convite

#### `GET /api/v1/auth/confirm?token=...`
- **Propósito**: Validar token de confirmação
- **Função**: Verifica validade do token e retorna dados do usuário

#### `POST /api/v1/auth/confirm`
- **Propósito**: Completar ativação da conta
- **Função**: Confirma conta, cria no Supabase Auth e finaliza cadastro

### Interface de Usuario

#### `/confirm-account`
- Página de confirmação responsiva
- Formulário de completar dados
- Validações de senha
- Feedback visual de status
- Redirecionamento automático

## 📧 Template de Email

### Características
- Design responsivo e profissional
- Informações do convite claramente apresentadas
- CTA (Call-to-Action) destacado
- Informações de expiração
- Fallback para link direto

### Dados incluídos
- Nome do novo usuário
- Nome de quem enviou o convite
- Link de ativação único
- Instruções de uso
- Informações de segurança

## 🔒 Segurança

### Validações Implementadas
- ✅ Token único com UUID + timestamp
- ✅ Expiração automática em 24 horas
- ✅ Verificação de role para criação
- ✅ Validação de email único
- ✅ Senha com critérios mínimos
- ✅ Verificação de usuário já confirmado

### Tratamento de Erros
- Token inválido ou expirado
- Email já existente
- Conta já confirmada
- Falha no envio de email (não bloqueia criação)

## 📱 Experiência do Usuário

### Para o Manager (quem convida)
1. Clica em "Criar Usuário"
2. Preenche formulário simples
3. Recebe confirmação de convite enviado
4. Usuário aparece como "pendente" na lista

### Para o Novo Usuário (quem é convidado)
1. Recebe email de convite
2. Clica no link de ativação
3. Completa dados e define senha
4. É redirecionado para login
5. Pode acessar a plataforma normalmente

## 🚀 Tecnologias Utilizadas

- **Backend**: Next.js API Routes
- **Database**: PostgreSQL com Prisma ORM
- **Auth**: Supabase Auth
- **Email**: Resend API
- **Frontend**: React + TypeScript
- **UI**: Tailwind CSS + Radix UI
- **Validação**: Zod

## 📋 Próximos Passos (Melhorias Futuras)

1. **Re-envio de convites** para tokens expirados
2. **Dashboard de convites pendentes** para managers
3. **Notificações push** complementares
4. **Templates de email personalizáveis**
5. **Auditoria completa** de convites enviados
6. **Integração com calendários** para agendamento de onboarding

## 🧪 Como Testar

### Pré-requisitos
- Banco de dados com migração aplicada
- Resend API Key configurada
- Supabase configurado

### Cenários de Teste
1. Criar novo operator como manager
2. Verificar recebimento do email
3. Clicar no link de confirmação
4. Completar dados e senha
5. Fazer primeiro login
6. Verificar acesso às funcionalidades

---

**Nota**: Lembre-se de executar `bun prisma migrate dev` para aplicar as mudanças no banco de dados antes de testar o fluxo completo.