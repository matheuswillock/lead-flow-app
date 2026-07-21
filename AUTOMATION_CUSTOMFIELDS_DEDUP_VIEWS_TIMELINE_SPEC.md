# Spec: Automação, Custom Fields, Dedup, Saved Views e Timeline Unificada

**Data:** 2026-07-06
**Base factual:** `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_AUDIT.md` (leitura obrigatória antes de executar qualquer estágio)
**Inspiração:** twentyhq/twenty (features apenas — nenhuma tecnologia importada)

---

## Restrições globais (valem para TODOS os estágios)

- Todo UseCase novo retorna `Output` (`lib/output/index.ts`). Toda rota nova em `/api/v1/**`, thin, sem Prisma direto.
- Serviços (backend e frontend) com interface + implementação concreta. Frontend novo segue `features/` page-local.
- Rotas com `getTeamAccess()` extraem `TeamContext` e propagam `ctx` na cadeia (Route → UseCase → Service → Repository); nunca refazer o par `profile.findUnique + teamMember.findUnique`.
- Migrations: schema via `bun run db:migrate:from-prisma -- <nome>`; manual/dados via `bun run db:migrate:new <nome>`; SQL idempotente; **push remoto só com autorização do dono do projeto**.
- Componentes visuais: workflow shadcn MCP (search → view → install `bunx --bun shadcn@latest add <componente>`), tokens semânticos (Warm-Precision do `DESIGN.md`), zero hex hardcoded, `FieldGroup`/`Field` em formulários, `sonner` para toasts, `Skeleton` para loading, Dialog com `max-h-[90vh] flex flex-col` + área scrollável.
- Após cada estágio: `bun run typecheck | head -20`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br` (+ `bun run design:check` em estágio com UI).
- Novo endpoint ⇒ atualizar `postman/Lead-Flow-API-Collection.json` **no mesmo estágio** (passo explícito de cada prompt).
- **Proibido tocar como efeito colateral:** `LeadStatus` (enum), `TeamStatusRule` (model/service/use case), qualquer tabela/rota `Backoffice*`, regiões geradas de `app/globals.css`, `agents.md` e adapters.
- Nada de GraphQL, Nx ou dependência nova fora do stack atual.

---

# Item 1 — Motor de Automação (trigger → condição → ação)

## Goal

Permitir que cada time configure regras do tipo "quando X acontecer com um lead, execute Y": enviar WhatsApp (template de texto), enviar e-mail (Resend), criar notificação in-app, atribuir operador. Triggers: lead criado, status mudou para X, lead parado N dias/horas no status X, reunião agendada, no-show. Com log de execução por regra e idempotência.

## Non-goals

- Builder visual de fluxo multi-passo (DAG) como o Workflows do Twenty — v1 é 1 trigger + condições simples + 1 ação por regra.
- Webhook outbound por evento (Apêndice A4 da auditoria) — o run log é projetado para habilitá-lo depois, mas não é implementado.
- Ações em massa retroativas ("aplicar a leads existentes").
- Modificar `TeamStatusRule` ou o gate de transição.

## Decisão arquitetural

1. **Entidade nova `TeamAutomationRule` + `TeamAutomationRunLog`** (tabelas `corretor_studio_team_automation_rules` / `_run_logs`). A auditoria confirmou zero colisão de naming. Não se estende `TeamStatusRule`: gating é síncrono-bloqueante; automação é efeito externo assíncrono e tolerante a falha — acoplar os dois contaminaria o caminho crítico de transição de status.
2. **Módulo isolado estilo backoffice, mas product-scoped:** pastas dedicadas `app/api/useCases/teamAutomations/`, `app/api/services/teamAutomation/`, `app/api/infra/data/repositories/teamAutomation/`, rotas `app/api/v1/teams/[teamId]/automations/**` + cron `app/api/v1/automations/cron/**`. Autorização via `getTeamAccess()` (**nunca** `getBackofficeAccess()`).
3. **Dois caminhos de execução, zero infra nova** (auditoria §3.4):
   - **Eventos** (lead_created, status_changed, meeting_scheduled, meeting_no_show): um único ponto de entrada `teamAutomationDispatcherService.dispatch(event)` chamado *após* o commit dos fluxos existentes, em `try/catch` isolado (falha de automação jamais falha a operação de origem).
   - **Tempo** (lead_idle_in_status): rota de cron `/api/v1/automations/cron/evaluate-idle` no padrão `Bearer CRON_SECRET`, agendada no `vercel.json` a cada 15 min, avaliando `Lead.statusEnteredAt`.
4. **Ações via adapter:** interface `IAutomationActionExecutor` com quatro executores concretos que **reusam** `IWhatsAppProvider.sendText`, Resend, `NotificationService` e update de `Lead.assignedTo`. Novo valor de enum `AUTOMATION_RULE` em `NotificationType` (migration de schema).
5. **Idempotência no run log:** chave única `[ruleId, leadId, dedupeKey]` — `dedupeKey` derivada do evento (ex.: `status_changed:{novoStatus}:{statusEnteredAt}` ou `idle:{status}:{dataAvaliacao}`), impedindo dupla execução em retry de cron.

### Modelagem (referência para o Estágio A1)

```prisma
enum TeamAutomationTriggerType {
  lead_created
  status_changed
  lead_idle_in_status
  meeting_scheduled
  meeting_no_show
}

enum TeamAutomationActionType {
  send_whatsapp_message
  send_email
  create_notification
  assign_operator
}

enum TeamAutomationRunStatus {
  success
  failed
  skipped
}

model TeamAutomationRule {
  id            String   @id @default(uuid()) @db.Uuid
  teamId        String   @db.Uuid
  createdBy     String   @db.Uuid
  name          String   @db.Text
  description   String?  @db.Text
  triggerType   TeamAutomationTriggerType
  triggerConfig Json     // { targetStatus?, idleValue?, idleUnit? ('hours'|'days') }
  actionType    TeamAutomationActionType
  actionConfig  Json     // { messageTemplate? , emailSubject?, emailBodyTemplate?, notifyProfileIds?, assignStrategy? }
  isEnabled     Boolean  @default(true)
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)
  // relações team/creator no padrão TeamStatusRule
  @@index([teamId, isEnabled])
  @@index([teamId, triggerType, isEnabled])
  @@map("corretor_studio_team_automation_rules")
}

model TeamAutomationRunLog {
  id           String   @id @default(uuid()) @db.Uuid
  ruleId       String   @db.Uuid
  teamId       String   @db.Uuid
  leadId       String?  @db.Uuid
  dedupeKey    String   @db.Text
  status       TeamAutomationRunStatus
  errorMessage String?  @db.Text
  payload      Json?
  executedAt   DateTime @default(now()) @db.Timestamptz(6)
  @@unique([ruleId, leadId, dedupeKey])
  @@index([teamId, executedAt(sort: Desc)])
  @@map("corretor_studio_team_automation_run_logs")
}
```

## Estágios

### Estágio A1 — Schema + registro de feature

**Prompt Codex:**

> Leia `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md` (Item 1, modelagem) e `CLAUDE.md`. Em `prisma/schema.prisma`, adicione os enums `TeamAutomationTriggerType`, `TeamAutomationActionType`, `TeamAutomationRunStatus` e os models `TeamAutomationRule` e `TeamAutomationRunLog` exatamente como na modelagem do spec, com relações `team`/`creator` no mesmo padrão de `TeamStatusRule` (schema:1660). Adicione o valor `AUTOMATION_RULE` ao enum `NotificationType`. Adicione `CRM_AUTOMATIONS: "crm-automations"` em `lib/features/feature-slugs.ts`. Gere a migration de schema com `bun run db:migrate:from-prisma -- team-automation-rules` (requer Supabase local na porta 55322), revise o SQL gerado e valide replay com `bun run db:migrate:reset:local`. Crie a migration de dados `bun run db:migrate:new seed-crm-automations` inserindo a feature `crm-automations` (filha do slug `crm`, sortOrder após as features crm existentes) e as access rules no padrão idempotente documentado em `CLAUDE.md` ("Feature Registration Policy"), e atualize `prisma/seed-backoffice-products.ts` (arrays `FEATURES` e `ACCESS_RULES_BY_SLUG` via `completeRuleSet`). Rode `bun run db:seed:backoffice-products` local para validar. NÃO aplique nada no banco remoto. Rode typecheck, lint, governance:check.

**Não tocar:** `TeamStatusRule`, `LeadStatus`, tabelas `Backoffice*` (a migration de dados apenas INSERE linhas em `backoffice_features`, sem DDL), `prisma/migrations/` legado.

**Aceite:** migration gerada pelo CLI (não manual); replay local limpo; seed local idempotente (rodar 2x sem erro); `prisma generate` ok; nenhuma alteração em models existentes além do valor novo em `NotificationType`.

### Estágio A2 — CRUD backend + Postman

**Prompt Codex:**

> Crie o CRUD de regras de automação seguindo o padrão de `app/api/v1/teams/[teamId]/status-rules/route.ts` e `teamFilterPresets` (interface + impl): repositório `app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository.ts` (+ interface), serviço `app/api/services/teamAutomation/TeamAutomationRuleService.ts` (+ `ITeamAutomationRuleService.ts`), use case `app/api/useCases/teamAutomations/TeamAutomationRulesUseCase.ts` (+ interface) retornando `Output`, e rotas: `GET/POST app/api/v1/teams/[teamId]/automations/route.ts`, `PATCH/DELETE .../automations/[ruleId]/route.ts`, `POST .../automations/[ruleId]/toggle/route.ts`, e `GET .../automations/[ruleId]/runs/route.ts` (lista paginada do run log). Todas com `getTeamAccess()`, validação do `teamId` da URL contra o contexto, Zod no body (validar `triggerConfig`/`actionConfig` por tipo com discriminated union), logs `[TeamAutomationRulesRoute][MÉTODO]`. Prisma sempre com `select` enxuto. Adicione todos os endpoints em `postman/Lead-Flow-API-Collection.json` (pasta "Automations") e variáveis novas em `postman/Lead-Flow-Environment.json` se necessário. Rode typecheck, lint, governance:check.

**Não tocar:** `LeadUseCase`, `TeamStatusRule*`, rotas existentes.

**Aceite:** CRUD completo via Postman contra ambiente local; regra com `triggerConfig` inválido para o `triggerType` é rejeitada com mensagem clara; `runs` pagina; governance:check verde (sem Prisma em rota).

### Estágio A3 — Dispatcher + executores de ação (triggers de evento)

**Prompt Codex:**

> Crie `app/api/services/teamAutomation/TeamAutomationDispatcherService.ts` (+ interface) com o método `dispatch(event: TeamAutomationEvent)` onde `TeamAutomationEvent = { type: 'lead_created' | 'status_changed' | 'meeting_scheduled' | 'meeting_no_show'; teamId: string; leadId: string; data?: Record<string, unknown> }`. O dispatcher: busca regras `isEnabled` do time por `triggerType`, avalia condição (`triggerConfig.targetStatus` quando aplicável), calcula `dedupeKey` determinística, grava `TeamAutomationRunLog` com `@@unique` como guarda de idempotência (upsert-ou-skip), e delega a um executor por `actionType` via interface `IAutomationActionExecutor` em `app/api/services/teamAutomation/executors/`: `SendWhatsAppMessageExecutor` (reusa `IWhatsAppProvider.sendText` via `WhatsAppService`, interpolando variáveis `{{lead.name}}`, `{{lead.status}}` no `messageTemplate`; skip com log se o time não tiver instância WhatsApp conectada ou o lead não tiver telefone), `SendEmailExecutor` (Resend, mesmo remetente/config dos e-mails transacionais existentes — localizar padrão em `LeadScheduleService`; skip se lead sem e-mail), `CreateNotificationExecutor` (usa `NotificationService` com `NotificationType.AUTOMATION_RULE`, destinatários de `actionConfig.notifyProfileIds` ou o `assignedTo` do lead), `AssignOperatorExecutor` (atualiza `Lead.assignedTo` respeitando membros ativos do time; registra `LeadActivity` tipo `note` documentando a atribuição automática). Toda execução em try/catch: falha vira `RunLog.status = failed` + `console.error`, nunca exceção propagada. Em seguida, adicione as chamadas de dispatch (fire-and-forget com `.catch(console.error)`, após sucesso da operação) em: `LeadUseCase.createLead` (evento lead_created), `LeadUseCase.updateLeadStatus` (status_changed, somente em `mode === "apply"` e após persistir), e nos pontos de agendamento/no-show — localize em `app/api/services/leadSchedule/LeadScheduleService.ts` onde o agendamento é criado e onde no-show/`noShowCount` ou `meetingHeald` é registrado, e despache `meeting_scheduled`/`meeting_no_show` ali. As inserções nesses arquivos devem ser mínimas (1–3 linhas por ponto, sem refatorar nada em volta). Rode typecheck, lint, governance:check.

**Não tocar:** lógica de gating de `updateLeadStatus` (linhas de `TeamStatusRule`), `TeamStatusRuleService`, assinatura de métodos existentes, fluxos de retorno/`Output` existentes.

**Aceite:** criar lead com regra `lead_created` ativa dispara a ação e gera `RunLog success`; regra desabilitada não dispara; repetir o mesmo evento não duplica execução (dedupeKey); falha do provider WhatsApp gera `RunLog failed` sem quebrar a criação do lead; transição de status bloqueada por `TeamStatusRule` NÃO dispara automação (dispatch só após persistência).

### Estágio A4 — Trigger temporal (cron) + vercel.json

**Prompt Codex:**

> Crie `app/api/useCases/teamAutomations/EvaluateIdleLeadsUseCase.ts` (+ interface, retorna `Output`) que: busca regras `lead_idle_in_status` habilitadas (todas as equipes, agrupadas por time), e para cada regra busca leads do time com `status = triggerConfig.targetStatus` e `statusEnteredAt` mais antigo que `idleValue`/`idleUnit`, com `select` mínimo e paginação defensiva (lotes de 200); para cada lead elegível monta `dedupeKey = "idle:" + status + ":" + statusEnteredAt.toISOString()` e delega ao `teamAutomationDispatcherService`. Crie a rota `GET app/api/v1/automations/cron/evaluate-idle/route.ts` no padrão exato de `app/api/v1/notifications/cron/lead-status-batch/route.ts` (Bearer `CRON_SECRET`, thin, `Output`, log `[AutomationEvaluateIdleCronRoute][GET]`). Adicione a entrada `{"path": "/api/v1/automations/cron/evaluate-idle", "schedule": "*/15 * * * *"}` em `vercel.json`. Adicione o endpoint na pasta "Automations" do `postman/Lead-Flow-API-Collection.json` (com header de autorização usando variável de ambiente do Postman). Rode typecheck, lint, governance:check.

