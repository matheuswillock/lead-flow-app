# RADAR_AUDIT.md — Auditoria consolidada do módulo Radar (ex-CDP): estado atual, sub-campanhas/teto diário, inventário do rename e riscos

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
