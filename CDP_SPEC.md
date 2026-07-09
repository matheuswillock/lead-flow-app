# CDP_SPEC.md — Spec: evolução do CDP do Corretor Studio (campos dinâmicos, identidade, segmentos e Segment)

**Data:** 2026-07-07
**Base factual:** `CDP_AUDIT.md` (leitura obrigatória antes de qualquer estágio) e `CDP_RESEARCH.md` (fundamentação das decisões).
**Premissa central:** o CDP **já existe** (`corretor_studio_cdp_*`, `CustomerDataPlatformService`, add-on `FEATURE_SLUGS.CDP`). Esta spec **evolui** a fundação existente — nenhum estágio cria um segundo CDP, um segundo event store ou uma segunda normalização.

---

## Goal

Transformar a fundação CDP existente em um CDP funcional de ponta a ponta: (1) custom fields de Lead filtráveis/ordenáveis e com RLS; (2) perfis CDP atualizados em tempo real a partir do CRM (fim do pull manual); (3) segmentos definíveis pelo usuário, avaliados em SQL, reutilizáveis em campanhas e exportação; (4) integração **Segment como Source** (identify/track para o workspace do cliente), atrás de adapter e com Write Key cifrada por Time.

## Non-goals

- **Fuzzy matching de identidade** — a resolução permanece por correspondência exata de telefone/e-mail/documento normalizados (`lib/cdp/normalization.ts`). Fuzzy é não-goal explícito desta fase (pergunta bloqueante (c) do briefing: se o negócio exigir fuzzy desde já, esta spec precisa ser revista).
- **Segment como Destination** (receber eventos de outras ferramentas) — a pesquisa (`CDP_RESEARCH.md` §2.3) indica Source-first; o adapter nasce direcional para permitir Destination no futuro, sem implementá-lo.
- **Objetos customizados** (à la Twenty) — custom fields só em `Lead`; nenhuma entidade dinâmica nova.
- **DDL em runtime / tabelas por Time / GraphQL dinâmico** — incompatível com Supabase compartilhado + Prisma estático + pipeline de migrations do projeto (`CDP_RESEARCH.md` §1.2).
- **Novo event store** — `CustomerEvent` é o store de eventos do CDP; `LeadActivity` segue como timeline do lead. Nada de terceiro store.
- **Merge de `Lead`** (dedup/merge do CRM) — continua sendo escopo dos estágios D1–D3 do `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md`, não desta spec.
- **Alterar o modelo EAV existente** de custom fields para JSONB ou colunas — decisão abaixo.

---

## Decisões arquiteturais

### D1 — Campos dinâmicos: manter o EAV existente e fechar o lado de consulta

O projeto já escolheu (e implementou) o modelo tabela de definição + tabela de valor (`LeadCustomFieldDefinition` + `LeadCustomFieldValue` com `value Json`). A pesquisa sobre o Twenty (`CDP_RESEARCH.md` §1) confirma que a alternativa "colunas reais geradas em runtime" só se justifica quando o metadata engine É o produto — o custo (DDL em runtime, locks de migration, ORM próprio) é incompatível com o stack Supabase/Prisma e com a política de migrations do `CLAUDE.md`. JSONB no `Lead` também perde para o EAV aqui: exigiria índice de expressão **por campo** para ordenação (DDL por campo — o mesmo problema disfarçado).

**Consequências práticas:**
- Filtro por campo custom = `EXISTS` sobre `LeadCustomFieldValue` por `(definitionId, value)`; ordenação = `LEFT JOIN` do value do campo escolhido. Com o cap de 30 definições ativas por time e filtros limitados a 3 campos custom simultâneos, o plano de query permanece saudável **desde que exista índice de consulta** — criado no Estágio 1.
- RLS das duas tabelas (débito de segurança, `CDP_AUDIT.md` §3.1.2) é pré-requisito de qualquer expansão — Estágio 1.

### D2 — Identidade: match exato, push inline, e correção do furo "lead sem telefone"

- A chave natural de perfil (`[teamId, normalizedPhone, normalizedName]`) e as identidades únicas por `[teamId, type, normalizedValue]` permanecem. O Estágio 3 **audita e endurece** o comportamento de `upsertIdentity` em conflito (mesmo telefone, nome divergente — risco documentado em `CDP_AUDIT.md` §3.2.2) antes de ligar qualquer envio externo.
- O sync CRM→CDP passa de pull manual para **push inline** (hooks fire-and-forget em `LeadUseCase`), espelhando o precedente do WhatsApp (`SyncWhatsappMessageToCdpUseCase`). As rotas de sync manual continuam existindo como backfill.
- Leads sem telefone válido mas com e-mail deixam de ser invisíveis ao CDP (hoje `isValidCdpPrimaryIdentity` os pula): decisão de produto embutida no Estágio 3 — perfil passa a poder nascer de e-mail (chave sintética de telefone vazio é proibida; ver prompt do estágio para a regra exata).

