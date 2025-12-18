# 🚀 Corretor Studio

> Sistema de gestão de leads inteligente para corretores de planos de saúde

[![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.1-2D3748)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3FCF8E)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Bun-1.2.16-000000)](https://bun.sh/)

## 📋 Sobre o Projeto

O **Corretor Studio** é uma plataforma moderna e elegante desenvolvida para otimizar o fluxo de trabalho de corretores de planos de saúde. Combina funcionalidades de CRM com uma interface intuitiva em formato Kanban, permitindo o gerenciamento eficiente de leads desde a captação até o fechamento.

### ✨ Características Principais

- **🎯 Gestão Visual**: Interface Kanban intuitiva para acompanhar o progresso dos leads
- **👥 Multi-usuário**: Sistema de roles (Manager/Operator) com permissões diferenciadas  
- **📊 Analytics**: Dashboard com métricas e insights de performance
- **🔄 Workflow Automatizado**: Pipeline customizável para diferentes estágios de vendas
- **📱 Responsive**: Design adaptativo para desktop, tablet e mobile
- **🌙 Tema Dinâmico**: Suporte a modo claro/escuro
- **🔐 Autenticação Segura**: Integração com Supabase Auth

## 🛠️ Stack Tecnológica

### Frontend
- **Next.js 15.5.9** - Framework React com App Router
- **React 19.1.0** - Biblioteca UI
- **TypeScript 5** - Tipagem estática 
- **Tailwind CSS 4** - Estilização utilitária
- **Radix UI** - Componentes acessíveis
- **Shadcn/ui** - Biblioteca de componentes
- **Framer Motion** - Animações fluidas
- **React Hook Form** - Gerenciamento de formulários
- **Zod 4** - Validação de schemas
- **Recharts** - Gráficos e visualizações

### Backend & Database
- **Supabase** - Backend as a Service (Auth + Storage)
- **PostgreSQL** - Banco de dados relacional
- **Prisma ORM 6.19.1** - Type-safe database client
- **Next.js API Routes** - Endpoints serverless
- **Asaas** - Gateway de pagamento (PIX, Boleto, Cartão)
- **Resend** - Serviço de email transacional

### DevOps & Tools
- **Vercel** - Deploy e hosting
- **GitHub Actions** - CI/CD automatizado
- **ESLint & Prettier** - Code quality
- **Bun 1.2.16** - Runtime e package manager
- **Ngrok** - Túneis para webhooks em desenvolvimento

## 🚀 Getting Started

> 📖 **Guia de Início Rápido**: Veja o [`docs/QUICK_START.md`](./docs/QUICK_START.md) para um passo a passo detalhado (5-10 minutos)

### Pré-requisitos

- **Node.js** >= 20
- **Bun** (recomendado) ou npm/yarn
- **PostgreSQL** ou conta Supabase

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/matheuswillock/lead-flow-app.git
cd lead-flow-app
```

2. **Instale as dependências**
```bash
bun install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database PostgreSQL
POSTGRES_USER=postgres.your-project
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=aws-1-sa-east-1.pooler.supabase.com
POSTGRES_PORT=5432
POSTGRES_DB=postgres
DATABASE_URL=postgresql://postgres.your-project:${POSTGRES_PASSWORD}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.your-project:${POSTGRES_PASSWORD}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

# Resend (Email)
RESEND_API_KEY=re_your_resend_api_key_here

# Asaas (Pagamento)
ASAAS_API_KEY=aact_hmlg_your_sandbox_key_here  # ou aact_prod_ para produção
ASAAS_URL=https://sandbox.asaas.com             # ou https://www.asaas.com para produção
ASAAS_ENV=sandbox                               # ou production
ASAAS_WEBHOOK_TOKEN=your_webhook_secret_token_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000       # ou sua URL de produção
NEXT_API_BASE_URL=/api/v1
NEXT_PUBLIC_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
```

**📝 Como obter as credenciais:**
- **Supabase**: [Criar projeto](https://supabase.com/dashboard) → Settings → API
- **Resend**: [Criar conta](https://resend.com/api-keys) → API Keys
- **Asaas**: [Criar conta](https://sandbox.asaas.com) → Configurações → Integrações → API Key
- **Encryption Key**: Execute `openssl rand -hex 32`

**📖 Para mais detalhes sobre configuração do Asaas**: [`docs/ASAAS_CONFIGURATION.md`](./docs/ASAAS_CONFIGURATION.md)

4. **Configure o banco de dados**
```bash
# Gerar cliente Prisma
bun run prisma:generate

# Executar migrações
bun run prisma:migrate

# Seed inicial (opcional)
bun run prisma:seed
```

5. **Inicie o servidor de desenvolvimento**
```bash
bun run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação.

### 🌐 Configuração do Ngrok (Para Webhooks em Desenvolvimento)

O **Ngrok** é necessário para testar webhooks do Asaas localmente.

#### Instalação

No Windows com Chocolatey:
```bash
choco install ngrok
```

Ou baixe diretamente: [https://ngrok.com/download](https://ngrok.com/download)

#### Configuração

1. **Crie uma conta** em [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)

2. **Configure o authtoken**:
```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

3. **Inicie o Ngrok** (terminal separado):
```bash
bun run ngrok
# ou manualmente: ngrok http --domain=your-domain.ngrok-free.dev 3000
```

4. **Configure o Webhook no Asaas**:
   - Acesse [https://sandbox.asaas.com](https://sandbox.asaas.com)
   - **Configurações** → **Integrações** → **Webhooks** → **Criar Webhook**
   - **URL**: `https://your-domain.ngrok-free.dev/api/webhooks/asaas`
   - **Token**: O mesmo valor de `ASAAS_WEBHOOK_TOKEN` do `.env`
   - **Eventos**: Marque todos, principalmente `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`

5. **Monitore**: Acesse [http://127.0.0.1:4040](http://127.0.0.1:4040) para ver requisições em tempo real

⚠️ **Importante**: 
- A URL do Ngrok (plano gratuito) muda a cada reinício
- Sempre atualize a URL no painel do Asaas quando necessário
- Para atualizar o ngrok execute `ngrok update` como Administrador no PowerShell

**📖 Documentação completa**: [`docs/NGROK_WEBHOOK_SETUP.md`](./docs/NGROK_WEBHOOK_SETUP.md)

## 📁 Estrutura do Projeto

```
├── app/                    # App Router (Next.js 15+)
│   ├── (auth)/            # Rotas de autenticação (sign-in, sign-up)
│   ├── [supabaseId]/      # Rotas protegidas dinâmicas
│   │   ├── dashboard/     # Dashboard com métricas
│   │   ├── board/         # Kanban board de leads
│   │   ├── pipeline/      # Funil de vendas
│   │   ├── manager-users/ # Gestão de operadores
│   │   ├── account/       # Configurações da conta
│   │   └── subscription/  # Gerenciar assinatura
│   ├── api/               # API Routes
│   │   ├── useCases/      # Camada de lógica de negócio
│   │   ├── services/      # Camada de domínio
│   │   ├── infra/         # Infraestrutura (DB, repositories)
│   │   ├── v1/            # Endpoints REST versionados
│   │   └── webhooks/      # Webhooks externos (Asaas)
│   ├── subscribe/         # Fluxo de assinatura pública
│   └── context/           # React Contexts globais
├── components/            # Componentes reutilizáveis
│   ├── ui/               # Componentes base (shadcn/ui)
│   ├── forms/            # Formulários específicos
│   ├── kanban/           # Componentes do Kanban
│   └── landing/          # Landing page components
├── lib/                  # Utilitários e configurações
│   ├── supabase/         # Cliente Supabase (server/browser)
│   ├── services/         # Services (Email, etc)
│   ├── output/           # Padrão de resposta Output
│   └── validations/      # Schemas de validação
├── prisma/              # Schema, migrations e seed
│   ├── schema.prisma    # Modelo de dados
│   ├── migrations/      # Histórico de migrações
│   └── seed.ts          # Dados iniciais
├── hooks/               # React Hooks customizados
├── types/               # TypeScript types globais
├── docs/                # Documentação técnica
└── public/              # Assets estáticos
```

## 🎯 Funcionalidades

### 🔐 Autenticação e Autorização
- Login/Registro seguro via Supabase Auth
- Controle de acesso baseado em roles (Manager/Operator)
- Gestão de perfis com upload de foto
- Sistema de convite para novos operadores

### 📊 Dashboard Inteligente  
- Métricas de conversão em tempo real
- Gráficos interativos de performance (Recharts)
- Visão geral dos leads por status
- Análise de NoShow e agendamentos
- Comparativos de período

### 🎨 Kanban Board
- Drag & drop para mover leads entre estágios
- Filtros avançados (período, responsável, busca)
- Cards detalhados com informações do lead
- Adição e edição rápida de leads
- Upload de anexos e documentos
- Sistema de agendamentos

### 👥 Gestão de Equipe
- Hierarquia Manager/Operator
- Atribuição de leads por responsável
- Sistema de pagamento para adicionar operadores
- Envio de convites via email personalizado
- Histórico de atividades por usuário

### 📈 Pipeline Analytics
- Funil de vendas visual
- Tempo médio por estágio
- Taxa de conversão detalhada
- Métricas de agendamentos e NoShow

### 💳 Pagamentos e Assinaturas
- Integração completa com Asaas
- Checkout PIX, Boleto e Cartão de Crédito
- Validação automática via Webhooks
- Gestão de assinaturas mensais
- Assinatura permanente para contas especiais
- Reativação de assinaturas canceladas

## 🔗 Webhooks

O sistema utiliza webhooks do Asaas para processar pagamentos automaticamente:

- **Endpoint**: `/api/webhooks/asaas`
- **Eventos monitorados**: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_CREATED`
- **Segurança**: Validação via token no header (`asaas-access-token`)

**Fluxo de Webhook:**
1. Asaas envia webhook quando pagamento é confirmado
2. Sistema valida o token de autenticação
3. Atualiza status da assinatura/pagamento no banco
4. Ativa acesso do usuário automaticamente
5. Envia email de confirmação via Resend

**Documentação completa**:
- [`docs/WEBHOOK_SETUP.md`](./docs/WEBHOOK_SETUP.md)
- [`docs/ASAAS_CONFIGURATION.md`](./docs/ASAAS_CONFIGURATION.md)
- [`docs/WEBHOOK_DRIVEN_PAYMENT_FLOW.md`](./docs/WEBHOOK_DRIVEN_PAYMENT_FLOW.md)

## 🧪 Scripts Disponíveis

```bash
# Desenvolvimento
bun run dev                 # Servidor de desenvolvimento (localhost:3000)
bun run ngrok               # Inicia ngrok com domínio configurado
bun run build               # Build de produção
bun run start               # Servidor de produção

# Qualidade de código
bun run typecheck           # Verificação de tipos TypeScript
bun run lint                # ESLint - Verificar problemas
bun run eslint:fix          # ESLint - Corrigir automaticamente
bun run format              # Prettier - Formatar código

# Database
bun run prisma:studio       # Interface visual do banco (localhost:5555)
bun run prisma:migrate      # Aplicar migrações pendentes
bun run prisma:generate     # Gerar Prisma Client
bun run prisma:seed         # Popular banco com dados de teste
bun run prisma:db:push      # Push schema sem criar migration
bun run prisma:db:pull      # Pull schema do banco existente
```

## 🚀 Deploy

### Vercel (Recomendado)

1. **Conecte seu repositório** na Vercel
2. **Configure as variáveis de ambiente** no dashboard
3. **Deploy automático** a cada push na branch main

### Manual

```bash
# Build de produção
bun run build

# Iniciar servidor
bun run start
```

## 🔧 Configuração Avançada

### Arquitetura da API

O projeto segue **Clean Architecture** com separação clara de responsabilidades:

```
Route (HTTP) → UseCase (Business Logic) → Service (Domain) → Prisma (Data)
```

- **Routes** (`app/api/v1/`): HTTP handling, parsing, status codes
- **UseCases** (`app/api/useCases/`): Validações, orquestração, retorna `Output`
- **Services** (`app/api/services/`): Lógica complexa de domínio
- **Repositories** (`app/api/infra/data/repositories/`): Acesso a dados

**📖 Documentação completa**: [`docs/ARCHITECTURE_GUIDE.md`](./docs/ARCHITECTURE_GUIDE.md)

### Customização de Temas

O projeto usa Tailwind CSS 4 com variáveis CSS customizadas:
- Edite `app/globals.css` para personalizar cores
- Suporte a modo claro/escuro via `next-themes`
- Componentes Shadcn/ui totalmente personalizáveis

### Adicionando Novos Status de Leads

1. Atualize o enum `LeadStatus` em [`prisma/schema.prisma`](prisma/schema.prisma)
2. Execute `bun run prisma:migrate`
3. Atualize constantes em [`app/[supabaseId]/board/features/context/BoardTypes.ts`](app/[supabaseId]/board/features/context/BoardTypes.ts)

### Integrações Externas

- **Email**: Resend para emails transacionais (convites, confirmações)
- **Pagamentos**: Asaas para faturamento e assinaturas
- **Storage**: Supabase Storage para upload de arquivos
- **Analytics**: Vercel Analytics habilitado
- **Auth**: Supabase Auth com JWT

## 🧑‍💻 Autor

**Matheus Willock**
- **GitHub**: [@matheuswillock](https://github.com/matheuswillock)
- **LinkedIn**: [matheuswillock](https://www.linkedin.com/in/matheuswillock/)
- **Email**: matheuswillock@gmail.com

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte, entre em contato através do GitHub Issues ou LinkedIn.

## 🐛 Troubleshooting

### Ngrok não conecta
```bash
# Erro: authentication failed
# Solução: Configure o authtoken
ngrok config add-authtoken SEU_TOKEN

# Erro: version too old
# Solução: Atualizar ngrok (PowerShell como Admin)
ngrok update

# Erro: Access denied ao atualizar
# Solução: Abra PowerShell como Administrador
```

### Webhook não recebe eventos
1. Verifique se o Ngrok está rodando (`bun run ngrok`)
2. Confirme que a URL no Asaas está correta
3. Verifique se o token no Asaas é o mesmo do `.env`
4. Monitore o dashboard do Ngrok: `http://127.0.0.1:4040`
5. Verifique logs do servidor no terminal

### Erro ao criar assinatura
1. Verifique se `ASAAS_API_KEY` está configurada
2. Confirme que está usando a URL correta (sandbox/produção)
3. Verifique se o ambiente (`ASAAS_ENV`) está correto
4. Verifique logs do servidor: terminal onde rodou `bun run dev`
5. Teste a API Key no Postman com a collection fornecida

### Database connection failed
```bash
# Erro: Can't reach database server
# Soluções:
1. Verifique se as URLs do Supabase estão corretas no .env
2. Confirme que o projeto Supabase está ativo
3. Execute: bun run prisma:generate
4. Execute: bun run prisma:migrate
5. Teste conexão direta: psql $DATABASE_URL

# Erro: SSL connection error
# Solução: Adicione ?sslmode=require na DATABASE_URL
```

### Prisma generate falha
```bash
# Erro: Could not convert engine type
# Solução: Remover runtime do schema.prisma
generator client {
  provider = "prisma-client-js"
  # remover: runtime  = "bun"
}

# Reinstalar dependências
bun install
bun run prisma:generate
```

### Build falha com erros ESLint
```bash
# Console.log errors
# Solução: Substituir console.log por console.info/warn/error

# Imports não utilizados
# Solução automática: bun run eslint:fix
```

### Supabase não conecta
```bash
# Erro: ENOTFOUND ncpzzfeiumvhvsapebxy.supabase.co
# Soluções:
1. Verificar conexão com internet
2. Limpar cache DNS: ipconfig /flushdns (Windows)
3. Testar DNS: ping ncpzzfeiumvhvsapebxy.supabase.co
4. Usar DNS público (8.8.8.8 / 8.8.4.4)
5. Verificar firewall/antivírus
```

### Email não envia
```bash
# Verificar configuração Resend
1. Confirme RESEND_API_KEY no .env
2. Verifique domínio verificado no Resend
3. Cheque logs: lib/services/EmailService.ts
4. Teste API Key no dashboard Resend
```

---

<div align="center">
  <p>Feito com ❤️ por <a href="https://github.com/matheuswillock">Matheus Willock</a></p>
</div>
