# RADAR_SPEC.md — Spec único do módulo Radar: rename "CDP → Radar" (R1–R5) + completude funcional (C1–C6)

**Data:** 2026-07-18
**Base factual:** `RADAR_AUDIT.md` (leitura obrigatória antes de qualquer estágio — paths, linhas e nomes físicos re-verificados em 2026-07-18 contra código e banco remoto). Este spec consolida e substitui `CDP_SPEC.md` e os documentos intermediários do ciclo.
**Premissa central:** o módulo **já existe** (fundação CDP em produção — audit §2). Este spec faz duas coisas, nesta ordem: **Fase R** renomeia tudo para Radar sem mudar comportamento; **Fase C** fecha os gaps funcionais até o Radar ser um sistema de perfil unificado + segmentação de ponta a ponta, **100% interno**. Nenhum estágio cria segundo event store, segunda normalização ou segundo motor de segmentos.
**Restrições de disparo vigentes (implementadas — audit §3):** teto de **2.000 e-mails por dia civil por time** (`EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY`, aplicado por `wouldExceedDailyEmailCap` no disparo manual e no cron) e **sub-campanhas** de até 2.000 destinatários (`EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB`) com pacing por intervalo de dias — split disponível **apenas para listas de contatos**; campanhas por segmento com >2.000 destinatários são **rejeitadas**. Tudo que este spec constrói respeita essas regras (D11).
**Janela favorável:** a feature está `isActive=false` em produção — rename de slug/URL sem impacto em cliente ativo.

---

## Goal

1. **Fase R (R1–R5):** eliminar toda a nomenclatura "CDP"/"cdp"/"Customer*" — banco físico, schema Prisma, 11 rotas, serviço/use case/repositório, `lib/`, RBAC/slugs, frontend, Postman, scripts e docs — com redirect permanente de `/cdp` → `/radar` e **zero regressão** (testes existentes seguem verdes, apenas renomeados). Inclui as novas mensagens de sub-campanha que citam "CDP".
2. **Fase C (C1–C6):** custom fields de Lead com RLS, filtráveis e ordenáveis; perfis Radar atualizados em tempo real a partir do CRM (fim do pull manual) com identidade endurecida; segmentos definíveis pelo usuário avaliados em SQL e reutilizáveis em campanhas **dentro dos limites de disparo** (≤2.000 por campanha; teto diário no dispatch); frontend `/radar` completo (abas Perfis/Segmentos, Sheet de detalhe, builder com preview de contagem e aviso de limite); hardening final.

## Non-goals

- **Integração Segment/Twilio ou qualquer CDP externa** — **fora do produto, permanente.**
- **Fuzzy matching de identidade** — resolução permanece por match exato normalizado.
- **Objetos customizados estilo Twenty / DDL em runtime / trocar o modelo EAV** — rationale no audit §2.
- **Merge/dedup de `Lead`** — escopo do `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md`; referenciar, não duplicar.
- **Novo event store** — `RadarEvent` é o store do módulo; `LeadActivity` segue como timeline do lead.
- **Rota dedicada de perfil** — detalhe é Sheet com deep-link por query param (D10).
- **Alterar as regras de sub-campanha/teto diário** — `campaign-limits.ts`, `campaign-sub-campaigns.ts` e `campaign-daily-dispatch-guard.ts` são invariantes deste spec (D11); mudá-las é decisão do módulo de e-mail, não do Radar. Em particular, **sub-campanhas para audiência de segmento NÃO fazem parte deste ciclo** (open question 4).

---

## Decisões arquiteturais

### D1 — Rename físico via `ALTER ... RENAME`, nunca via diff do Prisma
`db:migrate:from-prisma` geraria DROP+CREATE (perda de dados). Todo rename de banco é migration **manual** (`db:migrate:new`) com `ALTER TABLE/TYPE/INDEX/CONSTRAINT/POLICY ... RENAME`, idempotente via guardas `DO $$ ... IF EXISTS/to_regclass $$`. O `--dry-run` do fluxo from-prisma vira ferramenta de **verificação**: diff Prisma↔banco local vazio ao fim de cada estágio.

### D2 — Rename em duas fases desacopladas via `@@map`
R1 renomeia **só o físico** ajustando apenas `@@map` — models seguem `Customer*` e o backend compila sem edição de aplicação. R2 renomeia os símbolos TypeScript **sem mudança física** (exceto 3 colunas com migration própria). Cada PR com um único eixo de risco.

### D3 — Renames que atravessam deploy exigem janela coordenada
Rename físico não tem período de compatibilidade: aplicada a migration, o código antigo quebra (interpolação de e-mail, sync WhatsApp e webhook Resend rodam para todos os times). Regra para R1/R2/R3: **aplicar a migration no remoto (com autorização do dono) imediatamente antes de promover o deploy do PR mergeado, em janela de baixo tráfego**, monitorando os logs dos crons de e-mail por 15 min. Plano B (somente se o dono exigir janela zero): views de compatibilidade temporárias, documentadas no SQL de R1 sem implementar.

### D4 — Slug, URL e copy num único estágio atômico, com redirect permanente
`FEATURE_SLUGS.CDP`, o product slug `'cdp'`, os literais `"/cdp"` (2 mapas + sidebar) e a pasta do frontend formam um grafo acoplado (audit §6.2.3). R4 muda tudo junto + migration de dados (`backoffice_features` E `backoffice_products`) + seed + redirect 308 `/{supabaseId}/cdp` → `/{supabaseId}/radar` no `proxy.ts` (via `redirectWithSession`, preservando query).

### D5 — Valor de enum `'CDP' → 'RADAR'` ganha estágio próprio
Maior risco do rename (audit §6.1): tipo Postgres + linhas persistidas + ~25 literais sem proteção de compilador. R3 = `ALTER TYPE ... RENAME VALUE` + checklist fechado + teste de guarda que rejeita `"CDP"`.

### D6 — Política de documentos
Vivos renomeiam (`specs/cdp-email.md` → `specs/radar-email.md`, índice em `SPEC.md`); históricos datados ficam. `RADAR_AUDIT.md` e este arquivo já são os consolidados finais — nenhum doc novo por estágio (proibido `*_SUMMARY.md`). `project-context.instructions.md` ganha a seção do Radar em R5. `prisma/erd/diagram.md` é gerado — regenerar via `bunx prisma generate`.

