# CDP_AUDIT.md — Auditoria: estado atual do Corretor Studio frente ao estado-alvo de CDP

**Data:** 2026-07-07
**Escopo:** os 7 itens da Fase 3 do briefing de CDP, classificados como `existe` / `parcial` / `não existe`, com evidências (paths e linhas).
**Documentos pares:** `CDP_RESEARCH.md` (pesquisa externa), `CDP_SPEC.md` (estado-alvo).
**Método:** leitura de `prisma/schema.prisma`, módulos `lib/cdp/**`, `app/api/{v1/cdp,services/cdp,useCases/cdp,infra/data/repositories/cdp}/**`, migrations `supabase/migrations/**` e docs anteriores (`AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_AUDIT.md`/`_SPEC.md`). Nenhum código foi alterado.

---

## 1. Sumário executivo — a maior correção de premissa do briefing

**O Corretor Studio JÁ TEM um módulo CDP em produção.** O briefing trata o CDP como algo a construir; a auditoria encontrou uma fundação substancial construída em 2026-06 (migrations `20260623192000_cdp-core-schema.sql`, `20260623192001_cdp-rls-policies.sql`) e evoluída desde então:

- 5 tabelas: `corretor_studio_cdp_{profiles,identities,source_links,events,channel_consents}` (`prisma/schema.prisma:3190-3295`), com RLS por Time.
- Serviço de resolução de identidade com normalização testada (`app/api/services/cdp/CustomerDataPlatformService.ts`, `lib/cdp/normalization.ts` + `.test.ts`).
- 6 segmentos (hardcoded) consumidos por campanhas de e-mail (`lib/cdp/segment-config.ts`, `lib/cdp/list-segment-recipients.ts`).
- Frontend `app/[supabaseId]/cdp/` (features/ canônico) atrás do add-on `FEATURE_SLUGS.CDP` com RBAC dedicado (`app/api/v1/cdp/utils/getCdpAccess.ts`).
- Custom fields de Lead **também já existem** (estágios C1–C4 do spec `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md` já implementados), incluindo formulário público (`showOnPublicForm`, migration `20260707001452`).
- A timeline unificada write-side **já foi fechada**: `WhatsAppLeadActivityService` e `EmailCampaignLeadActivityService` existem com testes (estágios T1/T2 do mesmo spec).

O trabalho real do `CDP_SPEC.md`, portanto, **não é criar um CDP — é fechar 5 lacunas**: (1) custom fields não são filtráveis/ordenáveis; (2) tabelas de custom fields **sem RLS** (débito de segurança); (3) sync CRM→CDP é pull manual (perfis defasados); (4) segmentos não são definíveis pelo usuário; (5) integração Segment inexistente (greenfield confirmado).

---

## 2. Tabela de existência (7 itens da Fase 3)

| # | Item | Veredito | Evidência-chave |
|---|---|---|---|
| 1 | Campos dinâmicos por Time | **Parcial** | Tabelas + CRUD + form dinâmico existem; filtro/ordenação no Kanban/CRM **não**; RLS **ausente** |
| 2 | Perfil unificado (identity resolution) | **Parcial (quase existe)** | `CustomerProfile`/`CustomerIdentity` com match exato normalizado; sem merge; sync CRM pull-based |
| 3 | Timeline unificada de eventos | **Parcial (write-side fechado)** | `LeadActivity` recebe WhatsApp/E-mail; porém **dois** event stores coexistem (`LeadActivity` × `CustomerEvent`) |
| 4 | Segmentação (audiences) | **Parcial** | 6 segmentos fixos em código, avaliados em memória; sem segmentos definíveis por usuário |
| 5 | Integração Segment | **Não existe** | Zero SDK/env/adapter; único analytics é Vercel Analytics (produto, não cliente) — greenfield |
| 6 | RBAC e escopo | **Existe (com 1 furo)** | `getCdpAccess` (manager/master + add-on `cdp`); RLS nas 5 tabelas CDP; **furo**: custom fields sem RLS |
| 7 | Testes e mockups | **Existe (padrão estabelecido)** | Testes colocalizados no módulo CDP e custom fields; mockups textuais antes/depois no padrão dos specs |

---

## 3. Auditoria detalhada por item

### 3.1 Item 1 — Campos dinâmicos por Time: `parcial`

**O que existe (modelo EAV definition+value, alinhado à decisão do spec anterior):**

