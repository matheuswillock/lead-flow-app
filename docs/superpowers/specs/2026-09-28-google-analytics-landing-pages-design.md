# Analytics e privacidade para Landing Pages

**Status:** design aprovado em conversa, aguardando revisão do documento  
**Data:** 2026-09-28

## Objetivo

Integrar o Google Analytics ao produto E-mail do Corretor Studio como uma funcionalidade filha obrigatória, provisionada automaticamente durante o onboarding do cliente e vinculada ao domínio público Studio.

O produto terá duas fontes complementares:

- Corretor Studio: fonte de verdade para submissões, leads, respostas, atribuição determinística, CRM e auditoria.
- Google Analytics 4: fonte de análise comportamental, aquisição, sessões, navegação e campanhas.

## Escopo e regras de produto

Analytics será uma feature filha de E-mail. O onboarding de E-mail não será concluído sem:

1. domínio de envio configurado e verificado;
2. domínio `studio.{domínio-de-envio}` provisionado e com DNS verificado;
3. propriedade GA4 criada para o time;
4. web data stream criado;
5. Measurement ID disponível;
6. dimensões customizadas e eventos-chave provisionados;
7. dados de privacidade preenchidos;
8. consentimento de cookies habilitado.

Falhas mantêm o onboarding bloqueado, mas o processo deve ser idempotente e permitir retry sem criar recursos duplicados.

Cada time terá uma propriedade GA4 exclusiva dentro da conta Google do Corretor Studio. Não haverá uma propriedade compartilhada entre clientes.

## Provisionamento e ciclo de vida

O fluxo será:

```text
Ativar E-mail
→ verificar domínio de envio
→ gerar e verificar domínio Studio
→ criar propriedade GA4
→ criar web data stream
→ criar dimensões e eventos-chave
→ ativar tracking
→ concluir onboarding
```

O backend usará uma credencial administrativa do Corretor Studio, mantida somente no servidor. Nenhum cliente precisará conectar sua própria conta Google.

Estados previstos:

```text
email_pending
sending_domain_pending
sending_dns_pending
studio_domain_pending
studio_dns_pending
analytics_provisioning
analytics_ready
onboarding_error
```

A propriedade Google não será apagada automaticamente ao desconectar. O vínculo do time será desativado e o histórico nativo do Studio será preservado.

## Modelo de dados

### Integração por time

Entidade sugerida: `TeamGoogleAnalyticsProperty`.

```text
id
teamId
googleAccountId
propertyId
dataStreamId
measurementId
hostname
status
lastSyncAt
lastError
createdAt
updatedAt
```

Restrições:

- `teamId`, `propertyId` e `hostname` devem ser únicos;
- o backend resolve a propriedade somente pelo time autenticado;
- o frontend nunca envia ou escolhe `propertyId`;
- credenciais, refresh tokens e secrets não ficam no navegador.

### Cache de relatórios

Entidade sugerida: `GoogleAnalyticsReportCache`.

```text
id
teamId
reportKey
dateRange
payload
generatedAt
expiresAt
createdAt
```

O cache será indexado por `teamId` e pela chave fixa do dashboard. Não haverá consultas livres da Data API pelo usuário.

## Coleta de eventos

Landing Pages e formulários usarão a mesma taxonomia:

```text
landing_view
form_view
form_start
form_step_view
form_field_error
form_submit
form_success
cta_click
```

Parâmetros permitidos:

```text
campaign_id
landing_page_id
public_form_id
page_type
utm_source
utm_medium
utm_campaign
utm_content
utm_term
```

Não enviar ao Google Analytics:

```text
nome, e-mail, telefone, CPF, respostas,
conteúdo de campos livres, dispatch_id e cs_el
```

`dispatch_id` e `cs_el` continuam na atribuição nativa do Studio. IDs de campanha, landing e formulário podem ser registrados como dimensões customizadas de evento. Identificadores de alta cardinalidade não devem ser usados como dimensões customizadas.