### D7 — Campos dinâmicos: manter o EAV e fechar o lado de consulta
O EAV (`LeadCustomFieldDefinition` + `LeadCustomFieldValue`) é o modelo correto para o stack (audit §2). Falta: RLS + índice `(definitionId, value)` (C1) e a tradução de filtros/ordenação nas listagens do CRM/board (C2). Filtro = `EXISTS` por `(definitionId, value)`; cap de 3 filtros custom simultâneos por request.

### D8 — Identidade: match exato, push inline, correção do furo "lead sem telefone"
Chave natural `[teamId, normalizedPhone, normalizedName]` e uniques permanecem. C3 endurece o conflito "mesmo telefone, nome divergente" (a identidade `phone` NUNCA muda de perfil silenciosamente — lookup por identidade antes do upsert por chave natural) e passa o sync CRM→Radar para **push inline fire-and-forget** em `LeadUseCase` (precedente WhatsApp), mantendo as rotas de sync como backfill. Lead só-com-e-mail: perfil continua exigindo telefone para NASCER; registra identidade/eventos apenas se um perfil com aquele e-mail já existir; senão conta em `counters.deferred` no `Output`.

### D9 — Segmentos: entidade própria `TeamRadarSegment`, DSL tipada, avaliação SQL-first
Não estender `TeamFilterPreset` (audit §2). Os 6 hardcoded viram **segmentos de sistema virtuais** (somente leitura, sem seed); os do usuário vivem em `TeamRadarSegment` (`@@map("corretor_studio_radar_segments")`). DSL = JSON tipado com grupos Todos/Qualquer sobre catálogo fechado (campo de perfil, evento com janela temporal, consentimento, campo custom do lead, status do lead) — sem SQL livre. O motor (`RadarSegmentQueryService`) traduz para UMA query Prisma composta (ou `$queryRaw` parametrizado), matando o O(N)-em-memória.

### D10 — Frontend: uma rota `/radar` com abas; detalhe de perfil em Sheet com deep-link
Página raiz única com `Tabs` ("Perfis" | "Segmentos") por query param `?tab=`. Detalhe de perfil em `Sheet` com `?perfil=<id>` (compartilhável, sobrevive a refresh), disciplina de scroll do `DESIGN.md`. Builder de segmento em Dialog com preview de contagem. RBAC: tudo sob `getRadarAccess` + `FEATURE_SLUGS.RADAR` — **nenhum featureSlug novo**, nenhuma migration de `backoffice_features` na Fase C.

### D11 — Radar respeita os limites de disparo de e-mail (invariantes, não escopo)
As regras implementadas no módulo de e-mail (audit §3) são **contrato** para o Radar:
- **Teto diário:** `EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY = 2000` por time, aplicado por `wouldExceedDailyEmailCap` no disparo manual e agendado. O Radar não cria nenhum caminho de envio próprio — todo disparo passa pelo fluxo de campanhas existente, logo o teto já cobre segmentos sem trabalho novo. **Proibido** contornar o guard.
- **Limite por campanha de segmento:** audiência de segmento **não participa do split em sub-campanhas** (o snapshot `audienceContactIds` congela IDs de `EmailContact`; audiência de segmento é dinâmica e perfis nem sempre têm contato vinculado). Campanha por segmento com >`EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` destinatários é rejeitada na criação e re-validada no disparo (`EmailCampaignUseCase.ts:436, 640`). Os **segmentos dinâmicos de C4 herdam exatamente a mesma regra** — a validação existente passa a cobrir `custom:{segmentId}` sem duplicação de lógica, e a UX antecipa o limite: o builder (C5) mostra a contagem calculada com aviso quando >2.000 ("audiência excede o limite por campanha — refine as condições"), e o wizard de campanha mantém o aviso existente.
- Estender sub-campanhas para audiências de segmento exigiria congelar audiência dinâmica (decisão de produto) — registrado como open question 4, fora deste ciclo.

---

## Restrições globais (valem para TODOS os estágios)

