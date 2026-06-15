# Spec: Integracao WhatsApp via Evolution API

Esta spec define o v1 do modulo de WhatsApp do Lead Flow usando exclusivamente a Evolution API, com um numero por time, caixa compartilhada e integracao direta com o CRM. O objetivo e sair com um fluxo operacional utilizavel, auditavel e pronto para evoluir para billing e automacoes futuras sem redesenhar o dominio principal.

## Background

Hoje o produto ja trata WhatsApp como canal de contato em pontos isolados do CRM, mas nao possui um modulo real de conexao, inbox, envio e rastreabilidade por time. Isso obriga a operacao a sair do Lead Flow para conversar com o lead, quebra o historico operacional e impede qualquer camada confiavel de auditoria, produtividade e monetizacao do canal.

O trabalho foi priorizado agora porque a decisao de produto ja esta tomada:

- o v1 sera feito com Evolution API
- o numero conectado pertence ao time, nao ao operador
- a operacao sera compartilhada
- o modulo ja deve nascer com escopo comercial claro de mensalidade fixa com uso justo

Tambem existe necessidade de orientar a operacao sobre como subir a infraestrutura manualmente, incluindo um caminho opcional com Hostinger, sem acoplar a aplicacao a um provedor especifico.

## Goals

- Permitir que cada `Team` conecte um numero de WhatsApp via QR Code usando Evolution API.
- Exibir e operar uma inbox compartilhada do time dentro do Lead Flow.
- Vincular conversas e mensagens a `Lead` sempre que possivel.
- Registrar autoria do operador nas mensagens enviadas pelo sistema.
- Persistir eventos de uso e estado da integracao para billing futuro, observabilidade e suporte.
- Definir um escopo de v1 implementavel no padrao arquitetural atual do repositorio.

## Non-Goals

- Suportar API Oficial da Meta ou qualquer BSP no v1.
- Permitir mais de um numero ativo por time.
- Permitir um numero dedicado por operador.
- Cobrar automaticamente por mensagem excedente no v1.
- Entregar campanhas em massa, chatbot, fluxos de IA ou automacoes avancadas.
- Redesenhar o CRM, funil de leads ou os dominios de assinatura ja existentes.

## Design

### Technical Approach

O modulo sera tratado como parte do produto principal e seguira o fluxo canonico:

```txt
Route -> UseCase -> Service -> Prisma
```

Principios do v1:

- a integracao fica ancorada em `Team`
- a conversa e compartilhada entre membros autorizados do time
- mensagens inbound e outbound ficam persistidas em entidades proprias
- o CRM continua sendo a fonte de verdade para o lead; o WhatsApp se acopla a ele
- a Evolution API e uma dependencia de infraestrutura, nao de modelagem interna

Subdominios propostos:

1. Configuracao da integracao
   - cria e gerencia a instancia Evolution do time
   - mantem estado de conexao, QR Code, telefone e datas de sincronizacao

2. Inbox compartilhada
   - lista conversas do time
   - exibe mensagens e metadados
   - permite envio manual de mensagens

3. Ingestao por webhook
   - recebe eventos da Evolution
   - cria ou atualiza conversa
   - persiste mensagens e mudancas de status com idempotencia

4. Uso e readiness de billing
   - conta eventos relevantes para uso justo
   - expande facilmente para cobranca futura

### Data Model

Novas entidades sugeridas para `prisma/schema.prisma`:

#### `TeamWhatsAppConfig`

Configuracao unica de WhatsApp por time.

Campos propostos:

- `id: String @id @default(uuid())`
- `teamId: String @unique`
- `provider: WhatsAppProvider`
- `instanceName: String`
- `instanceId: String?`
- `phoneNumber: String?`
- `displayName: String?`
- `status: WhatsAppConnectionStatus`
- `qrCodeText: String?`
- `qrCodeImageUrl: String?`
- `webhookSecret: String`
- `hostBaseUrl: String?`
- `lastConnectedAt: DateTime?`
- `lastDisconnectedAt: DateTime?`
- `lastSyncAt: DateTime?`
- `usageLimitMonthly: Int`
- `billingEnabled: Boolean @default(true)`
- `createdByProfileId: String`
- `updatedByProfileId: String`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relacoes:

- `team -> Team`
- `createdBy -> Profile`
- `updatedBy -> Profile`
- `conversations -> WhatsAppConversation[]`
- `usageEvents -> WhatsAppUsageEvent[]`