**Não tocar:** crons existentes no `vercel.json` (apenas adicionar), demais rotas de cron.

**Aceite:** chamada local com `CRON_SECRET` correto processa e retorna contagens no `Output`; sem header → 401; lead parado além do limiar gera exatamente 1 execução por regra (re-rodar o cron não duplica, graças à dedupeKey por `statusEnteredAt`); lead que mudou de status sai da elegibilidade.

### Estágio A5 — Frontend `/automations`

**Prompt Codex:**

> Leia `DESIGN.md` e gere o design brief com a skill `corretor-studio-design` antes de escrever JSX. Crie a página `app/[supabaseId]/automations/` com a estrutura canônica `features/` (context com `*Types.ts`/`*Hook.ts`/`*Context.tsx`, services com `IAutomationsService.ts` + `AutomationsService.ts` chamando as rotas do Estágio A2, container `AutomationsContainer.tsx`, components). Gate de acesso com `useFeatureAccess` + `FEATURE_SLUGS.CRM_AUTOMATIONS` e item no sidebar seguindo o padrão das features `crm-*` existentes. UI: (1) lista de regras em cards — nome, resumo humano do trigger ("Quando o lead ficar 3 dias em Proposta"), `Badge` da ação, `Switch` de habilitar (com request lock), menu editar/excluir (`AlertDialog` para excluir); (2) dialog de criação/edição em 3 passos no mesmo dialog (Trigger → Condição → Ação) usando `FieldGroup`/`Field`, `Select` para status (labels via helper existente de status), campos condicionais por `triggerType`/`actionType`, textarea de template com hint das variáveis `{{lead.name}}`; (3) sheet "Execuções" por regra consumindo `/runs` com `Badge` de status (`success`/`failed`/`skipped` com tokens semânticos), `Skeleton` no loading e paginação. Dialog com `max-h-[90vh] flex flex-col` + corpo scrollável + `DialogFooter` fixo. Verifique componentes no shadcn MCP antes de criar qualquer markup custom (`switch`, `sheet`, `field` etc. — instalar via `bunx --bun shadcn@latest add` o que faltar). Botões de mutação com lock no primeiro clique. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** páginas existentes além do registro no sidebar; `app/globals.css` (regiões geradas).