- `Route → UseCase → [Service] → Prisma`; UseCase novo retorna `Output`; rota thin sem Prisma direto; `TeamContext` resolvido uma vez (`getTeamAccess()`/`getRadarAccess()`) e propagado.
- Serviços novos com interface + implementação concreta (backend e frontend). Frontend novo no layout `features/` canônico.
- Migrations: schema novo via `bun run db:migrate:from-prisma -- <nome>`; renames/RLS/dados via `bun run db:migrate:new <nome>`; SQL idempotente; replay validado 2×; **push remoto somente com autorização explícita do dono**, precedido de `db:migrate:push:dry-run`.
- Nenhum símbolo/rota/tabela/string **novos** com "cdp"/"CDP". Renomear, nunca duplicar.
- **Limites de disparo (D11):** nenhum código novo dispara e-mail fora do fluxo de campanhas; qualquer resolução de audiência que alimente campanha valida contra `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` e deixa o teto diário para `wouldExceedDailyEmailCap` no dispatch. Constantes sempre importadas de `lib/email/campaign-limits.ts` — nunca `2000` hardcoded.
- Componentes visuais: workflow shadcn MCP antes de markup custom; tokens semânticos do `DESIGN.md` (zero hex); `FieldGroup`/`Field`; `sonner`; `Skeleton`; Dialog/Sheet com `max-h-[90vh] flex flex-col` + corpo scrollável + footer fixo; request lock em toda mutação.
- Após cada estágio: `bun run typecheck 2>&1 | head -20`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br` (+ `bun run design:check` quando houver UI) e `bun run test`. Testes obrigatórios para todo serviço/use case novo; testes existentes renomeados e mantidos verdes.
- Endpoint novo/renomeado ⇒ Postman atualizado no mesmo PR.
- Nenhuma dependência nova em `package.json`. Cada estágio = 1 branch (a partir de `develop`) + 1 PR (o CI abre o PR no push).
- **Proibido tocar como efeito colateral:** enums `LeadStatus`/`ActivityType`, `TeamStatusRule*`, `TeamFilterPreset*`, tabelas/rotas `Backoffice*` (além das linhas `'cdp'` de R4), regiões geradas de `app/globals.css`, `agents.md` e adapters, `WhatsAppLeadActivityService`/`EmailCampaignLeadActivityService`, os 6 segmentos hardcoded (até C4 absorvê-los como sistema), **e a mecânica de sub-campanhas** (`campaign-limits.ts`, `campaign-sub-campaigns.ts`, `campaign-daily-dispatch-guard.ts`, `resolve-campaign-query-ids.ts`, campos `parentCampaignId`/`subCampaignIndex`/`audienceContactIds`).

---

# FASE R — Rename (R1–R5)

## Estágio R1 — Banco físico: tabelas, enums, índices e policies (código intacto via `@@map`)

**Prompt Codex:**

> Leia `RADAR_AUDIT.md` §5.1–5.2 e `RADAR_SPEC.md` (D1–D3). Crie UMA migration manual com `bun run db:migrate:new radar-rename-physical-schema` contendo, em SQL idempotente (blocos `DO $$ ... IF to_regclass(...)/IF EXISTS(pg_type) $$`): (1) rename das 5 tabelas `corretor_studio_cdp_{profiles,identities,source_links,events,channel_consents}` → `corretor_studio_radar_*`; (2) rename dos 5 tipos `customer_{identity_type,source_type,channel,consent_status,consent_reason}` → `radar_*` (NÃO tocar `email_variable_value_source` — é R3); (3) rename de TODOS os índices e constraints com "cdp" no nome — há DOIS conjuntos por tabela (era Prisma e era Supabase; audit §5.2): gere a lista no banco local (`pg_indexes`/`pg_constraint` com `LIKE '%cdp%'`) e renomeie cada um trocando `cdp`→`radar` (`ALTER INDEX ... RENAME TO`, `ALTER TABLE ... RENAME CONSTRAINT`), incluindo `corretor_studio_cdp_profiles_team_profile_data_idx`; NÃO dropar nenhum (dedupe é C6); (4) rename das 20 policies `cdp_*` → `radar_*` via `ALTER POLICY ... ON <tabela nova> RENAME TO`. Em `prisma/schema.prisma`, altere SOMENTE os `@@map` dos 5 models e 5 enums — nomes TypeScript NÃO mudam, nenhum arquivo de `app/`/`lib/` é tocado; adicione `map:` em `@@index`/`@@unique` se necessário para o diff fechar. Valide: reset local 2×, `bun run db:migrate:from-prisma -- --dry-run radar-noop` com diff VAZIO, `bunx prisma generate`, `bun run test` verde sem editar teste. Documente no cabeçalho SQL o plano B de views de compatibilidade SEM implementar. Rode typecheck, lint, governance:check.

**Não tocar:** `app/`, `lib/`, `components/`; nomes TS de models/enums; `email_variable_value_source`; colunas `cdpSegmentSlug`/`cdpFieldKey`; campos de sub-campanha (`parentCampaignId`/`subCampaignIndex`/`audienceContactIds`); dados `backoffice_*`; nenhum DROP.

**Aceite:** `pg_indexes`/`pg_policies` sem "cdp" no banco local; `to_regclass('corretor_studio_radar_profiles')` não-nulo e a antiga nula; diff Prisma vazio; typecheck + suíte verdes com edição restrita a `schema.prisma` + migration.

**Validação manual:** sync manual via Postman + página CDP funcionando igual, lendo das tabelas `radar_*`. Push remoto: janela coordenada (D3), com autorização.

---

## Estágio R2 — Símbolos: models, backend, `lib/radar`, colunas, contratos e Postman

**Prompt Codex:**

> Leia `RADAR_AUDIT.md` §5.1, §5.3–5.4, §5.7, §6.2 e `RADAR_SPEC.md` (D2, D11). **(1) Migration** `bun run db:migrate:new radar-rename-columns`: `RENAME COLUMN "cdpSegmentSlug" TO "radarSegmentSlug"` em `corretor_studio_email_campaigns` e `corretor_studio_email_campaign_dispatches`, e `"cdpFieldKey" TO "radarFieldKey"` em `email_team_variables` — idempotente via `information_schema.columns`. **(2) schema.prisma:** models `Customer*`→`Radar*` (5), enums TS `Customer*`→`Radar*` (5), relações do `Team` (:2061–2066, comentário `// Radar relations`), campos `radarSegmentSlug` (:2612 no `EmailCampaign` — cuidado para não tocar `parentCampaignId`/`subCampaignIndex` vizinhos; :2659 no `EmailCampaignDispatch`) e `radarFieldKey` (:3075), cabeçalho `// RADAR` (:3529). Dry-run deve acusar só as 3 colunas. **(3) Backend (`git mv` + rename de símbolos):** `app/api/v1/cdp/**`→`app/api/v1/radar/**` (11 rotas, logs `[Radar...Route][MÉTODO]`); `getCdpAccess.ts`→`getRadarAccess.ts` (`getRadarAccess`, `RadarAccessResult`, `teamContextFromRadarAccess`; ainda checando `FEATURE_SLUGS.CDP` — slug muda em R4) + teste; `services/cdp/CustomerDataPlatformService.ts`→`services/radar/RadarService.ts` (`class RadarService`, singleton `radarService`); `useCases/cdp/...`→`useCases/radar/RadarUseCase.ts`; `repositories/cdp/CdpRepository.ts`→`repositories/radar/RadarRepository.ts`; `SyncWhatsappMessageToCdpUseCase.ts`→`SyncWhatsappMessageToRadarUseCase.ts` (msg "Erro ao sincronizar mensagem com o Radar"). **Mensagens de Output do `EmailCampaignUseCase`:** `NO_RECIPIENTS_CDP`→`NO_RECIPIENTS_RADAR` "Nenhum perfil apto no segmento Radar" (:55); "Selecione uma lista de contatos ou um segmento Radar" (:391); "Use apenas lista de contatos ou segmento Radar, não ambos" (:394); "Segmento Radar inválido" (:397); e as DUAS rejeições de sub-campanha (:436 e :640) → "Segmentos Radar com mais de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários não são suportados. Use uma lista de contatos (com sub-campanhas) ou reduza o segmento" — **sem alterar a regra nem as constantes**. **(4) `lib/cdp`→`lib/radar`** (10 runtime + 6 testes; `team-has-cdp-feature.ts`→`team-has-radar-feature.ts`; `customer-data-platform.integration.test.ts`→`radar.integration.test.ts`): renomear todo export com Cdp/CDP conforme audit §5.4 (`normalizeRadar*`, `isValidRadarPrimaryIdentity`, `RADAR_SEGMENT_SLUGS`/`RadarSegmentSlug`/`isRadarSegmentSlug`, `RADAR_FIELD_CATALOG` e funções, `RadarResolvable*`, `listRadarSegmentEmailRecipients`, `enrichCampaignRecipientsWithRadar`, `RadarEmailVariableConfig`, `RadarSyncFilters`, `teamHasRadarFeature` — mantendo `"cdp"`/`FEATURE_SLUGS.CDP` até R4 com comentário). **(5) Todos os consumidores** (lista fechada no audit §5.3–5.4), incluindo `EmailAnalyticsRepository` (DTO `radarSegmentSlug`), rotas de variáveis (campo), `resolveLeadIdFromRecipientEmail.ts`, `contact-name.ts`, `LeadDuplicateCheckService`; no frontend SOMENTE camada de serviço/tipos (paths ficam para R4): `app/[supabaseId]/cdp/features/services/*` (URLs `/api/v1/radar/...`), `CampanhasService`/`ICampanhasService`/`CampanhasTypes`/`CampanhasHook` (campo `radarSegmentSlug`; o discriminante `"cdp_segment"` fica para R4), `AnalyticsTypes`, `CampaignDetailSheet.tsx:47` e `CampaignLogsTab.tsx:75` (campo; copy fica para R4), `EmailSettingsTypes`/`IEmailSettingsService` (campo `radarFieldKey`), `whatsappDisplay.ts`, `NewConversationDialog.tsx`. **(6) `package.json`:** `test` com `lib/radar`; `test:integration` com `RADAR_INTEGRATION_TEST=1` + path novo. **(7) Postman:** pasta "CDP"→"Radar", URLs `/api/v1/radar`, body `radarSegmentSlug`; adicionar os 3 requests faltantes e `radarProfileId` no Environment (audit §5.7). Rode typecheck, lint, governance:check, lint:pt-br, `bun run test`.

