# Spec: Radar V1 para e-mail

O Radar team-scoped sera criada como uma camada nova para unificar dados de clientes vindos do CRM, carteira, listas de contatos de e-mail e futuro WhatsApp. A primeira fase foca em e-mail: consolidar perfis, identidades, fontes, consentimentos e eventos para permitir segmentacao e personalizacao sem substituir os modulos atuais.

## Background

Hoje os dados de clientes vivem em superficies separadas:

- CRM: leads, status, atividades, reunioes, responsaveis e origem comercial.
- Carteira: clientes fechados, status de contrato, renovacao e dados do titular.
- E-mail: listas de contatos, campanhas, logs de envio e eventos de Resend.
- WhatsApp: implementacao paralela que deve se tornar uma fonte/canal da Radar depois.

Essa fragmentacao dificulta responder perguntas basicas para marketing e vendas, como quais clientes podem receber campanha, quem abriu um e-mail mas nao clicou, quem clicou e ainda nao fechou contrato, ou quais clientes da carteira estao proximos da renovacao.

A Radar resolve esse problema criando um perfil unico por cliente dentro de cada time, com identidades normalizadas, vinculos de origem, consentimento por canal e uma timeline de eventos.

## Goals

- Criar uma especificacao implementavel para uma Radar v1 focada em e-mail.
- Definir a identidade primaria v1 como `teamId + telefone normalizado + nome normalizado`.
- Usar e-mail, documento/CNPJ e IDs de origem como enriquecimento e identidades auxiliares.
- Consolidar dados de CRM, carteira e listas de e-mail em perfis Radar team-scoped.
- Registrar eventos de e-mail a partir de campanhas, logs e webhooks de analytics.
- Preparar o modelo para WhatsApp sem depender da implementacao paralela.
- Definir segmentos iniciais que possam alimentar campanhas de e-mail no futuro.

## Non-Goals

- Implementar codigo nesta etapa.
- Criar automacoes avancadas, construtor visual livre de jornadas ou dashboards analiticos complexos nesta fase.
- Substituir CRM, carteira, listas de contatos de e-mail ou WhatsApp como fontes operacionais.
- Tornar a Radar a fonte de verdade para edicao de lead, contrato ou contato de e-mail.
- Executar campanhas diretamente pela Radar na v1.
- Depender da entrega do modulo de WhatsApp para finalizar a Radar de e-mail.
- Criar integracao com ferramentas externas de ads, SMS ou push nesta fase.

## Design

### Technical Approach

A Radar sera uma camada backend/modelo/API separada dos dominios existentes. O fluxo futuro deve seguir a arquitetura do projeto:

```text
Route -> UseCase -> Service -> Prisma
```

Componentes previstos:

- `RadarUseCase`: orquestra syncs, leitura de perfis, eventos e segmentos; retorna `Output`.
- `RadarService`: aplica normalizacao, resolucao de identidade, enriquecimento, consentimento e regras de segmento.
- Repositorio Radar: concentra operacoes Prisma para perfis, identidades, links, eventos e consentimentos.
- Endpoints `/api/v1/radar/*`: expõem sync controlado, leitura e segmentacao.

Principios:

- A Radar v1 deve permanecer no PostgreSQL/Supabase relacional do projeto, em tabelas dedicadas, sem criar um segundo banco nao relacional.
- A resolucao primaria de perfil usa `teamId + normalizedPhone + normalizedName`.
- E-mail nao e chave primaria obrigatoria; ele e uma identidade auxiliar e um canal de comunicacao.
- Documento/CNPJ e usado como enriquecimento e apoio para deduplicacao futura.
- Syncs devem ser idempotentes, para poderem rodar novamente sem duplicar perfis, vinculos ou eventos.
- Eventos devem ser append-only sempre que possivel.
- Consentimento por canal deve bloquear segmentos de campanha quando houver unsubscribe, bounce ou complaint.
- Dados de Radar devem permanecer isolados por `teamId`.

Racional de armazenamento:

