# 📱 Meta Lead Ads - Configuração e Setup

> Guia completo para configurar integração com Facebook/Instagram Lead Ads

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura Implementada](#arquitetura-implementada)
3. [Configuração no Meta](#configuração-no-meta)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Testando a Integração](#testando-a-integração)
6. [Fluxo Completo](#fluxo-completo)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

A integração com Meta Lead Ads permite que leads capturados através de formulários no Facebook/Instagram sejam **automaticamente criados** no Lead Flow App.

### ✨ Funcionalidades

- ✅ **Webhook em tempo real** - Leads criados instantaneamente ao submeter formulário
- ✅ **Validação de segurança** - HMAC SHA256 para verificar autenticidade
- ✅ **Detecção de duplicados** - Evita criar leads com mesmo email/telefone
- ✅ **Mapeamento automático** - Campos do Meta → campos do Lead Flow
- ✅ **Status inicial** - Leads criados na coluna "new_opportunity"
- ✅ **Histórico completo** - Atividade registrada com dados do anúncio/formulário

---

## 🏗️ Arquitetura Implementada

### Arquivos Criados

```
app/api/
├── services/
│   └── MetaLeadService.ts          # Serviço para Graph API e validação
├── useCases/
│   └── metaLeads/
│       ├── IMetaLeadUseCase.ts     # Interface
│       └── MetaLeadUseCase.ts      # Implementação
└── webhooks/
    └── meta/
        └── route.ts                 # Endpoint do webhook (GET + POST)
```

### Fluxo de Dados

```
┌─────────────┐
│  Meta Ads   │
│ (Facebook/  │
│ Instagram)  │
└──────┬──────┘
       │ Webhook POST
       ↓
┌─────────────────────────────────────────────┐
│  POST /api/webhooks/meta                    │
│  1. Valida assinatura HMAC SHA256           │
│  2. Extrai leadgen_id do payload            │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│  MetaLeadUseCase.processWebhook()           │
│  1. Chama Graph API para buscar dados       │
│  2. Verifica duplicados (email/phone)       │
│  3. Cria lead no banco                      │
│  4. Status: new_opportunity                 │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│  Lead criado automaticamente!               │
│  • Visível no Kanban                        │
│  • Atribuído ao manager                     │
│  • Com histórico de origem (Meta)           │
└─────────────────────────────────────────────┘
```

---

## 🔧 Configuração no Meta

### 1️⃣ Criar App no Meta for Developers

1. Acesse: [developers.facebook.com](https://developers.facebook.com)
2. Clique em **"Meus Apps"** → **"Criar App"**
3. Escolha tipo: **"Negócios"**
4. Preencha:
   - Nome do app: `Lead Flow - [Sua Empresa]`
   - Email de contato
   - Finalidade: **Captura de Leads**

### 1️⃣.1 Colocar App ao Vivo (CRUCIAL!) 🔴

⚠️ **IMPORTANTE**: Por padrão, o app é criado em **modo desenvolvimento**. Para que webhooks e formulários funcionem, você precisa **colocar o app ao vivo**.

#### **Passo a Passo para Tornar o App Ativo:**

1. No painel do seu app **"teste-leads"**, procure no topo da página o **toggle de modo**

2. Você verá algo como:
   ```
   🔴 Modo do aplicativo: desenvolvimento
   ```

3. Clique no **toggle** ou botão para **"Tornar aplicativo ativo"** / **"Mudar para ao vivo"**

4. **Se aparecer requisitos pendentes:**

   O Meta pode exigir que você complete alguns passos antes:

   **a) Adicionar Política de Privacidade:**
   - Vá em **Configurações** → **Básico**
   - Role até **"URL da Política de Privacidade"**
   - Adicione uma URL (pode ser do seu site ou criar uma simples)
   - Exemplo de URL: `https://seu-site.com/privacy` ou use geradores online

   **b) Adicionar Ícone do App:**
   - Vá em **Configurações** → **Básico**
   - Role até **"Ícone do app"**
   - Faça upload de uma imagem 1024x1024px (PNG)
   - Pode ser o logo da sua empresa

   **c) Selecionar Categoria do App:**
   - Vá em **Configurações** → **Básico**
   - Role até **"Categoria"**
   - Selecione: **"Business and Pages"** ou **"Marketing"**

   **d) Adicionar Termos de Serviço (opcional):**
   - Vá em **Configurações** → **Básico**
   - **"URL dos Termos de Serviço"**
   - Adicione se tiver (não obrigatório para todos os casos)

5. Após completar os requisitos, clique novamente em **"Tornar aplicativo ativo"**

6. **Confirme a mudança**

7. Você verá:
   ```
   ✅ Modo do aplicativo: ao vivo
   ```

#### **Verificar se o App Está Ao Vivo:**

1. No painel do app, no topo deve aparecer:
   - ✅ **"Ao vivo"** (em verde)
   - ❌ ~~"Desenvolvimento"~~ (em cinza/vermelho)

2. Se ainda não conseguir, verifique **"Análise do app"** no menu lateral:
   - Pode haver pendências bloqueando
   - Resolva os itens listados

#### **Modo Desenvolvimento vs Ao Vivo:**

| Característica | Desenvolvimento | Ao Vivo |
|----------------|----------------|---------|
| **Webhooks** | ⚠️ Podem não funcionar | ✅ Funcionam |
| **Formulários Lead Ads** | ⚠️ Limitados | ✅ Totalmente funcionais |
| **Páginas conectadas** | ⚠️ Só admins testam | ✅ Todos os usuários |
| **Acesso à API** | ⚠️ Limitado | ✅ Completo |
| **Permissões** | ⚠️ Só desenvolvedores | ✅ Produção |

#### **Dica Rápida - URL de Política de Privacidade:**