**Aceite:** criar/editar/habilitar/desabilitar/excluir regra funciona com toasts `sonner`; usuário sem a feature não vê o item no sidebar nem acessa a rota; nenhuma cor hardcoded (`design:check` verde); estados vazio ("Nenhuma automação ainda" com CTA) e de erro presentes.

**Mockup antes/depois:** *Antes:* não existe a tela; automações limitam-se às regras de status (gating) na página de times. *Depois:* item "Automações" no sidebar do CRM; página com header (título Poppins + CTA laranja "Nova automação"), grid de cards em superfície `--surface-*` elevada, cada card com ícone do trigger (lucide `Zap`/`Clock`/`CalendarX`), resumo em `text-muted-foreground`, `Switch` à direita; dialog de criação com os 3 blocos Trigger/Condição/Ação separados por `Separator`; sheet lateral de execuções com timeline de badges verdes/vermelhos (tokens `--semantic-*`).

### Estágio A6 — Hardening

**Prompt Codex:**

> Endureça o motor de automação: (1) limite de segurança por time — máx. 50 execuções `send_whatsapp_message`/`send_email` por regra por dia (contagem no run log; excedente vira `skipped` com `errorMessage` explicativo); (2) validação profunda de `actionConfig` no use case (template não vazio, tamanho máx. 1000 chars, `notifyProfileIds` pertencem ao time); (3) truncamento/sanitização do `payload` gravado no run log (sem token, sem dados de terceiros além do necessário); (4) testes unitários do dispatcher (idempotência por dedupeKey, regra desabilitada, executor que lança erro → `failed` sem propagar) e do `EvaluateIdleLeadsUseCase` (limiar hours/days) seguindo o padrão dos testes existentes em `app/api/useCases/whatsapp/*.test.ts`; (5) revisão de índices: confirmar que as queries do cron usam `[teamId, status, ...]`/`statusEnteredAt` já indexados em `Lead`. Rode typecheck, lint, governance:check e os testes novos.

**Não tocar:** contrato das rotas do A2 (apenas validação interna).

**Aceite:** testes verdes; estouro do limite diário aparece como `skipped` na sheet de execuções; nenhum segredo em `payload` de log.

---

# Item 2 — Custom Fields por time

## Goal

Times definem campos adicionais para leads (texto, número, data, seleção, multi-seleção, booleano) sem alterar colunas do `Lead`. Campos aparecem dinamicamente no formulário de lead (RHF + Zod em runtime) e no detalhe do lead.

## Non-goals

- Custom fields em outras entidades (tasks, portfolio) — só `Lead` na v1.
- Filtros/colunas do CRM por campo custom (candidato natural a v2, casando com o Item 4).
- Qualquer mudança em colunas core do `Lead`, no fluxo de `LeadStatus` ou nas uniques `[teamId, email]`/`[teamId, cnpj]` — **as tabelas novas são 100% aditivas e não interagem com essas constraints** (auditoria §3.8).

## Decisão arquitetural

1. Duas tabelas: `LeadCustomFieldDefinition` (catálogo por time, `@@unique([teamId, key])`) e `LeadCustomFieldValue` (valor `Json` por lead+definição, `@@unique([leadId, definitionId])`, FKs `onDelete: Cascade` para lead e `Restrict` para definição ativa — desativação é soft via `isActive`, preservando valores históricos).
2. Valor sempre `Json` (tipagem interpretada pelo `type` da definição) — evita coluna por tipo e migrations por campo, espelhando o modelo do Twenty (metadata-driven) sem os objetos dinâmicos dele.
3. **Zod dinâmico no cliente e no servidor:** um builder único `buildLeadCustomFieldsSchema(definitions)` em `lib/leadCustomFields/schema.ts` usado pelo formulário (RHF resolver) e pelo use case (validação server-side) — fonte única de verdade de validação.
4. Payload de create/update de lead ganha campo **opcional** `customFields: Record<key, value>` — DTOs existentes permanecem retrocompatíveis.

### Modelagem (referência)

