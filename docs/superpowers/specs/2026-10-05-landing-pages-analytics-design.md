# Analytics das Landing Pages — Design

## Objetivo

Medir e encaminhar ao motor de Radar o funil completo de conversão de campanhas de e-mail:

`e-mail → CTA → landing page → formulário publicado → lead no Corretor Studio`

O sistema deve identificar a campanha de origem, distinguir visitas novas e recorrentes, medir o comportamento na LP e preservar a lógica existente do formulário, incluindo cookies, pré-preenchimento, condicionais, UTMs, submissão e criação de leads.

## Decisões de produto

- Uma mesma LP pode ser usada por várias campanhas. A campanha é determinada pelos parâmetros do CTA recebido, não por um vínculo fixo na LP.
- A atribuição deve sobreviver à navegação na LP e ser copiada para a submissão e para o lead criado.
- Parâmetros aceitos: `campaign_id`, `cs_el`, `utm_source`, `utm_medium`, `utm_campaign` e demais UTMs repetíveis.
- O JSON do formulário publicado continua sendo a fonte dos campos. A LP apenas fornece os containers e estilos do template; não duplica perguntas nem regras de negócio.
- O formulário mantém o fluxo existente de pré-preenchimento por cookie/`cs_el`, respostas condicionais, progresso, UTMs, validação e criação de lead.

## Privacidade e consentimento

- O IP é capturado exclusivamente no servidor.
- O banco não armazena o IP bruto como dado analítico. Para deduplicação, será armazenada uma representação derivada, versionada e não reversível.
- Se necessário para diagnóstico de segurança, o IP bruto poderá aparecer apenas em logs técnicos com retenção curta e acesso restrito.
- A Black and White já possui popup de consentimento; o mesmo contrato visual e comportamental será implementado na Alvorá.
- Eventos comportamentais (`scroll`, cliques, foco, progresso e respostas) só serão enviados depois do consentimento de analytics.
- Sem consentimento, a LP continua funcional: atribuição mínima necessária, pré-preenchimento, envio do formulário e criação do lead permanecem ativos.
- O consentimento deve registrar versão da política, decisão, timestamp, landing, sessão e origem da campanha.

## Eventos

Cada evento terá `schemaVersion`, `eventId` idempotente, `landingPageId`, `publicationId`, `templateSlug`, `visitorSessionId`, timestamp do cliente e do servidor, atribuição da campanha e contexto técnico permitido.

Eventos da LP:

- `landing.page_view` — primeira visualização de uma sessão/publicação;
- `landing.returning_visit` — nova visita da mesma sessão identificada por cookie;
- `landing.scroll_depth` — marcos de 25%, 50%, 75% e 100%, cada um no máximo uma vez por sessão/publicação;
- `landing.cta_click` — CTA, âncora, telefone ou WhatsApp, com identificador do elemento e destino;
- `landing.form_start` — primeira interação com o formulário;
- `landing.form_step_view` — etapa exibida, quando o formulário tiver etapas;
- `landing.form_answer_change` — pergunta alterada, sem enviar valores sensíveis em texto aberto;
- `landing.form_submit_attempt` — tentativa de envio;
- `landing.form_submitted` — submissão aceita pelo endpoint;
- `landing.lead_created` — lead efetivamente criado;
- `landing.consent_updated` — alteração da decisão de consentimento.

Valores de respostas não devem ser enviados no analytics comportamental. O evento pode carregar `questionId`, tipo, posição, estado de preenchimento e hash/indicador quando necessário. A resposta completa continua somente no fluxo seguro do formulário e da submissão.

## Atribuição

No primeiro acesso, o servidor e o cliente normalizam os parâmetros do CTA. A atribuição original é preservada em cookie próprio da LP, com escopo de domínio e prazo definidos pelo produto, e também na sessão em memória/local storage quando cookies estiverem indisponíveis.

O payload de cada evento e da submissão inclui:

- `landingPageId` e publicação/versionamento;
- `campaignId`, quando presente;
- `emailLogId` derivado de `cs_el`, quando presente;
- UTMs completas;
- URL de origem/referrer, quando disponível;
- contato atribuído, sem substituir a validação do formulário.

O lead criado deve manter a mesma origem já usada pelo Corretor Studio e acrescentar a referência da LP/campanha sem sobrescrever uma atribuição válida existente.

## Arquitetura

1. O renderer público cria ou recupera `visitorSessionId` e lê o contexto da campanha.
2. O banner de consentimento decide se eventos comportamentais podem ser enfileirados no navegador.
3. Um cliente de tracking pequeno e compartilhado registra eventos com batching, idempotência e `sendBeacon` no encerramento da página.
4. Uma rota pública de ingestão valida tamanho, origem, schema, rate limit e token público da LP. Ela nunca confia no IP, campanha ou identidade enviados pelo navegador.
5. A ingestão grava/encaminha eventos de forma assíncrona por fila/outbox, aproveitando a infraestrutura existente de Radar pixel e webhooks.
6. O worker normaliza o evento, associa time/LP/publicação/campanha, registra a projeção analítica e entrega o payload ao motor de Radar pelo webhook configurado.
7. Falhas de webhook usam retry com backoff, idempotência, logs e pausa automática conforme o padrão existente de `TeamWebhookOutbox`.

Não será criado um segundo sistema paralelo de webhook. O motor deve reutilizar o contrato de eventos/outbox de webhooks existente, adicionando apenas as chaves e payloads específicos de landing analytics.

## Identidade de visitante

