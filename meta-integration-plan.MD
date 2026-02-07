**Plano de Implementacao - Integracoes Meta (Lead Ads + WhatsApp Bot)**

## 1. Objetivo
Implementar duas integracoes Meta na aplicacao, com isolamento por cliente/manager (multi-tenant):
1. Consumo automatico de leads do Meta Lead Ads.
2. Bot WhatsApp (Cloud API) para consultar, criar e atualizar leads via comandos.

O plano contempla tambem o onboarding no Facebook Developer/WhatsApp Cloud API.

## 2. Escopo
**Incluido**
- Integracao Meta Lead Ads multi-tenant (credenciais e webhook por cliente).
- Bot WhatsApp 1:1 com comandos estruturados.
- UI para configuracao por cliente/time.
- Documentacao de setup (Meta/WhatsApp) e atualizacao de privacidade.

**Fora de escopo (neste MVP)**
- Fluxo de templates do WhatsApp (mensagens HSM).
- Estrategias avancadas de distribuicao de leads (round-robin).
- Dashboards avancados de metricas das integracoes.

## 3. Visao Geral da Arquitetura
- Tokens por cliente (criptografados em repouso).
- Webhook roteado por `page_id` (Meta Lead Ads).
- Webhook roteado por `phone_number_id` (WhatsApp Cloud).
- Use cases e repositories dedicados para as integracoes.
- UI de configuracao para managers.

## 4. Modelagem de Dados (Prisma)
**Novos modelos**
- `MetaLeadIntegration`
  - `managerId`, `teamId`, `pageId`
  - `pageAccessTokenEnc` (criptografado)
  - `verifyToken`, `isActive`, `defaultAssigneeId`
- `WhatsAppIntegration`
  - `managerId`, `teamId`
  - `businessAccountId`, `phoneNumberId`, `businessPhoneNumber`
  - `accessTokenEnc` (criptografado)
  - `verifyToken`, `isActive`

**Lead**
- `source` (enum `LeadSource`: `manual`, `meta_lead_ads`, `whatsapp`, `import`, `api`)
- Metadados Meta: `metaLeadgenId`, `metaFormId`, `metaAdId`, `metaPageId`
- Metadados WhatsApp: `whatsappFrom`, `whatsappMessageId`
- `phoneNormalized` para busca e deduplicacao

## 5. Endpoints e Fluxos
**Meta Lead Ads**
- `GET/POST /api/webhooks/meta`
  - GET: verifica `hub.verify_token` usando token salvo por integracao.
  - POST: valida assinatura, resolve integracao por `page_id`, busca dados no Graph API e cria lead.

**WhatsApp Bot**
- `GET/POST /api/webhooks/whatsapp`
  - GET: valida `hub.verify_token` por integracao.
  - POST: valida assinatura, resolve integracao por `phone_number_id`, processa comandos.

**Configuracao por cliente**
- `GET/POST /api/v1/integrations/meta-leads`
- `PUT /api/v1/integrations/meta-leads/[id]`
- `GET/POST /api/v1/integrations/whatsapp`
- `PUT /api/v1/integrations/whatsapp/[id]`

**Consulta Meta (autenticada)**
- `GET /api/v1/meta/forms`
- `GET /api/v1/meta/forms/[formId]/leads`
- `GET /api/v1/meta/forms/[formId]/stats`

## 6. UI de Configuracao (Managers)
Pagina dedicada: `app/[supabaseId]/integrations`
Formularios:
- Meta Lead Ads: `pageId`, `pageAccessToken`, `verifyToken`, `teamId`, `defaultAssigneeId`, `isActive`
- WhatsApp: `phoneNumberId`, `accessToken`, `verifyToken`, `teamId`, `businessAccountId`, `businessPhoneNumber`, `isActive`
Botao "Testar conexao" para validar tokens e IDs.

## 7. Seguranca
- Tokens criptografados em repouso com AES-256-GCM.
- Assinaturas validadas com `META_APP_SECRET`.
- Logs com dados sensiveis minimizados.
- Verificacao e isolamento por `pageId`/`phone_number_id`.

## 8. Passo a Passo - Facebook Developer (Meta Lead Ads)
1. Criar app no Meta for Developers.
2. Adicionar produto **Webhooks**.
3. Conceder permissoes `leads_retrieval`, `pages_manage_ads`, `pages_read_engagement`.
4. Gerar **Page Access Token** (long-lived).
5. Configurar Webhook:
   - URL: `https://seu-dominio.com/api/webhooks/meta`
   - Verify Token: usar o token definido na UI do cliente.
6. Conectar formulario ao app via **CRM Integration**.
7. Preencher na UI do Lead Flow: `pageId`, token, verify token, time e ativar.

## 9. Passo a Passo - WhatsApp Cloud API
1. No Meta Developers, adicionar produto **WhatsApp** ao app.
2. Criar Business Account (ou usar existente).
3. Configurar numero e obter `phone_number_id`.
4. Gerar token de acesso (idealmente long-lived).
5. Configurar Webhook:
   - URL: `https://seu-dominio.com/api/webhooks/whatsapp`
   - Verify Token: usar o token definido na UI do cliente.
6. Na UI do Lead Flow, preencher `phoneNumberId`, token, verify token e ativar.
7. Testar envio de mensagem e comandos.

## 10. Comandos do Bot
- `/ajuda`
- `/lead <leadCode|id|telefone|email>`
- `/status <leadCode|id> <novo_status>`
- `/novo Nome;Telefone;Email;Cidade;Plano`
- `/nota <leadCode|id> <texto>`

## 11. Testes e Validacoes
**Automatizados**
- Unit tests do `CommandParser`.
- Unit tests das validacoes de assinatura (Meta/WhatsApp).

**Manuais**
- Webhook Meta: verificacao de token correto/incorreto.
- Payload Meta sem `page_id`.
- Lead duplicado por `metaLeadgenId`.
- WhatsApp: numero nao autorizado.
- WhatsApp: `/lead` com multiplos resultados.
- WhatsApp: `/status` invalido.
- UI: salvar, atualizar e testar integracao.

## 12. Rollout e Migracao
- Backfill de `phoneNormalized` para leads existentes.
- Ativar integracoes por cliente (default `isActive=false`).
- Verificacao manual antes de ligar o webhook em producao.

## 13. Cronograma Sugerido
**Semana 1**
- Modelagem de dados e migracoes.
- Criptografia e repositories/use cases.

**Semana 2**
- Webhooks Meta e WhatsApp.
- Bot e comandos estruturados.

**Semana 3**
- UI de integracoes.
- Documentacao e testes.

## 14. Riscos e Mitigacoes
- Tokens expirando: usar long-lived tokens e incluir teste de conexao.
- Webhook invalido: validacao de assinatura e logs minimos.
- Acesso indevido: autorizacao por numero de telefone + time.
- Duplicidade: indices unicos e deduplicacao.

---

**Status atual:** implementado conforme plano, com documentacao e UI dedicadas.

