# RADAR_AUDIT.md — Auditoria consolidada do módulo Radar (ex-CDP): estado atual, sub-campanhas/teto diário, inventário do rename e riscos

## Status de implementação (pós-D19 / PR #633)

**Fonte de verdade do código:** branch `cursor/radar-d10-d18-unified` — [PR #633](https://github.com/matheuswillock/lead-flow-app/pull/633).  
**Verificado em:** 2026-08-04 (leitura do **HEAD commitado** no unificado; sem afirmar `db:migrate:push` remoto).

| Estágio | Descrição | Status |
|---------|-----------|--------|
| R1–R5 | Rename CDP → Radar | ✅ Concluído |
| C1–C6 | Completude funcional (custom fields, sync inline, segmentos, UI, hardening) | ✅ Concluído — C5×DA11 corrigido (alerta não sugere mais split automático por segmento) |
| D1 | Lead.originChannel schema | ✅ Concluído |
| D2 | Unificar entrada de leads | ✅ Concluído |
| D3 | Sync Portfolio → Radar | ✅ Concluído |
| D4 | Perfil email-only | ✅ Concluído |
| D5 | Marcos de LeadStatus | ✅ Concluído |
| D6 | Condição lead_field no segmento | ✅ Concluído |
| D7 | Pixel tracking + visitor_session | ✅ Concluído |
| D8 | Bridging formulário → RadarEvent | ✅ Concluído (2026-08-04 — `SyncPublicFormMetricToRadarUseCase` + hook fire-and-forget) |
| D9 | Touchpoints — sub-aba Contatos | ✅ Concluído |
| D10 | Remover sync manual | ✅ Concluído (UI 100% event-driven; rotas `sync/*` legadas/backfill) |
| D11 | Auditoria impeccable de /radar | ✅ Concluído |
| D12 | Hardening, docs, Postman, ERD | ✅ Concluído — migration `*_radar-d12-pixel-tables-rls.sql` no repo |
| D13 | `portfolio_field` + aba Contratos | ✅ Concluído |
| D14 | Perfis titular/dependente de contrato | ✅ Concluído — migration `*_radar-d14-contract-identity-types.sql` no repo |
| D15 | Materializar segmento → lista de e-mail | ✅ Concluído |
| D16 | Export CSV/Excel | ✅ Concluído |
| D17 | Polimento de UI | ✅ Concluído |
| D18 | Ranking templates/formulários | ✅ Concluído |
| D19 | Motor de engajamento (score 0–100 + temperatura) | ✅ Concluído — schema/seed `*_radar-d19-engagement-foundation.sql`; pesos no backoffice; score inline; DSL `engagement_band`; cron backfill; UI Lead Dialog/Sheet/tabela |
| **E1–E6** | **Incidente leads fantasma / milestone inflado** (spec `specs/radar-fase-e-incidente-leads-fantasma.md`) | ✅ Código na branch `fix/radar-fase-e-leads-fantasma` — **aguardando deploy**; E6 `--apply` só após E1 em prod + OK do owner. Migration remota N/A. |

**Fase E (checklist rápido):**
- E1 — sem criar Lead em `form_viewed`/`form_started`; resolve Radar por e-mail; gate nome+telefone na criação por atribuição
- E2 — `lead.milestone.new_opportunity` só em transição real (não no nascimento)
- E3 — `mergeProfiles` recalcula score; `MergeLeads` funde perfis Radar
- E4 — touchpoints = canal × dia; CRM fora da contagem
- E5 — Resend `emailEvent` upsert idempotente
- E6 — script cleanup dry-run pronto; **não aplicar** até E1 em prod

---

**Data:** 2026-07-18 (re-verificado contra código e banco remoto nesta data)
**Documento par:** `RADAR_SPEC.md` (spec executável — rename + completude). Este audit é a **base factual única**: consolida e substitui `CDP_AUDIT.md`, `CDP_RESEARCH.md` e os documentos intermediários do ciclo.
**Método:** leitura de código, `git log`/branches, migrations e **leitura SELECT-only do banco remoto** via `DIRECT_URL`. Nenhum código foi alterado.
**Decisões de produto vigentes:** (1) a feature passa a se chamar **Radar** em todas as camadas; (2) **não haverá integração com Segment/Twilio nem com nenhuma CDP externa — fora do produto, permanente**; (3) **teto de disparo de e-mail: 2.000 e-mails por dia civil por time**, com campanhas grandes quebradas em **sub-campanhas** de até 2.000 destinatários (regras já implementadas — §3).

---

## 1. Sumário executivo

1. **O módulo já existe em produção com o nome CDP** — fundação de 2026-06 (commit `4fa23736`): 5 tabelas `corretor_studio_cdp_*` com RLS, resolução de identidade com normalização testada, 6 segmentos hardcoded consumidos por campanhas, frontend `app/[supabaseId]/cdp` atrás do add-on `FEATURE_SLUGS.CDP` com `getCdpAccess`.
2. **O rename para Radar segue 100% não iniciado** (zero "radar" no código e no banco; re-verificado 2026-07-18), assim como os gaps funcionais (§4). Nenhuma branch pendente na área.
3. **NOVO — sub-campanhas e teto diário estão em produção** (PR #437, commit `1797afb4`, migration `20260718011640`): `EmailCampaign` ganhou hierarquia parent/child + snapshot de audiência; listas com >2.000 contatos quebram em sub-campanhas com pacing por intervalo de dias; o teto de 2.000/dia é aplicado no disparo manual e no cron. **Campanhas por segmento CDP com >2.000 destinatários são rejeitadas** — segmentos não participam do split (§3.2). Isso cria novas strings "CDP" e novas regras que o rename e a completude precisam respeitar.
4. **Janela favorável para o rename:** `backoffice_features.slug='cdp'` segue `isActive=false` em produção (add-on invisível). O produto `backoffice_products.featureSlug='cdp'` está ativo; o rename de dados cobre os dois.
5. **Risco nº 1 do rename:** o valor de enum `EmailVariableValueSource.CDP` está persistido em `email_team_variables.valueSource` e replicado como literal `"CDP"` em ~25 pontos por 4 camadas **sem proteção de compilador** (§6.1).
6. **Gaps funcionais a fechar depois do rename:** (a) custom fields de Lead sem RLS (re-confirmado: 0 policies) e não filtráveis; (b) sync CRM→perfil é pull manual; (c) segmentos não definíveis pelo usuário, avaliação O(N) em memória, e **audiência de segmento limitada a 2.000 por campanha** (sem sub-campanhas); (d) frontend mínimo, sem detalhe de perfil nem gestão de segmentos.

---

## 2. Estado do módulo (fundação existente)

| Camada | O que existe | Evidência |
|---|---|---|
| Schema | 5 models (`CustomerProfile`, `CustomerIdentity`, `CustomerSourceLink`, `CustomerEvent`, `CustomerChannelConsent`) + 5 enums, mapeados para `corretor_studio_cdp_*` / `customer_*` | `prisma/schema.prisma:3529–3692` |
| Identidade | Match **exato** por telefone/e-mail/documento normalizados; chave natural `[teamId, normalizedPhone, normalizedName]`; identidades únicas por `[teamId, type, normalizedValue]` | `lib/cdp/normalization.ts` (+ teste) |
| Sync | Pull manual via `POST /api/v1/cdp/sync/{crm,email,portfolio,whatsapp}`; exceções push: WhatsApp inline e eventos de e-mail via webhook Resend | `CustomerDataPlatformUseCase.ts`; `ResendWebhookUseCase.ts` |
| Segmentos | 6 hardcoded, avaliados **em memória** com full scan de perfis; reuso real em campanhas | `lib/cdp/segment-config.ts:8–15`, `segment-rules.ts`, `list-segment-recipients.ts` |
| Interpolação de e-mail | `CDP_FIELD_CATALOG` + `profileData` materializado + variáveis `valueSource='CDP'` | `lib/cdp/field-catalog.ts`, `resolve-recipient-interpolation.ts` |
| RBAC | `getCdpAccess` = `getTeamAccess()` + manager/master + add-on; RLS nas 5 tabelas (20 policies) | `app/api/v1/cdp/utils/getCdpAccess.ts`; `20260623192001_cdp-rls-policies.sql` |
| Frontend | Página única `app/[supabaseId]/cdp` (features/ mínimo, sem `components/`) com h1 "CDP" | §5.5 |
| Custom fields de Lead | EAV completo (definição + valor `Json`), CRUD, form dinâmico e público — **sem RLS (0 policies, re-confirmado) e sem índice de consulta**; listagens do CRM/board não conhecem custom fields | migration `20260706212549`; banco remoto `relrowsecurity=false` |
| Timeline | Write-side fechado (`WhatsAppLeadActivityService`, `EmailCampaignLeadActivityService`); dualidade `LeadActivity` × `CustomerEvent` — **não criar terceiro store** | serviços com testes |

### Fundamentos de decisão preservados (digest, sem Segment)

- **EAV vs. colunas dinâmicas (Twenty) vs. JSONB:** colunas físicas por workspace via DDL em runtime só se justificam quando o metadata engine É o produto; JSONB exigiria índice de expressão por campo. **O EAV já implementado é o modelo correto — falta o lado de consulta (índice + filtros), não trocar de modelo.**
- **`TeamFilterPreset` não vira motor de segmentos:** preset é shape de filtro de UI por tela sobre *leads*; segmento é *audience sobre perfis*. Reaproveita-se o padrão, não a tabela.
- **Riscos de identidade:** (a) chave perfil = telefone+nome → nomes divergentes entre canais tendem a duplicar; endurecer `upsertIdentity` no conflito de unique antes de expandir; (b) leads sem telefone são pulados pelo sync — lead só-com-e-mail nunca vira perfil.
- **Performance:** `countSegments` e `listSegmentProfileIds` fazem full scans em memória; evolução de segmentos deve ser SQL-first. `syncProfileDataForTeam` tem o mesmo padrão O(N).
- **Merge/dedup de `Lead`** é escopo do `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md` (D1–D3) — referenciar, não duplicar.

---

## 3. NOVO — Sub-campanhas e teto diário de 2.000 e-mails (estado implementado)

Mergeado em `develop` via PR #437 (`1797afb4` "feat(email): adiciona sub-campanhas com limite de 2000 e pacing diário"); colunas confirmadas no banco remoto.

### 3.1 Mecânica

- **Constantes** em `lib/email/campaign-limits.ts`: `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB = 2000` (máx. de destinatários por sub-campanha) e `EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY = 2000` (teto por dia civil por time).
- **Schema:** `EmailCampaign` ganhou `parentCampaignId` (:2613, FK self com CASCADE), `subCampaignIndex` (:2614), `audienceContactIds uuid[]` (snapshot congelado da audiência, até 2.000 IDs de `EmailContact`), relações `parentCampaign`/`subCampaigns` (:2635–2636) e índice (:2643). Migration `20260718011640_email-campaign-sub-campaigns.sql`.
- **Split (só para listas de contatos):** lista com >2.000 contatos exige agendamento + `scheduleIntervalDays >= 1`; `chunkContactIdsForSubCampaigns` particiona em lotes de ≤2.000 e `buildSubCampaignScheduledAts` espaça os `scheduledAt` (`start + i × intervalDays`) — `lib/email/campaign-sub-campaigns.ts` (+ teste). No pico, 1 sub-campanha/dia satisfaz o teto diário.
- **Teto diário:** `wouldExceedDailyEmailCap`/`countTeamEmailsDispatchedOnCivilDay` (`lib/email/campaign-daily-dispatch-guard.ts`) somam recipients dos dispatches `sending/completed` do dia civil no timezone do master do time; aplicado no disparo manual (`EmailCampaignUseCase.ts:906`) e no disparo agendado/cron (`:1596` — ao exceder, a campanha é reagendada, não perdida).
- **Agregação na UI:** listagem soma métricas dos filhos no pai (`_count.subCampaigns`, groupBy `parentCampaignId` — `EmailCampaignUseCase.ts:214–283`); detalhe expõe `subCampaigns` ordenadas por `subCampaignIndex` (`:304–364`); wizard mostra Alert "Sub-campanhas" com contagem estimada e primeiras datas (`CampaignCreateWizard.tsx:349–353`, campo "Intervalo entre sub-campanhas (dias)" :389). Suporte: `lib/email/resolve-campaign-query-ids.ts` (resolve pai+filhos por `parentCampaignId`).

### 3.2 Interação com o módulo Radar (crítico para o spec)

- **Segmento CDP NÃO participa do split.** Campanha por segmento com >2.000 destinatários é **rejeitada** na criação e re-validada no caminho de disparo: `EmailCampaignUseCase.ts:436` e `:640` — mensagem literal "Segmentos CDP com mais de 2000 destinatários não são suportados. Use uma lista de contatos (com sub-campanhas) ou reduza o segmento". O wizard replica o aviso quando a fonte é segmento (`CampaignCreateWizard.tsx:292–295`).
- **Motivo estrutural:** o snapshot `audienceContactIds` congela **IDs de `EmailContact`**; audiência de segmento é dinâmica (resolvida por perfil no momento do disparo) e perfis Radar nem sempre têm `EmailContact` vinculado — congelar audiência de segmento é decisão de produto em aberto, não débito técnico simples.
- **Consequência para a completude:** segmentos dinâmicos (Fase C) nascem sob a mesma regra — audiência ≤2.000 por campanha, teto de 2.000/dia aplicado no disparo (já coberto pelo guard, sem trabalho novo), e o builder de segmento deve exibir a contagem com aviso quando ultrapassar o limite.

---

## 4. Estado de execução (verificado contra código, banco e branches — 2026-07-18)

| Item | Veredito | Evidência |
|---|---|---|
| Rename CDP→Radar (qualquer camada) | **Nunca iniciado** | `grep -ri 'radar'` em `app/`, `lib/`, `components/`, schema: zero; banco sem tabela/tipo/slug `radar` |
| RLS + índice p/ custom fields | **Nunca iniciado** | Banco remoto: `relrowsecurity=false`, 0 policies; sem índice `(definitionId, value)` |
| Filtros/ordenação custom no CRM/board | **Nunca iniciado** | grep `customFieldFilters\|customFieldSort`: zero |
| Sync inline CRM→perfil | **Nunca iniciado** | `LeadUseCase.ts` sem referência ao módulo |
| Segmentos dinâmicos | **Nunca iniciado** | `to_regclass('corretor_studio_cdp_segments')` → NULL |
| Frontend (abas, Sheet, builder) | **Nunca iniciado** | Página atual mínima |
| Sub-campanhas + teto diário | **✅ Implementado** (fora do módulo, mas acopla — §3) | PR #437 mergeado; colunas no banco remoto |
| Integração Segment | **Fora do produto — nunca será** | — |

---

## 5. Inventário do rename por camada (linhas re-verificadas em 2026-07-18)

### 5.1 `prisma/schema.prisma`

| Linha | Item |
|---|---|
| 2061 | `// CDP relations` + relações `customer*` no model `Team` (2062–2066) |
| 2612 | `cdpSegmentSlug` no `EmailCampaign` (vizinho de `parentCampaignId` :2613 e `subCampaignIndex` :2614 — **não tocar os campos de sub-campanha no rename**) |
| 2659 | `cdpSegmentSlug` no **`EmailCampaignDispatch`** — atenção: NÃO é `EmailContactList` |
| 3075 | `cdpFieldKey` no `EmailTeamVariable` |
| 3529 | Cabeçalho `// CDP (Customer Data Platform)` |
| ~3532–3568 | 5 enums `Customer*` → `@@map("customer_*")` |
| 3583 | **Valor** `CDP` no `enum EmailVariableValueSource` → `@@map("email_variable_value_source")` |
| 3587–3692 | 5 models `Customer*` → `@@map("corretor_studio_cdp_*")` (:3614, :3634, :3652, :3672, :3692) |

### 5.2 Banco físico (confirmado no remoto)

- **Tabelas:** `corretor_studio_cdp_{profiles,identities,source_links,events,channel_consents}`, RLS ativa, 20 policies `cdp_*_{select,insert,update,delete}`.
- **Enums:** `customer_{identity_type,source_type,channel,consent_status,consent_reason}`, `email_variable_value_source` (PascalCase antigo já dropado).
- **Colunas cdp:** `email_campaigns.cdpSegmentSlug`, `email_campaign_dispatches.cdpSegmentSlug`, `email_team_variables.cdpFieldKey`.
- ⚠️ **Índices duplicados:** dois conjuntos por tabela (era Prisma, ex. `..._teamId_type_normalizedValue_key` × era Supabase, ex. `..._team_type_value_key`; `_events`: `..._idempotent_key` × `..._teamId_sourceType_sourceId_event_key`). `ALTER TABLE RENAME` não renomeia índices/constraints — renomear cada um explicitamente, nos dois conjuntos, incluindo `corretor_studio_cdp_profiles_team_profile_data_idx`.
- **Dados:** `backoffice_features` slug `'cdp'` (`isActive=false`, `betaEnabled=true`); `backoffice_products` featureSlug `'cdp'` (`isActive=true`, `isDefault=true`). FKs de rules por uuid.
- **Migrations históricas** (`20260623*`, `20260630153815`, `20260701021903`): imutáveis; rename usa migrations novas.

### 5.3 Backend

**Rotas `app/api/v1/cdp/**` (11) + `utils/getCdpAccess.ts`** (`CdpAccessResult` :12, `getCdpAccess` :16, `teamContextFromCdpAccess` :60, `FEATURE_SLUGS.CDP` :50) + teste — inalterado desde a auditoria anterior: `profiles`, `profiles/[id]`, `profiles/[id]/events`, `segments`, `segments/[segment]/profiles`, `sync/{crm,email,portfolio,whatsapp}`, `available-fields`, `interpolation-preview`.

**Núcleo:** `services/cdp/CustomerDataPlatformService.ts` (classe :119, singleton :894 — ⚠️ sem interface `I*`); `useCases/cdp/CustomerDataPlatformUseCase.ts` (`CdpListProfilesInput` :21, singleton :189); `repositories/cdp/CdpRepository.ts` (classe :83, singleton :651; literais `valueSource: "CDP"` :550 e :645); `useCases/whatsapp/SyncWhatsappMessageToCdpUseCase.ts` (msg :18).

**Consumidores (linhas atualizadas onde mudou):**

| Arquivo | Linhas | Uso |
|---|---|---|
| `EmailCampaignUseCase.ts` | 21–22, 31, **55** (`NO_RECIPIENTS_CDP`), 65, 129–132, 181, 248, 280, 336, 390–397 ("Selecione...", "Use apenas...", "Segmento CDP inválido"), 426–429, **436 e 640** (rejeição ">2000 — Segmentos CDP...") | segmentos/enrich/validações + **novas mensagens de sub-campanha com "CDP"** |
| `EmailTemplateUseCase.ts` | 9, 564 | enrich |
| `EmailTeamVariablesUseCase.ts` | 9, 47, 51, 60, 149, 154, 197, 223 | union `"STATIC" \| "CDP"` + `cdpFieldKey` |
| `ResendWebhookUseCase.ts` | 14, 117–118 | serviço + log |
| `ProcessEvoWebhookUseCase.ts` | 26, 325, 331–332 | sync inline WhatsApp |
| `SyncWhatsAppHistoryUseCase.ts` | 4, 19–20 | backfill |
| `EmailCampaignRecipientService.ts` (+ `I*` :27) | 21–22, 77, 88–89, 98 | destinatários por segmento |
| `EmailOrphanEventService.ts` | 10, 80, 92–93 | side effects |
| `LeadDuplicateCheckService.ts` | 1, 20, 27, 43–44 | só normalização |
| `EmailAnalyticsRepository.ts` | 17, 119 | DTO/select |
| Rotas de variáveis (`variables/route.ts`, `[variableId]/route.ts`) | 15 | Zod `z.enum(["STATIC", "CDP"])` |
| `lib/lead-activities/resolveLeadIdFromRecipientEmail.ts` | 1–3, 9, 12 | repo + normalização |

**Testes com referências:** `EmailAnalyticsUseCase.test.ts`, `EmailCampaignUseCase.test.ts`, `ResendWebhookUseCase.test.ts`, `getCdpAccess.test.ts`, `lib/email/email-orphan-event-service.test.ts` (+ `lib/email/campaign-sub-campaigns.test.ts` — sem "cdp", mas cobre as regras de split que o Radar deve respeitar).

### 5.4 `lib/cdp/**` — 10 runtime + 6 testes

Inventário de exports inalterado desde a auditoria anterior: `normalization.ts` (`normalizeCdp*`, `isValidCdpPrimaryIdentity`), `segment-config.ts` (`CDP_SEGMENT_SLUGS`, `CdpSegmentSlug`, `isCdpSegmentSlug`), `segment-rules.ts`, `field-catalog.ts` (`CDP_FIELD_CATALOG` etc.), `resolve-field-value.ts` (`CdpResolvable*`), `list-segment-recipients.ts`, `team-has-cdp-feature.ts` (literal `"cdp"` de product slug :5), `enrich-campaign-recipients.ts`, `resolve-recipient-interpolation.ts` (`CdpEmailVariableConfig`), `sync-filters.ts` (`CdpSyncFilters`); teste de integração `customer-data-platform.integration.test.ts` (gate `CDP_INTEGRATION_TEST=1`).
**Consumidores fora do módulo:** `lib/whatsapp/contact-name.ts:2`, `whatsappDisplay.ts:1`, `NewConversationDialog.tsx:22,56`, `LeadDuplicateCheckService`, `resolveLeadIdFromRecipientEmail.ts`.

### 5.5 Frontend

```text
app/[supabaseId]/cdp/  →  page.tsx · loading.tsx · features/{container/CdpContainer.tsx (h1 "CDP" :168),
  context/{CdpContext.tsx, CdpTypes.ts, useCdpHook.ts}, services/{ICdpService.ts, CdpService.ts}}
```

Cross-feature: `CampanhasHook.ts:17` importa `cdpService`. Estado do wizard: `wizardRecipientSource: "contact_list" | "cdp_segment"` e `wizardCdpSegmentSlug` (`CampanhasHook.ts:45–46, 83–84, 90, 127–128, 134, 463, 476–482, 496–508, 536, 695, 701, 726`; `CampanhasTypes.ts:43, 75 (`CdpSegmentOption`), 109, 145–146, 152`).

**Copy visível com "CDP" (inclui as novas strings de sub-campanha):**

| Arquivo:linha | Texto |
|---|---|
| `components/app-sidebar.tsx:138` | Nav `title: "CDP"`, url `/cdp`, `featureSlug: FEATURE_SLUGS.CDP` |
| `CdpContainer.tsx:168` | `<h1>CDP</h1>` |
| `CampaignCreateWizard.tsx:217` | `<SelectItem value="cdp_segment">Segmento CDP</SelectItem>` |
| `CampaignCreateWizard.tsx:251` | `<FieldLabel>Segmento CDP *</FieldLabel>` |
| `CampaignCreateWizard.tsx:258` | `aria-label="O que é segmento CDP?"` |
| `CampaignCreateWizard.tsx:292–295` | **NOVO** — aviso "Segmentos CDP com mais de 2.000 destinatários..." no wizard |
| `CampaignDetailSheet.tsx:47, 49` | **NOVO** — `Segmento CDP: ${campaign.cdpSegmentSlug}` |
| `CampaignLogsTab.tsx:75` | **NOVO** — `Segmento CDP: ${log.dispatch.cdpSegmentSlug}` |
| `DispatchAccordionTable.tsx:121–122` | `Segmento CDP: ...` |
| `GlobalVariablesCard.tsx` (13 hits) | SelectItem `value="CDP"` ("CDP (por destinatário)") :289, "Campo da CDP" :298, Badge :397, condições/fallbacks |
| `VariablesPanel.tsx:44, 284, 291` | union/condições `"CDP"` |
| `EmailCampaignUseCase.ts:55, 391, 394, 397, 436, 640` | Mensagens de Output — inclui as **novas** rejeições de sub-campanha "Segmentos CDP com mais de 2000..." |
| `SyncWhatsappMessageToCdpUseCase.ts:18` | "Erro ao sincronizar mensagem com CDP" |
| `prisma/seed-backoffice-products.ts:104–106, 175, 390, 566–583` + linhas persistidas de `backoffice_*` | Nome/descrição "CDP" (código + **dados**) |

### 5.6 RBAC / slugs / rotas literais

- `lib/features/feature-slugs.ts:25` → `CDP: "cdp"`; `feature-product-slug-map.ts:26` → `[FEATURE_SLUGS.CDP]: "cdp"`; `feature-route-access.ts:24` → `"/cdp"`; **`lib/proxy/route-access.ts:48`** → `"/cdp"` (linha mudou; o "middleware" do projeto é `proxy.ts` na raiz, com `redirectWithSession` — local do futuro redirect; testes: `proxy.test.ts`, `route-access.test.ts`).
- Sem `.eq('slug','cdp')` via Supabase client.

### 5.7 Postman, package.json, vercel.json, docs

- **Postman:** pasta "CDP" com 8 requests (`/api/v1/cdp/...`, var `{{cdpProfileId}}`). Débitos: 3 rotas fora da collection (`profiles/[id]`, `[id]/events`, `segments/[segment]/profiles`); `cdpProfileId` indefinida no Environment.
- **`package.json`:** script `test` inclui `lib/cdp`; `test:integration` usa `CDP_INTEGRATION_TEST=1`.
- **`vercel.json`:** nenhum cron do módulo.
- **Docs vivos:** `SPEC.md` → `specs/cdp-email.md`; `project-context.instructions.md` **não menciona o módulo**; `prisma/erd/diagram.md` é gerado (`prisma-erd-generator`). Históricos intactos: `docs/audits/**`, `.impeccable/**`, `Resumo.md`, `EMAIL_*`, `AUTOMATION_*`. Falsos positivos: `bun.lock`, SVGs, `Asaas Collection...json`.

---

## 6. Dependências cruzadas de risco

### 6.1 Valor de enum `'CDP'` (risco nº 1)

Tipo Postgres `email_variable_value_source` + linhas persistidas de `email_team_variables.valueSource` + literais `"CDP"`:

| Camada | Arquivo:linhas |
|---|---|
| Repositório | `CdpRepository.ts:550, 645` |
| UseCase | `EmailTeamVariablesUseCase.ts:9, 47, 51, 60, 149, 154, 197, 223` |
| Zod | rotas de variáveis `:15` (×2) |
| Frontend | `EmailSettingsTypes.ts:57, 67`; `IEmailSettingsService.ts:22`; `GlobalVariablesCard.tsx` (13 hits); `VariablesPanel.tsx:44, 284, 291` |

`ALTER TYPE ... RENAME VALUE` acompanha as linhas automaticamente, mas **os frontends redeclaram a union localmente** — literal esquecido passa no typecheck e quebra em runtime.

### 6.2 Outros acoplamentos

1. **`cdpSegmentSlug` é contrato + dado persistido** em `email_campaigns` e no snapshot imutável `email_campaign_dispatches`; DTOs em `EmailAnalyticsRepository.ts:17,119`, `AnalyticsTypes.ts:34`, `CampanhasTypes.ts:43,109`.
2. **Discriminante `"cdp_segment"`** do wizard (`CampaignCreateWizard.tsx:95, 207, 217, 292, 315, 333` + `CampanhasHook`/`CampanhasTypes` §5.5) — renomear em conjunto com a copy.
3. **Grafo slug+URL atômico:** `FEATURE_SLUGS.CDP` + product slug + `"/cdp"` (2 mapas + sidebar) + pasta do frontend + migration de dados (`UPDATE ... WHERE slug='cdp'` em features E products).
4. **Rename físico sem período de compatibilidade:** fluxos que rodam para todos os times (interpolação de e-mail, sync WhatsApp, webhook Resend) quebram entre migration e deploy — janela coordenada obrigatória; plano B = views temporárias.
5. **NOVO — acoplamento com sub-campanhas:** as mensagens de rejeição ">2000" (`EmailCampaignUseCase.ts:436, 640`) e o aviso do wizard (`:292–295`) citam "CDP" e "sub-campanhas" na mesma frase — o rename precisa reescrevê-las como "Segmentos Radar..." sem alterar a regra; e a completude (segmentos dinâmicos) herda a regra: **audiência de segmento ≤ `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` por campanha; teto de `EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY` aplicado no disparo por `wouldExceedDailyEmailCap`** — nenhum caminho novo de disparo pode contornar o guard.
6. **`prisma/erd/diagram.md`** regenerar; **URL** `/cdp` precisa de redirect permanente no `proxy.ts`.

---

## 7. Baseline para a Fase D (cobertura total de canais, origem e engajamento)

Achados confirmados diretamente no código de `develop` (pós C1–C6), usados como ponto de partida da Fase D (`RADAR_SPEC.md`):

### 7.1 Sync inline já cobre CRM, WhatsApp e E-mail — os gaps reais são Portfolio e EmailContact sem Lead

Contrário a uma suposição inicial de que "nada sincroniza por evento fora do CRM", confirmado que:

- **CRM:** `syncLeadToRadarInline` (`LeadUseCase.ts:2317`) roda fire-and-forget em `createLead`/`updateLead`/`updateLeadStatus`, gated por `teamHasRadarFeature`.
- **WhatsApp:** `syncWhatsappMessageToRadarUseCase.execute(...)` é chamado a partir do webhook real da Evolution (`ProcessEvoWebhookUseCase.ts:314`), não só do scan em lote.
- **E-mail:** `handleEmailWebhookEvent` é chamado a partir do webhook real do Resend (`ResendWebhookUseCase.ts:107`).

Os **gaps reais** que a Fase D fecha (D3/D4):

- **Portfolio:** `syncFromPortfolio` só é alcançável via rota de sync manual/batch (`RadarUseCase.ts:68`) — nenhum hook inline em `PortfolioUseCase`.
- **EmailContact sem Lead correspondente:** além de não ter hook inline em `EmailContactListUseCase.addContact`, há uma barreira de **schema** (§7.2 abaixo) que impede o perfil de nascer só a partir de um e-mail.

### 7.2 Bloqueio de schema: `RadarProfile.normalizedPhone`/`displayPhone` são `String` NOT NULL

Em `prisma/schema.prisma`, o model `RadarProfile` declara `normalizedPhone String` e `displayPhone String` sem `?` — todo perfil hoje **exige** um telefone válido para existir (consistente com a decisão DA8/C3 de que "perfil continua exigindo telefone para nascer"). Isso bloqueia, por construção, qualquer perfil "email-only" (contato de e-mail sem Lead correspondente, ou lead capturado só por formulário/pixel sem telefone). A Fase D (D4) relaxa esses dois campos para `String?`, mantendo a unique `[teamId, normalizedPhone, normalizedName]` (que convive com múltiplos `NULL` em Postgres) e introduzindo `resolveProfileForEmail` como espelho de `resolveProfileForPhone`.

### 7.3 `RadarSyncFilters` não tem filtro por portfólio/contato

`lib/radar/sync-filters.ts` define hoje:

```ts
export interface RadarSyncFilters {
  leadId?: string
  updatedSince?: Date
  emailLogSince?: Date
}
```

Não há `portfolioId`/`contactId` — a Fase D (D3) estende esse tipo com `portfolioId?: string` para o novo `SyncPortfolioToRadarUseCase`, seguindo o mesmo padrão de filtro único por entidade já usado por `leadId`.

### 7.4 Modelos de contrato relevantes para D13/D14

- **`LeadPortfolio`** (1:1 com `Lead`, contrato **atual/em andamento**): `portfolioStatus`, `renewalStatus`, `renewalAmount`, `source: PortfolioSource` (`crm`/`manual`/`brokerage_transfer`), `lastContactAt`. O repositório `findPortfoliosForRadarSync` hoje **não seleciona** o campo `source` — necessário incluí-lo em D3 para detectar `brokerage_transfer` ("troca de corretagem").
- **`LeadFinalized`** (1:N com `Lead`, contratos **históricos/fechados**): `finalizedDateAt`, `amount`, `contractType`, `operadora`, `productName`, `closerId`, com `holder: LeadFinalizedHolder?` e `dependents: LeadFinalizedDependent[]`.
- **`LeadFinalizedHolder`/`LeadFinalizedDependent`:** têm `name`/`document`(opcional para dependentes)/`birthDate`, mas **nenhum telefone/e-mail** — um perfil Radar para eles (D14) precisa de um esquema de identidade novo, chaveado por `document` normalizado, com uma regra explícita para o caso sem documento (não gera perfil próprio).

### 7.5 Nenhuma coluna de origem no Lead hoje

O model `Lead` não tem nenhuma coluna equivalente a "canal de origem" — toda a informação de como o lead entrou (webhook Meta, webhook Studio, formulário público, import CSV, manual) hoje só existe implicitamente no caminho de código que criou o registro, não como um dado consultável. A Fase D (D1/D2) introduz `LeadOriginChannel` + `Lead.originChannel`/`originMetadata` para tornar essa origem uma condição de segmento e um dado exibível no perfil.

---

## 8. Fase D — estado pós-unificado (D1–D18 / PR #633)

**Data de verificação:** 2026-08-04  
**Branch unificada:** `cursor/radar-d10-d18-unified` — [PR #633](https://github.com/matheuswillock/lead-flow-app/pull/633)

R1–R5 e C1–C6 estão **concluídos**. Na Fase D, **D1–D18** estão no código (D8 via `cursor/radar-d8-form-bridge` → merge no unificado). Esta seção atualiza o veredito do audit histórico (§1–§7, baseline pré-rename / pré-Fase D) sem reescrever o inventário datado de 2026-07-18.

| Estágio | Escopo | Status |
|---|---|---|
| D1 | Schema `LeadOriginChannel` + `originChannel`/`originMetadata` | ✅ Concluído |
| D2 | Origem nos webhooks/import/form → sync inline | ✅ Concluído |
| D3 | Sync portfolio / EmailContact inline (event-driven) | ✅ Concluído |
| D4 | Perfis email-only (`normalizedPhone` opcional) | ✅ Concluído |
| D5 | Marcos de status do Lead → `RadarEvent` | ✅ Concluído |
| D6 | Condição de segmento `lead_field` (+ catálogo) | ✅ Concluído |
| D7 | Identidade `visitor_session` + Corretor Studio Pixel | ✅ Concluído |
| D8 | Bridge `PublicFormMetricEvent` → `RadarEvent` | ✅ Concluído (`SyncPublicFormMetricToRadarUseCase`, dedupe `eventKey`) |
| D9 | Touchpoints / sub-aba Contatos no perfil | ✅ Concluído |
| D10 | UI sem sync manual — fluxo 100% event-driven | ✅ Concluído |
| D11 | Auditoria impeccable de `/radar` | ✅ Concluído |
| D12 | Hardening: Postman, RLS pixel, docs, ERD | ✅ Concluído (SQL no repo; push remoto não afirmado aqui) |
| D13 | `portfolio_field` + seção Contratos no perfil | ✅ Concluído |
| D14 | Identidades `contract_holder` / `contract_dependent` | ✅ Concluído (SQL no repo; push remoto não afirmado aqui) |
| D15 | Materializar segmento → lista de contatos | ✅ Concluído |
| D16 | Export perfis/segmentos CSV/Excel | ✅ Concluído |
| D17 | Polimento UI (identidades, Calendar, event Select, responsáveis) | ✅ Concluído |
| D18 | Ranking top templates / formulários | ✅ Concluído |

### Dívida C5 × DA11 — corrigida

O `Alert` em `RadarSegmentBuilderDialog` (e o equivalente no wizard de campanhas) agora deixa claro que audiência de segmento > `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` é **rejeitada**; split/sub-campanhas existem só após materializar o segmento em lista de contatos.

### Paths canônicos (pós-unificado)

- Frontend: `app/[supabaseId]/radar/**` (não mais `/cdp`)
- API: `/api/v1/radar/**` + hit público `/api/v1/public-pixel/:publicToken/hit`
- Lib/service/repo: `lib/radar/**`, `app/api/services/radar/**`, `app/api/infra/data/repositories/radar/**`
- Feature slug: `FEATURE_SLUGS.RADAR = "radar"`; `getRadarAccess()`
- Postman: pasta **Radar** (pixel, touchpoints, profiles, segments, export, materialize)
- Migrations no repo (existência ≠ push remoto): `*_radar-d12-pixel-tables-rls.sql`, `*_radar-d14-contract-identity-types.sql`

### D8 — Bridge formulário → RadarEvent

- UseCase: `app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase.ts`
- Inline fire-and-forget: `syncPublicFormMetricToRadarInline` (via `after()`)
- Hooks: `PublicFormsService.recordMetric`, `PublicFormSubmissionUseCase`, `PublicFormProgressUseCase`
- Dedupe: `RadarRepository.appendEventIfNewBySourceKey` com `sourceId = eventKey`
- Mapeamento: `lib/radar/map-public-form-metric-to-radar-event.ts`

---

## 9. Incidente de produção 2026-08-09 — Performance, banco e aplicação

**Fonte:** 24h de logs de produção da Vercel (29.244 linhas, 2026-08-08 22:06 → 2026-08-09 22:05 UTC), anexados pelo usuário, mais leitura direta do código e reverificação contra `origin/main` (release v0.200.0, PR #708, 2026-08-09). Documento par: `specs/radar-incidente-producao-2026-08-09.md` (correção executável). O achado transversal do mesmo incidente (tabela `backoffice_cron_executions` ausente, derruba 21 cron jobs de toda a aplicação, não só o Radar) está documentado à parte em `CRON_OBSERVABILITY_AUDIT.md`/`CRON_OBSERVABILITY_SPEC.md`.

### B1 — `countFixedSegmentsSQL` usa nomes de tabela errados em SQL raw — `/api/v1/radar/segments` quebrado

`app/api/infra/data/repositories/radar/RadarRepository.ts`, método `countFixedSegmentsSQL` (linhas 2331–2507, introduzido no commit `88c21a4f` — *"perf(radar): otimizar carregamento de segmentos com SQL e cache"*, 2026-08-07, o mesmo PR que trouxe o cache `"use cache"` de `listSegments` já registrado no §8). O `$queryRaw` referencia identificadores entre aspas duplas como se fossem nomes de tabela físicos:

```
FROM "RadarProfile" p          -- linhas 2380, 2426, 2452
FROM "RadarConsent" c          -- linhas 2355, 2360, 2474  (nem o nome do model é esse — é RadarChannelConsent)
FROM "RadarSourceLink" sl      -- linhas 2365, 2430, 2461
FROM "RadarIdentity" i         -- linhas 2370, 2435
FROM "RadarEvent" e            -- linhas 2375, 2389, 2456
INNER JOIN "Lead" l            -- linha 2436
```

Esses são nomes de **model** Prisma (ou, no caso de `"RadarConsent"`, nem isso), não os nomes físicos das tabelas. A migration `20260718220125_radar-rename-physical-schema.sql` (Fase R deste mesmo audit, §5) renomeou as tabelas físicas de `corretor_studio_cdp_*` para `corretor_studio_radar_*` mantendo os nomes de model estáveis **só via `@@map`** no Prisma — precisamente para que o código via Prisma Client continuasse funcionando sem alteração. SQL raw (`$queryRaw`) não passa pelo `@@map`: os identificadores citados acima não correspondem a nenhuma relação real do banco, então toda chamada lança `relation "RadarProfile" does not exist` (ou equivalente para os outros nomes).

**Nomes físicos corretos** (via `@@map` em `prisma/schema.prisma:4510-4619`): `RadarProfile` → `corretor_studio_radar_profiles`; `RadarIdentity` → `corretor_studio_radar_identities`; `RadarSourceLink` → `corretor_studio_radar_source_links`; `RadarEvent` → `corretor_studio_radar_events`; `RadarChannelConsent` (não `RadarConsent`) → `corretor_studio_radar_channel_consents`; `Lead` → `corretor_studio_leads`.

**Impacto observado:** 3 de 4 requisições a `/api/v1/radar/segments` na janela de 24h retornaram HTTP 500; latência p50 ~12s / p95 ~14s nas 4 requisições (inclusive as com erro) — vale investigar em separado se há uma query legada (`countSegmentsLegacy`, ver abaixo) rodando em paralelo "para validação comparativa" e inflando a latência antes mesmo do erro aparecer. Toda a UI do Radar que depende da listagem/contagem de segmentos fixos (dashboard `/radar`, cards de segmento) fica quebrada.

**Mitigação já existente no código:** `RadarService.ts:997` mantém um método `countSegmentsLegacy`, comentado como "mantida temporariamente para validação comparativa" — usa o Prisma Client normal (via `@@map`, portanto correto) em vez de SQL raw. Candidato a virar o caminho único até `countFixedSegmentsSQL` ser corrigido ou reescrito.

**Prevenção (processo):** a mesma classe de erro ocorre quando migrations ou SQL manual usam o nome do model como tabela. A partir de `agents.md` v2.5.1, toda migration/`$queryRaw` **MUST** usar nomes físicos de `prisma/schema.prisma` (`@@map`/`@map`) e o boundary `app/api/infra/data/prisma.ts` — ver `specs/radar-incidente-producao-2026-08-09.md` §B1 e `CRON_OBSERVABILITY_AUDIT.md` §6.

**Reverificado em `origin/main` (2026-08-09, release v0.200.0):** bug **continua presente**, linha a linha idêntico ao encontrado no worktree local — o release mais recente não tocou este arquivo além do que já estava no commit `88c21a4f` original.

**CORRIGIDO (confirmado em 2026-08-10):** o commit hoje em produção (`main`, `c797e71d`) já usa os nomes físicos corretos (`corretor_studio_radar_profiles`, `corretor_studio_radar_channel_consents`, `corretor_studio_radar_source_links`, `corretor_studio_radar_identities`, `corretor_studio_radar_events`, `corretor_studio_leads`) em `countFixedSegmentsSQL`. Executei a query completa diretamente contra o Postgres de produção (Supabase MCP) e ela retorna sem erro de relação — **este achado específico (nomes de tabela) não é mais o problema**. Só que a correção introduziu um bug diferente e igualmente grave — ver B5 abaixo.

### B2 — CORRIGIDO: não é tabela ausente — é esgotamento/instabilidade do pool de conexões (P1001/P2024)

**Este achado foi revisado em 2026-08-09 com evidência direta do banco (MCP do Supabase, autorizado pelo dono nesta data) e correção do texto abaixo — a hipótese original ("migration não aplicada") estava errada.** A leitura inicial dos logs se baseou numa mensagem truncada (`Invalid prisma.backofficeRadarEngagementConfig.findFirst() invocati...`) que, por semelhança superficial com o achado A (tabela do cron, esse sim ausente), foi lida como "tabela não existe". A mensagem completa nunca dizia isso.

**Confirmado via `execute_sql` no projeto `wcnxwdcoambpfwxwubka` (`corretor-studio`), consulta a `information_schema.tables`:** as três tabelas **existem**, com a contagem de colunas batendo exatamente com o schema:

| Tabela | Colunas (schema espera) | Colunas (confirmado no banco) |
|---|---|---|
| `backoffice_radar_engagement_weights` | 7 | 7 ✅ |
| `backoffice_radar_engagement_configs` | 12 | 12 ✅ |
| `backoffice_form_engagement_score_rules` | 8 | 8 ✅ |

E via `list_migrations` do mesmo projeto: `20260804170650_radar-d19-engagement-foundation` e `20260804194139_radar-d19b-form-engagement-score-rules` **aparecem aplicadas** no histórico do Supavisor — confirmando que, ao contrário do achado A (tabela do cron, nunca migrada em lugar nenhum), aqui schema, migration e banco remoto **batem os três**.

**Causa real, com a mensagem de erro completa (truncada demais na primeira leitura):**

```
[RadarRepository][updateEngagementScore] Error [PrismaClientKnownRequestError]:
Invalid `prisma.backofficeRadarEngagementConfig.findFirst()` invocation:

Timed out fetching a new connection from the connection pool. More info: http://pris.ly/d/connection-pool
(Current connection pool timeout: 20, connection limit: 1)
  code: 'P2024', meta: { connection_limit: 1, timeout: 20 }
```

Quantificado nas mesmas 24h de log: **49 ocorrências** de erro em `updateEngagementScore` (não "milhares" — correção também do volume citado na primeira leitura), distribuídas em **quase todas as horas do dia** (00h–21h, sem concentração num único horário/deploy — ver tabela abaixo), sendo:

| Código Prisma | Significado | Ocorrências | `connection_limit` observado |
|---|---|---|---|
| `P1001` | "Can't reach database server at `aws-1-sa-east-1.pooler.supabase.com:6543`" — falha de conectividade, não de pool | 26 | — |
| `P2024` | "Timed out fetching a new connection from the connection pool" — pool esgotado | 23 | **21×** com `connection_limit: 7` (sem override — fórmula padrão do Prisma, `num_cpus×2+1`, indicando execução **sem** o `connection_limit` explícito na `DATABASE_URL`) / **2×** com `connection_limit: 1` (a config recomendada, presente no `.env.example` do projeto) |

**Leitura correta do achado:** o problema não é o Radar em si — é uma instabilidade sistêmica de conectividade/pool com o Postgres via Supavisor, que atinge `updateEngagementScore` porque ele faz 3 queries em paralelo (`Promise.all`) sem retry, mas certamente atinge outras rotas também (ver §Cruzamento abaixo). A esmagadora maioria das ocorrências (21 de 23 `P2024`) rodou com `connection_limit: 7` — ou seja, **sem** a configuração `connection_limit=1&pool_timeout=20` que o `.env.example` do projeto recomenda para serverless — sugerindo que essa configuração não estava (ou não estava consistentemente) aplicada na `DATABASE_URL` de produção durante boa parte da janela de 24h analisada. As 2 ocorrências com `connection_limit: 1` mostram que, mesmo com a configuração recomendada aplicada, o pool **ainda estoura** sob a carga atual — ou seja, a mudança de env var por si só não é suficiente para eliminar o problema por completo, apenas reduz a frequência.

**Cruzamento com investigação paralela do mesmo dia (fora deste worktree):** o dono do projeto identificou de forma independente, via Sentry, o mesmo padrão de `ECHECKOUTTIMEOUT`/pool timeout afetando `POST /forms/[publicId]` (54 eventos) e crons do WhatsApp (38 eventos) na mesma janela, e aplicou `connection_limit=1&pool_timeout=20` na `DATABASE_URL` de produção da Vercel como mitigação. Os dados deste achado (2 de 23 `P2024` já com `connection_limit=1`, mas ainda existindo) são consistentes com essa mitigação parcialmente aplicada durante a janela de log e **ainda insuficiente sozinha** sob a carga atual — reforça a necessidade de uma mitigação estrutural adicional (fila/outbox, não só ajuste de env var) para a classe inteira desse problema, não só para o Radar.

**Efeito em runtime (comportamento observado nos logs, independente da causa ser tabela ou pool):** `RadarRepository.updateEngagementScore` (linhas 999–1031) chama `loadEngagementWeightsAndConfig()` (linhas 1110–1193 — 3 queries em `Promise.all` contra as 3 tabelas acima) sem try/catch próprio e sem usar `withPrismaRetry` (helper de retry para erros transitórios como `P2024`/`P1001`, já existente em `app/api/infra/data/prisma.ts` mas não aplicado aqui). Dependendo de quem chama:

- `appendEventIfNew`/`appendEventIfNewBySourceKey` (linhas 914/948/992): fire-and-forget com `.catch(console.error)` — é a origem direta dos milhares de `[RadarRepository][updateEngagementScore] Error...` nos logs (ver B3), mas não derruba o fluxo principal do chamador.
- `mergeProfiles` (linha 194) e o branch de merge dentro de `resolveProfileForPhone` (linha 557): `await` **sem try/catch** — a exceção propaga para cima, para `MergeLeadsUseCase` e para os fluxos de sync CRM/portfolio/finalized/WhatsApp. Raio de impacto maior do que os logs "silenciosos" de B3 sugerem.
- `getLeadRadarEngagementWithCtx` → `GetLeadRadarEngagementUseCase` → rota `/api/v1/radar/profiles/by-lead/[leadId]/engagement`: quebra o card de temperatura do lead no CRM (`LeadRadarTemperatureCard.tsx`).
- Tela de admin `app/backoffice/(app)/radar/engajamento/**`: depende diretamente dessas 3 tabelas para carregar e salvar configuração — provavelmente também quebrada.

### B3 — Sync do Radar no `EmailContactImport` falha ~100% das vezes, mascarado como sucesso (HTTP 200)

Uma das causas possíveis é a mesma de B2 (esgotamento/instabilidade do pool fazendo `updateEngagementScore` falhar), mas o comportamento do pipeline de import merece registro próprio independente da causa de fundo — é um problema de **observabilidade e mascaramento de falha**: mesmo que B2 seja corrigido, este padrão de log inutilizável para qualquer falha futura de sync continua existindo.

**Log sem detalhe correlacionável:** `EmailContactImportUseCase.ts:579` loga `Erro parcial no sync Radar do contato <uuid>: N erro(s)` — mas o array `syncErrors` contém só tags opacas tipo `contact:<id>` (`RadarService.ts:727`), nunca a mensagem real do erro. O erro de verdade só aparece numa linha de log **separada e sem `importId`** (`RadarService.ts:728`), impossível de correlacionar de forma confiável em produção sem heurística de timestamp. **Recomendação para o spec:** incluir `error.message` (ou o texto completo) na mesma linha de log que já tem o `importId`.

**Quantificado:** 2.559 contatos distintos tiveram o sync do Radar falhando em 10 execuções do cron de import de e-mail nas últimas 24h — cada lote processado tem ~256 contatos, e **100% deles falham** em cada lote (10 lotes × ~256 = ~2.560, bate com a contagem distinta).

**Por que não gerou nenhum alerta baseado em status HTTP:** a falha do sync Radar nunca popula `failedBatches` (só falhas do `upsertContactsBatch` externo populam isso), então `finalizeJob` sempre marca o job como sucesso e a rota `app/api/v1/email/cron/process-import-jobs/route.ts:34` sempre devolve HTTP 200 — apesar de 100% de falha real na sincronização Radar da feature.

### B4 — N+1 no backfill de engajamento (achado incidental de performance)

`app/api/useCases/radar/RadarEngagementBackfillUseCase.ts:17-33` — loop externo pagina perfis em lotes de 500 (`BATCH_SIZE`, conforme o próprio comentário do job: "recalcula engagementScore/engagementBand em lotes de 500 perfis"), mas o loop interno chama `updateEngagementScore` **um perfil por vez**, e cada chamada faz 2 queries sequenciais (`radarEvent.findMany` + `radarProfile.updateMany`). Resultado: até 1.000 round-trips sequenciais ao banco por lote de 500 perfis, num job cujo propósito explícito é justamente processar em lote. Candidato natural a virar uma query set-based (ou, no mínimo, `Promise.all` com concorrência limitada) no spec de correção.

## 10. Incidente de produção 2026-08-10 — todos os segmentos do Radar aparecem zerados para todos os times

**Gatilho:** usuário reportou que "todos os radares de todos os times estão zerados" e pediu investigação via Supabase, Vercel e Sentry MCP. Investigado com dados reais de produção — nenhuma suposição.

### B5 — `countFixedSegmentsSQL` compara `uuid` com `text` sem cast — 100% das chamadas a `/api/v1/radar/segments` falham 🔴 (regressão introduzida na correção do B1)

**Não é ausência de dado.** Confirmado via Supabase MCP: `corretor_studio_radar_profiles` tem 126.638 perfis reais em produção, distribuídos entre os times (o maior tem 34.389). Quando a query SQL de `countFixedSegmentsSQL` é executada diretamente contra o banco com o `teamId` escrito como literal no texto do SQL, ela retorna contagens reais e coerentes (`email_marketable: 32438`, `opened_not_clicked: 427`, `clicked_not_closed: 66`, `inactive_recent_campaign: 26944`, `crm_clients: 102` para o maior time da base). O problema é 100% na camada de aplicação.

**Causa raiz confirmada nos runtime logs da Vercel (`get_runtime_logs`, ocorrendo continuamente, a cada poucos minutos, até o momento desta investigação):**

```
Raw query failed. Code: `42883`. Message: `ERROR: operator does not exist: uuid = text
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.`
    at async l.countFixedSegmentsSQL (...RadarRepository...)
    at async I.countSegments (...)
    at async R (...RadarUseCase...)
```

`app/api/infra/data/repositories/radar/RadarRepository.ts:2373-2545` (mesmo método do achado B1) tem **14 comparações** do tipo `c."teamId" = ${teamId}` (e equivalentes em `sl`/`i`/`e`/`p`/`l`) sem `::uuid`. A coluna é `uuid`; o parâmetro `${teamId}` chega como `string` do TypeScript. O `$queryRaw` do Prisma envia parâmetros como **bind parameters tipados** (não literais interpolados) — nesse modo, o Postgres exige um operador `uuid = text` explícito, que não existe por padrão; só há coerção implícita quando o valor é escrito como literal solto no texto do SQL (por isso a query funcionou quando testei manualmente via Supabase MCP, mas falha sempre que chamada pela aplicação).

**Por que "zera para todos os times":** `getCachedRadarSegments`/`listSegments` (`app/api/useCases/radar/RadarUseCase.ts:55,494-497`) **não tem `try/catch`** em volta da chamada a `countSegments`. A exceção sobe até a rota `app/api/v1/radar/segments/route.ts`, que devolve `HTTP 500` com `result: null`. Como a query é idêntica (mesma falta de cast) para **qualquer** `teamId`, **toda chamada de todo time falha da mesma forma** — daí a UI parecer "tudo zerado" quando na real é "toda chamada com erro".

**Por que não apareceu no Sentry:** busquei por `radar`, `countFixedSegmentsSQL` e `uuid` no Sentry (organização `corretor-studio`, projeto `sentry-camel-flower`) — **nenhum resultado**. A rota só faz `console.error` no catch da rota (`[RadarSegmentsRoute][GET]`), sem captura explícita no Sentry; é uma lacuna de observabilidade adicional a registrar (não é escopo desta correção, mas vale nota para o `CRON_OBSERVABILITY_SPEC.md`/instrumentação geral: erros 500 de rota deveriam ir para o Sentry automaticamente).

**Não é regressão do trabalho em andamento (Estágios 8-11 do `EMAIL_SPEC.md`):** confirmado que o commit hoje em produção (`c797e71d`) já tinha esse bug — não foi introduzido por nada relacionado ao outbox de sync do Radar (D9) nem aos demais estágios em andamento. É uma regressão **da própria correção do B1** (commit `88c21a4f`, mesma linha de trabalho, 2026-08-07) — o fix dos nomes de tabela nunca foi validado contra Postgres real (só contra Prisma mockado em teste, aparentemente), então o gap de cast nunca foi pego.

**Correção:** adicionar `::uuid` em todas as 14 comparações de `${teamId}` (e revisar se `l.id::text` já usado na linha 108 tem o cast correto no sentido oposto). Adicionar também um `try/catch` em `countSegments`/`getCachedRadarSegments` para que uma falha nos segmentos fixos não derrube `getMetrics`/segmentos customizados junto — hoje qualquer erro em `countFixedSegmentsSQL` derruba a resposta inteira da rota, incluindo os segmentos customizados do time que não dependem dessa query.