Se você não tem uma página de privacidade, use um gerador:
- [freeprivacypolicy.com](https://www.freeprivacypolicy.com/)
- [privacypolicygenerator.info](https://www.privacypolicygenerator.info/)
- Ou crie uma página simples no Notion/Google Docs e torne pública

**Exemplo de Política de Privacidade Mínima:**

```markdown
# Política de Privacidade - [Sua Empresa]

## Coleta de Dados
Coletamos informações fornecidas por você através de formulários.

## Uso dos Dados
Utilizamos seus dados apenas para contato comercial.

## Compartilhamento
Não compartilhamos seus dados com terceiros.

## Contato
Para dúvidas: seu-email@empresa.com
```

Salve como HTML e hospede em qualquer lugar (seu site, GitHub Pages, Netlify, etc.)

---

### 2️⃣ Configurar Produtos

Adicione o produto **"Webhooks"**:

1. No painel do app → **Adicionar Produto**
2. Selecione **"Webhooks"** → **"Configurar"**

### 3️⃣ Adicionar Página do Facebook

⚠️ **IMPORTANTE**: Você precisa ser **administrador** da página do Facebook para conectar ao app!

#### **Cenário 1: Página é Sua (Você é Admin)**

1. **Configurações** → **Básico**
2. Role até **"Plataformas"**
3. Adicione sua **Página do Facebook** (deve ser verificada)

#### **Cenário 2: Página Pertence a Terceiro/Cliente 🔴**

Se a página **"Segundo Frame Store"** pertence a um cliente e **VOCÊ NÃO É ADMINISTRADOR**:

**Você tem 2 opções:**

**Opção A: Solicitar Permissões ao Dono da Página (RECOMENDADO)**

1. **Peça ao dono da página** para adicionar você como **Administrador**:
   - Página do Facebook → **Configurações**
   - **Funções da Página** → **Adicionar pessoa**
   - Email do seu perfil Facebook
   - Função: **Administrador** ✅

2. Após ser adicionado, você poderá:
   - Conectar o app à página
   - Configurar webhooks
   - Gerenciar formulários Lead Ads

**Opção B: Cliente Conecta o App (Cliente faz a configuração)**

Se o cliente não quer te dar acesso admin, **ELE precisa fazer** a configuração:

1. **Cliente** acessa [developers.facebook.com](https://developers.facebook.com)

2. **Cliente** vai em **Business Manager** → **Configurações de Negócios**

3. **Cliente** vai em **Integrações** → **Lead Access** → **CRMs**

4. **Cliente** clica em **"Assign CRM"**

5. **Cliente** procura pelo ID do seu app: **882595547825468**

6. **Cliente** seleciona **"teste-leads"** e atribui à página dele

7. **Cliente** atribui os formulários que ele quer enviar leads para você

**Você precisará fornecer ao cliente:**
- App ID: **882595547825468**
- App Name: **teste-leads**
- Explicação: "Esse app receberá leads via webhook para nosso CRM"

**Opção C: Usar Página de Teste Própria (Para Desenvolvimento)**

Para testar a integração **SEM DEPENDER DO CLIENTE**:

1. Crie uma **página do Facebook própria** para testes:
   - No Facebook, clique em **"Páginas"** → **"Criar nova página"**
   - Nome: "Teste Lead Flow [Seu Nome]"
   - Categoria: Negócios locais ou Marketing

2. Conecte **ESSA página** ao seu app (você será admin automático)

3. Crie formulários de teste nessa página

4. Teste toda a integração

5. Quando tudo funcionar, **repasse instruções ao cliente** (Opção B)

#### **Como Verificar se Você é Admin de uma Página:**

1. Vá para a página no Facebook

2. Clique em **"Configurações da Página"**

3. Vá em **"Funções da Página"**

4. Procure seu nome na lista

5. Se aparecer: ✅ **Você é Admin**

6. Se NÃO aparecer: ❌ Você **NÃO** tem permissões

### 3️⃣.1 Conectar Página ao App (CRUCIAL!) 🔴

⚠️ **PROBLEMA COMUM**: App não aparece como CRM disponível na página

**Isso acontece porque a página precisa estar explicitamente conectada ao app!**

#### **Solução - Conectar Página ao App:**

**Método 1: Via Configurações do App (RECOMENDADO)**

1. No painel do seu app **"teste-leads"** (Meta for Developers)

2. Vá em **"Configurações do app"** → **"Básico"**

3. Role até encontrar **"Domínios do aplicativo"** (se necessário)

4. Agora vá em **"Funções do app"** ou **"App Roles"** no menu lateral

5. Procure por **"Páginas"** ou **"Pages"**

6. Clique em **"Adicionar páginas"** ou **"Add Pages"**

7. Selecione: **"Segundo Frame Store"** (ou o nome da sua página)

8. Dê permissão para o app acessar a página

**Método 2: Via Business Manager (ALTERNATIVA)**

1. Vá para **Business Manager** → **Configurações de Negócios**
   - URL: [business.facebook.com/settings](https://business.facebook.com/settings)

2. No menu lateral: **Contas** → **Páginas**

3. Selecione sua página: **"Segundo Frame Store"**

4. Clique em **"Atribuir parceiros"** ou **"Assign Partners"**

5. Clique em **"Adicionar ativos"** → **"Apps"**

6. Procure por: **"teste-leads"** ou o ID: **882595547825468**

7. Selecione o app e atribua as permissões:
   - ✅ **Gerenciar anúncios** (Manage Ads)
   - ✅ **Gerenciar leads** (Manage Leads)
   - ✅ **Acessar informações** (Access Page Info)

8. Clique em **"Salvar alterações"**

**Método 3: Via Graph API Explorer (AVANÇADO)**

1. Vá para [Graph API Explorer](https://developers.facebook.com/tools/explorer/)

2. Selecione seu app: **"teste-leads"**

3. Adicione permissões:
   - `pages_manage_ads`
   - `leads_retrieval`
   - `pages_read_engagement`

4. Clique em **"Generate Access Token"**

5. Aceite as permissões

6. Execute este comando:
   ```bash
   GET /me/accounts
   ```

7. Copie o `id` da página **"Segundo Frame Store"**

8. Agora execute:
   ```bash
   POST /{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen&access_token={YOUR_TOKEN}
   ```

**Verificar se a Página Está Conectada:**

1. No painel do app → **"Funções do app"** → **"Páginas"**

2. Deve aparecer: **"Segundo Frame Store"** na lista ✅

3. OU vá em **Business Manager** → **Integrações** → **Lead Access**

4. Procure por **"teste-leads"** (ID: 882595547825468)

5. Deve mostrar que está conectado à página ✅

#### **Adicionar Permissões de Lead Ads ao App:**

Além de conectar a página, o app precisa das permissões corretas:

1. No painel do app → **"App Review"** (Análise do app)

2. Clique em **"Permissions and Features"**

3. Procure por:
   - **`leads_retrieval`** - CRUCIAL para Lead Ads!
   - **`pages_manage_ads`**
   - **`pages_read_engagement`**

4. Se aparecer botão **"Request"** ou **"Solicitar"**:
   - Clique nele
   - Preencha o formulário explicando que vai usar para capturar leads
   - **NOTA**: Para apps em desenvolvimento/teste, algumas permissões são concedidas automaticamente

5. Se aparecer **"Standard Access"** ou acesso padrão, já está aprovado! ✅

#### **Após Conectar a Página:**

Agora sim o app vai aparecer na busca de CRM!

1. Vá para **Business Manager** → **Integrações** → **Lead Access** → **CRMs**

2. Clique em **"Assign CRM"** ou **"Atribuir CRM"**

3. Procure por: **"teste-leads"** ou **882595547825468**

4. Agora o app **DEVE aparecer** na lista! ✅

5. Selecione o app e atribua ao formulário

**Troubleshooting - App Ainda Não Aparece:**

Se mesmo após conectar a página o app não aparecer:

1. **Aguarde 5-10 minutos** - Cache do Meta pode demorar a atualizar

2. **Limpe cache do navegador**:
   - Ctrl + Shift + Delete
   - Limpar cookies do Facebook

3. **Verifique novamente se o app está "Ao vivo"**:
   - No topo deve mostrar: ✅ **"Ao vivo"** (não "desenvolvimento")

4. **Confirme que Webhooks está configurado**:
   - App → Webhooks → Campo **`leadgen`** subscrito ✅

5. **Use o ID direto** na busca:
   - Ao invés de "teste-leads", procure por: **882595547825468**

6. **Tente via API** (método 3 acima):
   - Force a subscrição via Graph API Explorer

---

### 4️⃣ Configurar Webhook

#### URL do Webhook

**Produção:**
```
https://seu-dominio.com/api/webhooks/meta
```

**Desenvolvimento (com ngrok):**
```bash
# 1. Inicie ngrok
ngrok http 3000

# 2. Use a URL gerada
https://abc123.ngrok-free.app/api/webhooks/meta
```

#### Configuração

1. No painel de **Webhooks** → **"Editar Assinatura"**
2. Preencha:

| Campo | Valor |
|-------|-------|
| **URL de Retorno de Chamada** | `https://seu-dominio.com/api/webhooks/meta` |
| **Verificar Token** | `meta_lead_webhook_verify_token` (defina o mesmo no `.env`) |

3. Clique em **"Verificar e Salvar"**

   ✅ Se aparecer "Webhook verificado", está correto!

4. **Subscribe to Fields:**
   - Marque: ✅ **`leadgen`**
   - Clique em **"Salvar"**

### 5️⃣ Obter Credenciais

#### App Secret

1. **Configurações** → **Básico**
2. Clique em **"Mostrar"** ao lado de **"Chave Secreta do App"**
3. Copie o valor

#### Access Token (Page Access Token)

1. **Ferramentas** → **Graph API Explorer**
2. Selecione sua **Página**
3. Adicione permissões:
   - `pages_manage_ads`
   - `leads_retrieval`
4. Clique em **"Gerar Token"**
5. Copie o **Page Access Token**

⚠️ **IMPORTANTE:** Este token expira! Para produção, você deve gerar um **Long-Lived Token**:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_LIVED_TOKEN}"
```

### 6️⃣ Conectar Formulário ao Webhook

#### **Opção 1: Conectar via Configurações do Formulário (RECOMENDADO)**

1. Vá para **Ferramentas** → **Formulários Instantâneos** (ou acesse diretamente: [business.facebook.com/forms](https://business.facebook.com/forms))

2. **Encontre seu formulário** na lista

3. Clique em **"Editar"** (ícone de lápis ao lado do formulário)

4. **Role até a seção "Privacidade e conformidade"** ou **"Opções"** (geralmente no final)

5. Procure a opção **"Conectar ao CRM"** ou **"Enviar leads para CRM"**

6. **Ative o toggle** ☑️ **"Conectar ao CRM"**

7. Se aparecer uma lista de integrações:
   - Procure pelo nome do seu app: **"teste-leads"** (ou o nome que você deu)
   - Selecione o app
   - Clique em **"Conectar"**

8. Clique em **"Salvar"** ou **"Publicar"**

#### **Opção 2: Conectar via Configuração do App (ALTERNATIVA)**

1. No painel do seu app **"teste-leads"** (Meta for Developers)

2. Vá para **"Webhooks"** no menu lateral

3. Clique em **"Editar Assinatura"** na seção **Page**

4. Verifique se está inscrito no campo **`leadgen`**:
   - Se não estiver, marque: ☑️ **`leadgen`**
   - Clique em **"Salvar"**

5. Agora vá para **Facebook Business Manager** → **Configurações de Negócios**

6. No menu lateral: **Integrações** → **Lead Access**

7. Clique em **"CRMs"**

8. Clique em **"Adicionar CRM"**

9. Selecione seu app: **"teste-leads"**

10. Selecione sua **Página do Facebook**

11. **Atribua formulários**:
    - Selecione o formulário que você criou
    - Clique em **"Atribuir"**

12. Salve as alterações

#### **Opção 3: Via Gerenciador de Anúncios (Durante criação do anúncio)**

1. Ao criar/editar um anúncio de **"Geração de Leads"**

2. Na seção **"Formulário Instantâneo"**, selecione seu formulário

3. Clique em **"Opções"** ou **"Configurações Avançadas"** do formulário

4. Procure por **"Integração de CRM"** ou **"Conectar ao CRM"**

5. Ative a opção e selecione **"teste-leads"**

6. Salve as alterações

### ✅ Como Verificar se o Formulário Está Conectado

#### **1. Via Interface do Meta**

1. **Ferramentas** → **Formulários Instantâneos**
2. Encontre seu formulário
3. Deve aparecer um ícone ou badge indicando **"Conectado ao CRM"** ou **"Integration Active"**

#### **2. Via Graph API**

```bash
# Verificar configuração do formulário
curl "https://graph.facebook.com/v21.0/SEU_FORM_ID?fields=leadgen_tos_accepted,is_optimized_for_quality,locale,page,crm_integration&access_token=SEU_ACCESS_TOKEN"
```

**Resposta esperada:**
```json
{
  "id": "seu_form_id",
  "leadgen_tos_accepted": true,
  "page": {
    "id": "sua_page_id",
    "name": "Sua Página"
  },
  "crm_integration": {
    "app_id": "882595547825468",  ← Deve aparecer o ID do seu app!
    "app_name": "teste-leads"
  }
}
```

Se `crm_integration` estiver presente, o formulário está conectado! ✅

#### **3. Teste Prático**

1. Preencha e envie o formulário (via preview mobile)
2. Verifique os logs do seu servidor:

```bash
# Deve aparecer:
📨 Webhook Meta recebido: { signature: 'presente', bodyLength: 456 }
🔐 Validando assinatura HMAC SHA256...
✅ Assinatura válida!
```

Se o webhook foi chamado, o formulário está conectado! ✅

### 🚨 Problema Comum: "Não Vejo Opção Conectar ao CRM"

Se a opção **"Conectar ao CRM"** não aparecer:

**Causa 1: Webhook não configurado**
- ✅ Solução: Configure o webhook primeiro (seção 4️⃣ deste guia)
- O Meta só mostra a opção CRM se detectar um webhook ativo

**Causa 2: Formulário muito antigo**
- ✅ Solução: Crie um novo formulário (duplique o existente)
- Formulários criados antes de 2020 podem não ter essa opção

**Causa 3: Permissões insuficientes**
- ✅ Solução: Você precisa ser **Admin** da página do Facebook
- Verifique: **Configurações da Página** → **Funções da Página**

**Causa 4: App não tem permissões Lead Ads**
- ✅ Solução: No app Meta, vá em **App Review** → **Permissions and Features**
- Verifique se **`leads_retrieval`** está aprovado/ativo

### 📝 Passo a Passo Completo (Resumo)

1. ✅ Webhook configurado e verificado (seção 4️⃣)
2. ✅ Variáveis de ambiente no `.env` (seção 🔐)
3. ✅ Servidor Next.js rodando (`bun run dev`)
4. ✅ ngrok ativo (`ngrok http 3000`)
5. ✅ Formulário criado no Meta
6. ✅ **Formulário conectado ao app via "Conectar ao CRM"** ← CRUCIAL!
7. ✅ Anúncio publicado (mesmo com orçamento mínimo)
8. ✅ Testar via preview mobile
9. ✅ Verificar logs do servidor
10. ✅ Confirmar lead no Kanban

---

## 🔐 Variáveis de Ambiente

Adicione no arquivo `.env`:

```env
# Meta Lead Ads
META_APP_SECRET=sua_app_secret_aqui
META_ACCESS_TOKEN=sua_page_access_token_aqui
META_VERIFY_TOKEN=meta_lead_webhook_verify_token
```

### Descrição

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `META_APP_SECRET` | Chave secreta do app | Meta App → Configurações → Básico |
| `META_ACCESS_TOKEN` | Page Access Token (long-lived) | Graph API Explorer + troca por long-lived |
| `META_VERIFY_TOKEN` | Token customizado para verificação | Você define (use algo seguro) |

---

## 🧪 Testando a Integração

### 0. Testar o Formulário de Lead Ads ⭐

#### **Passo 1: Criar um Anúncio de Teste**

1. Vá para **Gerenciador de Anúncios** → [adsmanager.facebook.com](https://adsmanager.facebook.com)
2. Clique em **"Criar"**
3. Escolha objetivo: **"Geração de Leads"**
4. Configure a campanha:
   - Nome: `Teste Formulário Lead Flow`
   - Orçamento: R$ 1,00 (mínimo)
   - Continue até a criação do anúncio

5. Na seção **"Formulário Instantâneo"**:
   - Selecione o formulário que você criou
   - Continue

6. **IMPORTANTE - Configurar CRM**:
   - Na configuração do formulário, vá em **"Opções"** ou **"Configurações Avançadas"**
   - Ative: ☑️ **"Enviar leads para CRM"**
   - Se não aparecer essa opção, vá direto no formulário:
     - **Ferramentas** → **Formulários Instantâneos**
     - Clique no seu formulário → **"Editar"**
     - Role até **"Privacidade e conformidade"**
     - Ative: ☑️ **"Conectar ao CRM"**

7. Publique o anúncio (mesmo com orçamento mínimo)

#### **Passo 2: Testar via Preview do Anúncio**

**Opção A: Preview Mobile (RECOMENDADO)**

1. No **Gerenciador de Anúncios**, encontre seu anúncio
2. Clique nos **"⋮" (três pontos)** → **"Editar"**
3. Role até a seção do anúncio (criativo)
4. Clique em **"Visualizar no celular"**
5. Escaneie o QR Code com seu celular
6. O anúncio abrirá no **Facebook/Instagram app**
7. Clique no botão do anúncio (ex: "Saiba mais")
8. **Preencha o formulário** e envie

**Opção B: Via Desktop (pode ter limitações)**

1. **Gerenciador de Anúncios** → Seu anúncio
2. Clique em **"Visualizar"** ou **"Preview"**
3. Escolha **"Desktop News Feed"**
4. Clique no anúncio simulado
5. Preencha o formulário

⚠️ **ATENÇÃO**: Às vezes o desktop não permite submeter. Use mobile!

#### **Passo 3: Testar Direto pelo Formulário**

1. Vá para **Ferramentas** → **Formulários Instantâneos**
2. Encontre seu formulário
3. Clique em **"Visualizar"** ou **"Preview"**
4. Clique em **"Abrir Formulário"**
5. Preencha todos os campos obrigatórios
6. Clique em **"Enviar"**

**Se não aparecer botão "Enviar":**
- O preview pode estar apenas mostrando o layout
- Use o método do anúncio (Opção A ou B acima)

#### **Passo 4: Forçar Teste via Graph API (Avançado)**

Se nenhum método acima funcionar, você pode criar um lead de teste via API:

```bash
# 1. Obter seu Form ID
curl "http://localhost:3000/api/v1/meta/forms?pageId=SEU_PAGE_ID"

# 2. Criar lead de teste via Graph API
curl -X POST "https://graph.facebook.com/v21.0/SEU_FORM_ID/test_lead" \
  -d "access_token=SEU_ACCESS_TOKEN"
```

**Resposta:**
```json
{
  "id": "test_lead_123456",
  "success": true
}
```

Este lead de teste será enviado via webhook para seu sistema!

#### **Passo 5: Verificar se o Lead Chegou**

Após enviar o formulário, verifique:

**1. Logs do Servidor (ngrok/bun dev):**
```bash
# Você deve ver algo como:
📨 Webhook Meta recebido: { signature: 'presente', bodyLength: 456 }
🔐 Validando assinatura HMAC SHA256...
✅ Assinatura válida!
📋 Payload recebido: {...}
📥 Processando leadgen_id: abc123
🔍 Buscando dados do lead abc123 via Graph API...
✅ Dados do lead recebidos com sucesso
📝 Criando lead no sistema para manager xyz...
✅ Lead criado com sucesso: uuid-do-lead
```

**2. Banco de Dados:**
```bash
# No terminal, rode:
bun run prisma studio

# OU via SQL:
# SELECT * FROM "Lead" ORDER BY "createdAt" DESC LIMIT 1;
```

**3. Interface do Lead Flow:**
- Vá para o Kanban
- Verifique a coluna **"new_opportunity"**
- Deve aparecer o lead com os dados do formulário

**4. No Meta (confirmação):**
- **Gerenciador de Anúncios** → **Formulários Instantâneos**
- Clique no formulário → **"Ver Leads"**
- Deve aparecer o lead que você submeteu

### 🚨 Troubleshooting - Formulário Não Aceita Envio

#### **Problema: Botão "Enviar" não aparece ou está desabilitado**

**Possíveis causas:**

1. **Campos obrigatórios não preenchidos**
   - ✅ Solução: Preencha TODOS os campos marcados como obrigatórios
   - Geralmente: Nome completo, Email, Telefone

2. **Formulário está em modo Preview/Draft**
   - ✅ Solução: O formulário precisa estar **ATIVO** e conectado a um anúncio publicado
   - Vá em **Ferramentas** → **Formulários Instantâneos** → verifique status

3. **Testando no Desktop (limitação do Meta)**
   - ✅ Solução: **Use o celular!** Formulários de Lead Ads funcionam melhor no mobile
   - Escaneie QR code do preview

4. **Permissões da Página**
   - ✅ Solução: Você precisa ser admin da página do Facebook
   - **Configurações da Página** → **Funções da Página** → confirme seu papel

5. **Formulário não conectado ao webhook**
   - ✅ Solução: Edite o formulário → ative **"Conectar ao CRM"**
   - Isso habilita o envio de leads via webhook

#### **Problema: Formulário abre mas não carrega campos**

**Causas:**
- Conexão lenta
- App do Facebook/Instagram desatualizado
- Cache do navegador

**Soluções:**
```bash
# Mobile:
1. Atualize o app do Facebook/Instagram
2. Limpe cache do app
3. Tente em outro dispositivo

# Desktop:
1. Limpe cache do navegador (Ctrl+Shift+Delete)
2. Tente em modo anônimo
3. Use outro navegador
```

#### **Problema: Lead não chega no sistema**

**Verificar em ordem:**

1. **Webhook está verificado?**
   ```bash
   # Meta App → Webhooks → Status deve estar verde ✅
   # Se não, verifique META_VERIFY_TOKEN no .env
   ```

2. **Servidor está rodando?**
   ```bash
   # Terminal deve mostrar:
   ▲ Next.js 15.5.9
   - Local: http://localhost:3000
   
   # E ngrok deve estar ativo:
   ngrok http 3000
   ```

3. **Assinatura HMAC está válida?**
   ```bash
   # Logs devem mostrar:
   ✅ Assinatura válida!
   
   # Se mostrar ❌, verifique META_APP_SECRET no .env
   ```

4. **Access Token está válido?**
   ```bash
   # Teste:
   curl "https://graph.facebook.com/v21.0/me?access_token=SEU_TOKEN"
   
   # Se retornar erro 401, token expirou → gere novo token
   ```

5. **Manager existe e está ativo?**
   ```bash
   # Verifique no Prisma Studio:
   # Deve existir um Profile com role=MASTER e activeSubscription=true
   ```

### ✅ Checklist para Testar com Sucesso

Antes de testar, confirme:

- [ ] Formulário criado e status **ATIVO**
- [ ] Formulário conectado a um anúncio (mesmo de teste)
- [ ] Opção **"Conectar ao CRM"** ativada no formulário
- [ ] Webhook **verificado** no Meta (✅ verde)
- [ ] Servidor Next.js rodando (`bun run dev`)
- [ ] ngrok rodando e URL atualizada no webhook
- [ ] Variáveis de ambiente configuradas:
  - `META_APP_SECRET` ✅
  - `META_ACCESS_TOKEN` ✅
  - `META_VERIFY_TOKEN` ✅
- [ ] Manager ativo no banco de dados
- [ ] Testando via **celular** (recomendado)

### 📱 Método Recomendado Final

**Para garantir que funcione:**

1. ✅ Crie anúncio de teste com orçamento mínimo (R$ 1,00)
2. ✅ Configure formulário com "Conectar ao CRM" ativado
3. ✅ Publique o anúncio
4. ✅ No Gerenciador → Preview → **Escaneie QR code no celular**
5. ✅ Abra no app do Facebook/Instagram
6. ✅ Preencha formulário e envie
7. ✅ Verifique logs do servidor em tempo real
8. ✅ Confirme lead no Kanban (coluna "new_opportunity")

---

### 1. Testar Verificação do Webhook

O Meta faz uma requisição GET para verificar:

```bash
curl "http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=meta_lead_webhook_verify_token&hub.challenge=test_challenge"
```

**Resposta esperada:**
```
test_challenge
```

### 2. Simular Webhook (POST)

Crie um arquivo `test-meta-webhook.json`:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "123456789",
      "time": 1234567890,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "leadgen_id": "SEU_LEADGEN_ID_DE_TESTE",
            "page_id": "123456789",
            "form_id": "987654321",
            "adgroup_id": "111222333",
            "ad_id": "444555666",
            "created_time": 1234567890
          }
        }
      ]
    }
  ]
}
```

Envie o webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=..." \
  -d @test-meta-webhook.json
```

⚠️ **Nota:** Para testar localmente sem assinatura válida, você pode comentar temporariamente a validação no código.

### 3. Testar com Lead Real

1. Acesse seu anúncio no Facebook/Instagram
2. Preencha o formulário
3. Submeta
4. Verifique os logs do servidor:

```
📨 Webhook Meta recebido: { signature: 'presente', bodyLength: 456 }
📋 Payload recebido: {...}
📥 Buscando dados do lead abc123 no Meta...
📝 Criando lead no sistema para manager xyz...
✅ Lead criado com sucesso: uuid-do-lead
```

5. Veja o lead no Kanban (coluna "new_opportunity")

---

## 🔄 Fluxo Completo

### 1. Usuário Preenche Formulário

- Anúncio aparece no Facebook/Instagram
- Usuário clica e preenche formulário (Instant Form)
- Dados ficam salvos no Meta

### 2. Meta Envia Webhook

```json
POST /api/webhooks/meta
{
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "12345"
      }
    }]
  }]
}
```

### 3. Sistema Busca Dados Completos

```bash
GET https://graph.facebook.com/v21.0/12345?access_token=...
```

**Resposta:**
```json
{
  "id": "12345",
  "created_time": "2026-01-11T10:30:00+0000",
  "field_data": [
    {"name": "full_name", "values": ["João Silva"]},
    {"name": "email", "values": ["joao@email.com"]},
    {"name": "phone_number", "values": ["+5511999999999"]},
    {"name": "age", "values": ["35"]},
    {"name": "current_health_plan", "values": ["Amil"]}
  ]
}
```

### 4. Sistema Cria Lead

```typescript
{
  name: "João Silva",
  email: "joao@email.com",
  phone: "+5511999999999",
  age: "35",
  currentHealthPlan: "AMIL",
  status: "new_opportunity",
  notes: "Lead importado automaticamente do Meta Lead Ads...",
  // ... activity criada automaticamente
}
```

### 5. Lead Visível no Kanban

O lead aparece na coluna **"new_opportunity"** pronto para ser trabalhado!

---

## 🎯 Mapeamento de Campos

### Campos do Meta → Campos do Lead Flow

| Campo Meta | Campo Lead Flow | Transformação |
|------------|-----------------|---------------|
| `full_name` / `name` | `name` | Direto |
| `email` | `email` | Direto |
| `phone_number` / `phone` | `phone` | Normalizado (+55) |
| `age` / `idade` | `age` | Direto |
| `current_health_plan` / `plano_atual` | `currentHealthPlan` | Mapeado para enum |
| `city` / `cidade` | - | Adicionado nas notas |
| Outros campos customizados | `notes` | Concatenados |

### Mapeamento de Planos de Saúde

O sistema detecta automaticamente planos de saúde:

```typescript
"amil" → HealthPlan.AMIL
"bradesco" → HealthPlan.BRADESCO
"unimed" → HealthPlan.UNIMED
"sulamerica" / "sul america" → HealthPlan.SULAMERICA
// ... outros
```

Se não reconhecido → `HealthPlan.OUTROS`

---

## 🛡️ Segurança Implementada

### 1. Validação de Assinatura HMAC SHA256 ✅

**Todos os webhooks são validados** antes de processar:

```typescript
// No webhook route.ts
const signature = request.headers.get('x-hub-signature-256');
const body = await request.text();