### D3 — Segmentos: entidade própria `TeamCdpSegment`, avaliação SQL-first

- **Não** estender `TeamFilterPreset` (avaliado e rejeitado — `CDP_AUDIT.md` §3.4.3): preset é shape de filtro de UI por tela sobre leads; segmento é audience sobre perfis CDP consumida por campanhas/exportação. Reaproveita-se o *padrão* (tabela por Time, `createdBy`, visibilidade), não a tabela.
- Os 6 segmentos hardcoded viram **segmentos de sistema** (somente leitura), coexistindo com os definíveis pelo usuário.
- O motor novo avalia regras **em SQL** (queries compostas sobre `CustomerProfile`/`CustomerEvent`/`CustomerChannelConsent`/`LeadCustomFieldValue`), matando o padrão O(N)-em-memória atual antes que segmentos dinâmicos o amplifiquem (`CDP_AUDIT.md` §3.4.2).
- DSL de regra: JSON tipado com grupos AND/OR de condições sobre um catálogo fechado de atributos (campos do perfil, campos custom do Lead vinculado, eventos com janela temporal, consentimento). Sem SQL livre do usuário.

### D4 — Segment: Source-first, adapter obrigatório, Write Key por Time

- Direção: **Source** (Corretor Studio → workspace Segment do cliente), conforme `CDP_RESEARCH.md` §2.3. `identify` no upsert de perfil CDP; `track` no append de `CustomerEvent`; `group` opcional associando o perfil ao Time. Destination fica documentado como evolução futura.
- **Adapter pattern inegociável**: interface `ICdpStreamDestination` com implementação `SegmentStreamDestination` (HTTP Tracking API, método `batch`). Nenhuma chamada à API do Segment fora do adapter — mesmo princípio do `IWhatsAppProvider`.
- Credencial: `TeamSegmentIntegrationConfig` com Write Key **cifrada por Time** (`writeKeyCipher` + `writeKeyPreview`, padrão `TeamStudioWebhookConfig`/`ENCRYPTION_KEY`). Nunca chave global.
- Entrega: **outbox + cron** (padrão assíncrono único do projeto — Vercel Cron + `CRON_SECRET`; sem fila nova). Eventos CDP elegíveis entram numa tabela de outbox e um cron os despacha em batch com retry/dead-letter simples.

### D5 — RBAC e escopo

- Tudo sob o add-on `FEATURE_SLUGS.CDP` e `getCdpAccess` (manager/master) para: gestão de segmentos, configuração do Segment, página CDP. Preenchimento de valores de custom field permanece para qualquer papel com acesso ao lead (já é assim). Definição de custom fields permanece na página de times com gate gestor (já é assim). **Nenhum featureSlug novo** — logo, nenhuma migration de `backoffice_features` é necessária.
- Isolamento por `teamId` em toda tabela nova, com RLS por membership no padrão `20260623192001_cdp-rls-policies.sql`.

---

## Restrições globais (valem para TODOS os estágios)