```prisma
enum LeadCustomFieldType {
  text
  number
  date
  select
  multi_select
  boolean
}

model LeadCustomFieldDefinition {
  id           String              @id @default(uuid()) @db.Uuid
  teamId       String              @db.Uuid
  createdBy    String              @db.Uuid
  key          String              @db.Text   // slug estável (ex.: "corretora_atual")
  label        String              @db.Text
  type         LeadCustomFieldType
  options      Json?               // [{ value, label }] para select/multi_select
  isRequired   Boolean             @default(false)
  displayOrder Int                 @default(0)
  isActive     Boolean             @default(true)
  createdAt    DateTime            @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime            @updatedAt @db.Timestamptz(6)
  @@unique([teamId, key])
  @@index([teamId, isActive, displayOrder])
  @@map("corretor_studio_lead_custom_field_definitions")
}

model LeadCustomFieldValue {
  id           String   @id @default(uuid()) @db.Uuid
  leadId       String   @db.Uuid
  definitionId String   @db.Uuid
  value        Json
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  @@unique([leadId, definitionId])
  @@index([definitionId])
  @@map("corretor_studio_lead_custom_field_values")
}
```

## Estágios

### Estágio C1 — Schema + migration

**Prompt Codex:**

> Adicione a `prisma/schema.prisma` o enum `LeadCustomFieldType` e os models `LeadCustomFieldDefinition` e `LeadCustomFieldValue` conforme a modelagem do Item 2 do spec `AUTOMATION_CUSTOMFIELDS_DEDUP_VIEWS_TIMELINE_SPEC.md`, com relações para `Team`, `Profile` (creator) e `Lead` no padrão das tabelas `corretor_studio_*` vizinhas. Não altere nenhuma coluna, índice ou unique existente de `Lead`. Gere a migration com `bun run db:migrate:from-prisma -- lead-custom-fields`, revise o SQL e valide com `bun run db:migrate:reset:local`. NÃO aplique no remoto. Rode typecheck, lint, governance:check.

**Não tocar:** `Lead` (exceto adicionar a relação inversa `customFieldValues LeadCustomFieldValue[]`), uniques existentes, `LeadStatus`.

**Aceite:** diff da migration contém somente as 2 tabelas + 1 enum + FKs; replay local limpo; `@@unique([teamId, email])`/`[teamId, cnpj]` intactos no SQL final.

### Estágio C2 — Backend (CRUD de definições + valores no fluxo de lead) + Postman

**Prompt Codex:**

> Backend de custom fields em duas partes. (1) CRUD de definições: repositório `app/api/infra/data/repositories/leadCustomField/`, serviço `app/api/services/leadCustomField/` (interface + impl), use case `app/api/useCases/leadCustomFields/` (`Output`), rotas `GET/POST app/api/v1/teams/[teamId]/lead-custom-fields/route.ts` e `PATCH/DELETE .../lead-custom-fields/[definitionId]/route.ts` (DELETE = soft delete `isActive=false`; hard delete só se não houver `LeadCustomFieldValue` — verifique FK antes), tudo com `getTeamAccess()` e propagação de `TeamContext`. Validações: `key` slug kebab-case único por time e imutável após criação; `options` obrigatório e não vazio para select/multi_select; máx. 30 definições ativas por time. (2) Valores no fluxo de lead: crie `lib/leadCustomFields/schema.ts` exportando `buildLeadCustomFieldsSchema(definitions)` (Zod dinâmico por tipo: text→string, number→number finito, date→ISO string, select→enum dos options, multi_select→array do enum, boolean→boolean; required aplica `min`/`nonempty`). Estenda os DTOs `requestToCreateLead`/`requestToUpdateLead` com `customFields?: Record<string, unknown>` opcional e, em `LeadUseCase.createLead`/`updateLead`, após persistir o lead, valide com o builder (definições ativas do time) e faça upsert dos `LeadCustomFieldValue` na mesma transação quando possível; inclua os valores (com label/type da definição) na resposta de detalhe do lead (localize o DTO de resposta em `app/api/v1/leads/DTO/leadResponseDTO.ts`). Campo required só bloqueia quando o payload traz `customFields` (retrocompatibilidade com clientes antigos) — documente isso no código do use case. Atualize `postman/Lead-Flow-API-Collection.json` (pasta "Lead Custom Fields" + exemplos de `customFields` nos requests de lead). Rode typecheck, lint, governance:check.

**Não tocar:** validações existentes de lead (CNPJ, transfer, slots), `ImportMappedLeadsUseCase` (import com custom fields é v2), uniques.

**Aceite:** definição select sem options → 400; criar lead com `customFields` válido persiste valores; valor de tipo errado → 400 com mensagem por campo; lead sem `customFields` continua criando normalmente; GET do lead devolve valores com metadados.

### Estágio C3 — UI de gestão de definições

**Prompt Codex:**

> Leia `DESIGN.md` e gere o design brief com a skill `corretor-studio-design`. Na página de gestão do time (`app/[supabaseId]/teams/page.tsx` — localize onde as regras de status são gerenciadas e siga o mesmo padrão de composição), adicione a seção/aba "Campos personalizados": tabela ou lista ordenável das definições (label, `Badge` do tipo, obrigatório, ativo), botão "Novo campo" abrindo Dialog com `FieldGroup`/`Field` (label; key gerada automaticamente do label e travada após criação; `Select` de tipo; editor de options para select/multi_select com adicionar/remover linhas usando `gap-*`; `Switch` obrigatório), reordenação por setas cima/baixo persistindo `displayOrder`, desativação via `AlertDialog`. Componentes via shadcn MCP; `sonner` para feedback; request lock nos botões. Restrinja a seção a papéis gestores usando o mesmo critério de visibilidade das regras de status nessa página. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** seção de regras de status (apenas vizinhança), demais abas da página.

**Aceite:** CRUD completo pela UI; key imutável na edição; reordenar reflete no formulário de lead (após C4); usuário operador não vê a seção.

**Mockup antes/depois:** *Antes:* página de time só com membros/regras de status. *Depois:* card "Campos personalizados" na mesma família visual dos cards existentes (borda `--border`, título Poppins 24px), lista com badges de tipo em tokens `--semantic-*`, empty state com ícone lucide `ListPlus` e CTA.

### Estágio C4 — Render dinâmico no formulário de lead

**Prompt Codex:**

> Integre os custom fields ao formulário de lead. Crie `components/forms/fields/LeadCustomFieldsSection.tsx`: recebe as definições ativas do time (buscadas 1x via hook com deduplicação de request — siga a disciplina de useEffect do `CLAUDE.md`; reuse contexto de time existente para o teamId) e renderiza cada campo por tipo com componentes shadcn (`Input`, `Input type=number`, date picker já usado no projeto, `Select`, multi-select existente do projeto — localize o padrão usado em `LeadsMultiFilter` —, `Switch`), dentro de `FieldGroup`/`Field`, na ordem de `displayOrder`. No `useLeadForm` (`hooks/useForms.tsx:60`), componha o resolver: `leadFormSchema` existente estendido em runtime com `buildLeadCustomFieldsSchema(definitions)` de `lib/leadCustomFields/schema.ts` sob a chave `customFields` (use `schema.extend`/`superRefine` sem alterar o `leadFormSchema` base exportado). Injete a seção no `components/forms/leadForm.tsx` após os campos existentes, com `Separator` e heading "Campos personalizados" (renderiza apenas se houver definição ativa), e garanta que `LeadDialog.tsx` envie/receba `customFields` nos payloads de create/update e exiba os valores no modo leitura do detalhe. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** campos core do `leadForm.tsx`, `leadFormSchema` base (composição, não mutação), fluxos de status/transfer no `LeadDialog`.