Restricoes:

- apenas uma configuracao por `teamId`
- apenas `provider = EVOLUTION` no v1

#### `WhatsAppConversation`

Representa o agrupamento operacional da conversa do time com um contato.

Campos propostos:

- `id: String @id @default(uuid())`
- `teamId: String`
- `configId: String`
- `leadId: String?`
- `externalChatId: String?`
- `contactPhone: String`
- `contactName: String?`
- `normalizedPhone: String`
- `assignedProfileId: String?`
- `lastMessageAt: DateTime?`
- `lastInboundAt: DateTime?`
- `lastOutboundAt: DateTime?`
- `lastMessagePreview: String?`
- `unreadCount: Int @default(0)`
- `isArchived: Boolean @default(false)`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relacoes:

- `team -> Team`
- `config -> TeamWhatsAppConfig`
- `lead -> Lead?`
- `assignedProfile -> Profile?`
- `messages -> WhatsAppMessage[]`

Indices:

- `(teamId, lastMessageAt desc)`
- `(teamId, normalizedPhone)`
- `(leadId)`

#### `WhatsAppMessage`

Persistencia canonica das mensagens da conversa.

Campos propostos:

- `id: String @id @default(uuid())`
- `conversationId: String`
- `teamId: String`
- `configId: String`
- `leadId: String?`
- `providerMessageId: String?`
- `providerEventId: String?`
- `direction: WhatsAppMessageDirection`
- `messageType: WhatsAppMessageType`
- `status: WhatsAppMessageStatus`
- `contentText: String?`
- `mediaUrl: String?`
- `mediaMimeType: String?`
- `caption: String?`
- `sentByProfileId: String?`
- `senderPhone: String?`
- `recipientPhone: String?`
- `sentAt: DateTime?`
- `deliveredAt: DateTime?`
- `readAt: DateTime?`
- `failedAt: DateTime?`
- `rawPayload: Json`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Relacoes:

- `conversation -> WhatsAppConversation`
- `team -> Team`
- `config -> TeamWhatsAppConfig`
- `lead -> Lead?`
- `sentByProfile -> Profile?`

Indices e idempotencia:

- `(conversationId, createdAt asc)`
- `(teamId, providerMessageId)` com unicidade parcial quando houver `providerMessageId`
- `(teamId, providerEventId)` para evitar duplicidade de eventos

#### `WhatsAppUsageEvent`

Registro de consumo para regra de uso justo e faturamento futuro.

Campos propostos:

- `id: String @id @default(uuid())`
- `teamId: String`
- `configId: String`
- `conversationId: String?`
- `messageId: String?`
- `periodKey: String`
- `provider: WhatsAppProvider`
- `eventType: WhatsAppUsageEventType`
- `direction: WhatsAppMessageDirection?`
- `billable: Boolean`
- `countedTowardsQuota: Boolean`
- `quantity: Int @default(1)`
- `rawPayload: Json?`
- `createdAt: DateTime`

Uso no v1:

- contabilizar principalmente mensagens outbound
- opcionalmente contabilizar inbound em separado para analise operacional
- nao gerar cobranca automatica; apenas leitura de uso e alertas de limite

#### Enums novas

- `WhatsAppProvider = EVOLUTION`
- `WhatsAppConnectionStatus = PENDING | QR_READY | CONNECTED | DISCONNECTED | ERROR | BANNED`
- `WhatsAppMessageDirection = INBOUND | OUTBOUND`
- `WhatsAppMessageType = TEXT | IMAGE | AUDIO | VIDEO | DOCUMENT | STICKER | LOCATION | CONTACT | UNKNOWN`
- `WhatsAppMessageStatus = PENDING | SENT | DELIVERED | READ | FAILED | RECEIVED`
- `WhatsAppUsageEventType = OUTBOUND_MESSAGE | INBOUND_MESSAGE | CONNECTION_EVENT | RECONNECTION_EVENT`

### API

O v1 deve expor endpoints do produto em `/api/v1` e um webhook fora da arvore versionada.

#### Endpoints de configuracao

`POST /api/v1/teams/[teamId]/whatsapp/config`

- cria a configuracao do modulo para o time
- cria ou reaproveita a instancia na Evolution
- gera segredo de webhook
- retorna status inicial e, quando disponivel, QR Code

Request sugerido:

```json
{
  "provider": "EVOLUTION",
  "usageLimitMonthly": 2000
}
```

Response de sucesso sugerida:

```json
{
  "isValid": true,
  "successMessages": ["Configuracao do WhatsApp criada com sucesso."],
  "errorMessages": [],
  "result": {
    "teamId": "uuid",
    "provider": "EVOLUTION",
    "status": "QR_READY",
    "instanceName": "team_uuid",
    "phoneNumber": null,
    "qrCodeImageUrl": "https://evolution.example/qr/abc",
    "usageLimitMonthly": 2000
  }
}
```

`GET /api/v1/teams/[teamId]/whatsapp/config`

- retorna configuracao atual, status da conexao, telefone conectado e uso do periodo

`POST /api/v1/teams/[teamId]/whatsapp/reconnect`

- solicita novo QR Code ou recicla a conexao

`POST /api/v1/teams/[teamId]/whatsapp/disconnect`

- encerra a sessao na Evolution e marca a configuracao local como desconectada

#### Endpoints de inbox

`GET /api/v1/teams/[teamId]/whatsapp/conversations`

- lista conversas do time
- filtros sugeridos: `leadId`, `assignedProfileId`, `hasUnread`, `search`

`GET /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/messages`

- retorna historico paginado da conversa

`POST /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/messages`

- envia mensagem outbound
- exige configuracao conectada
- registra autoria do usuario autenticado

Payload inicial sugerido:

```json
{
  "messageType": "TEXT",
  "contentText": "Ola, tudo bem? Estou entrando em contato sobre sua cotacao."
}
```

`POST /api/v1/teams/[teamId]/whatsapp/conversations/[conversationId]/link-lead`

- associa conversa a um `Lead` quando a vinculacao nao existir ou precisar ser corrigida

#### Endpoint de consumo

`GET /api/v1/teams/[teamId]/whatsapp/usage`

- retorna contagem do periodo
- exibe limite, uso atual, percentual consumido e status de alerta

Response sugerida:

```json
{
  "isValid": true,
  "successMessages": [],
  "errorMessages": [],
  "result": {
    "periodKey": "2026-06",
    "usageLimitMonthly": 2000,
    "outboundCount": 347,
    "inboundCount": 221,
    "consumedPercentage": 17.35,
    "status": "WITHIN_LIMIT"
  }
}
```

#### Webhook da Evolution

`POST /api/webhooks/whatsapp/evolution/[teamToken]`

Responsabilidades:

- validar segredo/token do time
- processar webhook de mensagens inbound
- processar status de envio
- processar eventos de conexao e desconexao
- garantir idempotencia por identificadores do provider

Eventos minimos tratados no v1:

- nova mensagem recebida
- mensagem enviada confirmada
- mensagem entregue
- mensagem lida
- falha no envio
- QR Code atualizado
- instancia conectada
- instancia desconectada

Observacao de contrato:

- a shape exata do webhook deve ser adaptada a documentacao real da Evolution no momento da implementacao
- internamente o Lead Flow nao deve propagar o payload bruto como contrato de dominio

#### Autorizacao

- configuracao da integracao: manager ou membros com permissao equivalente sobre o time
- inbox compartilhada: membros do time autenticados e autorizados
- envio de mensagem: sempre registra o `Profile` responsavel
- webhook: autenticacao por segredo dedicado, nunca por sessao de usuario

### UI/UX

O v1 deve prever duas superficies principais.

#### 1. Configuracoes > Integracoes > WhatsApp

Objetivo:

- conectar o numero do time
- acompanhar o estado da conexao
- visualizar consumo do plano

Blocos obrigatorios:

1. Card de status
   - provider atual
   - status da conexao
   - telefone conectado
   - ultima sincronizacao

2. Card de conexao
   - QR Code quando a instancia estiver aguardando pareamento
   - instrucoes curtas para escanear com o WhatsApp Business
   - botoes de conectar, atualizar QR, reconectar e desconectar

3. Card de risco operacional
   - aviso de que a integracao usa Evolution API
   - texto explicito de que podem ocorrer desconexoes, necessidade de reconectar e risco operacional do canal

4. Card de uso justo
   - franquia mensal do plano
   - mensagens consumidas
   - percentual utilizado
   - estado visual: normal, atencao, limite atingido

Estados obrigatorios:

- loading inicial
- sem configuracao
- QR pronto
- conectado
- desconectado
- erro de sincronizacao

#### 2. Inbox / Conversa integrada ao CRM

Objetivo:

- operar o atendimento sem sair do produto
- manter historico compartilhado por time