- `Route → UseCase → [Service] → Prisma`; UseCase novo retorna `Output` (`lib/output/index.ts`); rota thin sem Prisma direto.
- `TeamContext` resolvido uma vez via `getTeamAccess()`/`getCdpAccess()` e propagado na cadeia; nunca refazer `profile.findUnique + teamMember.findUnique`.
- Serviços com interface + implementação concreta (backend e frontend). Frontend novo no layout `features/` canônico.
- Migrations: schema via `bun run db:migrate:from-prisma -- <nome>`; RLS/seeds/manuais via `bun run db:migrate:new <nome>`; SQL idempotente; **push remoto somente com autorização do dono do projeto**.
- Componentes visuais: workflow shadcn MCP antes de qualquer markup custom; tokens semânticos do `DESIGN.md` (zero hex em JSX/TSX); `FieldGroup`/`Field` em formulários; `sonner`; `Skeleton`; Dialog com `max-h-[90vh] flex flex-col` + corpo scrollável + footer fixo; request lock em toda mutação.
- Após cada estágio: `bun run typecheck 2>&1 | head -20`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br` (+ `bun run design:check` quando houver UI) e os testes do estágio.
- **Testes obrigatórios sem exceção** — todo serviço/use case novo com teste colocalizado no padrão `lib/cdp/*.test.ts` / `app/api/services/**/**.test.ts`.
- Endpoint novo ⇒ atualizar `postman/Lead-Flow-API-Collection.json` (e `Lead-Flow-Environment.json` se necessário) no mesmo estágio.
- **Proibido tocar como efeito colateral:** enums `LeadStatus`/`ActivityType`, `TeamStatusRule*`, `TeamFilterPreset*`, qualquer tabela/rota `Backoffice*`, regiões geradas de `app/globals.css`, `agents.md` e adapters, os 6 segmentos hardcoded (até o Estágio 4 os absorver como sistema), `WhatsAppLeadActivityService`/`EmailCampaignLeadActivityService`.
- Nenhuma dependência nova em `package.json` (o Segment será chamado via `fetch` na HTTP Tracking API — sem SDK).
- Cada estágio = 1 branch + 1 PR (nunca `main`/`develop` direto), com o checklist de PR do `CLAUDE.md`.

---

## Estágio 1 — RLS + índices de consulta para custom fields (fundação, sem UI)

**Prompt Codex:**

> Leia `CDP_AUDIT.md` §3.1 e §4.1-4.2 e `CLAUDE.md` (Migration Policy). Crie uma migration manual com `bun run db:migrate:new lead-custom-fields-rls-and-query-index` contendo, em SQL idempotente: (1) `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para `corretor_studio_lead_custom_field_definitions` e `corretor_studio_lead_custom_field_values`; (2) policies select/insert/update/delete por membership de time no padrão exato de `supabase/migrations/20260623192001_cdp-rls-policies.sql` — para `definitions` o `teamId` está na própria linha; para `values` derive o time via join com `corretor_studio_leads` (`values.leadId → leads.id → leads.teamId`); (3) índice de consulta para filtros: `CREATE INDEX IF NOT EXISTS lead_custom_field_values_definition_value_idx ON corretor_studio_lead_custom_field_values ("definitionId", "value")` usando GIN em `value` se a forma composta btree+gin exigir a extensão `btree_gin` (nesse caso `CREATE EXTENSION IF NOT EXISTS btree_gin` na mesma migration) — justifique a escolha final em comentário SQL com o plano de uso (filtro por igualdade/containment e ordenação); (4) comentário SQL documentando que o acesso de aplicação é via service role (Prisma) e a RLS protege caminhos client-side/realtime futuros. Valide replay com `bun run db:migrate:reset:local`. NÃO aplique no remoto. Rode typecheck, lint, governance:check.

**Não tocar:** models Prisma (nenhuma mudança de schema.prisma — RLS/índice são manuais), dados existentes, rotas.

**Aceite:** replay local limpo e idempotente (rodar reset 2x); policies visíveis via `pg_policies` no banco local; `EXPLAIN` de um filtro `EXISTS (definitionId = X AND value = '"Y"'::jsonb)` usa o índice novo; CRUD de custom fields via Postman continua funcionando (service role não é afetado por RLS).

**Validação manual:** no Supabase Studio local, confirmar que um usuário autenticado de outro time não lê definitions/values do time A via API REST do Supabase.

---

## Estágio 2 — Custom fields filtráveis e ordenáveis no CRM e no Kanban

**Prompt Codex:**

> Leia `CDP_AUDIT.md` §3.1 e o `CDP_SPEC.md` (D1). Backend: em `app/api/infra/data/repositories/lead/` (repositório de leads existente — localize o builder de `where` das listagens do CRM e do board), adicione suporte opcional a `customFieldFilters: Array<{ definitionId: string; operator: 'eq' | 'neq' | 'contains' | 'is_empty' | 'not_empty'; value?: unknown }>` (máximo 3 por request — valide no use case) traduzido para condições `customFieldValues: { some: { definitionId, value: { equals: ... } } }` do Prisma (para `contains` em text use filtro jsonb `string_contains`; para `is_empty` use `none`), e a `customFieldSort?: { definitionId: string; direction: 'asc' | 'desc' }` — como Prisma não ordena por relação filtrada diretamente, implemente a ordenação buscando os values do campo em questão para os leads da página via segunda query e ordenando no use case somente quando `customFieldSort` estiver presente, documentando o custo no código (alternativa `$queryRaw` tipado com LEFT JOIN é aceitável se a paginação exigir ordenação no banco — escolha uma e justifique em comentário). Estenda o Zod dos endpoints de listagem usados pelo CRM e pelo board (localize as rotas que os contexts `CrmContext`/`BoardContext` consomem) de forma **aditiva e retrocompatível**. Frontend: no `CrmFiltersBar.tsx` e no header do board (`BoardHeader.tsx`/`LeadsFiltersLayout`), adicione a seção "Campos personalizados" no painel de filtros: um `Select` de definição ativa do time (reuse o fetch de definições já usado pelo formulário de lead, com dedupe de request), operador e input de valor por tipo (`Input`, `Select` de options, `Switch` para boolean, date picker do projeto para date). Os filtros custom entram no estado de filtros existente de cada tela e — onde a tela suporta presets (`TeamFilterPreset`) — são serializados dentro do `queryJson` existente sem mudança de schema (o shape do preset é opaco). Escreva testes unitários do tradutor de filtros (todos os operadores por tipo) no padrão dos testes existentes. Atualize o Postman (exemplos de listagem com `customFieldFilters`). Rode typecheck, lint, governance:check, design:check, lint:pt-br e os testes.