**Não tocar:** literais `"CDP"` de `valueSource` (R3); `FEATURE_SLUGS`/mapas de rota/sidebar/seed/dados `backoffice_*` (R4); paths e copy visual do frontend (R4); mecânica de sub-campanhas (constantes, chunking, guard — apenas as mensagens que citam "CDP" mudam de texto); docs (R5); comportamento.

**Aceite:** `grep -ri 'cdp' app/api lib --include='*.ts'` retorna somente literais de `valueSource` (R3) e referências de slug/rota (R4); diff físico = exatamente 3 colunas; Postman sem `/api/v1/cdp`; suíte verde (incluindo `campaign-sub-campaigns.test.ts` intacto); criar campanha com `radarSegmentSlug` >2.000 destinatários segue rejeitada com a mensagem nova.

**Validação manual:** fluxo local — variável de e-mail → `POST /api/v1/radar/sync/crm` → `GET /api/v1/radar/profiles` → campanha com segmento Radar resolvendo destinatários; lista >2.000 contatos ainda cria sub-campanhas normalmente. Push remoto: janela coordenada (D3).

---

## Estágio R3 — Valor de enum `'CDP' → 'RADAR'` (checklist fechado)

**Prompt Codex:**

> Leia `RADAR_AUDIT.md` §6.1 e `RADAR_SPEC.md` (D5). **Migration** `bun run db:migrate:new radar-rename-email-variable-value-source`, idempotente (guarda via `pg_enum`): `ALTER TYPE "public"."email_variable_value_source" RENAME VALUE 'CDP' TO 'RADAR'` — linhas persistidas acompanham automaticamente (comentar no SQL). **schema.prisma:** valor `CDP`→`RADAR` no enum `EmailVariableValueSource` (:3583). **Literais — lista fechada, mesmo PR:** `RadarRepository` (`valueSource: "RADAR"`, ex-:550/:645); `EmailTeamVariablesUseCase` (8 pontos); Zod `z.enum(["STATIC", "RADAR"])` nas 2 rotas de variáveis; frontend `EmailSettingsTypes.ts` (union), `GlobalVariablesCard.tsx` (SelectItem `value="RADAR"` com label "Radar (por destinatário)", condições, Badge "Radar", label "Campo do Radar", fallbacks — 13 hits), `VariablesPanel.tsx` (:44, :284, :291). **Teste de guarda:** caso que rejeita `valueSource: "CDP"` e aceita `"RADAR"`. Rode typecheck, lint, governance:check, design:check, lint:pt-br, testes. `grep -rn '"CDP"' app lib components` deve zerar.

**Não tocar:** enums `radar_*` (R1); colunas (R2); slug/rotas/paths (R4); valor `STATIC`; dados além do efeito automático do RENAME VALUE.

**Aceite:** grep de `"CDP"` zero; `pg_enum` local = `{STATIC, RADAR}`; variável antiga interpola no preview (`POST /api/v1/radar/interpolation-preview`); criar/editar variável fonte "Radar" ponta a ponta; testes verdes com o teste de guarda.

**Validação manual:** abrir variável antiga (exibida "Radar"), salvar sem mudanças, nada regride; envio de teste de template com variável interpolada. Push remoto: janela coordenada (D3) — maior exposição de runtime; monitorar `[EmailTeamVariables...]` e cron `dispatch-scheduled`.

---

## Estágio R4 — Slug `'radar'`, URL `/radar`, frontend e copy (com redirect)

**Prompt Codex:**

> Leia `RADAR_AUDIT.md` §5.5–5.6, §6.2 e `RADAR_SPEC.md` (D4). **(1) Constantes/mapas:** `feature-slugs.ts:25` → `RADAR: "radar"` (remover `CDP`); `feature-product-slug-map.ts:26` → `[FEATURE_SLUGS.RADAR]: "radar"`; `feature-route-access.ts:24` → `"/radar"`; `lib/proxy/route-access.ts:48` → `"/radar"` (+ `route-access.test.ts`/`proxy.test.ts` se citarem `/cdp`); `team-has-radar-feature.ts` → `teamHasProductFeature(teamId, "radar", FEATURE_SLUGS.RADAR)`; `getRadarAccess` checa `FEATURE_SLUGS.RADAR` (+ teste). **(2) Migration de dados** `bun run db:migrate:new radar-rename-feature-product-slugs`, idempotente: `UPDATE backoffice_features SET slug='radar', name='Radar', description='Radar — perfis unificados, segmentos e timeline para campanhas de e-mail.', "updatedAt"=now() WHERE slug='cdp';` e o equivalente em `backoffice_products` (`featureSlug='radar'`); FKs por uuid intactas (comentar). **(3) Seed:** `prisma/seed-backoffice-products.ts` — todas as entradas cdp→radar (:104–106, :175, :390, :566–583; `CDP_PAYMENT_RULES`→`RADAR_PAYMENT_RULES`); validar com `bun run db:seed:backoffice-products`. **(4) Frontend:** `git mv app/[supabaseId]/cdp app/[supabaseId]/radar`; `CdpContainer.tsx`→`RadarContainer.tsx` (h1 "Radar"), `CdpContext.tsx`→`RadarContext.tsx`, `CdpTypes.ts`→`RadarTypes.ts`, `useCdpHook.ts`→`useRadarHook.ts`, `ICdpService.ts`/`CdpService.ts`→`IRadarService.ts`/`RadarService.ts`; atualizar import cross-feature em `CampanhasHook.ts:17`. Sidebar :138 → `title: "Radar"`, `url: /${supabaseId}/radar`, `featureSlug: FEATURE_SLUGS.RADAR` (ícone `Radar` do lucide-react se exportado pela versão instalada; senão manter `Database`). Discriminante `"cdp_segment"`→`"radar_segment"` (`CampaignCreateWizard.tsx:95, 207, 217, 292, 315, 333`; `CampanhasHook` :45–46, :83–84, :127–128, :496–508; `CampanhasTypes` :145–146; tipo `CdpSegmentOption`→`RadarSegmentOption` :75 e estados `cdpSegments`→`radarSegments`). **Copy:** "Segmento CDP"→"Segmento Radar" no wizard (:217, :251), `aria-label` "O que é segmento Radar?" (:258), aviso de limite do wizard (:292–295 — manter a regra e a constante, só o nome), `CampaignDetailSheet.tsx:49` e `CampaignLogsTab.tsx:75` (`Segmento Radar: ...`), `DispatchAccordionTable.tsx:121–122`. **(5) Redirect:** em `proxy.ts`, antes da resolução de acesso, 308 de `/{uuid}/cdp` → `/{uuid}/radar` via `redirectWithSession` preservando query (usar `UUID_RE`); caso novo em `proxy.test.ts`. Rode typecheck, lint, governance:check, design:check, lint:pt-br, testes.