// Validação com timing-safe comparison
const isValid = metaLeadService.validateWebhookSignature(signature, body);

if (!isValid) {
  console.error('❌ Assinatura inválida! Possível tentativa de ataque.');
  return NextResponse.json({ error: 'Assinatura inválida' }, { status: 403 });
}
```

**Como funciona:**
1. Meta envia header `X-Hub-Signature-256: sha256=<hash>`
2. Sistema calcula hash do body usando `APP_SECRET`
3. Compara com `crypto.timingSafeEqual()` (proteção contra timing attacks)
4. Só processa se assinatura for válida

**Logs de segurança:**
```bash
🔐 Validando assinatura HMAC SHA256...
✅ Assinatura válida!
# OU
❌ Assinatura inválida! Possível tentativa de ataque.
```

### 2. Verificação de Token (Webhook Setup) ✅

Na configuração inicial do webhook:

```typescript
// GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=...
if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
  return new NextResponse(challenge, { status: 200 });
}
```

### 3. Busca Segura via Graph API ✅

**Dados completos só são buscados após validação:**

```typescript
// Só busca dados se webhook passou pela validação
const metaData = await metaLeadService.getLeadData(leadgenId);
```

**Access Token é enviado de forma segura:**
- Nunca exposto em logs
- Armazenado em variável de ambiente
- Transmitido via HTTPS apenas

**Logs detalhados:**
```bash
🔍 Buscando dados do lead abc123 via Graph API...
✅ Dados do lead recebidos com sucesso
📋 Campos recebidos: full_name, email, phone_number, age
```

### 4. Detecção de Duplicados ✅

Antes de criar, verifica se já existe lead com:
- ✅ Mesmo email
- ✅ Mesmo telefone

**Se existir:**
```typescript
// Não cria lead duplicado
// Apenas registra tentativa
await prisma.lead.update({
  activities: {
    create: {
      type: 'note',
      body: `Tentativa de criação duplicada via Meta Lead Ads (leadgen_id: ${leadgenId})`
    }
  }
});
```

### 5. Proteções Adicionais

| Proteção | Implementação |
|----------|---------------|
| **Rate Limiting** | Next.js (produção com Vercel) |
| **HTTPS Only** | Webhook só aceita HTTPS |
| **Error Handling** | Try/catch em todas operações |
| **Logging Seguro** | Dados sensíveis mascarados |
| **Validação de Dados** | Schema validation antes de salvar |

### 6. Checklist de Segurança

Antes de ir para produção:

- [x] `META_APP_SECRET` configurado corretamente
- [x] `META_ACCESS_TOKEN` é long-lived (60 dias)
- [x] `META_VERIFY_TOKEN` é único e seguro
- [x] Webhook usa HTTPS (não HTTP)
- [x] Validação de assinatura ativa
- [ ] Monitoramento de tentativas de ataque
- [ ] Rate limiting configurado (Vercel Edge Config)
- [ ] Logs sendo enviados para serviço externo

---

## 🚨 Troubleshooting

### Webhook não está sendo chamado

**Verificar:**

1. ✅ URL do webhook está acessível publicamente (não `localhost`)
2. ✅ Webhook foi **verificado** com sucesso no Meta
3. ✅ Subscribed to field **`leadgen`** está ativo
4. ✅ Formulário tem **"Enviar leads para CRM"** ativado

**Como debugar:**

```bash
# Ver logs do webhook
tail -f logs/webhook.log