- Schema: `LeadCustomFieldType` (text, number, date, select, multi_select, boolean) + `LeadCustomFieldDefinition` (`@@unique([teamId, key])`, `isActive`, `displayOrder`, `isRequired`, `showOnPublicForm`) + `LeadCustomFieldValue` (`value Json`, `@@unique([leadId, definitionId])`, FK `Restrict` para definição) — `prisma/schema.prisma:1797-1845`.
- CRUD: rotas `app/api/v1/teams/[teamId]/lead-custom-fields/route.ts` e `.../[definitionId]/route.ts`; serviço `app/api/services/leadCustomField/LeadCustomFieldService.ts`.
- Escrita de valores integrada ao fluxo de lead: `LeadUseCase.ts:419-422` (validação no create), `:527-530` (upsert no update), `:2274-2278` (valores no DTO de detalhe); formulário público em `app/api/useCases/integrations/PublicLeadFormUseCase.ts`.
- UI de gestão: `app/[supabaseId]/teams/features/components/TeamLeadCustomFieldsSection.tsx`.
- Board exibe valores no card: `app/[supabaseId]/board/features/context/BoardTypes.ts:53-57` (`customFields` como dado de exibição).

**O que falta (gaps confirmados):**

1. **Filtro e ordenação**: `app/api/infra/data/repositories/lead/**` tem **zero** referência a custom fields (grep `customField|definitionId` vazio) — as queries de listagem do CRM/Kanban não sabem que custom fields existem. `BoardTypes.ts` só carrega valores para display. O requisito "filtráveis e ordenáveis no Kanban" não existe em nenhuma camada (query, preset, UI de filtro).
2. **RLS ausente**: a migration `supabase/migrations/20260706212549_lead-custom-fields.sql` cria as duas tabelas **sem** `ENABLE ROW LEVEL SECURITY` e sem policies (grep confirmado; nenhuma migration posterior cobre). Compare com o rigor de `20260623192001_cdp-rls-policies.sql`. Como o acesso hoje passa só pelo Prisma (service role), o vazamento não é explorável pela API atual, mas viola o padrão do projeto e fica exposto se algum dia essas tabelas entrarem em query client-side/realtime. **Débito de segurança a corrigir antes de qualquer expansão.**
3. **Três sistemas paralelos de "campos custom"**: além do EAV de Lead, existem `EmailContact.customFields Json` (livre, sem definição/validação — `schema.prisma:2262`) e `CustomerProfile.profileData Json` (mapa de variáveis CDP para interpolação de e-mail — `schema.prisma:3202`, populado por `syncProfileDataForTeam`). Nenhum conversa com o catálogo `CDP_FIELD_CATALOG` (`lib/cdp/field-catalog.ts`), que também **não inclui custom fields de Lead** — um campo custom não pode ser usado como variável de e-mail nem como trait de perfil hoje.

### 3.2 Item 2 — Perfil de cliente unificado: `parcial (quase existe)`

**O que existe:**

- `CustomerProfile` (chave natural `@@unique([teamId, normalizedPhone, normalizedName])`) + `CustomerIdentity` (`@@unique([teamId, type, normalizedValue])`, tipos `phone | email | document | lead_id | email_contact_id | portfolio_id | whatsapp_contact_id`) + `CustomerSourceLink` (`@@unique([teamId, sourceType, sourceId])`) — `schema.prisma:3190-3255`.
- Normalização canônica **exata** e testada: `lib/cdp/normalization.ts` (`normalizeCdpPhone` → dígitos + DDI 55, `normalizeCdpEmail`, `normalizeCdpDocument`, `normalizeCdpName`) — exatamente o "nível mínimo aceitável" que o briefing pede (match exato, sem fuzzy).
- Upsert de identidade por canal: CRM (`CustomerDataPlatformService.syncFromCrm:119-231` — phone/email/document/lead_id), Carteira (`syncFromPortfolio`), E-mail (`syncFromEmail` + `handleEmailWebhookEvent` chamado pelo webhook Resend — `ResendWebhookUseCase.ts:108`), WhatsApp (`syncWhatsappMessageToCdp`/`syncWhatsappConversationToCdp`, chamados inline por `SyncWhatsappMessageToCdpUseCase`).
- O canal Dialer, quando existir, tem encaixe natural (identidade `phone` + novo `sourceType`).

**O que falta / riscos:**