**Não tocar:** banco físico além da migration de dados; rotas de API (já `/api/v1/radar`); `backoffice_feature_access_rules`/`_product_payment_rules`; mecânica de sub-campanhas (Alert "Sub-campanhas", intervalo, estimativas — só a copy que cita "CDP" muda); layout visual (rename de copy, não redesign); docs (R5).

**Aceite:** `grep -rn "'cdp'\|\"cdp\"\|/cdp" app lib components prisma --include='*.ts' --include='*.tsx'` → zero; sidebar "Radar" e `/{supabaseId}/radar` com h1 "Radar" (add-on ativo local); `/cdp` redireciona 308; `hasAccess('radar')` concede/nega corretamente; wizard "Segmento Radar" com o aviso de limite funcionando; seed idempotente; testes verdes.

**Validação manual:** manager com add-on → sidebar → Radar → sync → perfis; bookmark `/cdp` redireciona; backoffice mostra "Radar"; criar campanha por segmento >2.000 vê a mensagem nova. Push remoto da migration de dados com autorização (`isActive=false` — zero cliente afetado).

**Mockup antes/depois (tokens Warm-Precision):** *Antes:* nav "CDP" → página com `<h1>CDP</h1>`; wizard com "Segmento CDP". *Depois:* mesma superfície — item "Radar" na mesma posição, `<h1>Radar</h1>` em Poppins, tokens intocados; wizard com "Segmento Radar" e o mesmo aviso de limite (agora "Segmentos Radar..."); badge de variável "Radar". Nenhum espaçamento/cor/componente muda; `design:check` passa sem novo sync.

---

## Estágio R5 — Docs, ERD e varredura final

**Prompt Codex:**

> Leia `RADAR_SPEC.md` (D6). (1) `git mv specs/cdp-email.md specs/radar-email.md` com varredura interna (paths pós-R1–R4 reais) + atualizar índice `SPEC.md:14–16`. (2) `.github/instructions/project-context.instructions.md`: adicionar seção do módulo Radar (perfis/identidades/eventos/consentimentos/segmentos; paths canônicos; RBAC `getRadarAccess` + `FEATURE_SLUGS.RADAR`; **nota dos limites de disparo**: 2.000/dia por time e ≤2.000 por campanha de segmento). (3) Revisar `RADAR_AUDIT.md` e `RADAR_SPEC.md`: marcar R1–R5 concluídos e corrigir paths divergentes. (4) Regenerar `prisma/erd/diagram.md` via `bunx prisma generate`. (5) **Varredura final:** `grep -ri 'cdp' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next` deve retornar SOMENTE históricos datados (`docs/audits/**`, `.impeccable/**`, `Resumo.md`, `EMAIL_*`, `AUTOMATION_*`, migrations `supabase/migrations/*cdp*`) e falsos positivos base64; qualquer outro hit é bug de R1–R4 — reportar no PR, não corrigir silenciosamente. (6) Bateria completa + SELECTs de verificação em produção (com autorização): slug `radar` existente/`cdp` inexistente; `to_regclass('corretor_studio_radar_profiles')` não-nulo; `pg_enum` = `{STATIC, RADAR}`.

**Não tocar:** `agents.md` e adapters; históricos datados; migrations históricas; código de aplicação (resquício = reportar).

**Aceite:** varredura limpa conforme lista fechada; `SPEC.md` → `specs/radar-email.md`; ERD com `corretor_studio_radar_*`; project-context documenta o Radar com os limites; suíte verde; SELECTs de produção confirmando.

---

# FASE C — Completude funcional (C1–C6)

> Paths desta fase assumem R1–R5 concluídos (`lib/radar/**`, `app/api/v1/radar/**`, `RadarService`, `getRadarAccess`, `FEATURE_SLUGS.RADAR`). `RADAR_AUDIT.md` atualizado em R5 é a referência.

## Estágio C1 — RLS + índice de consulta para custom fields de Lead (fundação, sem UI)

**Prompt Codex:**

> Leia `RADAR_AUDIT.md` §2 (custom fields) e `CLAUDE.md` (Migration Policy). Crie migration manual `bun run db:migrate:new lead-custom-fields-rls-and-query-index` com, em SQL idempotente: (1) `ENABLE ROW LEVEL SECURITY` em `corretor_studio_lead_custom_field_definitions` e `_values`; (2) policies select/insert/update/delete por membership de time no padrão das policies `radar_*` — para `definitions` o `teamId` está na linha; para `values` derive via join `values.leadId → corretor_studio_leads.id → teamId`; (3) índice `CREATE INDEX IF NOT EXISTS lead_custom_field_values_definition_value_idx ON corretor_studio_lead_custom_field_values ("definitionId", "value")` — GIN com `btree_gin` (`CREATE EXTENSION IF NOT EXISTS btree_gin`) se a forma composta exigir; justificar em comentário SQL com o plano de uso; (4) comentário documentando que o acesso da aplicação é via service role e a RLS protege caminhos client-side/realtime futuros. Replay 2×. NÃO aplicar no remoto sem autorização. Rode typecheck, lint, governance:check.