# Testar conectividade
curl https://seu-dominio.com/api/webhooks/meta
```

### Erro "Assinatura inválida"

**Causa:** `META_APP_SECRET` incorreto

**Solução:**

1. Verifique `.env`
2. Copie novamente de **Meta App → Configurações → Básico → App Secret**
3. Reinicie servidor: `bun run dev`

### Erro ao buscar dados do lead

**Causa:** `META_ACCESS_TOKEN` expirado ou sem permissões

**Solução:**

1. Gere novo token no **Graph API Explorer**
2. Permissões necessárias:
   - `pages_manage_ads`
   - `leads_retrieval`
3. Converta para long-lived token (ver seção de credenciais)

### Lead não aparece no Kanban

**Verificar:**

1. ✅ Manager tem assinatura ativa
2. ✅ Lead foi criado (verificar banco de dados)
3. ✅ Status é `new_opportunity`

**Logs para verificar:**

```bash
# No terminal do servidor
✅ Lead criado com sucesso: <uuid>
```

---

## 📊 Monitoramento e Logs

### APIs de Consulta Implementadas

Você pode consultar formulários e estatísticas via API:

#### 1. **Listar Formulários de uma Página**

```bash
GET /api/v1/meta/forms?pageId=123456789
```

**Resposta:**
```json
{
  "isValid": true,
  "successMessages": ["3 formulário(s) encontrado(s)"],
  "errorMessages": [],
  "result": [
    {
      "id": "form_123",
      "name": "Formulário Teste Lead Flow",
      "status": "ACTIVE",
      "leads_count": 45
    }
  ]
}
```

#### 2. **Listar Leads de um Formulário**

```bash
GET /api/v1/meta/forms/{formId}/leads?limit=100
```

**Resposta:**
```json
{
  "isValid": true,
  "successMessages": ["45 lead(s) encontrado(s)"],
  "errorMessages": [],
  "result": {
    "formId": "form_123",
    "totalLeads": 45,
    "leads": [
      {
        "id": "lead_abc",
        "created_time": "2026-01-11T10:30:00+0000",
        "form_id": "form_123",
        "ad_id": "ad_456",
        "field_data": [
          { "name": "full_name", "values": ["João Silva"] },
          { "name": "email", "values": ["joao@email.com"] },
          { "name": "phone_number", "values": ["+5511999999999"] }
        ]
      }
    ]
  }
}
```

#### 3. **Estatísticas de um Formulário**

```bash
GET /api/v1/meta/forms/{formId}/stats
```

**Resposta:**
```json
{
  "isValid": true,
  "successMessages": ["Estatísticas obtidas com sucesso"],
  "errorMessages": [],
  "result": {
    "formId": "form_123",
    "formName": "Formulário Teste Lead Flow",
    "status": "ACTIVE",
    "totalLeads": 45,
    "createdTime": "2026-01-01T00:00:00+0000",
    "leads": [...]
  }
}
```

### Como Obter o Page ID e Form ID

#### **Page ID:**

**Opção 1: Via API do Meta**
```bash
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=SEU_ACCESS_TOKEN"
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "123456789",
      "name": "Minha Página",
      "access_token": "page_token...",
      "category": "Health/Beauty"
    }
  ]
}
```

**Opção 2: Via Interface do Facebook**
1. Vá para sua página no Facebook
2. Clique em **"Sobre"**
3. Role até **"ID da Página"**

#### **Form ID:**

**Opção 1: Via API do Lead Flow**
```bash
curl "http://localhost:3000/api/v1/meta/forms?pageId=123456789"
```

**Resposta:**
```json
{
  "isValid": true,
  "successMessages": ["3 formulário(s) encontrado(s)"],
  "result": [
    {
      "id": "987654321",  ← FORM ID
      "name": "Formulário Teste Lead Flow",
      "status": "ACTIVE"
    }
  ]
}
```

**Opção 2: Via Interface do Meta**
1. **Gerenciador de Anúncios** → **Formulários Instantâneos**
2. Copie o ID do formulário desejado

### Consultas Completas Passo a Passo

#### **1. Descobrir suas páginas do Facebook**

```bash
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=EAAMit0obxTwBQexZBb0eLZCiWQxU9apNkP6HBwa1mXKVtTRosrQGnoj7poS2T5gFOIvJTwlUl24KH16yZATilRNGzi3pTEgJKIFqcJ6vZAJE7PRv8eqdPUiIsBpZByqZAQDb5MacAKIekS7UGMl47g5zrR9bJTjZC6YswKSyNSWDP8CIV8ZAsyZAaZCFhlOnylfYKPdV62DLEHACu8vlVCFZB1My0y2sAiZCDNLMT4gcV9qrmmIpkEapdGMNqrXXA8NDjQZCqMllbiSDz4krbSMT5U9hDZBbIU"
```

**Resultado:**
- Lista de todas as páginas que você administra
- Pegue o `id` da página desejada

#### **2. Listar formulários da sua página**

```bash
# Com a API do Lead Flow (recomendado)
curl "http://localhost:3000/api/v1/meta/forms?pageId=SEU_PAGE_ID"