1. **Sync CRM/e-mail/carteira é pull manual**: só roda quando o usuário aciona `POST /api/v1/cdp/sync/{crm,email,portfolio}` (`CustomerDataPlatformUseCase.ts:41-60`). Criar/editar lead **não** atualiza o perfil CDP inline — perfis ficam defasados entre syncs. WhatsApp (push inline) e eventos de e-mail via webhook são as exceções. Qualquer integração Segment "identify em tempo real" exigirá fechar esse gap primeiro.
2. **Chave de perfil = telefone + nome**: a mesma pessoa com o mesmo telefone mas nome digitado diferente em dois canais ("Maria Silva" no CRM, "Maria S." no WhatsApp) tenta criar **dois perfis** — e como `CustomerIdentity` tem unique `[teamId, type, normalizedValue]` para `phone`, o segundo upsert de identidade colide com o perfil anterior. O comportamento do `upsertIdentity` nesse conflito (re-aponta o profileId ou mantém?) precisa ser verificado em `CdpRepository.upsertIdentity` no primeiro estágio da spec — é a principal fonte potencial de duplicidade/inconsistência de identidade.
3. **Sem merge**: não há fluxo de merge de `CustomerProfile` (nem de `Lead` — o item 3 do spec anterior, estágios D1–D3, ainda não foi implementado: não existe `MergeLeadsUseCase` nem `LeadDuplicateCheckService`).

### 3.3 Item 3 — Timeline unificada de eventos: `parcial (write-side fechado, dualidade pendente)`

**O que existe:**

- `ActivityType` com 7 valores (`note | call | whatsapp | email | status_change | task | studio_bot` — `schema.prisma:221-229`); `call` já reservado para o Dialer.
- **Write-side dos módulos foi fechado** (estágios T1/T2 do spec anterior implementados): `app/api/services/whatsapp/WhatsAppLeadActivityService.ts` (+ interface + teste; chamado por `ProcessEvoWebhookUseCase`, `LinkConversationToLeadUseCase`, `CreateLeadFromConversationUseCase`, `WhatsAppLeadSyncUseCase`) e `app/api/services/email/EmailCampaignLeadActivityService.ts` (+ teste), com idempotência por `payload.sourceKey`.
- Realtime de `corretor_studio_lead_activities` publicado (migration `20260524200028`, confirmado na auditoria anterior).
- Em paralelo, `CustomerEvent` (`corretor_studio_cdp_events`, dedupe `@@unique([teamId, sourceType, sourceId, eventType, occurredAt])`) acumula eventos profile-cêntricos com taxonomia própria (`lead.created`, `lead.status_changed`, `email.opened`, `whatsapp.message_received`, `portfolio.renewal_due`... — ver `EMAIL_EVENT_MAP` e chamadas de `appendEventIfNew` em `CustomerDataPlatformService`). Exposto em `GET /api/v1/cdp/profiles/[id]/events`.

**O que falta / riscos:**

1. **Dualidade estrutural permanece**: `LeadActivity` é a timeline lead-cêntrica (CRM) e `CustomerEvent` é a timeline profile-cêntrica (CDP). A auditoria anterior já alertou: **não criar um terceiro store**. Para o CDP, `CustomerEvent` é o store correto de eventos para segmentação e para o `track` do Segment — mas os eventos CRM só entram nele via sync manual (§3.2.1). Mudança de status de lead em tempo real não vira `CustomerEvent` inline hoje.
2. A timeline visual unificada (estágio T3 do spec anterior — extração do feed do `LeadDialog` para componente compartilhado) não foi confirmada como implementada; o requisito do briefing ("todo evento na mesma linha do tempo do perfil") é atendido parcialmente pela página CDP (eventos do perfil) e pelo feed do lead, separadamente.

### 3.4 Item 4 — Segmentação (audiences): `parcial`

**O que existe:**

- 6 segmentos **hardcoded**: `email_marketable`, `email_blocked`, `opened_not_clicked`, `clicked_not_closed`, `portfolio_renewal_due`, `inactive_recent_campaign` (`lib/cdp/segment-config.ts:8-15`), com regras puras testadas (`lib/cdp/segment-rules.ts` + `.test.ts`).
- Reuso real em campanhas: `lib/cdp/list-segment-recipients.ts` alimenta a seleção de destinatários de campanhas de e-mail; rotas `GET /api/v1/cdp/segments` e `GET /api/v1/cdp/segments/[segment]/profiles`.
- `TeamFilterPreset` (com `scope`/`visibility` já implementados — enums `FilterPresetScope`/`FilterPresetVisibility`, `schema.prisma:169-183`) é o conceito paralelo de "filtros salvos por tela".