**Não tocar:** `schema.prisma`, dados, rotas.

**Aceite:** replay idempotente; policies em `pg_policies`; `EXPLAIN` de filtro `EXISTS (definitionId = X AND value = '"Y"'::jsonb)` usa o índice; CRUD via Postman inalterado.

**Validação manual:** no Supabase Studio local, usuário de outro time não lê definitions/values do time A via API REST.

---

## Estágio C2 — Custom fields filtráveis e ordenáveis no CRM e no board

**Prompt Codex:**

> Leia `RADAR_SPEC.md` (D7). Backend: no repositório de leads (`app/api/infra/data/repositories/lead/**` — localize o builder de `where` das listagens do CRM e do board), suporte opcional a `customFieldFilters: Array<{ definitionId: string; operator: 'eq' | 'neq' | 'contains' | 'is_empty' | 'not_empty'; value?: unknown }>` (máx. 3 — validar no use case) traduzido para `customFieldValues: { some: ... } }` (`contains` via `string_contains`; `is_empty` via `none`), e `customFieldSort?: { definitionId; direction }` — escolha e justifique em comentário: segunda query + ordenação no use case, OU `$queryRaw` tipado com LEFT JOIN se a paginação exigir ordenação no banco. Zod das rotas de listagem **aditivo e retrocompatível**. Frontend: painel de filtros do CRM (`CrmFiltersBar.tsx`) e do board com seção "Campos personalizados" após `Separator`: `Select` de definição ativa (reuso do fetch com dedupe), operador e input tipado; filtros custom entram no estado existente e serializam no `queryJson` dos presets (shape opaco); chip removível por filtro (Badge `secondary` com `X`) e contador no botão. Testes do tradutor (todos os operadores por tipo). Postman com exemplos. Bateria completa + design:check.

**Não tocar:** `TeamFilterPreset` (schema/rotas), drag do board, schema de custom fields, queries existentes quando `customFieldFilters` ausente (zero regressão de plano).

**Aceite:** filtro por select custom retorna só os leads corretos; 2 filtros custom + core combinam; ordenação por `number` com nulls por último; request sem filtros custom não muda a query; presets salvam/reaplicam; testes verdes.

**Validação manual:** criar definição, preencher em 3 leads, filtrar e ordenar no board e no CRM.

**Mockup antes/depois (board):** *Antes:* painel só com status/responsável/período. *Depois:* bloco "Campos personalizados" (ícone `SlidersHorizontal`), chips removíveis, contador em `--primary`; empty state "Nenhum campo personalizado — crie na página do time".

---

## Estágio C3 — Sync inline CRM → perfil Radar (fim do pull manual) + hardening de identidade

**Prompt Codex:**

> Leia `RADAR_SPEC.md` (D8) e `RADAR_AUDIT.md` §2 (riscos de identidade). **Parte 1 — conflito:** teste de integração primeiro em `lib/radar/` (padrão `radar.integration.test.ts`): CRM cria perfil ("Maria Silva", 11988887777); sync WhatsApp chega com "Maria S.", mesmo telefone. Documente o comportamento real de `RadarRepository.upsertIdentity` no conflito do unique `[teamId, type, normalizedValue]` e ajuste: a identidade `phone` NUNCA muda de perfil silenciosamente — em conflito, o upsert REUSA o perfil dono da identidade (lookup antes do upsert por chave natural); extraia `RadarRepository.findProfileByIdentity(teamId, type, normalizedValue)` e use em `RadarService` em todos os caminhos. **Parte 2 — leads sem telefone:** quando `isValidRadarPrimaryIdentity` falhar mas houver e-mail válido, registrar identidade/source link/eventos APENAS se perfil com aquele e-mail já existir; senão incrementar `counters.deferred` no `Output` (perfil continua exigindo telefone para nascer). **Parte 3 — push inline:** `app/api/useCases/radar/SyncLeadToRadarUseCase.ts` (+ interface, `Output`) sincronizando UM lead (reusando `RadarService`), fire-and-forget (`.catch(console.error)`, após persistência, 1–3 linhas por ponto) em `LeadUseCase.createLead`, `updateLead` (contato mudou) e `updateLeadStatus` — somente com add-on (`lib/radar/team-has-radar-feature.ts`). Dedupe idêntico ao batch (`appendEventIfNew` com mesmo sourceId). Testes: idempotência inline×batch, deferred, gate de feature, conflito. Bateria completa.

**Não tocar:** rotas `/api/v1/radar/sync/**` (backfill), `WhatsAppLeadActivityService`/`EmailCampaignLeadActivityService`, `Output` existente do `LeadUseCase`, `lib/radar/normalization.ts`.

**Aceite:** lead com telefone gera perfil imediatamente; editar e-mail atualiza identidade; mudar status gera `RadarEvent` inline; batch não duplica; conflito resolve num único perfil; sem add-on nada roda; testes verdes.

**Validação manual:** com add-on, criar lead e abrir `/radar` — perfil aparece sem "Sincronizar"; `deferred` aparece no sync manual com leads só-com-e-mail.

---

## Estágio C4 — Segmentos dinâmicos (`TeamRadarSegment`) com avaliação SQL, dentro dos limites de disparo

**Prompt Codex:**