# OU direto via Graph API do Meta
curl "https://graph.facebook.com/v21.0/SEU_PAGE_ID/leadgen_forms?access_token=SEU_ACCESS_TOKEN"
```

**Resultado:**
```json
{
  "isValid": true,
  "result": [
    {
      "id": "987654321",
      "name": "Formulário Plano de Saúde",
      "status": "ACTIVE"
    },
    {
      "id": "987654322",
      "name": "Formulário Teste",
      "status": "PAUSED"
    }
  ]
}
```

#### **3. Ver total de respostas de um formulário**

```bash
# Estatísticas completas (recomendado)
curl "http://localhost:3000/api/v1/meta/forms/987654321/stats"

# OU apenas listar leads
curl "http://localhost:3000/api/v1/meta/forms/987654321/leads?limit=100"
```

**Resultado (stats):**
```json
{
  "isValid": true,
  "result": {
    "formId": "987654321",
    "formName": "Formulário Plano de Saúde",
    "status": "ACTIVE",
    "totalLeads": 45,  ← TOTAL DE RESPOSTAS
    "createdTime": "2026-01-01T00:00:00+0000",
    "leads": [
      {
        "id": "lead_abc123",
        "created_time": "2026-01-11T10:30:00+0000",
        "field_data": [
          { "name": "full_name", "values": ["João Silva"] },
          { "name": "email", "values": ["joao@email.com"] },
          { "name": "phone_number", "values": ["+5511999999999"] }
        ]
      }
      // ... outros leads
    ]
  }
}
```

#### **4. Ver apenas a contagem de leads**

```bash
# Buscar stats e extrair totalLeads
curl "http://localhost:3000/api/v1/meta/forms/987654321/stats" | grep -o '"totalLeads":[0-9]*'