**Não tocar:** `TeamFilterPreset` (schema/rotas), lógica de drag do board, `LeadCustomFieldDefinition`/`Value` (schema), queries de listagem existentes quando `customFieldFilters` ausente (zero regressão de plano).

**Aceite:** filtrar o board por `select` custom "Corretora atual = X" retorna só os leads com o valor; combinação de 2 filtros custom + filtros core funciona; ordenar o CRM por campo `number` custom ordena corretamente com nulls por último; request sem filtros custom não muda a query atual (verificar por log/inspeção); presets salvam e reaplicam filtros custom; testes verdes.

**Mockup antes/depois (board com filtros custom):** *Antes:* painel de filtros do board só com status, responsável, período; campos custom aparecem apenas como texto no card. *Depois:* mesma superfície de filtros com bloco "Campos personalizados" após `Separator` — linha por filtro com `Select` do campo (ícone lucide `SlidersHorizontal`), operador compacto e input tipado, chip removível por filtro ativo na barra (badge `variant=secondary` com `X`), contador no botão de filtros em `--primary`; empty state do bloco quando o time não tem definição ativa ("Nenhum campo personalizado — crie na página do time", link laranja).

**Mockup antes/depois (construtor de campos, tela alterada):** *Antes:* card "Campos personalizados" na página do time lista label/tipo/obrigatório/ativo. *Depois:* mesma lista ganha coluna "Filtrável" com `Badge` informativo `Filtrável no CRM e no board` em `--semantic-success-surface` para todos os tipos suportados — sem toggle novo (todos os campos são filtráveis por padrão nesta fase); tooltip explica onde o filtro aparece.

---

## Estágio 3 — Sync inline CRM → CDP (fim do pull manual) + hardening de identidade

**Prompt Codex:**

> Leia `CDP_AUDIT.md` §3.2 e `CDP_SPEC.md` (D2). Parte 1 — auditoria de conflito: escreva primeiro um teste de integração em `lib/cdp/` (padrão `customer-data-platform.integration.test.ts`) cobrindo o cenário "mesmo telefone, nome divergente entre canais": sync CRM cria perfil (Maria Silva, 11988887777), depois sync WhatsApp com (Maria S., mesmo telefone). Documente no teste o comportamento real de `CdpRepository.upsertIdentity` no conflito de `@@unique([teamId, type, normalizedValue])` e ajuste o repositório para o comportamento correto: a identidade `phone` NUNCA muda de perfil silenciosamente — em conflito, o upsert de perfil deve REUSAR o perfil dono da identidade phone existente (lookup por identidade antes do upsert por chave natural) em vez de criar perfil paralelo; extraia esse lookup para `CdpRepository.findProfileByIdentity(teamId, type, normalizedValue)` e use-o em `CustomerDataPlatformService` (todos os caminhos: crm, portfolio, email, whatsapp). Parte 2 — leads sem telefone: em `syncFromCrm` e no novo caminho inline, quando `isValidCdpPrimaryIdentity` falhar mas houver e-mail válido, crie/reuse o perfil via `findProfileByIdentity(teamId, 'email', normalizedEmail)`; se não existir perfil, crie com `normalizedPhone = ''` proibido — em vez disso adicione ao model `CustomerProfile` nada (sem migration): use o telefone placeholder NUNCA; a regra é: perfil só nasce de e-mail se a chave natural puder ser `[teamId, normalizedPhone='email:'+hash, normalizedName]`? NÃO — pare: mantenha a regra simples e documentada: perfil continua exigindo telefone para NASCER; lead só-com-email registra identidade `email` + source link + eventos APENAS se um perfil com aquele e-mail já existir (via `findProfileByEmail` já existente), e caso contrário incrementa um contador novo `counters.deferred` reportado no `Output` do sync — deixando explícito quantos leads aguardam telefone. Parte 3 — push inline: crie `app/api/useCases/cdp/SyncLeadToCdpUseCase.ts` (+ interface, `Output`) que sincroniza UM lead (mesma lógica de `syncFromCrm`, escopo de 1 registro, reusando `CustomerDataPlatformService`), e chame-o fire-and-forget (`.catch(console.error)`, após persistência, 1–3 linhas por ponto) em: `LeadUseCase.createLead`, `LeadUseCase.updateLead` (dados de contato mudaram) e `LeadUseCase.updateLeadStatus` (após aplicar) — o sync inline só roda se o time tiver o add-on CDP ativo (reuse `lib/cdp/team-has-cdp-feature.ts`). Os eventos gerados devem usar as MESMAS chaves de dedupe do sync batch (`appendEventIfNew` com sourceId idêntico) para que batch e inline nunca dupliquem. Testes unitários do use case novo (idempotência inline×batch, lead sem telefone → deferred, gate de feature). Rode typecheck, lint, governance:check e os testes.

