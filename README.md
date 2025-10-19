# 🚀 Lead Flow

> Sistema de gestão de leads inteligente para corretores de planos de saúde

[![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16.1-2D3748)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3FCF8E)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC)](https://tailwindcss.com/)

## 📋 Sobre o Projeto

O **Lead Flow** é uma plataforma moderna e elegante desenvolvida para otimizar o fluxo de trabalho de corretores de planos de saúde. Combina funcionalidades de CRM com uma interface intuitiva em formato Kanban, permitindo o gerenciamento eficiente de leads desde a captação até o fechamento.

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
- **Next.js 15.5.2** - Framework React com App Router
- **TypeScript** - Tipagem estática 
- **Tailwind CSS 4** - Estilização utilitária
- **Radix UI** - Componentes acessíveis
- **Framer Motion** - Animações fluidas
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas

### Backend & Database
- **Supabase** - Backend as a Service
- **PostgreSQL** - Banco de dados relacional
- **Prisma ORM** - Type-safe database client
- **Next.js API Routes** - Endpoints serverless

### DevOps & Tools
- **Vercel** - Deploy e hosting
- **GitHub Actions** - CI/CD automatizado
- **ESLint & Prettier** - Code quality
- **Bun** - Runtime e package manager

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
```bash
cp .env.example .env
```

Configure as seguintes variáveis no `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Email (Resend)
RESEND_API_KEY=your_resend_key

# Pagamentos (Asaas)
ASAAS_API_KEY=your_asaas_key
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=your_webhook_secret_token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

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

O **Ngrok** é necessário para testar webhooks do Asaas localmente, pois cria um túnel seguro que expõe seu `localhost` para a internet.

#### Para que serve?
- ✅ Permite que o Asaas envie webhooks de pagamento para sua máquina local
- ✅ Útil para testar fluxo completo de pagamento PIX
- ✅ Evita necessidade de deploy apenas para testes

#### Instalação e Configuração

1. **Instale o Ngrok**
```bash
npm install -g ngrok
```

2. **Crie uma conta gratuita**
   - Acesse: [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
   - Faça login e copie seu authtoken

3. **Configure o Authtoken**
```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

4. **Inicie o Ngrok** (em um terminal separado)
```bash
ngrok http 3000
```

Você verá uma saída como:
```
Session Status                online
Account                       seu-email@gmail.com (Plan: Free)
Region                        South America (sa)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

**🎯 URLs Geradas:**
- 🌐 **URL Pública**: `https://abc123xyz.ngrok-free.app` (use no webhook do Asaas)
- 🔍 **Dashboard**: `http://127.0.0.1:4040` (monitore requisições em tempo real)

5. **Configure o Webhook no Asaas**
   - Acesse: [https://sandbox.asaas.com](https://sandbox.asaas.com) (ou produção)
   - Vá em **Menu do usuário** > **Integrações** > **Webhooks**
   - Clique em **Criar Webhook**
   - **URL**: `https://sua-url.ngrok-free.app/api/webhooks/asaas`
   - **Eventos**: Selecione `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`
   - **Token**: Use o mesmo valor da variável `ASAAS_WEBHOOK_TOKEN` do seu `.env`

6. **Monitore as requisições**
   - Abra [http://127.0.0.1:4040](http://127.0.0.1:4040) para ver o dashboard do Ngrok
   - Você verá todas as requisições HTTP em tempo real

#### ⚠️ Importante
- A URL do Ngrok muda toda vez que você reinicia (plano gratuito)
- Sempre atualize a URL no painel do Asaas quando reiniciar o Ngrok
- Use apenas em desenvolvimento - nunca em produção!

Para mais detalhes, consulte: [`docs/WEBHOOK_SETUP.md`](./docs/WEBHOOK_SETUP.md)

## 📁 Estrutura do Projeto

```
├── app/                    # App Router (Next.js 13+)
│   ├── (auth)/            # Rotas de autenticação
│   ├── (protected)/       # Rotas protegidas
│   │   ├── dashboard/     # Dashboard principal
│   │   ├── board/         # Kanban board
│   │   ├── pipeline/      # Pipeline analytics
│   │   └── account/       # Configurações da conta
│   ├── api/               # API Routes
│   └── context/           # React Contexts
├── components/            # Componentes reutilizáveis
│   ├── ui/               # Componentes base (shadcn/ui)
│   ├── forms/            # Formulários
│   ├── kanban/           # Componentes do Kanban
│   └── landing/          # Landing page
├── lib/                  # Utilitários e configurações
├── prisma/              # Schema e migrações do banco
├── hooks/               # React Hooks customizados
└── public/              # Assets estáticos
```

## 🎯 Funcionalidades

### 🔐 Autenticação e Autorização
- Login/Registro seguro via Supabase
- Controle de acesso baseado em roles
- Gestão de perfis e preferências

### 📊 Dashboard Inteligente  
- Métricas de conversão em tempo real
- Gráficos interativos de performance
- Visão geral dos leads por status

### 🎨 Kanban Board
- Drag & drop para mover leads entre estágios
- Filtros avançados (período, responsável, busca)
- Cards detalhados com informações relevantes
- Adição rápida de novos leads

### 👥 Gestão de Equipe
- Hierarquia Manager/Operator
- Atribuição de leads por responsável
- Histórico de atividades por usuário

### 📈 Pipeline Analytics
- Funil de vendas visual
- Tempo médio por estágio
- Taxa de conversão detalhada
- Exportação de relatórios

### 💳 Pagamentos e Assinaturas
- Integração completa com Asaas
- Checkout PIX, Boleto e Cartão
- Validação automática via Webhooks
- Gestão de assinaturas mensais

## 🔗 Webhooks

O sistema utiliza webhooks do Asaas para processar pagamentos automaticamente:

- **Endpoint**: `/api/webhooks/asaas`
- **Eventos monitorados**: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
- **Segurança**: Validação via token (`ASAAS_WEBHOOK_TOKEN`)

Quando um pagamento PIX é confirmado:
1. Webhook atualiza automaticamente o status da assinatura
2. Usuário é redirecionado para completar cadastro
3. Dados da assinatura são pré-preenchidos
4. Acesso à plataforma é liberado instantaneamente

**Documentação completa**: [`docs/WEBHOOK_SETUP.md`](./docs/WEBHOOK_SETUP.md)

## 🧪 Scripts Disponíveis

```bash
# Desenvolvimento
bun run dev                 # Servidor de desenvolvimento
bun run build              # Build de produção
bun run start              # Servidor de produção

# Qualidade de código
bun run typecheck          # Verificação de tipos
bun run lint               # Linting
bun run format             # Formatação

# Database
bun run prisma:studio      # Interface visual do banco
bun run prisma:migrate     # Aplicar migrações
bun run prisma:generate    # Gerar cliente
bun run prisma:seed        # Popular banco com dados de teste
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

### Customização de Temas
O projeto usa Tailwind CSS com variáveis CSS customizadas. Edite `app/globals.css` para personalizar cores e estilos.

### Adicionando Novos Status
1. Atualize o enum `LeadStatus` em `prisma/schema.prisma`
2. Execute `bun run prisma:migrate`
3. Atualize as constantes em `app/[supabaseId]/board/page.tsx`

### Integrações Externas
- **Email**: Configurado com Resend para notificações
- **Pagamentos**: Integração com Asaas para faturamento
- **Analytics**: Vercel Analytics habilitado

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

# Erro: version '3' invalid
# Solução: Delete o arquivo de configuração corrompido
rm ~/AppData/Local/ngrok/ngrok.yml  # Windows
rm ~/.ngrok2/ngrok.yml              # Linux/Mac
```

### Webhook não recebe eventos
1. Verifique se o Ngrok está rodando
2. Confirme que a URL no Asaas está correta
3. Verifique se o token no Asaas é o mesmo do `.env`
4. Monitore o dashboard do Ngrok: `http://127.0.0.1:4040`

### Erro ao criar assinatura
1. Verifique se `ASAAS_API_KEY` está configurada
2. Confirme que está usando a URL correta (sandbox/produção)
3. Verifique logs do servidor: terminal onde está `bun run dev`

### Database connection failed
1. Verifique se as URLs do Supabase estão corretas
2. Confirme que o projeto Supabase está ativo
3. Execute as migrações: `bun run prisma:migrate`

---

<div align="center">
  <p>Feito com ❤️ por <a href="https://github.com/matheuswillock">Matheus Willock</a></p>
</div>