# OU via Graph API (menos confiável)
curl "https://graph.facebook.com/v21.0/987654321?fields=leads_count&access_token=SEU_ACCESS_TOKEN"
```

#### **5. Comparar leads do Meta com leads no banco**

```bash
# 1. Ver total no Meta
META_TOTAL=$(curl -s "http://localhost:3000/api/v1/meta/forms/987654321/stats" | jq '.result.totalLeads')

# 2. Ver total no banco (via API do Lead Flow)
BANCO_TOTAL=$(curl -s "http://localhost:3000/api/v1/leads?managerId=SEU_MANAGER_ID" | jq '.result | length')

# 3. Calcular diferença
echo "Leads no Meta: $META_TOTAL"
echo "Leads no Banco: $BANCO_TOTAL"
echo "Diferença: $(($META_TOTAL - $BANCO_TOTAL))"
```

### Exemplos de Uso

**Com cURL:**

```bash
# Listar formulários
curl "http://localhost:3000/api/v1/meta/forms?pageId=123456789"

# Ver leads de um formulário
curl "http://localhost:3000/api/v1/meta/forms/form_123/leads?limit=50"

# Ver estatísticas
curl "http://localhost:3000/api/v1/meta/forms/form_123/stats"
```

**Com JavaScript (Frontend):**

```typescript
// Service
async getFormStats(formId: string) {
  const response = await fetch(`/api/v1/meta/forms/${formId}/stats`);
  const data = await response.json();
  
  if (data.isValid) {
    console.log(`Total de leads: ${data.result.totalLeads}`);
    return data.result;
  }
}
```

### Logs de Validação de Webhook

```bash
# Verificação (setup inicial)
🔍 Verificação do webhook Meta recebida: { mode: 'subscribe', token: '***', challenge: '***' }
✅ Webhook Meta verificado com sucesso