**Não tocar:** rotas `/api/v1/cdp/sync/**` (continuam como backfill), `WhatsAppLeadActivityService`/`EmailCampaignLeadActivityService`, fluxo de `Output` existente de `LeadUseCase` (o dispatch é efeito colateral isolado), `lib/cdp/normalization.ts`.

**Aceite:** criar lead com telefone gera perfil CDP imediatamente (sem sync manual); editar o e-mail do lead atualiza a identidade; mudar status gera `CustomerEvent lead.status_changed` inline; rodar o sync batch depois não duplica nada; teste do conflito telefone+nome divergente passa com um único perfil; time sem add-on CDP não executa nada; testes verdes.

**Validação manual:** com o add-on ativo, criar um lead e abrir a página CDP — o perfil aparece sem acionar "Sincronizar"; o contador `deferred` aparece no resultado do sync manual quando existem leads só-com-email.

---

## Estágio 4 — Segmentos dinâmicos (`TeamCdpSegment`) com avaliação SQL

**Prompt Codex:**

> Leia `CDP_AUDIT.md` §3.4 e `CDP_SPEC.md` (D3). Schema: adicione a `prisma/schema.prisma` o model `TeamCdpSegment` (`id uuid`, `teamId`, `createdBy`, `name`, `description?`, `rulesJson Json`, `isSystem Boolean @default(false)`, `isActive Boolean @default(true)`, timestamps; relações team/creator no padrão `TeamAutomationRule`; `@@unique([teamId, name])`, `@@index([teamId, isActive])`, `@@map("corretor_studio_cdp_segments")`). Gere a migration com `bun run db:migrate:from-prisma -- team-cdp-segments`, valide replay local, e crie migration manual `bun run db:migrate:new cdp-segments-rls` com RLS por membership no padrão das tabelas CDP. DSL de regras: crie `lib/cdp/segment-dsl.ts` com o tipo `CdpSegmentRules = { match: 'all' | 'any'; conditions: CdpSegmentCondition[] }` onde `CdpSegmentCondition` é discriminated union: `{ kind: 'profile_field'; field: 'primaryEmail' | 'primaryDocument' | 'lastSeenAt'; operator: ...}`, `{ kind: 'consent'; channel: 'email' | 'whatsapp'; status: ... }`, `{ kind: 'event'; eventType: string; presence: 'occurred' | 'not_occurred'; windowDays?: number }`, `{ kind: 'lead_custom_field'; definitionId: string; operator: 'eq' | 'neq' | 'is_empty' | 'not_empty'; value?: unknown }`, `{ kind: 'lead_status'; statuses: LeadStatus[] }` — com schema Zod exportado e testes. Motor: crie `app/api/services/cdp/CdpSegmentQueryService.ts` (+ interface) que traduz `CdpSegmentRules` para UMA query Prisma sobre `CustomerProfile` (where composto com `identities`/`events`/`consents` relacionais; para `lead_custom_field` e `lead_status` resolva o `leadId` via identidade `lead_id` com subconsulta `identities: { some: { type: 'lead_id', normalizedValue: { in: ... } } }` — se o Prisma não expressar alguma condição, use `$queryRaw` tipado e parametrizado, NUNCA interpolação de string). O serviço expõe `countProfiles(scope, rules)` e `listProfileIds(scope, rules, pagination)` — sem carregar todos os perfis em memória. Absorção dos segmentos de sistema: crie migration de dados `bun run db:migrate:new seed-cdp-system-segments` inserindo (idempotente, `ON CONFLICT (teamId,name) DO NOTHING` — na verdade como são por time, os 6 sistema NÃO são semeados por time: mantenha-os virtuais) — PARE: mantenha os 6 hardcoded como segmentos VIRTUAIS somente leitura servidos pela rota atual, sem seed; a rota de listagem passa a retornar `[...virtuais (isSystem: true), ...TeamCdpSegment do time]`. Rotas: `GET/POST app/api/v1/cdp/segments/custom/route.ts`, `PATCH/DELETE .../custom/[segmentId]/route.ts`, `GET .../custom/[segmentId]/profiles/route.ts` (paginada) — todas com `getCdpAccess()`, Zod da DSL no body, logs `[CdpCustomSegmentsRoute][MÉTODO]`. Reuso em campanhas: estenda `lib/cdp/list-segment-recipients.ts` para aceitar `custom:{segmentId}` além dos slugs fixos, resolvendo via `CdpSegmentQueryService` (a UI de campanhas que consome segmentos deve listar os dois grupos). UI: na página CDP existente (`app/[supabaseId]/cdp/features/**`), adicione a aba/seção "Segmentos": lista com `Badge` "Sistema"/"Personalizado", contagem por segmento, CTA "Novo segmento" abrindo Dialog construtor de regras (linhas de condição com `Select` de tipo de condição, campos condicionais por `kind`, toggle Todos/Qualquer no topo, preview de contagem com botão "Calcular" e request lock), editar/excluir só para personalizados (`AlertDialog` no delete). Testes: DSL (Zod), tradutor de query (cada `kind` + combinação all/any) e rota (RBAC). Atualize o Postman (pasta "CDP Segments"). Rode typecheck, lint, governance:check, design:check, lint:pt-br e os testes.