**Aceite:** time sem definição → formulário idêntico ao atual; campo required vazio bloqueia submit com mensagem inline; valores aparecem no detalhe do lead; troca de time recarrega definições sem loop de request.

**Mockup antes/depois:** *Antes:* formulário de lead fixo (dados de contato, plano, valores). *Depois:* mesma estrutura + bloco final "Campos personalizados" com os campos do time em duas colunas responsivas (`gap-4`), labels `text-sm text-muted-foreground`, obrigatórios com asterisco no padrão dos campos core.

---

# Item 3 — Detecção de duplicados + merge

## Goal

Avisar (com override consciente) quando um lead novo tem telefone ou e-mail normalizado igual ao de lead existente do mesmo time, e oferecer merge de dois leads preservando 100% do histórico (`LeadActivity` nunca é deletado).

## Non-goals

- Dedup cross-tenant (proibido — escopo sempre `teamId`).
- Dedup fuzzy por nome/razão social (v2).
- Merge automático sem ação humana.
- Substituir a resolução de identidade do CDP (continua intacta e paralela).

## Decisão arquitetural

1. **`LeadDuplicateCheckService`** em `app/api/services/leadDuplicateCheck/` (interface + impl), invocado dentro de `LeadUseCase.createLead` (`app/api/useCases/leads/LeadUseCase.ts:122`, logo após o check de CNPJ em `:322-335`) e em `ImportMappedLeadsUseCase` (modo relatório). Normalização **reusa `lib/cdp/normalization.ts`** (`normalizeCdpPhone` já produz E.164-BR determinístico; `normalizeCdpEmail`) — não criar a 4ª implementação (auditoria §3.7).
2. **UX de bloqueio suave** no padrão já existente das `TeamStatusRule` de confirmação: o use case retorna `Output(false)` com `result.duplicateCandidates` + `requiresDuplicateConfirmation: true`; o cliente reenvia com `confirmDuplicate: true` para criar mesmo assim. Sem coluna nova, sem hash persistido na v1 (busca por igualdade nos campos normalizados calculados on-the-fly sobre candidatos do time — o volume por time é baixo; se necessário, índice funcional vira otimização futura).
3. **Merge:** `MergeLeadsUseCase` + rota `POST /api/v1/leads/[id]/merge` (`id` = lead vencedor, body `{ sourceLeadId }`). Regras de dados: **o lead alvo (vencedor) vence em todo conflito; campos vazios do alvo são preenchidos pelo de origem**; filhos re-parenteados (nunca deletados): `activities`, `tasks`, `LeadsSchedule`, `LeadFinalized`, `transfers`, `attachments`, `whatsappConversations`, `whatsappMessages`, `requiredDocuments`, `referredLeads`; `portfolio`/`proposalReview` (1:1) migram apenas se o alvo não tiver. Ao final, grava `LeadActivity` tipo `note` no vencedor com payload `{ mergedLeadId, mergedLeadCode }` e **deleta o lead de origem** somente após re-parentear tudo (transação única; conferir FKs restantes antes do delete, conforme governança).
4. **Localização da UI (decisão):** aviso de duplicado no fluxo de criação (`LeadDialog`) + ação "Mesclar lead" no detalhe do lead (`LeadDialog`), restrita a papéis gestores. **Não** no Kanban card (poluiria a ação primária de drag) e **não** no Backoffice (é feature de produto; Backoffice é módulo isolado por governança).

## Estágios

### Estágio D1 — Serviço de checagem + integração no create

**Prompt Codex:**

> Crie `app/api/services/leadDuplicateCheck/ILeadDuplicateCheckService.ts` e `LeadDuplicateCheckService.ts`: método `findCandidates(ctx, { teamId, phone?, email?, excludeLeadId? })` que normaliza com `normalizeCdpPhone`/`normalizeCdpEmail` de `lib/cdp/normalization.ts` e busca leads do MESMO `teamId` cujo telefone/e-mail normalizados coincidam (busque candidatos por igualdade direta e também compare a forma normalizada em memória para cobrir dados legados sem máscara consistente; `select` mínimo: id, leadCode, name, phone, email, status, createdAt; limite 5). Escreva testes unitários do serviço (variações de máscara BR: "+55 (11) 98888-7777" vs "11988887777"; e-mail com maiúsculas). Integre em `LeadUseCase.createLead` logo após o check de CNPJ (linha ~335): se houver candidatos e `data.confirmDuplicate !== true`, retorne `new Output(false, [], ["Possível lead duplicado neste time"], { requiresDuplicateConfirmation: true, duplicateCandidates })`. Adicione `confirmDuplicate?: boolean` ao DTO `requestToCreateLead`. Em `ImportMappedLeadsUseCase`, apenas anote os duplicados detectados no relatório de import existente (sem bloquear o import). Atualize os exemplos no Postman (create lead com e sem `confirmDuplicate`). Rode typecheck, lint, governance:check e os testes.

**Não tocar:** check de CNPJ existente, uniques de banco, CDP (`CustomerDataPlatformService` intocado — apenas import das funções de `lib/cdp/normalization.ts`).

**Aceite:** criar lead com telefone igual (máscara diferente) de lead existente do time → `Output` com candidatos; reenvio com `confirmDuplicate: true` cria; leads de outro time nunca aparecem; testes verdes.

### Estágio D2 — Merge backend + Postman

**Prompt Codex:**

> Crie `app/api/useCases/leads/MergeLeadsUseCase.ts` (+ interface; `Output`) e a rota `POST app/api/v1/leads/[id]/merge/route.ts` (body Zod `{ sourceLeadId: string }`, `getTeamAccess()`, apenas papéis gestores — reuse o critério `isManagerLikeRole` de `lib/roles`). Validações: ambos os leads existem, pertencem ao MESMO `teamId` do contexto, ids distintos, origem não pode estar em transferência ativa. Execução em `prisma.$transaction`: (1) re-parentear via `updateMany` de `leadId` (origem→alvo) as tabelas: lead_activities, tasks, LeadsSchedule, LeadFinalized, LeadTransfer, LeadAttachment, LeadRequiredDocument, WhatsAppConversation, WhatsAppMessage, e `referrerLeadId` dos leads indicados; (2) migrar `LeadPortfolio` e `LeadProposalReview` somente se o alvo não tiver (senão manter o do alvo e re-parentear é impossível por unique — nesse caso deletar o da origem é PROIBIDO: aborte com mensagem clara pedindo resolução manual); (3) preencher campos vazios do alvo (email, phone, cnpj, age, currentHealthPlan, currentValue, referenceHospital, notes etc.) com os da origem — atenção às uniques `[teamId,email]`/`[teamId,cnpj]`: como a origem será deletada na mesma transação, faça o update do alvo APÓS o delete da origem; (4) deletar o lead de origem; (5) criar `LeadActivity` tipo `note` no alvo com body "Lead {leadCode} mesclado neste registro" e payload `{ mergedLeadId, mergedLeadCode, mergedBy }`. `LeadActivity` jamais é deletado. Adicione o endpoint ao Postman. Escreva teste unitário cobrindo: merge feliz, conflito de portfolio (aborta), origem inexistente, times diferentes (403/404). Rode typecheck, lint, governance:check e os testes.

