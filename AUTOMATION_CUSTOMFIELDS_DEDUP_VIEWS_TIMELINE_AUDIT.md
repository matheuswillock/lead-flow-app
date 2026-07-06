# AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_AUDIT.md — Auditoria (Corretor Studio)

**Data:** 2026-07-06
**Escopo:** Itens 1–5 inspirados no benchmark twentyhq/twenty (inspiração de features apenas; stack permanece Next.js 16 + Prisma 6 + Supabase + TeamContext + shadcn/ui)
**Método:** auditoria factual do estado atual antes de qualquer design (Step 0). Nenhum código de implementação foi escrito nesta tarefa.
**Documento par:** `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md`

---

## 1. Sumário executivo

1. **Automation engine (Item 1)** — não existe motor trigger→condição→ação. `TeamStatusRule` é apenas *gating* de transição de status (bloqueio/confirmação), avaliado sincronamente dentro de `LeadUseCase.updateLeadStatus`; não despacha nenhuma ação externa. Existem, porém, três precedentes reaproveitáveis: (a) auto-respostas de WhatsApp (trigger de mensagem inbound → resposta automática), (b) infra de cron consolidada em `vercel.json` + `CRON_SECRET`, (c) adapters prontos para as quatro ações desejadas (WhatsApp via `IWhatsAppProvider`, e-mail via Resend, `NotificationService` in-app, atribuição via `Lead.assignedTo`).
2. **Correção de premissa do briefing:** `TeamStudioWebhookConfig` + `TeamStudioWebhookRequestLog` **não são um sistema de webhook OUTBOUND**. São o webhook **INBOUND** de captação de leads (`app/api/webhooks/studio/[teamId]/[token]/route.ts`): sistemas externos enviam leads para o Studio autenticando por token. Ele não dispara em evento nenhum e não tem filtro por tipo de evento. Não serve como camada de dispatch de ações do Item 1 — serve apenas como referência de UX de gestão de token.
3. **Custom fields (Item 2)** — não existe nada. O formulário de lead é estático (`components/forms/leadForm.tsx` + `leadFormSchema` fixo em `lib/validations/validationForms`). Terreno limpo, risco de duplicação baixo.
4. **Dedup (Item 3)** — parcial. Na criação há apenas checagem exata de CNPJ + uniques de banco `[teamId, email]` / `[teamId, cnpj]`. **Não há checagem por telefone nem normalização** no fluxo CRM. Porém o módulo CDP já resolve identidade com normalização testada (`lib/cdp/normalization.ts`) — deve ser reusada, não recriada. Não existe fluxo de merge em lugar nenhum.
5. **Saved views (Item 4)** — **a tabela `TeamFilterPreset` NÃO está órfã.** Está viva e consumida por CRM (tabela) e Performance via rotas `/api/v1/teams/[teamId]/{crm,performance}/filter-presets`. Gaps reais: presets são privados por criador (sem compartilhamento de time), **CRM e Performance compartilham o mesmo namespace sem coluna de escopo** (presets se misturam entre as duas telas — bug latente), Carteira usa **localStorage** em vez da tabela, e o Kanban (board) não tem presets.
6. **Timeline unificada (Item 5)** — parcial. `LeadActivity` + realtime já publicado cobrem o read-side; o gap real é **write-side**: os módulos WhatsApp e Campanhas de E-mail não escrevem `LeadActivity` (tipos `whatsapp` e `email` só entram por lançamento manual). Atenção: já existem **dois** sistemas de eventos (`LeadActivity` lead-cêntrico e `CustomerEvent`/CDP profile-cêntrico) — o Item 5 não pode criar um terceiro.

---

## 2. Tabela de existência (Step 0)