Elementos obrigatorios:

- lista lateral de conversas
- painel principal de mensagens
- identificacao do lead vinculado
- identificacao do operador que enviou cada mensagem outbound
- CTA para vincular conversa a um lead quando necessario
- composer de mensagem textual

Estados obrigatorios:

- loading
- lista vazia
- conversa vazia
- erro de carregamento
- instancia desconectada
- falha de envio

Regras de UX:

- a caixa de entrada e compartilhada, mas a autoria de cada envio deve ficar visivel
- mensagens novas devem atualizar `unreadCount`
- a interface deve impedir envio quando a conexao estiver desconectada
- o layout deve seguir o padrao visual do projeto com componentes shadcn e tokens semanticos

Direcao visual resumida:

- publico: manager e operadores
- tom: tecnico, operacional e confiavel
- componentes provaveis: `Card`, `Badge`, `Button`, `Dialog`, `Tabs`, `ScrollArea`, `Skeleton`, `Textarea`, `Separator`
- status de conexao e quota devem ter hierarquia visual clara

## Edge Cases & Error Handling

- Criacao repetida da configuracao no mesmo time:
  - retornar a configuracao existente ou erro de conflito controlado
- Webhook duplicado:
  - ignorar reprocessamento por chave idempotente
- Mensagem inbound sem `Lead` associado:
  - criar conversa sem `leadId` e permitir vinculacao manual posterior
- Time sem permissao para operar a inbox:
  - responder `401` ou `403` conforme helper de acesso do produto
- Instancia desconectada no momento do envio:
  - nao tentar mascarar erro; registrar falha e retornar mensagem clara
- QR Code expirado:
  - permitir refresh manual sem recriar toda a configuracao
- Telefone ja conectado em outra instancia:
  - registrar falha de sincronizacao e orientar reconfiguracao manual
- Falha parcial entre envio no provider e persistencia local:
  - priorizar persistencia do erro e permitir reconciliacao por webhook
- Volume alto acima do uso justo:
  - nao bloquear automaticamente no primeiro release; sinalizar status e suportar acao comercial posterior

## Security & Privacy

- O numero do lead, telefone conectado e conteudo de mensagem sao dados sensiveis e devem ser tratados como PII.
- O webhook da Evolution deve usar segredo dedicado por time ou por configuracao.
- `rawPayload` deve ser armazenado para auditoria, mas sem vazar em responses publicas.
- Credenciais da Evolution e URLs de infra devem vir de variaveis de ambiente validadas.
- Logs de erro nao devem despejar payloads completos com dados pessoais desnecessarios.
- Apenas membros autorizados do time podem ver e enviar mensagens daquele time.
- O modelo nao deve reaproveitar rotas ou tabelas de backoffice.

## Testing Strategy

### Unit tests

- normalizacao de telefone para chave de conversa
- determinacao de `Lead` vinculado por telefone
- classificacao de status de quota
- geracao de chaves de idempotencia

### Integration tests

- criacao idempotente da configuracao por time
- bloqueio de segunda conexao ativa
- listagem de conversas isolada por time
- envio manual persistindo autoria e mensagem local
- webhook inbound criando conversa e mensagem
- webhook de status atualizando mensagem existente sem duplicar
- endpoint de uso consolidando contagem do periodo

### Manual tests

- provisionar ambiente da Evolution
- cadastrar configuracao do time
- gerar e escanear QR Code
- receber primeira mensagem inbound
- responder a mensagem pelo sistema
- validar visualizacao da mesma conversa por outro membro do time
- desconectar a sessao e validar estado de erro/reconexao

## Success Criteria

- Cada time consegue conectar um unico numero via QR Code dentro da tela de configuracao.
- O status da conexao fica visivel e sincronizado no Lead Flow.
- Conversas inbound aparecem na inbox compartilhada do time.
- Mensagens outbound ficam registradas com autoria do operador.
- Conversas podem ser vinculadas a um `Lead` e consultadas no contexto operacional.
- O sistema persiste uso mensal suficiente para aplicar politica de uso justo.
- O modulo pode ser implementado sem quebrar a separacao atual entre produto principal, backoffice e billing.

## Infraestrutura Manual Opcional com Hostinger

Esta secao existe como guia operacional opcional. Ela nao altera a arquitetura do produto e nao cria dependencia tecnica da aplicacao em relacao a Hostinger.

### Quando usar Hostinger