# Webhook recebido
📨 Webhook Meta recebido: { signature: 'presente', bodyLength: 456 }
🔐 Validando assinatura HMAC SHA256...
✅ Assinatura válida!
```

### Logs de Processamento de Lead

```bash
# Processamento iniciado
📋 Payload recebido: {...}
📥 Processando leadgen_id: abc123

# Busca via Graph API
🔍 Buscando dados do lead abc123 via Graph API...
✅ Dados do lead recebidos com sucesso
📋 Campos recebidos: full_name, email, phone_number, age, current_health_plan

# Criação do lead
📝 Criando lead no sistema para manager xyz...
✅ Lead criado com sucesso: uuid-do-lead
```

### Logs de Erro/Segurança

```bash
# Assinatura inválida
❌ Assinatura inválida! Possível tentativa de ataque.

# Token de verificação errado
❌ Token de verificação inválido

# Erro na Graph API
❌ Erro ao buscar lead do Meta: { status: 401, error: 'Invalid OAuth token' }

# Lead duplicado
⚠️  Lead duplicado encontrado: uuid-do-lead-existente
```

### Verificar Webhook no Meta

1. **Meta App** → **Webhooks**
2. Clique em **"Testar"** ao lado do campo `leadgen`
3. Veja o resultado do teste

---

## 🎯 Próximos Passos

### ✅ Implementado

- [x] **Service para integração Meta Graph API** ([MetaLeadService.ts](../app/api/services/MetaLeadService.ts))
  - [x] Busca dados completos do lead via Graph API
  - [x] Validação de assinatura HMAC SHA256
  - [x] Normalização de telefone (+55)
  - [x] Mapeamento de campos do formulário
  - [x] Logging detalhado e seguro
  - [x] **Listagem de formulários de uma página**
  - [x] **Listagem de leads de um formulário**
  - [x] **Estatísticas de formulários**

- [x] **UseCase para processar leads** ([MetaLeadUseCase.ts](../app/api/useCases/metaLeads/MetaLeadUseCase.ts))
  - [x] Processamento de webhooks
  - [x] Criação automática de leads
  - [x] Detecção de duplicados (email/phone)
  - [x] Mapeamento de planos de saúde
  - [x] Registro de atividades
  - [x] Status inicial: `new_opportunity`

- [x] **Endpoints implementados**
  - [x] `POST /api/webhooks/meta` - Recebe webhooks
  - [x] `GET /api/webhooks/meta` - Verificação do webhook
  - [x] **`GET /api/v1/meta/forms?pageId=X` - Lista formulários**
  - [x] **`GET /api/v1/meta/forms/:formId/leads` - Lista leads**
  - [x] **`GET /api/v1/meta/forms/:formId/stats` - Estatísticas**

- [x] **Segurança implementada**
  - [x] Validação de assinatura (timing-safe)
  - [x] Verify token customizado
  - [x] Detecção de duplicados
  - [x] Logging de tentativas de ataque
  - [x] HTTPS obrigatório

### 🚧 Melhorias Futuras (Opcional)

- [ ] **Atribuição automática** a operadores (round-robin)
- [ ] **Múltiplos managers** (cada anúncio → manager específico)
- [ ] **Retry automático** se Graph API falhar
- [ ] **Dashboard de métricas** (leads por anúncio/formulário)
- [ ] **Notificações** (email/WhatsApp quando lead chegar)
- [ ] **Custom fields** do formulário → campos customizados do lead

---

## 📚 Recursos Adicionais

### Documentação Oficial

- [Meta Lead Ads Documentation](https://developers.facebook.com/docs/marketing-api/guides/lead-ads)
- [Webhooks for Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/webhooks)
- [Graph API - Leadgen](https://developers.facebook.com/docs/graph-api/reference/leadgen)

### Testes no Meta

- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Webhooks Tester](https://developers.facebook.com/tools/webhooks/)

---

## 💬 Suporte

**Dúvidas?** Verifique:

1. Logs do servidor (`bun run dev`)
2. Console do navegador (erros JS)
3. Meta App → Webhooks → Activity Log
4. Graph API Explorer para testar tokens

---

**✅ Setup completo!** Agora seus leads do Facebook/Instagram serão criados automaticamente no Lead Flow. 🎉