| Feature # | Já existe? | Artefato existente | Gap a fechar | Risco de duplicação |
|---|---|---|---|---|
| 1. Automation engine | **Parcial** (só gating de status) | `TeamStatusRule` (`prisma/schema.prisma:1660`) + `teamStatusRuleService` + avaliação em `LeadUseCase.ts:1360-1431`; auto-respostas WhatsApp (`ProcessWhatsAppInboundAutoResponseUseCase`); crons em `vercel.json`; adapters de ação prontos | Motor trigger→condição→ação com dispatch externo, log de execução, idempotência, cron para trigger temporal | **Médio.** Não estender `TeamStatusRule` (propósito materialmente diferente). Reusar adapters e padrão de cron; entidade nova dedicada |
| 2. Custom fields | **Não** | Formulário estático `components/forms/leadForm.tsx` + `leadFormSchema` fixo; `useLeadForm` (`hooks/useForms.tsx:60`) | Tabelas definition/value + CRUD + render dinâmico RHF/Zod | **Baixo.** Único ponto de contato futuro: `/api/v1/cdp/available-fields` (interpolação de e-mail) |
| 3. Dedup de leads | **Parcial** | Check exato de CNPJ em `LeadUseCase.ts:322-335`; uniques `[teamId,email]`/`[teamId,cnpj]` (`schema.prisma:1264-1265`); normalização CDP (`lib/cdp/normalization.ts`, testada) | Checagem por telefone/e-mail normalizados na criação + import; fluxo de merge (inexistente) | **Alto se ignorar o CDP.** Reusar `normalizeCdpPhone/Email/Document`; não criar 4ª implementação de normalização (já existem 3: cdp, whatsapp, leadImport) |
| 4. Saved views | **Sim (parcial)** | `TeamFilterPreset` (`schema.prisma:1641`) + rotas crm/performance + `TeamFilterPresetsUseCase` + `FilterPresetsTriggerButton` + `CrmFiltersBar`/`PerfFiltersBar` | Coluna de escopo (crm/performance se misturam); visibilidade de time vs privada; presets no Kanban (board); migrar Carteira de localStorage para a tabela | **Alto.** NÃO criar nova tabela nem novo use case — é extensão da infra existente |
| 5. Timeline unificada | **Parcial** | `LeadActivity` (`schema.prisma:1283`) + enum `ActivityType` com 7 valores; realtime já publicado (`20260524200028_functions_rls_realtime.sql:153-154`); feeds em `LeadDialog.tsx` e `CarteiraActivityFeed.tsx` | Write-side: WhatsApp e Campanhas de E-mail não escrevem `LeadActivity`; read-side: extrair componente de timeline compartilhado (hoje embutido no monólito `LeadDialog`) | **Médio.** Dois sistemas paralelos já existem (`LeadActivity` × `CustomerEvent`/CDP). Decidir fan-in e não criar terceiro store |

---

## 3. Auditoria detalhada por artefato

### 3.1 `TeamFilterPreset` — vivo, mas com quatro lacunas

- **Schema:** `prisma/schema.prisma:1641` → `corretor_studio_team_filter_presets` (teamId, createdBy, name, description, queryJson, lastUsedAt; índices `[teamId, createdBy]` e `[teamId, lastUsedAt desc]`). **Sem coluna de escopo/contexto e sem flag de visibilidade.**
- **Backend:** rotas canônicas (thin, `getTeamAccess`, `Output`, cache invalidation):
  - `app/api/v1/teams/[teamId]/crm/filter-presets/route.ts` (+`[presetId]`, +`[presetId]/use`)
  - `app/api/v1/teams/[teamId]/performance/filter-presets/route.ts` (+idem)
  - Ambas chamam **o mesmo** `teamFilterPresetsUseCase` (`app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase.ts`) sem nenhum discriminador ⇒ **um preset salvo no CRM aparece na lista da Performance e vice-versa** (os `queryJson` têm shapes diferentes; cada tela "normaliza" o que consegue). Bug latente confirmado por leitura das duas rotas (`crm/filter-presets/route.ts:35` e `performance/filter-presets/route.ts:33` chamam `list(teamId, profileId)` idêntico).