`form_success` somente será emitido depois da confirmação de submissão válida pelo backend. O evento analítico nunca criará ou atualizará leads.

## Métricas do dashboard

O módulo de Analytics terá as abas:

```text
Visão geral | Aquisição | Funil | Landing Pages | Formulários | Campanhas
```

### Visão geral

- visualizações;
- usuários;
- sessões;
- sessões engajadas;
- taxa de engajamento;
- formulários iniciados;
- submissões válidas;
- leads criados;
- taxa oficial de conversão.

### Funil

```text
Visualização
→ CTA
→ Formulário iniciado
→ Etapa avançada
→ Submissão
→ Lead criado
```

Leads criados e taxa oficial vêm do Studio. Sessões, usuários e comportamento vêm do GA4. Diferenças entre `form_success` e submissões nativas serão exibidas, não ocultadas.

### Campanhas, landing e formulário

Os dashboards permitirão filtrar por:

- campanha;
- landing page;
- formulário;
- origem;
- mídia;
- dispositivo;
- intervalo de data e hora.

O seletor terá data inicial, data final, hora inicial e hora final, além de atalhos como hoje, ontem, últimos 7 dias e últimos 30 dias. A Data API trabalha com intervalo de datas; o backend usará dimensões de hora e minuto para aplicar o recorte de horário no fuso `America/Sao_Paulo`.

## Navegação e privacidade

Landing Pages será um módulo filho de E-mail:

```text
E-mail
└── Landing pages
    ├── Páginas de conversão
    ├── Privacidade e cookies
    └── Analytics
```

### Consentimento

Toda Landing Page exibirá consentimento antes de ativar Analytics, marketing ou scripts opcionais. Cookies essenciais permanecem ativos e o formulário funciona mesmo sem consentimento analítico.

O consentimento registra versão, categorias aceitas, timestamp e hostname. As preferências poderão ser alteradas posteriormente.

### Privacidade

Cada cliente terá uma página pública:

```text
https://studio.cliente.com.br/privacidade
```

A tela autenticada de `Privacidade e cookies` permitirá configurar campos versionados:

```text
brandName
legalName
privacyContact
address
cookieCategories
enabledTrackingTools
privacyPolicyVersion
privacyPolicyUpdatedAt
```

O texto jurídico base será controlado pelo Corretor Studio. O cliente não editará livremente o conteúdo legal; poderá preencher os dados configuráveis e visualizar a versão pública.

Uma nova versão deverá manter histórico, autor, data e versão do consentimento.

## Falhas, cache e confiabilidade

- métricas nativas: leitura direta do Studio;
- métricas GA4: cache de 5 minutos para dados recentes e 30 minutos para histórico;
- falha do Google: exibir último cache válido e status da integração;
- sem cache: dashboard mostra estado de indisponibilidade, nunca dados de outro time;
- health check valida propriedade, stream, Measurement ID, dimensões, eventos e permissões;
- criação técnica concluída não implica existência imediata de dados nos relatórios.

O consentimento recusado, bloqueador de anúncios e atraso de processamento podem reduzir métricas do GA4. Isso não altera a conversão nativa do Studio.

## Fora do escopo inicial

- consultas livres da Data API;
- acesso do cliente ao Google Analytics;
- exclusão automática de propriedades Google;
- envio de dados pessoais ao Google;
- edição livre do texto jurídico;
- substituição do banco nativo de leads por GA4;
- criação de dashboards personalizados pelo cliente.

## Critérios de sucesso

- E-mail só conclui onboarding quando domínio, Studio, GA4 e privacidade estiverem prontos;
- cada time consulta somente sua propriedade GA4;
- dashboards exibem campanhas, landing pages e formulários;
- filtros de data e hora respeitam `America/Sao_Paulo`;
- submissão nativa continua sendo a conversão oficial;
- recusa de Analytics não impede preenchimento do formulário;
- nenhuma informação pessoal é enviada ao Google;
- falhas do GA4 não expõem dados de outro time nem apagam dados nativos;
- página pública de privacidade é exibida em cada domínio Studio.