> Leia `RADAR_SPEC.md` (D9, D11). **Schema:** model `TeamRadarSegment` (`id` uuid, `teamId`, `createdBy`, `name`, `description?`, `rulesJson Json`, `isSystem Boolean @default(false)`, `isActive Boolean @default(true)`, timestamps; relações no padrão `TeamAutomationRule`; `@@unique([teamId, name])`, `@@index([teamId, isActive])`, `@@map("corretor_studio_radar_segments")`). Migration via `bun run db:migrate:from-prisma -- team-radar-segments` + manual `bun run db:migrate:new radar-segments-rls` (RLS padrão `radar_*`). **DSL:** `lib/radar/segment-dsl.ts` com `RadarSegmentRules = { match: 'all' | 'any'; conditions: RadarSegmentCondition[] }`, discriminated union: `profile_field` (`primaryEmail`/`primaryDocument`/`lastSeenAt` + operador), `consent` (canal + status), `event` (eventType, `occurred`/`not_occurred`, `windowDays?`), `lead_custom_field` (definitionId + `eq`/`neq`/`is_empty`/`not_empty` + value), `lead_status` (statuses) — Zod exportado + testes. **Motor:** `app/api/services/radar/RadarSegmentQueryService.ts` (+ interface) traduzindo para UMA query Prisma sobre `RadarProfile` (identities/events/consents relacionais; `lead_custom_field`/`lead_status` via identidade `lead_id` com subconsulta; `$queryRaw` tipado se necessário — NUNCA interpolação de string), expondo `countProfiles(scope, rules)` e `listProfileIds(scope, rules, pagination)` — sem carregar perfis em memória. **Sistema:** os 6 hardcoded permanecem VIRTUAIS (isSystem: true na listagem, sem seed); rota de listagem retorna `[...virtuais, ...TeamRadarSegment]`. **Rotas:** `GET/POST /api/v1/radar/segments/custom`, `PATCH/DELETE .../custom/[segmentId]`, `GET .../custom/[segmentId]/profiles` (paginada) — `getRadarAccess()`, Zod da DSL, logs `[RadarCustomSegmentsRoute][MÉTODO]`. **Reuso em campanhas (D11 obrigatório):** `lib/radar/list-segment-recipients.ts` aceita `custom:{segmentId}` além dos slugs fixos, resolvendo via `RadarSegmentQueryService`; a validação existente de audiência em `EmailCampaignUseCase` (`countActiveRecipients` + rejeição >`EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` na criação E no disparo) passa a cobrir `custom:{segmentId}` pelo MESMO caminho — sem duplicar a regra, sem tocar `campaign-limits.ts`/`campaign-sub-campaigns.ts`/`campaign-daily-dispatch-guard.ts`; o teto diário segue por `wouldExceedDailyEmailCap` no dispatch, sem mudança. Testes: DSL, tradutor (cada `kind` + all/any), rota (RBAC), e um caso provando que segmento custom com >2.000 perfis é rejeitado ao criar campanha. Postman: pasta "Radar Segments". Bateria completa.

**Não tocar:** `lib/radar/segment-config.ts`/`segment-rules.ts` (os 6 seguem como hoje), `TeamFilterPreset*`, rota `GET /api/v1/radar/segments` além do merge aditivo, `RadarService.countSegments` (O(N) dos fixos é follow-up), mecânica de sub-campanhas e teto diário.

**Aceite:** segmento "campo custom X = Y E sem e-mail aberto em 30 dias" retorna contagem/perfis corretos vs. conferência manual; segmento custom aparece como audience na criação de campanha e resolve destinatários; **segmento custom com >2.000 perfis é rejeitado na criação da campanha com a mensagem padrão**; sem add-on não acessa; segmentos de outro time invisíveis (RLS + rota); replay limpo; testes verdes.

**Validação manual:** criar/editar/excluir segmento custom via Postman; usá-lo numa campanha local; forçar um segmento >2.000 (dados de teste) e confirmar a rejeição.

---

## Estágio C5 — Frontend `/radar`: abas Perfis/Segmentos, Sheet de perfil, builder com aviso de limite

**Prompt Codex:**

> Leia `RADAR_SPEC.md` (D10, D11), `DESIGN.md` e siga o workflow shadcn MCP antes de qualquer markup (Tabs, Sheet, Dialog, Table, Badge, Skeleton, Alert). Evolua `app/[supabaseId]/radar/features/**` mantendo o layout canônico: **(1) Abas:** `RadarContainer.tsx` com `Tabs` "Perfis" | "Segmentos", estado por `?tab=segmentos` (default perfis). **(2) Nova pasta `features/components/`:** `RadarProfilesTable.tsx` (nome, telefone, e-mail, último evento, fontes como Badges, ação "Ver perfil"), `RadarProfileFilters.tsx` (busca nome/telefone/e-mail + filtro por fonte, dedupe de request), `RadarProfileSheet.tsx`, `RadarSegmentCard.tsx`, `RadarSegmentBuilderDialog.tsx`, `RadarEmptyState.tsx`. **(3) Sheet de perfil (deep-link):** abre com `?perfil=<id>` (fechar limpa o param); `max-h-[90vh] flex flex-col`, corpo `overflow-y-auto flex-1`, footer fixo: header (nome, telefone, e-mail, badge `lastSeenAt`), identidades (chips por tipo), fontes (origem + primeiro/último sync), consentimento por canal (Badge permitido/bloqueado/desconhecido + motivo), timeline paginada (`GET /api/v1/radar/profiles/[id]/events`, ícone por `eventType`), footer "Sincronizar agora" (secundário, request lock). **(4) Aba Segmentos:** "Segmentos do sistema" (cards `--surface-2`, ícone `Lock`, contagem em Poppins, somente leitura) + `Separator` + "Meus segmentos" (cards com menu editar/excluir — `AlertDialog` no delete) + CTA "Novo segmento" → `RadarSegmentBuilderDialog`: linhas de condição em `FieldGroup` (Select do `kind` com ícone — `User` perfil, `MousePointerClick` evento, `ShieldCheck` consentimento, `ListChecks` campo custom, `Kanban` status), pill Todos/Qualquer, rodapé com "Calcular audiência" (via `countProfiles`, request lock) e CTA salvar. **Aviso de limite (D11):** quando a contagem calculada exceder `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` (importar de `lib/email/campaign-limits.ts`), exibir `Alert` informativo "Audiência acima de 2.000 perfis — este segmento não poderá ser usado em campanhas de e-mail até ser refinado (limite de 2.000 destinatários por campanha e 2.000 envios/dia por time)"; o segmento ainda pode ser salvo (uso analítico), o bloqueio de campanha é do backend (C4). **(5) Serviço:** estender `IRadarService`/`RadarService` frontend (segments custom CRUD, profile detail/events) — interface + implementação; contexts com dedupe e estado de aba/sheet. `sonner`; `Skeleton`; tokens semânticos (zero hex). Testes dos hooks/utils puros. Bateria completa + design:check (design:sync se falhar).

**Não tocar:** rotas backend além do consumo; `RadarService` backend; sidebar; mecânica de sub-campanhas; página de campanhas além de listar os dois grupos de segmento (se C4 já não cobriu).

**Aceite:** `/radar?tab=segmentos` e `/radar?perfil=<id>` abrem no estado certo após refresh; criar segmento com preview de contagem e usá-lo em campanha; segmento >2.000 mostra o Alert de limite no builder e é rejeitado no wizard de campanha com a mensagem do backend; timeline pagina; consentimentos/identidades visíveis; sem add-on nada renderiza; design:check e testes verdes.

