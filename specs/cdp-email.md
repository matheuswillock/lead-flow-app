# Spec: CDP V1 para e-mail

A CDP (Customer Data Platform) team-scoped sera criada como uma camada nova para unificar dados de clientes vindos do CRM, carteira, listas de contatos de e-mail e futuro WhatsApp. A primeira fase foca em e-mail: consolidar perfis, identidades, fontes, consentimentos e eventos para permitir segmentacao e personalizacao sem substituir os modulos atuais.

## Background

Hoje os dados de clientes vivem em superficies separadas:

- CRM: leads, status, atividades, reunioes, responsaveis e origem comercial.
- Carteira: clientes fechados, status de contrato, renovacao e dados do titular.
- E-mail: listas de contatos, campanhas, logs de envio e eventos de Resend.
- WhatsApp: implementacao paralela que deve se tornar uma fonte/canal da CDP depois.

Essa fragmentacao dificulta responder perguntas basicas para marketing e vendas, como quais clientes podem receber campanha, quem abriu um e-mail mas nao clicou, quem clicou e ainda nao fechou contrato, ou quais clientes da carteira estao proximos da renovacao.

A CDP resolve esse problema criando um perfil unico por cliente dentro de cada time, com identidades normalizadas, vinculos de origem, consentimento por canal e uma timeline de eventos.

## Goals

- Criar uma especificacao implementavel para uma CDP v1 focada em e-mail.
- Definir a identidade primaria v1 como `teamId + telefone normalizado + nome normalizado`.
- Usar e-mail, documento/CNPJ e IDs de origem como enriquecimento e identidades auxiliares.
- Consolidar dados de CRM, carteira e listas de e-mail em perfis CDP team-scoped.
- Registrar eventos de e-mail a partir de campanhas, logs e webhooks de analytics.
- Preparar o modelo para WhatsApp sem depender da implementacao paralela.
- Definir segmentos iniciais que possam alimentar campanhas de e-mail no futuro.

## Non-Goals

- Implementar codigo nesta etapa.
- Criar UI completa de CDP nesta fase.
- Substituir CRM, carteira, listas de contatos de e-mail ou WhatsApp como fontes operacionais.
- Tornar a CDP a fonte de verdade para edicao de lead, contrato ou contato de e-mail.
- Executar campanhas diretamente pela CDP na v1.
- Depender da entrega do modulo de WhatsApp para finalizar a CDP de e-mail.
- Criar integracao com ferramentas externas de ads, SMS ou push nesta fase.

## Design

### Technical Approach

A CDP sera uma camada backend/modelo/API separada dos dominios existentes. O fluxo futuro deve seguir a arquitetura do projeto:

```text
Route -> UseCase -> Service -> Prisma
```

Componentes previstos:

- `CustomerDataPlatformUseCase`: orquestra syncs, leitura de perfis, eventos e segmentos; retorna `Output`.
- `CustomerDataPlatformService`: aplica normalizacao, resolucao de identidade, enriquecimento, consentimento e regras de segmento.
- Repositorio CDP: concentra operacoes Prisma para perfis, identidades, links, eventos e consentimentos.
- Endpoints `/api/v1/cdp/*`: expõem sync controlado, leitura e segmentacao.

Principios:

- A resolucao primaria de perfil usa `teamId + normalizedPhone + normalizedName`.
- E-mail nao e chave primaria obrigatoria; ele e uma identidade auxiliar e um canal de comunicacao.
- Documento/CNPJ e usado como enriquecimento e apoio para deduplicacao futura.
- Syncs devem ser idempotentes, para poderem rodar novamente sem duplicar perfis, vinculos ou eventos.
- Eventos devem ser append-only sempre que possivel.
- Consentimento por canal deve bloquear segmentos de campanha quando houver unsubscribe, bounce ou complaint.
- Dados de CDP devem permanecer isolados por `teamId`.

### Data Model

Os nomes abaixo representam modelos conceituais para a implementacao futura. A implementacao deve criar migrations pelo fluxo oficial do projeto, usando `bun run db:migrate:new <migration-name>`.

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

Vinculo auditavel entre a CDP e uma entidade operacional existente.

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

Endpoints futuros devem ficar em `/api/v1/cdp/*`, usar acesso autenticado e validar autorizacao pelo time. Routes devem cuidar apenas de HTTP, sem Prisma direto.

#### Sync controlado

- `POST /api/v1/cdp/sync/crm`
  - Sincroniza leads do CRM para perfis CDP.
  - Entrada: filtros opcionais por `teamId`, periodo ou lead especifico, conforme permissao do usuario.
  - Saida: contadores de perfis criados, enriquecidos, ignorados e erros.