- **Semântica de `createdBy` (pergunta do briefing):** presets são **privados do criador**. `TeamFilterPresetService.listByTeamAndCreator(teamId, createdBy)` (`app/api/services/teamFilterPreset/TeamFilterPresetService.ts:9`) filtra sempre por ambos; update/delete/use também exigem o par. Cache por `teamFilterPresets(teamId, profileId)` (`TeamFilterPresetsUseCase.ts:12-17`). Nenhum membro vê preset de outro.
- **Frontend:**
  - `app/[supabaseId]/crm/features/container/CrmFiltersBar.tsx` — 100% ligado à API (`fetch /api/v1/teams/{id}/crm/filter-presets`, linhas 191, 263, 301, 320), com `FilterPresetsTriggerButton` compartilhado (`app/[supabaseId]/components/leads-filters/FilterPresetsTriggerButton.tsx`) e memorização do último preset em localStorage (apenas o id).
  - `app/[supabaseId]/performance/features/container/Components/PerfFiltersBar.tsx` — idem, contra `/performance/filter-presets`.
  - `app/[supabaseId]/carteira/features/container/CarteiraFiltersBar.tsx` — **presets inteiros em localStorage** (linhas 204-309); nunca toca a API. Inconsistente com o resto do produto (não sincroniza entre dispositivos, não sobrevive a limpeza de browser).
  - **Kanban (board):** `BoardContainer.tsx`/`BoardHeader.tsx` usam `LeadsFiltersLayout` mas **não têm presets**. `app/[supabaseId]/pipeline/**` (tabela) também não.
- **Conclusão para o Item 4:** escopo do spec = extensão-apenas (coluna `scope` + `visibility`, presets no board, migração da Carteira). Não fabricar schema novo.

### 3.2 `TeamStatusRule` — rules engine parcial, somente para transição de status

- **Schema:** `prisma/schema.prisma:1660` → tipos `disabled_status | lead_time | combined_transition` (`TeamStatusRuleType`), `targetStatus`, `requiredStatus`, `leadTimeValue/Unit`, `requireConfirmation`, `confirmationMessage`, `isEnabled`.
- **Onde é avaliado (pergunta do briefing):** dentro de `LeadUseCase.updateLeadStatus` — `app/api/useCases/leads/LeadUseCase.ts:1360-1431`:
  - `:1344` — `leadStatusTransitionGateEvaluatorService.evaluate(...)` (gates de campos obrigatórios por status);
  - `:1360-1362` — `teamStatusRuleService.findActiveByTargetStatus(teamId, status)`;
  - `:1364-1376` — `disabled_status` bloqueia a transição;
  - `:1378-1431` — `combined_transition` com lógica OR + confirmação (`confirmRuleId`).
- **`lead_time`** não bloqueia nada: alimenta lembretes no Calendário (`TeamStatusRulesUseCase.ts:32` filtra `lead_time`; `app/[supabaseId]/calendar/features/container/CalendarContainer.tsx:209,462` renderiza eventos `"lead_time"`).
- **Confirmado: zero capacidade de dispatch de ação.** O retorno é sempre `Output` de bloqueio/confirmação/aviso para o cliente. Nenhum efeito colateral externo (WhatsApp, e-mail, notificação, atribuição).
- CRUD em `app/api/v1/teams/[teamId]/status-rules/route.ts`; UI de gestão na página de times; consumido por `BoardContext.tsx` e `PipelineContext.tsx` para UX de gating.
- **Conclusão para o Item 1:** conceito (regra por time, `isEnabled`, `createdBy`, tipos) serve de referência de modelagem, mas a entidade não deve ser estendida — propósito de automação (efeito externo assíncrono) é materialmente diferente de gating síncrono. **Hard constraint respeitada: `TeamStatusRule` não será modificada.**

### 3.3 `TeamStudioWebhookConfig` + `TeamStudioWebhookRequestLog` — INBOUND, não outbound

- **Schema:** `prisma/schema.prisma:1683` e `:1704`. Config = 1 token por time (`tokenHash`, `tokenCipher`, `tokenPreview`, `expiryMode` 24h/6meses/indeterminado, `lastUsedAt`).
- **Fluxo real:** `app/api/webhooks/studio/[teamId]/[token]/route.ts` (e variante header em `[teamId]/route.ts`) → `handleStudioWebhookLeadRequest` → cria lead a partir de payload externo. O `RequestLog` registra **requisições recebidas** (method, endpoint, statusCode, request/response payload).
- **Respostas às perguntas do briefing:** dispara em **nenhum** evento (não é emissor); **não** há filtro por tipo de evento; não há assinatura de eventos.
- Gestão: `app/api/v1/integrations/studio-webhook/route.ts` (+`/logs`), `StudioWebhookIntegrationUseCase`/`Service`, UI em `app/[supabaseId]/integrations/features/components/StudioWebhookIntegration.tsx`.
- **Conclusão para o Item 1:** não é infraestrutura reaproveitável como camada de ação/dispatch. O que se reaproveita é o *padrão* (token por time com hash+preview, log de requisições com payload, UI de integração). Um eventual webhook outbound por evento (Apêndice, item A4) seria construção nova.