**Não tocar:** `LeadUseCase.createLead`/`updateLeadStatus`, cascatas do schema (nenhuma mudança de FK).

**Aceite:** após merge, atividades das duas origens aparecem na timeline do vencedor em ordem cronológica; e-mail da origem passa a ser o do alvo se o alvo não tinha (sem violar unique); origem some das listas; testes verdes.

### Estágio D3 — UI (aviso na criação + merge no detalhe)

**Prompt Codex:**

> Leia `DESIGN.md` e gere o design brief com a skill `corretor-studio-design`. Duas entregas no `app/[supabaseId]/components/LeadDialog.tsx` e arquivos novos ao lado: (1) **Aviso de duplicado na criação** — ao receber do create o `Output` com `requiresDuplicateConfirmation`, abra `AlertDialog` "Possível duplicado" listando os candidatos (nome, leadCode, `Badge` de status com o mapa de cores de status existente, telefone/e-mail mascarados) com ações "Criar mesmo assim" (reenvia com `confirmDuplicate: true`, com request lock) e "Cancelar". Siga o padrão do dialog de confirmação de regra de status já existente nesse fluxo. (2) **Merge no detalhe** — para papéis gestores (`isManagerLikeRole`), item "Mesclar com outro lead" no menu de ações do lead: Dialog com busca de lead do time (reuse endpoint/padrão de busca de leads existente), preview lado a lado (duas colunas: "Este lead (mantido)" e "Lead selecionado (será mesclado)") com callout `text-muted-foreground` explicando as regras (histórico preservado, campos vazios preenchidos, o outro lead deixa de existir), confirmação final em `AlertDialog` exigindo digitar o leadCode da origem, chamada a `POST /api/v1/leads/[id]/merge`, toast `sonner` e refresh do board/lista. Componha em componentes novos (`LeadDuplicateWarningDialog.tsx`, `LeadMergeDialog.tsx`) em `app/[supabaseId]/components/` para não inflar o monólito `LeadDialog`. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** fluxo de drag do Kanban, ações de status existentes no dialog.

**Aceite:** criação com telefone duplicado mostra o aviso e permite override; operador comum não vê "Mesclar"; merge conclui com toast e o lead de origem desaparece do board sem reload manual da página.

**Mockup antes/depois:** *Antes:* criação duplicada só falha por CNPJ (erro seco) ou constraint de e-mail (erro bruto de banco); nenhum merge. *Depois:* AlertDialog Warm-Precision com ícone lucide `CopyX` em `--semantic-warning`, cards compactos dos candidatos; dialog de merge em duas colunas com setas indicando o fluxo de dados e footer fixo com CTA destrutivo em token `--destructive`.

---

# Item 4 — Saved Views / filtros persistentes (extensão)

## Goal

Fechar as quatro lacunas da auditoria (§3.1) sobre a infra `TeamFilterPreset` **existente**: (1) separar presets por escopo de tela; (2) visibilidade privada × compartilhada com o time; (3) presets no Kanban (board); (4) migrar Carteira de localStorage para a tabela.

## Non-goals

- Nova tabela ou novo use case (extensão de `TeamFilterPreset`/`TeamFilterPresetsUseCase` — hard constraint da auditoria: risco de duplicação alto).
- Views com ordenação/colunas customizadas por preset (só filtros, como hoje).
- Presets no Pipeline (aguarda consolidação Board × Pipeline; registrar como follow-up).

## Decisão arquitetural

1. **Coluna `scope` (`crm | performance | board | carteira`, enum Prisma) + coluna `visibility` (`private | team`, default `private`)** na tabela existente. Backfill heurístico na migration: linhas cujo `queryJson` contém chaves exclusivas da Performance (identifique 2–3 chaves do shape da `PerfFiltersBar`) → `performance`; resto → `crm`. Documentar a heurística no SQL. Corrige o bug latente de mistura CRM×Performance.
2. **Semântica de visibilidade (decisão de produto, documentada):** preset `private` = comportamento atual (só o criador vê). Preset `team` = todos os membros do time veem e usam; **editar/excluir** preset `team` só o criador ou papel gestor (`isManagerLikeRole`). `lastUsedAt` continua global por preset (não por usuário) — suficiente para ordenação, sem tabela de uso por membro na v1.
3. Rotas existentes ganham o escopo da própria URL (a rota `/crm/filter-presets` fixa `scope='crm'` etc.); board usa rota nova irmã `/board/filter-presets` no mesmo padrão. Cache tag passa a incluir escopo.

## Estágios

### Estágio V1 — Migration de escopo/visibilidade + backend

**Prompt Codex:**

> Em `prisma/schema.prisma`, adicione ao model `TeamFilterPreset` (schema:1641) os campos `scope FilterPresetScope @default(crm)` e `visibility FilterPresetVisibility @default(private)` com os enums novos (`crm|performance|board|carteira`; `private|team`), índice `[teamId, scope, visibility]`. Gere a migration com `bun run db:migrate:from-prisma -- team-filter-preset-scope-visibility` e ACRESCENTE no fim do SQL gerado o backfill idempotente: UPDATE das linhas existentes para `scope='performance'` quando o `queryJson` contiver chaves exclusivas do shape da Performance (inspecione `PerfFiltersBar.tsx` e liste as chaves no SQL como comentário), demais permanecem `crm`. Estenda `TeamFilterPresetService`/`TeamFilterPresetsUseCase`/interfaces: `list(teamId, profileId, scope)` retorna presets do escopo onde (`createdBy = profileId` OU `visibility = 'team'`); `create` aceita `scope` + `visibility`; `update`/`delete`/`markAsUsed` permitem ação sobre preset `team` de outro autor apenas se o solicitante for `isManagerLikeRole` (o role já está disponível no retorno de `getTeamAccess` — propague via `TeamContext`, sem novo lookup). Atualize as rotas `crm/filter-presets/**` e `performance/filter-presets/**` para fixarem o `scope` da URL, e o Zod do body para aceitar `visibility`. Inclua `scope` na cache tag (`lib/cache/cacheTags` e invalidation). Crie a rota irmã `app/api/v1/teams/[teamId]/board/filter-presets/**` (route + [presetId] + use) idêntica com `scope='board'`. Atualize o Postman (novas rotas board + campo visibility). Rode typecheck, lint, governance:check.

**Não tocar:** shape do `queryJson` (opaco como hoje), `TeamFilterPreset` além dos 2 campos + índice, contratos de resposta existentes (aditivo).

**Aceite:** preset criado no CRM não aparece mais na Performance (e vice-versa, pós-backfill); preset `team` criado por A aparece para B do mesmo time; B (operador) não consegue excluí-lo (403 no `Output`), gestor consegue; replay local da migration limpo e idempotente.

### Estágio V2 — UI de visibilidade nos filter bars existentes

**Prompt Codex:**