- `POST /api/v1/cdp/sync/portfolio`
  - Sincroniza carteira para perfis CDP.
  - Saida: contadores e detalhes de conflitos nao bloqueantes.

- `POST /api/v1/cdp/sync/email`
  - Sincroniza listas de contatos, logs e eventos de e-mail.
  - Atualiza identidades de e-mail, consentimento e timeline.

#### Leitura

- `GET /api/v1/cdp/profiles`
  - Lista perfis CDP do time.
  - Filtros: texto, canal, consentimento, origem, segmento, periodo de ultima interacao.

- `GET /api/v1/cdp/profiles/[id]`
  - Retorna perfil, identidades, fontes, consentimentos e resumo de eventos.

- `GET /api/v1/cdp/profiles/[id]/events`
  - Retorna timeline paginada de eventos.

#### Segmentos

- `GET /api/v1/cdp/segments`
  - Retorna segmentos predefinidos e contagens.

- `GET /api/v1/cdp/segments/[segment]/profiles`
  - Retorna perfis que pertencem a um segmento predefinido.

Segmentos v1:

- `email_marketable`: perfis com e-mail valido e consentimento de e-mail permitido.
- `email_blocked`: perfis bloqueados por unsubscribe, bounce ou complaint.
- `opened_not_clicked`: perfis que abriram campanha e nao clicaram.
- `clicked_not_closed`: perfis que clicaram em campanha e ainda nao estao em carteira/contrato finalizado.
- `portfolio_renewal_due`: clientes da carteira proximos da renovacao.
- `inactive_recent_campaign`: perfis sem campanha recente dentro de uma janela configuravel.

### UI/UX

Nao ha UI dedicada de CDP na v1 desta especificacao.

Quando uma etapa futura incluir UI, sera obrigatorio:

- Usar `design-system-guard` e `corretor-studio-design` antes de criar telas, modais, tabelas ou formularios.
- Consultar shadcn antes de markup customizado.
- Seguir a arquitetura frontend local de `page -> context -> service` / `page -> container -> context`.
- Rodar `design:check` alem das validacoes padrao.

### Caching And Runtime

A CDP deve priorizar consistencia e isolamento por time. Cache so deve ser considerado em leituras agregadas ou contagens de segmentos, nunca para sync ou mutacoes.

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

- Dados da CDP contem PII: nome, telefone, e-mail, documento, historico comportamental e eventos de campanha.
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
- Conferir que os modulos existentes continuam funcionando sem depender da CDP.

## Success Criteria

- A SPEC existe em `specs/cdp-email.md`.
- A SPEC define claramente a CDP como camada nova, sem substituir CRM, carteira, e-mail ou WhatsApp.
- A identidade primaria v1 esta documentada como `teamId + telefone normalizado + nome normalizado`.
- E-mail, documento/CNPJ e IDs de origem estao documentados como enriquecimento e identidades auxiliares.
- O desenho inclui modelos, APIs futuras, segmentos, edge cases, seguranca, testes e decisoes.
- A implementacao futura pode ser planejada a partir desta SPEC sem rediscutir o escopo base.

## Open Questions

- [ ] A janela padrao para "campanha recente" deve ser 30, 60 ou 90 dias?
- [ ] A carteira proxima de renovacao deve considerar qual janela inicial: 30, 45 ou 60 dias?
- [ ] O segmento `clicked_not_closed` deve considerar apenas fechamento em carteira ou tambem status finais do CRM?
- [ ] A primeira UI futura sera uma tela de perfis CDP ou apenas seletores de segmento dentro do modulo de e-mail?

## Decisions Log

> **Q:** Qual e a identidade primaria da CDP v1?
> **A:** `teamId + telefone normalizado + nome normalizado`, porque nome e telefone sao obrigatorios nos fluxos atuais e e-mail pode estar ausente.

> **Q:** O e-mail sera chave primaria do perfil?
> **A:** Nao. E-mail sera identidade auxiliar, canal de comunicacao e dado de enriquecimento.

> **Q:** A CDP substitui CRM, carteira, listas de e-mail ou WhatsApp?
> **A:** Nao. A CDP unifica e segmenta dados, mas os modulos atuais continuam como fontes operacionais.

> **Q:** A entrega de WhatsApp bloqueia a CDP de e-mail?
> **A:** Nao. O modelo fica preparado para WhatsApp, mas a v1 de e-mail deve funcionar sem essa integracao.

> **Q:** Devemos implementar codigo agora?
> **A:** Nao. Esta etapa cria a SPEC primeiro; a implementacao vem depois da revisao/aprovacao do documento.