**Não tocar:** `lib/cdp/segment-config.ts`/`segment-rules.ts` (os 6 continuam funcionando como hoje), `TeamFilterPreset*`, rota existente `GET /api/v1/cdp/segments` além do merge aditivo da listagem, `CustomerDataPlatformService.countSegments` (refatorar o O(N) dos fixos é follow-up, não este estágio).

**Aceite:** criar segmento "campo custom corretora_atual = X E sem e-mail aberto em 30 dias" retorna contagem e perfis corretos comparados a uma conferência manual no banco local; segmento aparece como audience selecionável na criação de campanha e a campanha resolve os destinatários; usuário sem add-on CDP não acessa; segmentos de outro time invisíveis (RLS + rota); replay local das migrations limpo; testes verdes.

**Mockup antes/depois (tela de segmentos, nova seção na página CDP):** *Antes:* página CDP mostra apenas cards dos 6 segmentos fixos com contagem, sem qualquer criação. *Depois:* aba "Segmentos" com duas seções separadas por `Separator` — "Segmentos do sistema" (cards `--surface-2`, ícone lucide `Lock` discreto, contagem em Poppins 24px) e "Meus segmentos" (cards com menu editar/excluir); CTA laranja "Novo segmento" no header; dialog construtor com linhas de condição em `FieldGroup` (cada linha: Select do tipo com ícone — `User` p/ perfil, `MousePointerClick` p/ evento, `ShieldCheck` p/ consentimento, `ListChecks` p/ campo custom, `Kanban` p/ status), pill Todos/Qualquer no topo, rodapé com "Calcular audiência" (badge de contagem em `--semantic-success-surface`) e CTA salvar; empty state "Nenhum segmento personalizado ainda" com ícone `Users` e CTA.

---

## Estágio 5 — Integração Segment (Source): config por Time + adapter + outbox + cron

**Prompt Codex:**