> Leia `DESIGN.md`. No componente compartilhado de presets (`app/[supabaseId]/components/leads-filters/FilterPresetsTriggerButton.tsx` e o painel de presets usado por `CrmFiltersBar.tsx` e `PerfFiltersBar.tsx`): (1) no formulário de salvar preset, adicione o controle "Visibilidade" (`RadioGroup` ou `Select` shadcn: "Somente eu" / "Todo o time") enviando `visibility`; (2) na listagem, agrupe ou marque presets compartilhados com `Badge` "Time" + tooltip com o nome do criador (o backend já retorna `createdBy`; exiba nome via dados de membros já disponíveis no contexto de time); (3) esconda ações de editar/excluir de presets `team` alheios para não-gestores (mesma regra do backend). Mantenha 100% da UX atual para presets privados. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** lógica de aplicação de filtros (`normalizePresetFilters` de cada tela), localStorage do "último preset usado".

**Aceite:** salvar como "Todo o time" torna o preset visível para outro membro; badge e permissões corretas; CRM e Performance continuam funcionando sem regressão.

**Mockup antes/depois:** *Antes:* popover de presets com lista simples pessoal. *Depois:* mesma superfície com duas seções separadas por `Separator` ("Meus filtros" / "Filtros do time"), badges `Badge variant=secondary` "Time", radio de visibilidade no form de salvar.

### Estágio V3 — Presets no Kanban (board)

**Prompt Codex:**

> Adicione saved views ao Kanban. Em `app/[supabaseId]/board/features/container/BoardHeader.tsx` (e `BoardContainer.tsx` conforme a composição atual com `LeadsFiltersLayout`), integre o `FilterPresetsTriggerButton` compartilhado apontando para `/api/v1/teams/{teamId}/board/filter-presets`, seguindo exatamente o padrão de integração do `CrmFiltersBar.tsx` (fetch, salvar preset com nome/descrição/visibilidade, aplicar preset normalizando o `queryJson` para o estado de filtros do board, marcar `use`, lembrar último preset em localStorage por time). Crie o normalizador `normalizeBoardPresetFilters` tipado sobre o estado de filtros do `BoardContext` (defaults seguros para chaves desconhecidas). Respeite a disciplina de requests (dedupe, sem refetch em loop). Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** lógica de colunas/drag do board, `BoardContext` além de expor o estado de filtros necessário, `TeamStatusRule` no board.

**Aceite:** salvar o conjunto de filtros atual do board como preset e reaplicar após reload restaura os mesmos filtros; preset de board não vaza para CRM/Performance; preset `team` de board visível aos colegas.

**Mockup antes/depois:** *Antes:* header do board só com filtros efêmeros. *Depois:* botão de presets (ícone lucide `Bookmark`) ao lado dos filtros, mesmo popover das outras telas — consistência visual total entre CRM, Performance e Kanban.

### Estágio V4 — Migrar Carteira de localStorage para a API

**Prompt Codex:**

> Migre os presets da Carteira (`app/[supabaseId]/carteira/features/container/CarteiraFiltersBar.tsx`, hoje 100% localStorage — linhas ~204-309) para a API com `scope='carteira'`: crie as rotas irmãs `app/api/v1/teams/[teamId]/carteira/filter-presets/**` (mesmo padrão do V1), troque a persistência do componente por fetches à API (siga `CrmFiltersBar.tsx`) e implemente importação one-shot: na primeira carga, se existirem presets no localStorage (`carteira:filter-presets:*`) e a API não tiver nenhum preset do usuário nesse escopo, poste-os na API e então remova a chave do localStorage (mantendo apenas a chave de "último usado"). Atualize o Postman. Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** filtros da Carteira em si (apenas persistência), `CarteiraActivityFeed`.

**Aceite:** presets antigos do localStorage aparecem na API após primeira visita (e não duplicam em visitas seguintes); presets sincronizam entre navegadores; UX idêntica à do CRM.

---

# Item 5 — Timeline unificada de atividades

## Goal

A timeline do lead mostrar TODOS os pontos de contato em ordem cronológica — notas, ligações, status, tasks, studio bot (já cobertos) **+ WhatsApp e Campanhas de E-mail (os dois gaps write-side da auditoria §3.6)** — em um componente único reutilizável com renderização por tipo e realtime.

## Non-goals

- Novo schema/event store — `LeadActivity` é o store da timeline (realtime já publicado; auditoria confirmou). O CDP (`CustomerEvent`) permanece intacto para segmentação/e-mail.
- Espelhar cada mensagem de WhatsApp como uma atividade (flood; a conversa continua morando no inbox) — só eventos-marco.
- Dialer: quando o módulo existir, escreve `ActivityType.call` — registrado aqui como contrato, sem estágio.
- Unificar `CarteiraActivityFeed` neste ciclo (candidato a follow-up após o componente compartilhado existir).

## Decisão arquitetural

1. **Write-side fan-in para `LeadActivity`** (em vez de agregação read-side de 3 fontes): mantém uma única query/subscription no cliente, realtime grátis (publication já inclui `lead_activities`) e ordenação trivial. Custo: escritas adicionais idempotentes nos módulos WhatsApp/E-mail — controlado por eventos-marco, não por mensagem.
2. **Idempotência por payload:** cada atividade automática carrega `payload.sourceKey` (ex.: `whatsapp:conversation_started:{conversationId}`, `email:dispatch:{dispatchId}`) e o escritor verifica existência antes de criar (findFirst por leadId+type+sourceKey). Sem migration — `payload Json` já existe.
3. **Eventos-marco WhatsApp:** `conversation_started` (primeira vez que uma conversa é vinculada a um lead) e `conversation_reopened` (nova mensagem após 7+ dias de silêncio na conversa vinculada) — tipo `whatsapp`, com deep link para o inbox. **Campanhas de E-mail:** 1 atividade tipo `email` por disparo a destinatário vinculável a lead (via identidade `lead_id` do CDP), payload `{ campaignId, subject, dispatchId }`.
4. **Read-side:** extrair o feed já existente do monólito `LeadDialog.tsx` para `app/[supabaseId]/components/lead-timeline/LeadActivityTimeline.tsx` (com subcomponentes por tipo), preservando reações/emoji, e adicionar os renderers `whatsapp`/`email` novos. `GET /api/v1/leads/[id]/activities` existente permanece o contrato.

## Estágios

### Estágio T1 — Write-side WhatsApp (eventos-marco)

**Prompt Codex:**

> No módulo WhatsApp, crie `app/api/services/whatsapp/WhatsAppLeadActivityService.ts` (+ interface): método `recordConversationMilestone({ ctx?, teamId, leadId, conversationId, milestone: 'conversation_started' | 'conversation_reopened', preview? })` que cria `LeadActivity` `{ type: 'whatsapp', body: resumo curto em pt-BR ("Conversa de WhatsApp iniciada"), payload: { sourceKey, conversationId, milestone, preview } }` com guarda de idempotência (findFirst por leadId + type + `payload.sourceKey` antes de criar; para `conversation_reopened` inclua a data no sourceKey). Localize os pontos de vínculo conversa↔lead no fluxo atual (busque em `app/api/useCases/whatsapp/ProcessEvoWebhookUseCase.ts` e nos use cases de criação/vínculo de conversa onde `leadId` é definido em `WhatsAppConversation`) e chame o serviço: (a) quando uma conversa passa a ter `leadId` → `conversation_started`; (b) quando chega mensagem inbound em conversa vinculada cuja última mensagem anterior tem mais de 7 dias → `conversation_reopened`. Chamadas em try/catch isolado com `console.error` — falha na atividade nunca quebra o processamento do webhook. Teste unitário do serviço (idempotência, reopened só após 7 dias). Rode typecheck, lint, governance:check e os testes.