### 3.4 Infra de cron/fila existente (pergunta do briefing: "identificar antes de propor infra nova")

- **Não há fila** (sem BullMQ/QStash/etc. no stack). O mecanismo assíncrono do produto é **Vercel Cron** → `vercel.json` com 9 entradas, todas em rotas `/api/v1/**/cron/*` (e-mail dispatch a cada 5 min, meeting-reminders, studio-bot-outbox, task-overdue, lead-status-batch a cada 15 min, meeting-follow-up 2x/dia, billing 1x/dia).
- **Padrão de autenticação:** header `authorization: Bearer ${CRON_SECRET}` validado na rota (ex.: `app/api/v1/notifications/cron/lead-status-batch/route.ts:8-12`), rota thin → `useCase.processBatch()` → `Output`.
- **Conclusão:** o trigger temporal do Item 1 (lead parado N dias no status X) deve nascer como mais uma rota de cron nesse padrão. Nenhuma infra nova.

### 3.5 Adapters existentes para as ações do Item 1

| Ação desejada | Adapter existente | Evidência |
|---|---|---|
| Enviar WhatsApp | `IWhatsAppProvider` (vendor-neutral, resultado do Estágio 5 do `WHATSAPP_SPEC.md`) com `sendText`/`sendMedia`; implementação `EvolutionWhatsAppProvider` (com testes) | `app/api/services/whatsapp/provider/IWhatsAppProvider.ts:97,131,140` |
| Enviar e-mail | Resend SDK usado diretamente em serviços (`LeadScheduleService`, `LeadUseCase`, `SupportRequestUseCase`); campanhas via `EmailCampaignDispatchService` + `lib/email/interpolate` | grep `from "resend"` (7 arquivos); `app/api/v1/email/cron/dispatch-scheduled/route.ts:5-9` |
| Notificação in-app | `NotificationService` + enum `NotificationType` (12 valores; novo valor exigirá migration de enum) | `app/api/services/notifications/NotificationService.ts`; `schema.prisma:433` |
| Atribuir operador | `Lead.assignedTo` já atualizado por `LeadUseCase`/`LeadRepository` | `schema.prisma:1194` |

- **Precedente de automação:** auto-respostas de WhatsApp — `ProcessWhatsAppInboundAutoResponseUseCase` + rotas `app/api/v1/teams/[teamId]/whatsapp/auto-response-rules/**` + migration `20260624145748_whatsapp-auto-response-rules.sql`. É um motor trigger→ação de propósito único (mensagem inbound → resposta), útil como referência de modelagem/UX, insuficiente como base genérica.
- **Sem colisão de naming:** não existe `Workflow*` nem `Automation*` no schema ou em `app/` (grep vazio). Nome proposto no spec: `TeamAutomationRule` (prefixo `Team*` consistente com `TeamStatusRule`/`TeamFilterPreset`).

### 3.6 `LeadActivity` / `ActivityType` — quem escreve o quê hoje (Item 5)

- **Enum real** (`schema.prisma:205`): `note | call | whatsapp | email | status_change | task | studio_bot` — o briefing citou 5; são **7** (`task` e `studio_bot` a mais).
- **Escritores automáticos confirmados:**

| Tipo | Escritor | Evidência |
|---|---|---|
| `status_change` | `LeadRepository` (`:528`, `:606`), `LeadUseCase` (`:1521`), rota finalize (`app/api/v1/leads/[id]/finalize/route.ts:222`), `PortfolioService` (`:433`, `:584`), `LeadScheduleService` (`:665`) | greps `ActivityType.status_change` |
| `task` | `TaskRepository` (atividade espelho da task; `Task.activityId` 1:1) | `schema.prisma:1327` |
| `studio_bot` | `StudioBotActionRepository` | grep `leadActivity.create` |
| `note` | anexos (`LeadAttachmentUseCase`), agendamento (resend/cancel), proposta de associado | greps |