**Validação manual:** fluxo completo com add-on — perfis → filtrar → Sheet → copiar URL e reabrir → aba Segmentos → criar segmento → campanha com o segmento; repetir com segmento >2.000 e conferir aviso + rejeição.

**Mockup antes/depois:** *Antes:* página única com lista simples de perfis e cards fixos, sem detalhe nem criação. *Depois:* header "Radar" + `Tabs`; aba Perfis com busca/filtros e tabela com Badges de fonte; clique abre Sheet lateral (scroll interno, footer fixo); aba Segmentos com dois grupos separados por `Separator`, CTA `--primary` "Novo segmento", dialog do builder com pill Todos/Qualquer, badge de contagem em `--semantic-success-surface` e — quando >2.000 — `Alert` com ícone `TriangleAlert` em tom `--semantic-warning`; empty states com ícone e CTA.

---

## Estágio C6 — Hardening e fechamento

**Prompt Codex:**

> Endureça C1–C5: (1) **Deduplicação dos índices duplicados** das 5 tabelas `corretor_studio_radar_*` (audit §5.2): migration `bun run db:migrate:new radar-dedupe-indexes` dropando o conjunto redundante APÓS provar equivalência (`pg_indexes` + `EXPLAIN` antes/depois; documentar no SQL qual conjunto ficou e por quê). (2) **`EXPLAIN` das 3 queries novas mais quentes** (filtro custom no board, avaliação de segmento dinâmico, listagem de perfis com filtros) no banco local — conclusões em comentários dos repositórios; índice adicional somente se o plano provar necessidade. (3) **Teste de regressão ponta a ponta** em `lib/radar/` (gate `RADAR_INTEGRATION_TEST=1`): criar lead → perfil inline (C3) → segmento dinâmico o encontra (C4) → campanha resolve o destinatário respeitando os limites (audiência ≤2.000; um caso >2.000 rejeitado). (4) **Revisão de RLS:** policies ativas nas 7 tabelas do domínio (5 radar + 2 custom fields) via `pg_policies` + teste de isolamento entre times via API REST local. (5) Nenhuma rota de C1–C5 fora do Postman. (6) TODOS os testes do módulo + bateria completa.

**Não tocar:** contratos das rotas anteriores (apenas aditivo); schema além das migrations de índice justificadas; mecânica de sub-campanhas.

**Aceite:** testes do módulo verdes; `EXPLAIN`s documentados; índices deduplicados com equivalência provada; isolamento RLS verificado; Postman completo.

---

## Ordem de execução e dependências

| Ordem | Estágio | Depende de | Justificativa |
|---|---|---|---|
| 1 | R1 — banco físico via `@@map` | — | Desacopla físico de símbolos (D2) |
| 2 | R2 — símbolos, colunas, contratos, Postman | R1 | Models renomeiam sobre o físico pronto |
| 3 | R3 — valor de enum `'CDP'→'RADAR'` | R2 | Literais vivem nos arquivos renomeados; risco isolado (D5) |
| 4 | R4 — slug, URL, frontend, copy, redirect | R2 (R3 antes, recomendado) | Grafo atômico (D4) |
| 5 | R5 — docs, ERD, varredura final | R1–R4 | Fechamento do rename |
| 6 | C1 — RLS + índice custom fields | R5 | Débito de segurança; pré-requisito de C2/C4 |
| 7 | C2 — filtros/ordenação custom | C1 | Usa o índice de C1 |
| 8 | C3 — sync inline + identidade | R5 | Dados frescos para C4/C5 |
| 9 | C4 — segmentos dinâmicos (com limites D11) | C1, C3 | `lead_custom_field` usa índice; audience exige perfis frescos |
| 10 | C5 — frontend completo | C3, C4 | Consome perfis frescos e segmentos custom |
| 11 | C6 — hardening | C1–C5 | Fechamento |

Cada push remoto de migration exige autorização explícita do dono; R1/R2/R3 seguem a janela coordenada (D3).

## Critérios de sucesso (macro)

- **Fase R:** `grep -ri 'cdp'` limpo fora da lista fechada de históricos/falsos positivos; zero mudança de comportamento (incluindo as regras de sub-campanha — apenas texto das mensagens muda); banco de produção com 5 tabelas `radar_*`, 5 tipos `radar_*`, enum `{STATIC, RADAR}`, colunas `radarSegmentSlug`/`radarFieldKey`, slugs `radar`; `/cdp` redireciona; nenhuma copy visível com "CDP".
- **Fase C:** custom fields com RLS e filtráveis/ordenáveis sem regressão de plano; perfil Radar nasce/atualiza inline; segmentos definíveis avaliados em SQL e consumíveis em campanhas **respeitando ≤2.000 por campanha e o teto diário no disparo**; `/radar` com abas, Sheet deep-linkável e builder com aviso de limite; zero mudança em `LeadStatus`/`ActivityType`/`TeamStatusRule*`/`TeamFilterPreset*`/módulo Backoffice/mecânica de sub-campanhas (verificável por diff).
- **Sempre:** `governance:check` verde sem novas entradas de allowlist; nenhuma dependência nova; cobertura de teste em todo serviço/use case novo; constantes de limite sempre importadas de `lib/email/campaign-limits.ts`; nenhuma menção a integração externa.

## Open questions (bloqueiam apenas o estágio indicado)

1. **(R1/R2/R3 — dono)** Confirmar a janela de deploy coordenada de cada push remoto (D3); se exigir janela zero, ativar o plano B de views de compatibilidade.
2. **(R4 — dono)** Descrição de marketing da feature/produto "Radar" — mantive o texto atual trocando só o nome; validar se o posicionamento pede copy nova.
3. **(C3 — produto)** Leads só-com-e-mail: regra conservadora adotada (perfil exige telefone; `deferred` conta os que aguardam). Perfis nascendo de e-mail exigiriam relaxar a chave natural — fora deste ciclo.
4. **(Pós-C6 — produto/follow-up)** **Sub-campanhas para audiência de segmento:** hoje segmento >2.000 é rejeitado porque o split congela `audienceContactIds` (IDs de `EmailContact`) e audiência de segmento é dinâmica. Suportar exigiria decidir entre (a) congelar a audiência resolvida no momento da criação (materializar snapshot de perfis→contatos, perdendo dinamismo) ou (b) re-resolver por sub-campanha (audiência pode mudar entre disparos). Decisão de produto; nenhum estágio deste spec depende dela.
5. **(Pós-C6 — follow-up)** Absorver os 6 segmentos fixos no motor SQL novo (aposentando `segment-rules.ts` em memória) quando o motor estiver batalha-testado.