> Leia `CDP_RESEARCH.md` §2 e `CDP_SPEC.md` (D4). Schema: adicione a `prisma/schema.prisma` (1) `TeamSegmentIntegrationConfig` (`id`, `teamId @unique`, `writeKeyCipher Text`, `writeKeyPreview Text`, `isEnabled Boolean @default(false)`, `identifyEnabled Boolean @default(true)`, `trackEnabled Boolean @default(true)`, `lastDispatchAt?`, `createdBy`, timestamps, relações team/creator, `@@map("corretor_studio_cdp_segment_integration_configs")`) e (2) `CdpStreamOutbox` (`id`, `teamId`, `profileId?`, `kind` enum `CdpStreamMessageKind { identify track }`, `payload Json`, `dedupeKey Text`, `status` enum `CdpStreamOutboxStatus { pending sent failed }`, `attempts Int @default(0)`, `lastError?`, `createdAt`, `sentAt?`, `@@unique([teamId, dedupeKey])`, `@@index([status, createdAt])`, `@@map("corretor_studio_cdp_stream_outbox")`). Migration via `bun run db:migrate:from-prisma -- cdp-segment-integration` + migration manual de RLS no padrão CDP. Cifra da write key: reuse o padrão de `lib/webhooks/studioWebhookSecurity.ts` (`ENCRYPTION_KEY`) extraindo/reusando helper — a chave NUNCA aparece em log, resposta de API (só `writeKeyPreview`, últimos 4 chars) ou payload de outbox. Adapter: crie `app/api/services/cdp/stream/ICdpStreamDestination.ts` com `sendBatch(messages: CdpStreamMessage[]): Promise<CdpStreamDispatchResult>` onde `CdpStreamMessage = { kind: 'identify'; userId: string; traits: Record<string, unknown> } | { kind: 'track'; userId: string; event: string; properties: Record<string, unknown>; timestamp: string }`, e `SegmentStreamDestination.ts` implementando via `fetch` para `https://api.segment.io/v1/batch` com Basic auth da write key (sem SDK novo). `userId` = `CustomerProfile.id` (estável, não expõe PII); traits do identify = displayName, email, phone, documento, lastSeenAt + entradas de `profileData`; track = eventos `CustomerEvent` com `event` legível mapeado do `eventType`. Enfileiramento: em `CustomerDataPlatformService`, após `upsertProfile` (identify) e `appendEventIfNew` retornar criação nova (track), enfileire na outbox em try/catch isolado SOMENTE se o time tiver config `isEnabled` (cache curto da config por request; `dedupeKey` = `identify:{profileId}:{updatedAt}` / `track:{eventId}`). Dispatch: `app/api/useCases/cdp/DispatchCdpStreamOutboxUseCase.ts` (+ interface, `Output`) processando pendentes em lotes de 100 por time (agrupa por time → resolve write key → `sendBatch` → marca `sent`/`failed` com `attempts += 1`; `failed` com `attempts >= 5` para de tentar), e rota cron `GET app/api/v1/cdp/cron/dispatch-stream/route.ts` no padrão Bearer `CRON_SECRET` de `app/api/v1/notifications/cron/lead-status-batch/route.ts`, agendada em `vercel.json` a cada 5 min. Config API/UI: rotas `GET/PUT/DELETE app/api/v1/cdp/integrations/segment/route.ts` (`getCdpAccess`; PUT recebe write key plena e devolve só preview; DELETE desativa e apaga cipher) + card "Segment" na página de integrações (`app/[supabaseId]/integrations/features/**`, padrão visual do `StudioWebhookIntegration.tsx`): input de write key com máscara, `Switch` habilitar, switches identify/track, status do último dispatch, botão "Enviar teste" (enfileira um identify de teste com request lock). Testes: adapter (formato batch/auth com fetch mockado), enfileiramento (gate por config, dedupe), dispatcher (retry, attempts cap, write key nunca em log — assert no payload de erro). Atualize Postman (pasta "CDP Segment Integration" + cron). Rode typecheck, lint, governance:check, design:check, lint:pt-br e os testes.

**Não tocar:** `CustomerEvent`/`CustomerProfile` (schema), fluxos existentes de sync além dos pontos de enfileiramento (1–3 linhas em try/catch), crons existentes do `vercel.json` (apenas adicionar), `lib/env/validation.ts` além de eventual flag `SEGMENT_STREAM_ENABLED` global de kill-switch (documentar em `.env.example`).

**Aceite:** configurar write key (aparece só o preview), criar lead (com Estágio 3 ativo) → outbox ganha identify+track → cron local com `CRON_SECRET` despacha e marca `sent`; write key inválida → `failed` com erro legível e sem vazamento da chave; time com config desabilitada não enfileira nada; re-execução do cron não reenvia (`dedupeKey`/status); rota de config nega operador comum e time sem add-on; testes verdes.

**Validação manual:** com um workspace Segment de teste (ou request bin), confirmar recebimento do batch com `userId` estável e traits corretos; desligar `isEnabled` e confirmar silêncio.

**Mockup antes/depois (config Segment, tela nova na página de integrações):** *Antes:* página de integrações só com o card do Webhook Studio (token inbound). *Depois:* card irmão "Segment" na mesma família visual (`--surface-2`, borda `--border`, logo substituída por ícone lucide `Waypoints` + título Poppins) — estado desconectado: parágrafo curto `text-muted-foreground` explicando "Envie perfis e eventos do CDP para o workspace Segment do seu time", input de Write Key (`Input type=password`) e CTA laranja "Conectar"; estado conectado: `Badge` verde `--semantic-success` "Ativa" + preview `••••‑ab12`, switches "Enviar perfis (identify)" / "Enviar eventos (track)", linha "Último envio há 5 min" com ícone `RefreshCw`, botões "Enviar teste" (secundário) e "Desconectar" (ghost destrutivo com `AlertDialog`).