- **Escritores manuais:** `POST /api/v1/leads/[id]/activities` aceita `note | call | whatsapp | email` (+`task`) — `app/api/v1/leads/[id]/activities/route.ts:18,24`. Ou seja: **`whatsapp`, `email` e `call` hoje só existem por lançamento manual do usuário.**
- **Gaps por módulo (a resposta do Step 0):**

| Módulo | Escreve `LeadActivity`? | Detalhe |
|---|---|---|
| CRM (status/finalize/portfolio/schedule) | **Sim** | cobertura completa de `status_change` |
| Tasks | **Sim** | via espelho 1:1 |
| Studio Bot | **Sim** | `studio_bot` |
| **WhatsApp** | **Não** | zero matches em `app/api/useCases/whatsapp/**`; mensagens vivem em `whatsapp_messages` (com `leadId`) e sincronizam para o CDP (`SyncWhatsappMessageToCdpUseCase`) |
| **Campanhas de E-mail** | **Não** | eventos vivem em analytics de e-mail (`EmailAnalyticsRepository`, `ResendWebhookUseCase`) e no CDP |
| Dialer | n/a | módulo não existe ainda; `call` reservado |
| Google Calendar (agendamento) | **Sim (indireto)** | `LeadScheduleService` registra `status_change`/notas nos fluxos de agenda |

- **Realtime (pergunta do briefing):** `corretor_studio_lead_activities` e `corretor_studio_lead_activity_reactions` **já estão** na publication `supabase_realtime` (`supabase/migrations/20260524200028_functions_rls_realtime.sql:153-154`). `whatsapp_conversations`/`whatsapp_messages` também (`20260624145748:101,107`). **Nenhuma extensão de publication é necessária** se o write-side convergir para `LeadActivity`.
- **Read-side/UI:** não existe componente unificado. O feed do CRM está **embutido no monólito** `app/[supabaseId]/components/LeadDialog.tsx` (reações, emoji picker, `resolveActivityAuthor` de `lib/lead-activities/`); a Carteira tem o seu próprio `CarteiraActivityFeed.tsx`. Extração de um componente compartilhado é o trabalho de UI do Item 5.
- **Risco arquitetural:** já existem **dois** event stores — `LeadActivity` (lead-cêntrico) e `CustomerEvent` (`schema.prisma:2992`, `corretor_studio_cdp_events`, profile-cêntrico, com chave de dedupe `[teamId, sourceType, sourceId, eventType, occurredAt]`, alimentado pelas rotas `/api/v1/cdp/sync/{crm,whatsapp,email,portfolio}`). O Item 5 deve fazer fan-in para `LeadActivity` (timeline do lead) **sem** desligar o CDP e **sem** criar um terceiro store.

### 3.7 CDP — infraestrutura de identidade relevante para o Item 3

- Tabelas: `corretor_studio_cdp_profiles`, `_identities`, `_source_links`, `_events`, `_channel_consents` (`schema.prisma:2951-3029`).
- `CustomerDataPlatformService` (`app/api/services/cdp/CustomerDataPlatformService.ts:140-196`) já faz upsert de identidades **normalizadas por time** (`type: phone | email | document | lead_id`).
- Normalização canônica e **testada**: `lib/cdp/normalization.ts` → `normalizeCdpPhone` (dígitos + DDI 55), `normalizeCdpEmail`, `normalizeCdpDocument`, `formatDisplayPhone` (+ `normalization.test.ts`).
- Há ainda duas outras normalizações paralelas (`lib/whatsapp/normalize-phone.ts`, `lib/leadImport/normalizers.ts`) — o `LeadDuplicateCheckService` do Item 3 deve padronizar em `lib/cdp/normalization.ts` e não criar a quarta.

### 3.8 Estado atual da criação de lead (Item 3)