**Não tocar:** persistência de `WhatsAppMessage`/`WhatsAppConversation`, sync com CDP (`SyncWhatsappMessageToCdpUseCase`), RBAC do inbox.

**Aceite:** vincular conversa a lead gera exatamente 1 atividade `whatsapp` (reprocessar webhook não duplica); mensagem após 8 dias gera `conversation_reopened`; mensagens em sequência normal não geram nada.

### Estágio T2 — Write-side Campanhas de E-mail

**Prompt Codex:**

> No dispatch de campanhas (`app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService.ts` e o cron `app/api/v1/email/cron/dispatch-scheduled/route.ts`), após o envio bem-sucedido a cada destinatário, resolva o lead vinculado ao contato: use a identidade CDP `type='lead_id'` do profile destinatário (via `CdpRepository`; se o destinatário não tiver profile/lead vinculado, não faça nada). Para cada lead resolvido, crie `LeadActivity` `{ type: 'email', body: "E-mail enviado: {assunto}", createdBy: null, payload: { sourceKey: "email:dispatch:" + dispatchId, campaignId, subject, dispatchId } }` com a mesma guarda de idempotência do Estágio T1 (extraia a guarda para helper compartilhado `app/api/infra/data/repositories/leadActivity/` ou `lib/lead-activities/` — localize onde `resolveActivityAuthor` vive e siga o padrão do módulo). Envolva em try/catch isolado: falha na atividade não afeta o dispatch nem os créditos. Teste unitário da resolução contato→lead e da idempotência. Rode typecheck, lint, governance:check e os testes.

**Não tocar:** contagem de créditos (`EmailCreditService`), analytics/webhooks Resend existentes, CDP sync.

**Aceite:** campanha para segmento com contatos vinculados a leads gera 1 atividade `email` por lead; re-execução do cron não duplica; contato sem lead não gera nada nem loga erro.

### Estágio T3 — Componente unificado `LeadActivityTimeline` + realtime

**Prompt Codex:**

> Leia `DESIGN.md` e gere o design brief com a skill `corretor-studio-design`. Extraia o feed de atividades hoje embutido em `app/[supabaseId]/components/LeadDialog.tsx` para `app/[supabaseId]/components/lead-timeline/LeadActivityTimeline.tsx` + subcomponentes por tipo (`TimelineItemNote`, `TimelineItemStatusChange`, `TimelineItemTask`, `TimelineItemWhatsApp`, `TimelineItemEmail`, `TimelineItemStudioBot`, `TimelineItemCall`), preservando 100% do comportamento atual (reações com emoji picker, `resolveActivityAuthor` de `lib/lead-activities/`, ordenação `createdAt desc`, criação manual de atividade). Renderização por tipo com ícone lucide e token semântico consistentes (`MessageCircle` para whatsapp, `Mail` para email, `ArrowRightLeft` para status_change, `Phone` para call, `Bot` para studio_bot, `ClipboardList` para task): itens `whatsapp` mostram o marco + preview e deep link "Abrir conversa" para o inbox do WhatsApp (rota do módulo com a conversa do `payload.conversationId`); itens `email` mostram assunto + campanha. Confirme que a subscription realtime existente do dialog (tabela `corretor_studio_lead_activities`, já publicada) cobre os tipos novos sem mudança de publication — apenas garanta que o handler de INSERT renderiza qualquer `ActivityType`. `LeadDialog.tsx` passa a consumir o componente extraído (redução líquida de código no monólito; nenhuma mudança de comportamento). Filtro visual por tipo no topo da timeline (`ToggleGroup` shadcn com os tipos, estado local). Rode typecheck, lint, governance:check, design:check, lint:pt-br.

**Não tocar:** `GET/POST /api/v1/leads/[id]/activities` (contrato mantido), `CarteiraActivityFeed` (follow-up), publication do Supabase.

**Aceite:** timeline do lead exibe nota manual, mudança de status, task, marco de WhatsApp (T1) e envio de campanha (T2) em ordem cronológica com visual distinto por tipo; nova atividade chega via realtime sem refresh; reações continuam funcionando; deep link abre a conversa correta; filtro por tipo funciona.

**Mockup antes/depois:** *Antes:* feed do `LeadDialog` com aparência única para tudo (nota genérica), sem eventos de WhatsApp/e-mail automáticos. *Depois:* timeline com trilho vertical (`--border`), nós com ícone circular por tipo em `--surface-*` elevado, cartões compactos — status_change com par de badges "de → para", whatsapp com preview em itálico `text-muted-foreground` e link laranja "Abrir conversa", email com assunto em Inter 14px médio; barra de filtro por tipo no topo (ToggleGroup pill).

---

## Ordem de execução recomendada e dependências

| Ordem | Estágio | Dependência |
|---|---|---|
| 1 | V1 → V2 → V3 → V4 (Item 4) | nenhuma — menor risco, valor imediato, corrige bug latente CRM×Performance |
| 2 | T1 → T2 → T3 (Item 5) | nenhuma (T3 depende de T1/T2 para ter o que exibir) |
| 3 | D1 → D2 → D3 (Item 3) | nenhuma |
| 4 | C1 → C2 → C3 → C4 (Item 2) | nenhuma |
| 5 | A1 → A2 → A3 → A4 → A5 → A6 (Item 1) | maior superfície; A3 toca `LeadUseCase`/`LeadScheduleService` — executar após D1/D2 para evitar conflitos de merge nesses arquivos |

Cada estágio = 1 branch + 1 PR (nunca commitar em `main`/`develop`), com o checklist de PR do `CLAUDE.md` — incluindo o item de migration e o de Postman quando aplicável.

## Critérios de sucesso (macro)

- Zero mudanças em `LeadStatus`, `TeamStatusRule` e módulo Backoffice ao final dos 5 itens (verificável por diff dos arquivos proibidos).
- `bun run governance:check` verde em todos os PRs sem novas entradas de allowlist.
- Nenhuma nova dependência em `package.json` além de componentes shadcn.
- Todas as migrations geradas pelo Supabase CLI, com replay local validado; push remoto somente com autorização explícita do dono do projeto.

## Open questions (não bloqueiam os estágios 1–2 da ordem recomendada)

1. **Item 1 / envio de e-mail:** o remetente das automações deve usar o domínio/config de e-mail do time (módulo de campanhas) ou o transacional global (Resend padrão)? Spec assume transacional global na v1 (A3); confirmar com o dono do produto.
2. **Item 4 / Pipeline:** a tela `pipeline` (tabela) receberá presets ou será absorvida pelo CRM? Registrado como follow-up do V3.
3. **Item 5 / e-mails transacionais de agenda:** convites/lembretes de reunião enviados por `LeadScheduleService` já geram `status_change`/notas; decidir se também merecem atividade `email` dedicada (fora do escopo T2, que cobre campanhas).