Hostinger entra como atalho operacional quando o time quer:

- subir a Evolution rapidamente sem montar infra propria do zero
- centralizar VPS, dominio e SSL em um unico fornecedor
- operar um ambiente pequeno ou medio com controle manual

Nao deve ser tratada como obrigatoria quando:

- a equipe ja possui padrao proprio em outro provedor
- houver necessidade de observabilidade, fila, backup ou isolamento acima do que o setup inicial entrega

### O que contratar

Para o v1, a recomendacao operacional minima na Hostinger e contratar:

- um VPS Linux com acesso administrativo
- um dominio ou subdominio dedicado para a Evolution
- SSL ativo para o endpoint publico

Dependencias minimas esperadas no ambiente:

- Evolution API
- banco de dados usado pela Evolution, se exigido pela stack adotada
- Redis ou camada equivalente, se a instalacao escolhida depender de cache/fila
- Docker e Docker Compose, caso o setup seja containerizado

Como diretriz de compra:

- preferir VPS em vez de hospedagem compartilhada
- validar memoria e CPU suficientes para sessao persistente e webhooks
- prever crescimento se varios times forem compartilhar o mesmo ambiente

### Fluxo manual de contratacao e setup

1. Contratar um VPS Linux na Hostinger.
2. Configurar acesso SSH, usuario administrativo e endurecimento basico do servidor.
3. Apontar um subdominio dedicado, por exemplo `whatsapp.seudominio.com`.
4. Ativar SSL no dominio exposto para a Evolution.
5. Instalar Docker e Compose, se o setup da Evolution for containerizado.
6. Subir a Evolution API com as variaveis de ambiente necessarias.
7. Configurar persistencia de dados e reinicio automatico do servico.
8. Configurar URL publica de webhook apontando para o Lead Flow.
9. No Lead Flow, cadastrar a configuracao do time e validar geracao de QR Code.
10. Escanear o QR Code com o WhatsApp Business do numero do time.

### Configuracoes operacionais minimas

Documentar no runbook do projeto:

- URL publica da Evolution
- rota de healthcheck
- segredo do webhook
- politica de restart do servico
- estrategia de backup
- processo de renovacao ou verificacao de SSL
- procedimento de reconexao quando a sessao cair

### Responsabilidades operacionais do time

Mesmo usando Hostinger, continuam sendo responsabilidade do time do produto:

- deploy e upgrade da Evolution
- restart do servico quando necessario
- backup da persistencia
- monitoramento basico de disponibilidade
- rotacao de segredos
- validacao do endpoint de webhook
- suporte operacional quando o QR Code expirar ou a sessao cair

### Riscos e limites

- Hostinger resolve a camada de hospedagem, nao o risco de negocio inerente a uma integracao baseada em sessao do WhatsApp.
- O uso do provedor nao elimina desconexao, reautenticacao, expiracao de QR Code ou bloqueio do numero.
- O Lead Flow nao deve depender de APIs proprietarias da Hostinger para funcionar.
- Qualquer facilidade "nativa" da Hostinger deve ser tratada apenas como conveniencia de provisionamento.

## Open Questions

- [ ] O v1 exibira a inbox em rota propria dedicada ou tambem dentro do `LeadDialog` existente?
- [ ] Havera regra automatica de vinculacao de conversa por telefone unico antes da acao manual do usuario?
- [ ] O uso justo acima do limite deve apenas alertar ou tambem travar novos envios apos aprovacao comercial?
- [ ] O produto precisara registrar anexos de audio/documento no v1 ou apenas suportar texto com estrutura pronta para evolucao?

## Decisions Log

> **Q:** Qual provider sera usado no v1?
> **A:** Apenas Evolution API. A API oficial fica fora de escopo do primeiro release.

> **Q:** O numero conectado pertence a quem?
> **A:** Ao time. O v1 usa um numero por `Team`, compartilhado por membros autorizados.

> **Q:** Como a operacao de mensagens funciona no v1?
> **A:** Como caixa compartilhada, com auditoria explicita de quem enviou cada mensagem outbound.

> **Q:** O v1 ja precisa nascer comercializavel?
> **A:** Sim. A spec inclui mensalidade fixa com uso justo e persistencia de eventos para billing futuro, sem cobranca variavel automatica neste release.

> **Q:** Hostinger vira dependencia da arquitetura?
> **A:** Nao. Ela entra apenas como guia opcional de contratacao e configuracao operacional da infraestrutura.