- `CreateLead` vive em `app/api/useCases/leads/LeadUseCase.ts:122` (`createLead`), chamado pela rota de leads; import em massa por `app/api/useCases/leads/ImportMappedLeadsUseCase.ts` (que também precisa do dedup).
- Dedup hoje: apenas CNPJ exato (`:322-335`, escopo `teamId`) + uniques de banco. **Sem checagem de telefone; e-mail só estoura na constraint (erro bruto de banco, sem UX).**
- **Merge:** inexistente. Relações filhas do `Lead` que um merge precisa re-parentear (todas `onDelete: Cascade` ou equivalentes — `schema.prisma:1249-1261`): `activities`, `tasks`, `LeadsSchedule`, `LeadFinalized`, `transfers`, `portfolio`, `attachments`, `proposalReview`, `requiredDocuments`, `whatsappConversations`, `whatsappMessages`, `referredLeads` (self-relation `referrerLeadId`). Histórico de `LeadActivity` **nunca pode ser deletado** — re-parentear sempre.

### 3.9 Registro de feature (transversal)

- Qualquer tela nova com `featureSlug` (Item 1 é o caso) exige: constante em `lib/features/feature-slugs.ts`, migration de dados `bun run db:migrate:new seed-<slug>` em `backoffice_features` + `backoffice_feature_access_rules`, e atualização de `prisma/seed-backoffice-products.ts` (`FEATURES` + `ACCESS_RULES_BY_SLUG`). Padrão de slugs existente: `crm-*` (ex.: `crm-performance`, `crm-wallet`).

---

## 4. Apêndice — candidatos futuros (AUDIT-ONLY, sem estágios)

| Candidato | Abordagem do Twenty | Fit/risco no Corretor Studio |
|---|---|---|
| A1. Bulk actions (multi-select → mudança de status/atribuição em lote, export CSV) + favoritar/fixar lead | Tabela com seleção múltipla + action bar contextual; favoritos por usuário no sidebar | Fit médio. Board/Pipeline não têm multi-select hoje; mutação em lote precisa respeitar `TeamStatusRule` por lead (custo N avaliações). Favorito = tabela leve `profileId+leadId`. Risco médio |
| A2. Cmd+K com ações contextuais | Palette central (navegação + criação + ações sobre o registro focado) | Fit médio. **Não existe palette hoje** (zero `cmdk`/`CommandDialog` no app) — seria construção nova; shadcn `Command` cobre a base. Risco baixo/médio |
| A3. Permissões granulares por campo/objeto | Grants por objeto/campo por role, gerados dinamicamente | **Alta complexidade / alto risco.** Hoje o produto usa `role` + enums de função (`TeamMemberFunction`) + `FeatureAccess`; permissão por campo atravessaria todos os selects/DTOs. Fora do roadmap próximo — apenas registrar |
| A4. API pública + webhook outbound com filtro por tipo de evento | REST/GraphQL auto-gerados por objeto + webhooks por evento | Fit médio-alto (clientes pedem integração), risco médio. Hoje só existe o webhook **inbound** (§3.3); outbound por evento é construção nova — o motor do Item 1 pode emitir os eventos que esse dispatcher consumiria no futuro (projetar o `TeamAutomationRunLog` pensando nisso) |
| A5. Navegação next/prev entre registros dentro do detalhe do lead | Registro herda o contexto (filtro/ordenação) da lista de origem | Fit bom, risco baixo. `LeadDialog` é aberto por Board/CRM/Pipeline; exigiria passar a lista ordenada (ou cursores) ao dialog. Boa candidata a quick-win pós-Item 4 |

---

## 5. Premissas do briefing corrigidas pela auditoria

1. `TeamStudioWebhookConfig` **não é outbound** (§3.3) — o Item 1 não vai "estendê-lo"; a camada de ação nasce no módulo de automação.
2. `TeamFilterPreset` **não está órfão** (§3.1) — Item 4 vira extensão (escopo + visibilidade + board + Carteira), não "surfacing de tabela não usada".
3. `ActivityType` tem **7 valores**, não 5 (§3.6).
4. Realtime de `lead_activities` **já está publicado** — nenhum trabalho de publication no Item 5.
5. O produto **não tem fila**; o único mecanismo assíncrono é Vercel Cron (§3.4) — o motor do Item 1 será síncrono-pós-commit (eventos) + cron (tempo), sem infra nova.