- O dominio da Radar v1 e altamente relacional: perfis, identidades, fontes, eventos, consentimentos, times, leads, carteira e contatos de e-mail precisam de integridade, joins, constraints e indices compostos.
- Manter a Radar no mesmo PostgreSQL/Supabase reduz duplicacao operacional, evita sincronizacao entre dois bancos e preserva transacoes entre leitura de origem e escrita Radar.
- Campos flexiveis como `metadata`, `sourceMetadata` e payloads de evento devem usar `Json`/JSONB dentro do Postgres, em vez de justificar um banco nao relacional separado.
- Um banco nao relacional separado so deve ser reavaliado em fase futura se volume, latencia ou workloads analiticos deixarem de caber no Postgres relacional com indices, particionamento e materializacoes adequadas.

### Data Model

Os nomes abaixo representam modelos conceituais para a implementacao futura. A implementacao deve criar migrations pelo fluxo oficial do projeto, usando `bun run db:migrate:new <migration-name>`.

A implementacao deve usar tabelas relacionais dedicadas no PostgreSQL/Supabase atual. A SPEC nao recomenda criar uma base Radar separada em banco nao relacional para a v1.

#### `CustomerProfile`

Perfil unificado do cliente dentro de um time.

- `id`: UUID.
- `teamId`: UUID do time dono do perfil.
- `normalizedName`: nome normalizado usado na identidade primaria.
- `displayName`: nome exibido.
- `normalizedPhone`: telefone normalizado usado na identidade primaria.
- `displayPhone`: telefone exibido.
- `primaryEmail`: e-mail principal opcional.
- `normalizedPrimaryEmail`: e-mail normalizado opcional.
- `primaryDocument`: CPF/CNPJ/documento opcional.
- `normalizedPrimaryDocument`: documento normalizado opcional.
- `lastSeenAt`: ultima data conhecida de interacao ou enriquecimento.
- `createdAt` / `updatedAt`: auditoria.

Restricoes recomendadas:

- Unique por `teamId + normalizedPhone + normalizedName`.
- Indice por `teamId + normalizedPrimaryEmail`.
- Indice por `teamId + normalizedPrimaryDocument`.

#### `CustomerIdentity`

Identidades auxiliares vinculadas ao perfil.

- `id`: UUID.
- `profileId`: UUID do `CustomerProfile`.
- `teamId`: UUID para filtro e isolamento.
- `type`: `phone`, `email`, `document`, `lead_id`, `email_contact_id`, `portfolio_id`, `whatsapp_contact_id`.
- `value`: valor original quando aplicavel.
- `normalizedValue`: valor normalizado.
- `source`: origem que criou ou atualizou a identidade.
- `isPrimary`: indica identidade preferencial para o tipo.
- `createdAt` / `updatedAt`: auditoria.

Restricoes recomendadas:

- Unique por `teamId + type + normalizedValue`.
- Indice por `profileId + type`.

#### `CustomerSourceLink`

Vinculo auditavel entre a Radar e uma entidade operacional existente.

- `id`: UUID.
- `profileId`: UUID do `CustomerProfile`.
- `teamId`: UUID.
- `sourceType`: `crm_lead`, `portfolio`, `email_contact`, `email_campaign`, `whatsapp_contact`.
- `sourceId`: ID da entidade de origem.
- `sourceMetadata`: JSON opcional com dados nao criticos da origem.
- `firstLinkedAt`: primeira vinculacao.
- `lastSyncedAt`: ultimo sync.

Restricoes recomendadas:

- Unique por `teamId + sourceType + sourceId`.
- Indice por `profileId + sourceType`.

#### `CustomerEvent`

Timeline de eventos comportamentais e transacionais.

- `id`: UUID.
- `profileId`: UUID do `CustomerProfile`.
- `teamId`: UUID.
- `eventType`: tipo do evento.
- `sourceType`: origem do evento.
- `sourceId`: ID da entidade de origem quando existir.
- `occurredAt`: timestamp real do evento.
- `metadata`: JSON opcional.
- `createdAt`: auditoria.