- `visitorSessionId` é um identificador aleatório, sem dados pessoais.
- Visitas recorrentes são deduplicadas por `landingPageId + publicationId + visitorSessionId` dentro da janela analítica.
- O lead é a identidade de negócio final; antes da submissão, eventos não devem tentar inferir uma pessoa a partir de fingerprint invasivo.
- IP derivado, user-agent normalizado, idioma, viewport e referrer são metadados limitados para diagnóstico e agregação.

## Métricas mínimas

- visitas totais;
- visitantes/sessões únicas;
- visitas recorrentes;
- visitas por campanha, disparo e LP;
- profundidade média e distribuição de rolagem;
- cliques por CTA;
- taxa de início do formulário;
- abandono por etapa/pergunta;
- respostas por pergunta sem expor o valor sensível no analytics;
- submissões aceitas;
- leads criados;
- conversão por campanha e por template;
- atraso entre visita, submissão e criação do lead.

## Tela de Analytics das LPs

Será criada uma tela de analytics das landing pages seguindo o mesmo padrão visual e de interação da tela de analytics de e-mail existente: cards de resumo, seletor de período, filtros, estados de carregamento/erro/vazio, gráficos e tabelas responsivos. A tela não altera o design público das LPs.

Filtros obrigatórios:

- período inicial e final, com presets equivalentes ao analytics de e-mail;
- campanha de e-mail, com opção de todas as campanhas;
- landing page/template;
- opcionalmente formulário publicado, quando a análise exigir recorte do formulário.

Todos os filtros devem ser aplicados no servidor e refletidos na URL para permitir compartilhamento e retorno à mesma consulta. A ausência de campanha representa tráfego direto/orgânico e não deve ser misturada silenciosamente com campanhas identificadas.

Cards principais:

- visitas totais;
- sessões únicas;
- visitas recorrentes;
- taxa de retorno;
- sessões que iniciaram o formulário;
- submissões aceitas;
- leads criados;
- conversão visita → lead;
- conversão formulário iniciado → lead.

Visualizações e tabelas:

- série temporal de visitas, sessões, inícios, submissões e leads;
- funil `visita → CTA → formulário iniciado → submissão → lead`;
- desempenho por campanha de e-mail;
- desempenho por LP/template;
- cliques por CTA e destino;
- scroll depth por marco;
- abandono por etapa e pergunta, sem exibir respostas sensíveis;
- tabela de submissões/leads com campanha, LP, sessão, timestamps e status;
- indicador de tracking degradado quando eventos foram descartados, bloqueados por consentimento ou sofreram falha de entrega.

Os dados devem respeitar os mesmos limites de acesso do time e não expor IP, cookies, tokens ou respostas completas. Exportação CSV/XLSX pode reutilizar o padrão do analytics de e-mail, mas fica condicionada à confirmação do contrato final dos dados.

### Contrato de consulta

A camada de serviço da tela receberá um único filtro tipado, no mínimo:

```ts
type LandingAnalyticsFilters = {
  from: string
  to: string
  campaignId?: string
  landingPageId?: string
  templateSlug?: "black-and-white" | "alvora"
  formId?: string
}
```

O backend deve expor resumo, série temporal, funil, campanhas, CTAs, scroll e abandono por endpoints separados ou por uma resposta agregada versionada, mantendo o padrão já usado em `CampanhasAnalyticsService`. Consultas sem dados retornam estruturas vazias estáveis, nunca erro de renderização.

## Ordem de entrega

1. Contrato de eventos, atribuição e consentimento.
2. Ingestão, deduplicação, outbox e entrega ao Radar.
3. Instrumentação dos dois templates e do formulário compartilhado.
4. Projeções/consultas agregadas para os filtros de período e campanha.
5. Tela de analytics visualmente alinhada ao analytics de e-mail.
6. Exportações e otimizações somente após validar as métricas do funil.

## Falhas e segurança

- O tracking nunca pode bloquear a renderização da LP ou o envio do formulário.
- O endpoint público deve rejeitar payloads excessivos, eventos desconhecidos, sessões inválidas e excesso de frequência.
- Eventos duplicados devem ser seguros por `eventId` e chave composta de evento/sessão.
- O webhook não deve receber IP bruto nem respostas completas do formulário.
- Logs devem mascarar cookies, tokens, autorização, IP bruto e respostas sensíveis.
- O sistema deve tolerar bloqueadores, cookies recusados, rede offline e navegação antes do carregamento completo.

## Testes e aceitação

- Unitários para normalização de campanha, consentimento, deduplicação, limites de scroll, idempotência e remoção de dados sensíveis.
- API para validação de origem/token, rate limit, payload inválido, isolamento por time/LP e enfileiramento assíncrono.
- Integração para evento → outbox → webhook Radar, retry e duplicata.
- E2E para os dois templates em desktop e 360px: consentimento, rejeição, page view, CTA, scroll, início do formulário, pré-preenchimento por `cs_el`, submissão e criação de lead.
- Verificar que analytics indisponível não impede o formulário.
- Verificar que uma LP usada por duas campanhas mantém atribuições separadas.
- Verificar que nenhum evento analítico contém IP bruto ou valor completo de resposta.

## Fora do escopo inicial

- Fingerprinting avançado de navegador.
- Gravação de sessão, replay de tela ou captura de teclado.
- Alteração das cores, tipografia ou estrutura visual dos templates.
- Novo editor de formulários dentro da LP.
- Dashboard completo de analytics; a primeira entrega prioriza ingestão, atribuição, webhook e dados confiáveis para o Radar.