**O que falta / riscos:**

1. **Usuário não define segmentos**: os 6 são fixos em código; criar "campo custom X = Y" ou "não abriu e-mail em 30 dias" como segmento reutilizável não existe.
2. **Performance O(N) em memória, com full scan duplicado**: `countSegments` carrega **todos** os perfis do time com identities/events/consents (`cdpRepository.listProfilesForSegmentation`) e avalia as regras em JS (`CustomerDataPlatformService.ts:639-673`); `listSegmentProfileIds` chama `countSegments` **e depois recarrega todos os perfis de novo** (`:675-698`) — dois full scans por listagem de segmento. Aceitável no volume atual; será o primeiro gargalo quando times tiverem dezenas de milhares de perfis, e é incompatível com segmentos dinâmicos avaliados a cada uso. A evolução precisa ser SQL-first (avaliação no banco), não mais regras em memória.
3. **Resposta à pergunta do briefing (reaproveitar `TeamFilterPreset`?):** os dois conceitos não devem se fundir. `TeamFilterPreset` guarda o shape de filtro de **uma tela** (`queryJson` opaco por escopo `crm|performance|board|carteira`) sobre **leads**; segmento CDP é uma **audience sobre perfis** consumida por campanhas/exportação. Fundir criaria acoplamento entre o shape de UI e o motor de segmentação. O que se reaproveita é o *padrão* (tabela por Time, `createdBy`, visibility) — ver decisão no `CDP_SPEC.md`.

### 3.5 Item 5 — Integração com Segment: `não existe` (greenfield confirmado)

- Grep por `segment|mixpanel|amplitude|ga4|gtag|posthog|rudderstack` em `app/`, `lib/`, `components/`, `hooks/`: todos os hits são o conceito interno "cdp segments" ou falsos positivos. Nenhum SDK de CDP externo em `package.json`, nenhuma env `SEGMENT_*` em `lib/env/validation.ts`.
- Único analytics existente é **Vercel Analytics** (telemetria do produto, não dados do cliente final) — irrelevante para o caso de uso.
- Precedentes de adapter pattern prontos para replicar: `IWhatsAppProvider`/`EvolutionWhatsAppProvider` (`app/api/services/whatsapp/provider/`) e armazenamento cifrado de credencial por Time em `TeamStudioWebhookConfig` (`tokenHash`/`tokenCipher`/`tokenPreview`, `lib/webhooks/studioWebhookSecurity.ts`).
- Precedente de decisão "config por Time" (não por manager): `EmailTeamSettings`/créditos de e-mail — o mesmo raciocínio se aplica à Write Key do Segment.

### 3.6 Item 6 — RBAC e escopo: `existe, com um furo`

- **Rotas CDP**: `getCdpAccess` (`app/api/v1/cdp/utils/getCdpAccess.ts`, com teste) = `getTeamAccess()` (resolução única de `TeamContext`, conforme governança) + `isManagerOrMaster` + verificação do add-on `FEATURE_SLUGS.CDP` via `featureAccessUseCase`. CDP é feature paga/add-on registrada em `backoffice_features`.
- **Definições de custom field**: CRUD nas rotas de team com gate de papel gestor; preenchimento de valor por qualquer papel com acesso ao lead (via `LeadUseCase` create/update) — exatamente o RBAC pedido no briefing.
- **RLS**: 5 tabelas CDP cobertas por policies por membership de time (`20260623192001_cdp-rls-policies.sql` — select/insert/update/delete via `EXISTS` em `corretor_studio_team_members`). **Furo**: `corretor_studio_lead_custom_field_{definitions,values}` sem RLS (§3.1.2).
- Isolamento entre Times: consistente — todas as tabelas CDP e de custom fields carregam `teamId` com uniques compostos por `teamId`.

### 3.7 Item 7 — Testes e mockups: `existe (padrão estabelecido)`

- Testes colocalizados no módulo CDP: `lib/cdp/normalization.test.ts`, `segment-rules.test.ts`, `field-catalog.test.ts`, `resolve-field-value.test.ts`, `enrich-campaign-recipients.test.ts`, `customer-data-platform.integration.test.ts`, `app/api/v1/cdp/utils/getCdpAccess.test.ts`; timeline: `WhatsAppLeadActivityService.test.ts`, `EmailCampaignLeadActivityService.test.ts`.
- Mockups: o padrão do projeto é mockup textual antes/depois por tela dentro do spec (ver `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md`), com tokens Warm-Precision (`--surface-*`, `--semantic-*`) do `DESIGN.md`. O `CDP_SPEC.md` segue o mesmo formato.