Eventos v1 esperados:

- `lead.created`
- `lead.status_changed`
- `portfolio.created`
- `portfolio.renewal_due`
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`
- `email.unsubscribed`

Eventos preparados para futuro WhatsApp:

- `whatsapp.contact_created`
- `whatsapp.message_received`
- `whatsapp.message_sent`
- `whatsapp.opt_out`

Restricoes recomendadas:

- Indice por `teamId + eventType + occurredAt`.
- Indice por `profileId + occurredAt`.
- Chave idempotente por `teamId + sourceType + sourceId + eventType + occurredAt` quando a origem permitir.

#### `CustomerChannelConsent`

Estado de permissao por canal.

- `id`: UUID.
- `profileId`: UUID do `CustomerProfile`.
- `teamId`: UUID.
- `channel`: `email`, `whatsapp`.
- `status`: `allowed`, `blocked`, `unknown`.
- `reason`: `manual`, `imported`, `unsubscribe`, `bounce`, `complaint`, `opt_out`, `missing_identity`.
- `sourceType`: origem da atualizacao.
- `sourceId`: ID da origem quando existir.
- `updatedAt`: auditoria.

Restricoes recomendadas:

- Unique por `profileId + channel`.
- Indice por `teamId + channel + status`.

### API

Endpoints futuros devem ficar em `/api/v1/radar/*`, usar acesso autenticado e validar autorizacao pelo time. Routes devem cuidar apenas de HTTP, sem Prisma direto.

#### Sync controlado

- `POST /api/v1/radar/sync/crm`
  - Sincroniza leads do CRM para perfis Radar.
  - Entrada: filtros opcionais por `teamId`, periodo ou lead especifico, conforme permissao do usuario.
  - Saida: contadores de perfis criados, enriquecidos, ignorados e erros.

- `POST /api/v1/radar/sync/portfolio`
  - Sincroniza carteira para perfis Radar.
  - Saida: contadores e detalhes de conflitos nao bloqueantes.

- `POST /api/v1/radar/sync/email`
  - Sincroniza listas de contatos, logs e eventos de e-mail.
  - Atualiza identidades de e-mail, consentimento e timeline.

#### Leitura

- `GET /api/v1/radar/profiles`
  - Lista perfis Radar do time.
  - Filtros: texto, canal, consentimento, origem, segmento, periodo de ultima interacao.

- `GET /api/v1/radar/profiles/[id]`
  - Retorna perfil, identidades, fontes, consentimentos e resumo de eventos.

- `GET /api/v1/radar/profiles/[id]/events`
  - Retorna timeline paginada de eventos.

#### Segmentos

- `GET /api/v1/radar/segments`
  - Retorna segmentos predefinidos e contagens.

- `GET /api/v1/radar/segments/[segment]/profiles`
  - Retorna perfis que pertencem a um segmento predefinido.

Segmentos v1:

- `email_marketable`: perfis com e-mail valido e consentimento de e-mail permitido.
- `email_blocked`: perfis bloqueados por unsubscribe, bounce ou complaint.
- `opened_not_clicked`: perfis que abriram campanha e nao clicaram.
- `clicked_not_closed`: perfis que clicaram em campanha e ainda nao estao em carteira/contrato finalizado.
- `portfolio_renewal_due`: clientes da carteira proximos da renovacao.
- `inactive_recent_campaign`: perfis sem campanha recente dentro de uma janela configuravel.

### UI/UX

A v1 deve incluir uma UI dedicada para a Radar, focada em consulta, auditoria e uso operacional dos segmentos de e-mail. A UI nao deve substituir as telas de CRM, carteira ou e-mail; ela deve mostrar a visao unificada do cliente e permitir que o time entenda por que um perfil esta apto ou bloqueado para campanhas.

Superficie prevista:

- Rota tenant-aware em `app/[supabaseId]/radar`.
- Arquitetura local obrigatoria: `page -> context -> service` / `page -> container -> context`.
- Servico frontend dedicado consumindo `/api/v1/radar/*`.
- Tabela principal de perfis Radar com filtros por texto, canal, consentimento, origem, segmento e ultima interacao.
- Detalhe de perfil em `Sheet` ou pagina de detalhe, exibindo dados consolidados, identidades, fontes, consentimentos e timeline de eventos.
- Area de segmentos com contagens e acao para visualizar perfis de cada segmento.

#### Desenho inicial da tela

A UI inicial deve ser uma superficie operacional densa, sem hero marketing, sem orbs e sem decoracao visual. O primeiro viewport deve priorizar leitura rapida de perfis, elegibilidade de campanha e explicabilidade dos dados.

Layout desktop:

- Header compacto com titulo `Radar`, subtitulo curto `Perfis unificados para campanhas de e-mail`, badge de status do ultimo sync e acao secundaria `Sincronizar`.
- Faixa de metricas no topo com quatro cards compactos:
  - `Perfis unificados`
  - `Aptos para e-mail`
  - `Bloqueados`
  - `Com engajamento recente`
- Linha de filtros abaixo das metricas:
  - busca por nome, telefone ou e-mail;
  - filtro de segmento;
  - filtro de consentimento;
  - filtro de origem;
  - filtro de ultima interacao.
- Corpo principal em duas colunas:
  - coluna esquerda larga com tabela de perfis;
  - coluna direita fixa em desktop com painel de segmentos e contagens.
- Ao selecionar um perfil, abrir `Sheet` lateral com detalhe consolidado, identidades, fontes, consentimentos e timeline.

Layout mobile:

- Header compacto no topo.
- Metricas em grid de duas colunas.
- Filtros em `Sheet` acionado por botao.
- Lista de perfis em cards compactos no lugar da tabela.
- Detalhe do perfil em `Sheet` full-height com area interna scrollavel.

Tabela de perfis:

- Colunas desktop:
  - cliente: nome, telefone e e-mail principal quando existir;
  - consentimento: badges de e-mail e futuro WhatsApp;
  - origem: CRM, carteira, lista de e-mail e futuro WhatsApp;
  - segmento principal;
  - ultima interacao;
  - acao de abrir detalhe.
- A linha deve deixar claro por que o contato esta apto ou bloqueado para campanha.
- Contatos bloqueados por bounce, complaint ou unsubscribe devem usar badge de perigo/alerta e nao aparecer como aptos.

Painel de segmentos:

- Lista vertical de segmentos v1 com nome, descricao curta, contagem e acao `Ver perfis`.
- Segmentos obrigatorios:
  - aptos para e-mail;
  - bloqueados;
  - abriram e nao clicaram;
  - clicaram e nao fecharam;
  - carteira proxima de renovacao;
  - sem campanha recente.

Detalhe do perfil:

- Topo com nome, telefone, e-mail principal, documento quando existir e badge de elegibilidade.
- Aba `Resumo`: fontes vinculadas, ultimos eventos e dados consolidados.
- Aba `Identidades`: telefone, e-mail, documento, leadId, emailContactId, portfolioId e futuro whatsappContactId.
- Aba `Consentimentos`: status por canal, motivo, origem e data de atualizacao.
- Aba `Timeline`: eventos ordenados por `occurredAt`, com tipo, origem e metadados seguros.

Componentes shadcn previstos:

- `Table` para desktop.
- `Card` para metricas e lista mobile.
- `Badge` para status, consentimento, origem e segmento.
- `Sheet` para filtros mobile e detalhe do perfil.
- `Tabs` para secoes do detalhe.
- `Input` para busca.
- `Select` para filtros.
- `Button` para sincronizar, aplicar filtros e abrir detalhe.
- `Skeleton` para carregamento.
- `Separator` para separar grupos no detalhe.

Direcao visual:

- Superficie App/CRM com tipografia Poppins.
- Usar `bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-primary` e tokens `semantic-*`.
- Usar `semantic-success` para apto, `semantic-danger` para bloqueado, `semantic-warning` para atencao e `semantic-info` para eventos informativos.
- Usar acento primario apenas em acoes principais e foco ativo.
- Evitar gradientes, blur, orbs, sombras decorativas e cards aninhados.
- Densidade compacta: `gap-4`, cards com padding contido e cabecalhos de painel menores que headings de pagina.

Estados obrigatorios:

- Loading com `Skeleton`.
- Empty state para nenhum perfil sincronizado.
- Error state com mensagem acionavel e sem expor detalhes sensiveis.
- Badges para consentimento, origem e elegibilidade de campanha.
- Paginacao ou carregamento incremental para lista de perfis e timeline.

Regras visuais obrigatorias:

- Usar `design-system-guard` e `corretor-studio-design` antes de criar telas, modais, tabelas ou formularios.
- Consultar shadcn antes de markup customizado.
- Usar componentes shadcn existentes para `Table`, `Badge`, `Sheet`, `Tabs`, `Skeleton`, `Button`, `Input`, `Select` e `Separator` quando aplicavel.
- Seguir tokens semanticos do projeto, sem cores hardcoded.
- Rodar `design:check` alem das validacoes padrao apos qualquer implementacao visual.

### Caching And Runtime

A Radar deve priorizar consistencia e isolamento por time. Cache so deve ser considerado em leituras agregadas ou contagens de segmentos, nunca para sync ou mutacoes.

Se a implementacao futura usar cache:

- Preferir tags por `teamId` e segmento.
- Invalidar cache apos sync, evento novo ou mudanca de consentimento.
- Nao cachear dados sensiveis por usuario sem chave que inclua escopo de autorizacao.
- Tratar Runtime Cache como efemero; a fonte de verdade permanece no Postgres.

### Notion And Implementation Planning

Esta SPEC e o artefato base. Se a equipe decidir levar o trabalho ao Notion, o fluxo `notion-spec-to-implementation` deve ser usado depois desta SPEC existir, para criar plano, tarefas e acompanhamento a partir do conteudo aprovado.

## Edge Cases & Error Handling

- Dois contatos com mesmo nome e telefone no mesmo time devem resolver para o mesmo `CustomerProfile`.
- Dois times diferentes podem ter clientes com mesmo nome e telefone sem conflito.
- E-mail ausente nao deve bloquear criacao do perfil se nome e telefone existirem.
- Telefone invalido ou nome vazio deve impedir sync do registro e registrar erro nao bloqueante.
- E-mails com bounce, complaint ou unsubscribe devem bloquear o canal de e-mail sem apagar o perfil.
- Sync reexecutado nao deve duplicar perfil, identidade, link ou evento idempotente.
- Eventos de e-mail podem chegar antes do contato estar sincronizado; o sync deve criar/enriquecer o perfil quando houver dados minimos suficientes.
- Eventos duplicados do Resend devem ser tolerados sem inflar contadores de segmento.
- Dados divergentes entre CRM, carteira e lista de e-mail devem enriquecer sem sobrescrever campos primarios melhores sem regra explicita.
- WhatsApp ausente nao deve causar erro em endpoints de e-mail.

## Security & Privacy

- Dados da Radar contem PII: nome, telefone, e-mail, documento, historico comportamental e eventos de campanha.
- Toda leitura e sync deve ser isolada por `teamId`.
- Endpoints devem revalidar autorizacao em Route Handler/UseCase; middleware nao e suficiente como unica barreira.
- Logs devem evitar payload completo de clientes, listas de destinatarios, documentos, tokens e headers sensiveis.
- Migrations devem ser criadas pelo fluxo oficial do projeto, nunca manualmente com timestamp inventado.
- Tabelas em schema exposto devem usar RLS ou ter acesso Data API controlado conforme politica Supabase do projeto.
- Politicas RLS futuras nao devem usar claims editaveis de `user_metadata`.
- Consentimento por canal e obrigatorio para evitar envio de e-mail a contatos bloqueados.
- Eventos devem preservar auditoria suficiente para explicar por que um contato entrou ou saiu de um segmento.

## Testing Strategy

### Unit tests

- Normalizacao de nome, telefone, e-mail e documento.
- Resolucao primaria por `teamId + normalizedPhone + normalizedName`.
- Upsert idempotente de perfil.
- Upsert idempotente de identidade.
- Criacao de source links sem duplicidade.
- Regras de consentimento para unsubscribe, bounce e complaint.
- Regras dos segmentos v1.

### Integration tests

- Sync de lead cria perfil, identidade e source link.
- Sync de carteira enriquece perfil existente.
- Sync de lista de e-mail adiciona identidade de e-mail e consentimento.
- Evento `email.opened` cria evento e posiciona perfil no segmento correto.
- Evento `email.clicked` remove perfil de `opened_not_clicked` e inclui em `clicked_not_closed` quando aplicavel.
- Bounce/complaint bloqueia `email_marketable`.
- Reexecucao do sync nao duplica registros.
- Acesso de um time nao lista perfis de outro time.

### Manual checks

- Rodar sync de CRM em ambiente local/staging com poucos registros.
- Rodar sync de e-mail para lista com contatos ativos, bounced e unsubscribed.
- Conferir contagens de segmentos antes e depois de eventos simulados.
- Conferir que os modulos existentes continuam funcionando sem depender da Radar.

## Success Criteria

- A SPEC existe em `specs/radar-email.md`.
- A SPEC define claramente a Radar como camada nova, sem substituir CRM, carteira, e-mail ou WhatsApp.
- A identidade primaria v1 esta documentada como `teamId + telefone normalizado + nome normalizado`.
- E-mail, documento/CNPJ e IDs de origem estao documentados como enriquecimento e identidades auxiliares.
- O desenho inclui modelos, APIs futuras, segmentos, edge cases, seguranca, testes e decisoes.
- A implementacao futura pode ser planejada a partir desta SPEC sem rediscutir o escopo base.

## Open Questions

- [ ] A janela padrao para "campanha recente" deve ser 30, 60 ou 90 dias?
- [ ] A carteira proxima de renovacao deve considerar qual janela inicial: 30, 45 ou 60 dias?
- [ ] O segmento `clicked_not_closed` deve considerar apenas fechamento em carteira ou tambem status finais do CRM?
- [ ] A rota de Radar deve aparecer no menu lateral principal desde a v1 ou ficar acessivel apenas pelo modulo de e-mail ate haver uso suficiente?

## Decisions Log

> **Q:** Qual e a identidade primaria da Radar v1?
> **A:** `teamId + telefone normalizado + nome normalizado`, porque nome e telefone sao obrigatorios nos fluxos atuais e e-mail pode estar ausente.

> **Q:** O e-mail sera chave primaria do perfil?
> **A:** Nao. E-mail sera identidade auxiliar, canal de comunicacao e dado de enriquecimento.

> **Q:** A Radar substitui CRM, carteira, listas de e-mail ou WhatsApp?
> **A:** Nao. A Radar unifica e segmenta dados, mas os modulos atuais continuam como fontes operacionais.

> **Q:** A entrega de WhatsApp bloqueia a Radar de e-mail?
> **A:** Nao. O modelo fica preparado para WhatsApp, mas a v1 de e-mail deve funcionar sem essa integracao.

> **Q:** A Radar v1 deve usar um banco nao relacional separado?
> **A:** Nao. A v1 deve usar o PostgreSQL/Supabase relacional atual, com tabelas dedicadas e campos JSONB apenas para metadados flexiveis. Isso preserva integridade, joins, transacoes, RLS e reduz complexidade operacional.

> **Q:** Devemos implementar codigo agora?
> **A:** Nao. Esta etapa cria a SPEC primeiro; a implementacao vem depois da revisao/aprovacao do documento.

> **Q:** A v1 deve ter UI dedicada de Radar?
> **A:** Sim. A v1 deve incluir uma UI dedicada para consulta de perfis, segmentos, consentimentos, fontes e timeline, sem substituir CRM, carteira ou telas de e-mail.