---

## Estágio 6 — Hardening, observabilidade e documentação de contrato

**Prompt Codex:**

> Endureça a entrega dos Estágios 1–5: (1) limite de segurança na outbox — máx. 5.000 mensagens `pending` por time; excedente vira `failed` com `lastError` explicativo (proteção contra loop de enfileiramento); (2) truncamento de `payload` da outbox (traits/properties com no máximo 32 entradas e valores string ≤ 500 chars — sanitize antes de gravar); (3) métrica de defasagem: `GET /api/v1/cdp/integrations/segment/route.ts` passa a incluir `pendingCount` e `failedCount` da outbox do time, exibidos no card da UI; (4) revisão de índices com `EXPLAIN` no banco local para as três queries novas mais quentes (filtro custom no board, avaliação de segmento dinâmico, varredura da outbox pelo cron) — registre o resultado em comentários dos repositórios; (5) teste de regressão integrado em `lib/cdp/` cobrindo o fluxo ponta a ponta local: criar lead → perfil inline → segmento dinâmico o encontra → outbox enfileira → dispatcher mockado envia; (6) confirme que nenhuma rota nova ficou fora do `postman/Lead-Flow-API-Collection.json`. Rode typecheck, lint, governance:check, lint:pt-br e TODOS os testes do módulo CDP.

**Não tocar:** contratos das rotas dos estágios anteriores (apenas campos aditivos), schema (nenhuma migration nova além de índice se o item 4 provar necessidade — nesse caso via `db:migrate:new` com justificativa).

**Aceite:** todos os testes do módulo CDP verdes; card do Segment mostra pendências/falhas; caps de outbox e payload cobertos por teste; `EXPLAIN`s documentados.

---

## Ordem de execução e dependências

| Ordem | Estágio | Depende de | Justificativa |
|---|---|---|---|
| 1 | Estágio 1 (RLS + índices) | — | Débito de segurança; pré-requisito de qualquer expansão de custom fields |
| 2 | Estágio 2 (filtros custom) | 1 | Usa o índice do Estágio 1 |
| 3 | Estágio 3 (sync inline + identidade) | — | Pré-requisito de dados frescos para segmentos e Segment |
| 4 | Estágio 4 (segmentos dinâmicos) | 1, 3 | Condição `lead_custom_field` usa índice; audience confiável exige perfis frescos |
| 5 | Estágio 5 (Segment Source) | 3 | `identify`/`track` em tempo real dependem do push inline |
| 6 | Estágio 6 (hardening) | 1–5 | Fechamento |

## Critérios de sucesso (macro)

- Zero mudanças em `LeadStatus`, `ActivityType`, `TeamStatusRule*`, `TeamFilterPreset*` e módulo Backoffice ao final (verificável por diff).
- `bun run governance:check` verde em todos os PRs sem novas entradas de allowlist; nenhuma dependência nova em `package.json`.
- Todas as migrations geradas pelo CLI Supabase com replay local validado; push remoto somente com autorização explícita do dono do projeto.
- Nenhuma chamada à API do Segment fora de `SegmentStreamDestination`; write key jamais em log/resposta/outbox.
- Cobertura de teste em todo serviço/use case novo, sem exceção.

## Open questions (bloqueiam apenas o estágio indicado)

1. **(Estágio 5)** Validar com o dono do produto a necessidade real de negócio da integração Segment: o cliente final quer VER dados do Corretor Studio no workspace Segment dele (→ Source, como especificado), ou quer TRAZER dados de outras ferramentas para o Corretor Studio (→ Destination, fora desta spec)? A pesquisa aponta Source, mas é premissa de negócio (pergunta bloqueante (b) do briefing).
2. **(Estágio 3)** Leads só-com-email: a spec adota a regra conservadora (identidade adiada até existir telefone, contador `deferred` no sync). Se o produto preferir perfis nascendo de e-mail, é preciso relaxar a chave natural `[teamId, normalizedPhone, normalizedName]` — mudança de schema com migração de dados, fora deste ciclo.
3. **(Estágio 4)** Absorver os 6 segmentos fixos no motor SQL novo (aposentando `segment-rules.ts` em memória) — follow-up recomendado após o Estágio 6, quando o motor estiver batalha-testado.