---

## 4. CRITIQUE — riscos além dos 7 itens

1. **EAV sem índice de consulta**: `LeadCustomFieldValue` tem índices apenas em `[leadId, definitionId]` (unique) e `[definitionId]`. Habilitar filtro no Kanban sem criar índice de consulta por valor (ex.: GIN em `value`, ou composto `(definitionId, value)` via índice de expressão) fará cada filtro custom virar scan dos values do time inteiro. O cap existente de definições por time ajuda, mas o índice é obrigatório no mesmo estágio que o filtro.
2. **RLS incompleta** (custom fields) — já detalhado em §3.1.2; corrigir via `bun run db:migrate:new` (nunca SQL Editor), no primeiro estágio da spec.
3. **Duplicidade de identidade entre canais**: o risco central apontado pelo briefing se materializa em dois pontos concretos: (a) chave de perfil telefone+nome (§3.2.2 — mesma pessoa, nomes divergentes); (b) leads sem telefone válido são **pulados** pelo sync (`isValidCdpPrimaryIdentity` retorna false → `counters.skipped`), então um lead só-com-email nunca vira perfil CDP e seus eventos de e-mail caem no vazio (`handleEmailWebhookEvent` retorna sem perfil). Segmentos e futuros `identify` do Segment herdam esses buracos — comprometem a credibilidade de qualquer relatório construído em cima.
4. **Acoplamento direto ao provider (a evitar)**: o módulo de e-mail chama o SDK da Resend diretamente em vários serviços (débito conhecido). A integração Segment **não pode** repetir isso — nasce atrás de interface (`ISegmentDestinationProvider` ou equivalente), como `IWhatsAppProvider`.
5. **Consistência eventual invisível para o usuário**: como o sync CRM→CDP é manual, a página CDP mostra contagens/segmentos que podem estar horas/dias defasados sem nenhum indicador de "última sincronização" proeminente por fonte. Ao ligar o Segment (Source), essa defasagem viraria dados errados no workspace do cliente — mais um motivo para o estágio de sync inline preceder a integração.
6. **`CustomerProfile.profileData` recalculado por full scan**: `syncProfileDataForTeam` reprocessa todos os perfis do time a cada sync de variáveis — mesmo padrão O(N) da segmentação; qualquer evolução deve evitar ampliar esse caminho.

---

## 5. Inventário de artefatos-chave (referência rápida)

| Camada | Artefato |
|---|---|
| Schema CDP | `prisma/schema.prisma:3134-3295` (enums + 5 models) |
| Schema custom fields | `prisma/schema.prisma:1797-1845` |
| Normalização | `lib/cdp/normalization.ts` (+ teste) |
| Regras de segmento | `lib/cdp/segment-config.ts`, `lib/cdp/segment-rules.ts` (+ teste) |
| Catálogo de campos p/ interpolação | `lib/cdp/field-catalog.ts`, `lib/cdp/resolve-field-value.ts` |
| Serviço | `app/api/services/cdp/CustomerDataPlatformService.ts` |
| UseCase | `app/api/useCases/cdp/CustomerDataPlatformUseCase.ts` |
| Repositório | `app/api/infra/data/repositories/cdp/CdpRepository.ts` |
| Rotas | `app/api/v1/cdp/{profiles,segments,sync,available-fields,interpolation-preview}/**` |
| RBAC | `app/api/v1/cdp/utils/getCdpAccess.ts` (+ teste); `FEATURE_SLUGS.CDP` |
| RLS CDP | `supabase/migrations/20260623192001_cdp-rls-policies.sql` |
| Migration custom fields (SEM RLS) | `supabase/migrations/20260706212549_lead-custom-fields.sql` |
| Frontend CDP | `app/[supabaseId]/cdp/features/**` |
| Timeline write-side | `app/api/services/whatsapp/WhatsAppLeadActivityService.ts`, `app/api/services/email/EmailCampaignLeadActivityService.ts` (+ testes) |
| Precedente adapter | `app/api/services/whatsapp/provider/IWhatsAppProvider.ts` |
| Precedente credencial cifrada por Time | `TeamStudioWebhookConfig` + `lib/webhooks/studioWebhookSecurity.ts` |
