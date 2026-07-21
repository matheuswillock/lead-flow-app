# Spec: Bot de WhatsApp por Time — Número Dedicado + Qualificação de Leads

> **ADIADA — NÃO IMPLEMENTAR ANTES DA ESTABILIDADE DO INBOX**  
> Pré-condição: fechar dívidas bloqueadoras de [`WHATSAPP_SPEC.md`](WHATSAPP_SPEC.md) Fases 0–1 (mídia em storage, webhook async, soft-delete/audit, mic/mobile/UX).  
> Bloqueio arquitetural: `TeamWhatsAppConfig.teamId @unique` ainda impede segundo config (`purpose INBOX|BOT`).  
> Status em 2026-07-18: **zero implementação** (schema, rotas, UI, feature slug).

Adiciona ao módulo WhatsApp existente (Evolution API, inbox por time) um **segundo número de WhatsApp por time**, dedicado a um bot com identidade configurável (nome + foto), regras simples de resposta e um **motor de qualificação de leads em etapas** (perguntas sequenciais → pontuação → tag automática). Compatível com `WHATSAPP_SPEC.md` (evolução paralela do mesmo módulo — RBAC, adapter de vendor, tags), sem depender dele.

**Baseada em:** leitura direta de `prisma/schema.prisma` (seção WhatsApp), `app/api/services/whatsapp/**`, `app/api/useCases/whatsapp/**`, `app/api/infra/data/repositories/whatsapp/WhatsAppRepository.ts`, `app/[supabaseId]/whatsapp/features/**`, `prisma/seed-backoffice-products.ts`, `agents.md`, `WHATSAPP_SPEC.md`, `WHATSAPP_AUDIT.md`. Ler `WHATSAPP_AUDIT.md` antes de qualquer estágio.

**Nomenclatura usada no resto do documento:** "config INBOX" = `TeamWhatsAppConfig` existente (número humano); "config BOT" = novo config de propósito bot (número dedicado).

---

## Background

O módulo WhatsApp atual assume rigidamente **1 config por Team** — `TeamWhatsAppConfig.teamId @unique` — suposição espalhada em ao menos **18 call-sites** de `findConfigByTeamId` (13 em `WhatsAppService.ts`, mais `MarkConversationReadUseCase`, `GetMessageMediaUseCase`, `WhatsAppAutoResponseRuleUseCase.resolveConfig`, `ProcessEvoWebhookUseCase.resolveTargetTeamContext`), todos sobre `prisma.teamWhatsAppConfig.findUnique({ where: { teamId } })`, que só funciona porque `teamId` é `@unique`. Esse é o bloqueio arquitetural central deste plano: a feature pedida (bot com número diferente do time) exige um segundo `TeamWhatsAppConfig` por time, mas relaxar a unique constraint ingenuamente quebra os 18 call-sites.

O restante da fundação é reaproveitável quase sem alteração: `WhatsAppConversation`/`WhatsAppMessage` já são `configId`-scoped, `handoffMode` já é `conversationId`-scoped, `WhatsAppAutoResponseRule` já é `configId`-scoped, e `WhatsAppConversationTag`/`WhatsAppConversationTagAssignment` **já existem e já estão implementados** (confirmado por leitura direta: `ConversationTagFilter.tsx`, `ConversationTagPicker.tsx`, `WhatsAppConversationTagUseCase.ts` já existem no repo — não é mais só plano do `WHATSAPP_SPEC.md`). Boa parte do trabalho de tags que o `WHATSAPP_SPEC.md` propôs já está pronto e pode ser diretamente reaproveitado pelo bot.

### Decisões de escopo confirmadas com o usuário (não reabrir)

1. **Motor combinado**: regras simples (reaproveita `WhatsAppAutoResponseRule`) **+** fluxo de qualificação em etapas novo.
2. **Efeito no lead**: registra histórico (`LeadActivity`) **+** pontuação/tag automática — **sem** mexer em `LeadStatus`.
3. **Onde aparece**: dentro do inbox `/whatsapp` já existente, com filtro por número.
4. **Handoff**: conversa do número-bot pode ser assumida por humano, igual ao número principal.

## Goals

1. Time pode conectar um **segundo número WhatsApp** (config BOT), com fluxo de QR/conexão idêntico ao já existente, sem afetar o número humano (config INBOX).
2. Time edita **identidade do bot**: nome + avatar, ambos refletidos no próprio perfil da instância Evolution (visível para qualquer pessoa que fale com o número).
3. Time configura **regras simples** (saudação/horário/palavra-chave) para o número do bot — reaproveitando `WhatsAppAutoResponseRule` sem mudança de schema.
4. Time constrói um **fluxo de qualificação em etapas** (perguntas sequenciais, editável), disparado por gatilho configurável (primeiro contato ou palavra-chave). Respostas do lead são capturadas via webhook, pontuadas, e ao final geram **tag de conversa automática** + **`LeadActivity`** — sem tocar `LeadStatus`.
5. Conversas do número do bot aparecem no **mesmo inbox** `/whatsapp`, com filtro por número.
6. Handoff (`BOT|HUMAN`) funciona igual para conversas do config BOT.
7. Nova feature é **registrada e vendável** (`featureSlug` próprio, billing como addon).

## Non-Goals

- Mensagens interativas nativas do WhatsApp (listas/botões) — ver D6.
- Scoring por NLP/análise de texto livre — perguntas de texto livre são armazenadas como contexto, não pontuam (v1).
- Mudar `LeadStatus` automaticamente a partir do resultado da qualificação (decisão já confirmada).
- Migrar para Meta WhatsApp Cloud API (`docs/WHATSAPP_CLOUD_API_IMPLEMENTATION.md` é iniciativa própria).
- Reescrever RBAC de visibilidade, adapter `IWhatsAppProvider`, ou nome de contato (`contactNameSource`) — objeto do `WHATSAPP_SPEC.md` em paralelo; este plano é compatível mas não depende dele.
- Tocar no domínio Bethânia/Studio Bot (`app/backoffice/(app)/studio-bot/`) — isolado por governança. Nomes de modelo/enum deste plano não colidem com os já usados lá (ex.: `ActivityType.studio_bot` é do Bethânia — não reutilizado aqui, ver D9).

---

## Decisões arquiteturais

### D1 — Multi-config por Team via campo `purpose`, não relaxamento cru da unique

`TeamWhatsAppConfig` ganha `purpose WhatsAppConfigPurpose @default(INBOX)` (enum `{ INBOX, BOT }`), e a constraint muda de `teamId @unique` para `@@unique([teamId, purpose])`. `IWhatsAppRepository.findConfigByTeamId(teamId: string, purpose: WhatsAppConfigPurpose = "INBOX")` ganha um segundo parâmetro **opcional com default `"INBOX"`** — todos os 18 call-sites atuais continuam compilando e se comportando exatamente igual sem serem tocados. Call-sites novos (do bot) chamam explicitamente com `"BOT"`, ou usam um método dedicado `findBotConfigByTeamId(teamId)` (wrapper fino).

**Justificativa:** a alternativa óbvia — trocar `findConfigByTeamId` para `findFirst`/retornar array — obrigaria revisar e potencialmente quebrar 18 pontos de chamada em `WhatsAppService.ts` (1063 linhas) numa única migration arriscada. Um parâmetro opcional com default preserva 100% do comportamento atual por construção. `primaryConfigId` (espelhamento entre times do mesmo master) continua funcionando igual, mas ganha uma validação nova: o config de origem e o config espelhado precisam ter o **mesmo `purpose`** (assert de aplicação, não constraint de banco).

### D2 — Guardas de telefone: bot precisa ser um número diferente do INBOX do mesmo time

Nova função em `WhatsAppPhonePolicy.ts`: `assertBotPhoneDiffersFromInbox({ teamId, botNormalizedPhone })`, chamada em `WhatsAppService.createConfig`/fluxo de conexão quando `purpose === "BOT"` e a instância reporta um número conectado. Se `botNormalizedPhone === inboxConfig.normalizedPhone` do mesmo team → erro de negócio (`Output` inválido), mesma convenção de `assertNoConflictingPhoneOnSameTeam`.

**Justificativa:** requisito explícito do usuário ("número DIFERENTE"); sem essa guarda nada impede o time de conectar a mesma instância/número nos dois propósitos, quebrando a distinção INBOX×BOT silenciosamente.

### D3 — Identidade do bot: reaproveitar `displayName` existente + 2 campos novos de avatar, sem tabela nova

`TeamWhatsAppConfig.displayName` (já existe) passa a ter semântica dupla por `purpose`: para BOT, é o **nome público do bot** (pushado ao perfil da instância). Dois campos novos: `botAvatarPath String? @db.Text` (chave de storage) e `botAvatarUrl String? @db.Text` (URL pública).

**Justificativa:** evita tabela `WhatsAppBotIdentity` 1:1 só para 3 colunas — o resto do schema já guarda avatar como coluna simples (`WhatsAppConversation.contactAvatarUrl`). Campos ficam `null` em `purpose = INBOX`, aceitável (mesmo padrão de `qrCodeText`/`historySyncError`).

### D4 — Upload de avatar: novo bucket dedicado (código + migration SQL), service fino, mesmo padrão de `ProfileIconService`

Novo bucket `STORAGE_BUCKETS.WHATSAPP_BOT_AVATARS` em `lib/supabase/storage.ts` (`maxFileSize: 2MB`, `allowedTypes: image/jpeg|png|webp`). **Obrigatório** criar o bucket no Postgres via migration manual `bun run db:migrate:new create-whatsapp-bot-avatars-bucket` (espelhar `20260701173214_email-template-assets-bucket.sql`): `INSERT INTO storage.buckets` com `public = true` (Evolution precisa baixar `pictureUrl` publicamente), `file_size_limit = 2097152`, mime types jpeg/png/webp, + policy `SELECT` pública em `storage.objects` para o bucket. Sem essa migration, upload em projeto/fresh DB falha com "Bucket not found".

Novo `WhatsAppBotAvatarService` (thin wrapper sobre `SupabaseStorageService`, mesmo shape de `ProfileIconService`: `uploadAvatar(file, configId)`, `deleteAvatar(path)`). Rota `POST /api/v1/teams/[teamId]/whatsapp/bot/avatar` (FormData) → `UpdateWhatsAppBotIdentityUseCase`: upload → grava `botAvatarPath`/`botAvatarUrl` no config → chama `evoApiService.updateProfilePicture` → rollback do arquivo se a chamada à Evolution falhar (mesmo padrão de `app/api/v1/profiles/[supabaseId]/icon/route.ts`).

**Justificativa:** reaproveitar infraestrutura ponta a ponta; bucket dedicado (não `PROFILE_ICONS`) mantém o princípio 1 bucket = 1 domínio já seguido por todos os buckets existentes. Constantes em `lib/supabase/storage.ts` sozinhas **não** criam o bucket no Supabase.

### D5 — Novos métodos em `IEvoApiService`/`EvoApiService`: `updateProfileName`, `updateProfilePicture`

```ts
updateProfileName(params: { instanceName: string; name: string; hostBaseUrl?: string }): Promise<void>
updateProfilePicture(params: { instanceName: string; pictureUrl: string; hostBaseUrl?: string }): Promise<void>
```

Wrappers finos sobre `PUT /chat/updateProfileName/{instance}` e `PUT /chat/updateProfilePicture/{instance}` da Evolution API — mesmo padrão HTTP dos métodos já existentes (`setWebhook`, `disconnectInstance`).

**Justificativa:** confirmado por leitura de `IEvoApiService.ts` que esses métodos **não existem hoje** (só há `fetchProfilePictureUrl`, leitura). É diferente do requisito já auditado como infactível (`WHATSAPP_AUDIT.md` §3.3/§4.3 — gravar na agenda do celular do lead): aqui a escrita é no próprio perfil da instância, operação padrão da Evolution API, sem relação com a limitação de protocolo Baileys.

### D6 — Sem mensagens interativas nativas (lista/botão) na v1; escolha múltipla é texto numerado

`EvoApiService` hoje só expõe `sendTextMessage`/`sendMediaMessage`. Perguntas de múltipla escolha (`SINGLE_CHOICE`) são enviadas como **texto simples numerado** (ex.: `"1) Sim\n2) Não\n3) Talvez"`), reaproveitando `sendTextMessage`. A resposta do lead é casada por: (a) número exato da opção, (b) correspondência exata/contains do rótulo (case-insensitive, sem acento), nessa ordem — mesma filosofia de `matchMode` de `WhatsAppAutoResponseRule`.

**Justificativa:** implementar `sendList`/`sendButtons` é escopo novo real na Evolution API, com risco elevado de banimento de número em self-hosted (não é o canal oficial de templates da Meta). Manter tudo em texto simples remove esse risco e mantém o motor simples de auditar/debugar.

### D7 — Schema do motor de qualificação (5 modelos novos)

```prisma
enum WhatsAppConfigPurpose {
  INBOX
  BOT
}

enum WhatsAppQualificationTriggerMode {
  FIRST_CONTACT   // dispara na primeira mensagem inbound processada da conversa
  KEYWORD         // dispara quando o texto casa com triggerKeywords/matchMode
}

enum WhatsAppQualificationQuestionType {
  FREE_TEXT     // resposta armazenada como contexto, não pontua em v1
  SINGLE_CHOICE // opções com pontuação por opção (texto numerado, D6)
  YES_NO        // atalho de SINGLE_CHOICE com 2 opções fixas
}

enum WhatsAppQualificationSessionStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED   // expirada por TTL sem resposta (Estágio 8) ou cancelada manualmente
}

model WhatsAppQualificationFlow {
  id                String   @id @default(uuid()) @db.Uuid
  configId          String   @unique @db.Uuid   // 1 flow ativo por config BOT
  name              String   @db.Text
  isActive          Boolean  @default(false)
  triggerMode       WhatsAppQualificationTriggerMode @default(FIRST_CONTACT)
  triggerKeywords   String[] @default([])
  triggerMatchMode  WhatsAppAutoResponseMatchMode    @default(CONTAINS)
  completionMessage String?  @db.Text
  createdAt         DateTime @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @db.Timestamptz(6)

  config     TeamWhatsAppConfig               @relation(fields: [configId], references: [id], onDelete: Cascade)
  questions  WhatsAppQualificationQuestion[]
  scoreBands WhatsAppQualificationScoreBand[]
  sessions   WhatsAppQualificationSession[]

  @@map("whatsapp_qualification_flows")
}

model WhatsAppQualificationQuestion {
  id           String                            @id @default(uuid()) @db.Uuid
  flowId       String                            @db.Uuid
  order        Int
  prompt       String                            @db.Text
  inputType    WhatsAppQualificationQuestionType  @default(FREE_TEXT)
  options      Json?     // SINGLE_CHOICE/YES_NO: [{ label, value, score }]
  isRequired   Boolean                            @default(true)
  createdAt    DateTime                           @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime                           @updatedAt @db.Timestamptz(6)

  flow    WhatsAppQualificationFlow      @relation(fields: [flowId], references: [id], onDelete: Cascade)
  answers WhatsAppQualificationAnswer[]

  @@unique([flowId, order])
  @@map("whatsapp_qualification_questions")
}

model WhatsAppQualificationScoreBand {
  id                 String  @id @default(uuid()) @db.Uuid
  flowId             String  @db.Uuid
  minScore           Int
  maxScore           Int
  label              String  @db.Text   // ex: "Quente" / "Morno" / "Frio"
  conversationTagId  String? @db.Uuid   // FK opcional para WhatsAppConversationTag
  sortOrder          Int     @default(0)

  flow WhatsAppQualificationFlow  @relation(fields: [flowId], references: [id], onDelete: Cascade)
  tag  WhatsAppConversationTag?   @relation(fields: [conversationTagId], references: [id], onDelete: SetNull)

  @@index([flowId])
  @@map("whatsapp_qualification_score_bands")
}

model WhatsAppQualificationSession {
  id                   String                              @id @default(uuid()) @db.Uuid
  flowId               String                              @db.Uuid
  conversationId       String                              @db.Uuid
  leadId               String?                             @db.Uuid   // snapshot no momento da conclusão
  status               WhatsAppQualificationSessionStatus   @default(IN_PROGRESS)
  currentQuestionOrder Int                                  @default(1)
  totalScore           Int?
  resultLabel          String?                              @db.Text
  startedAt            DateTime                             @default(now()) @db.Timestamptz(6)
  completedAt          DateTime?                            @db.Timestamptz(6)
  createdAt            DateTime                             @default(now()) @db.Timestamptz(6)
  updatedAt            DateTime                             @updatedAt @db.Timestamptz(6)

  flow         WhatsAppQualificationFlow     @relation(fields: [flowId], references: [id], onDelete: Cascade)
  conversation WhatsAppConversation          @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  lead         Lead?                         @relation(fields: [leadId], references: [id], onDelete: SetNull)
  answers      WhatsAppQualificationAnswer[]

  @@index([conversationId, status])
  @@map("whatsapp_qualification_sessions")
}

model WhatsAppQualificationAnswer {
  id                  String   @id @default(uuid()) @db.Uuid
  sessionId           String   @db.Uuid
  questionId          String   @db.Uuid
  inboundMessageId     String   @db.Uuid   // obrigatório — chave de idempotência do webhook
  rawAnswerText        String? @db.Text
  selectedOptionValue  String? @db.Text
  scoreAwarded         Int      @default(0)
  answeredAt           DateTime @default(now()) @db.Timestamptz(6)

  session  WhatsAppQualificationSession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question WhatsAppQualificationQuestion   @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, questionId])
  @@unique([sessionId, inboundMessageId])
  @@map("whatsapp_qualification_answers")
}
```

E em `WhatsAppConversation`, adicionar `qualificationSessions WhatsAppQualificationSession[]` (relação inversa); em `WhatsAppConversationTag`, adicionar `scoreBands WhatsAppQualificationScoreBand[]`.

**Justificativa:** 1 flow ativo por config BOT (`@unique configId`) espelha a decisão de simplicidade "1 número por config" — o time não precisa de múltiplos fluxos concorrentes na v1. Idempotência de resposta é **em duas chaves**: `@@unique([sessionId, questionId])` (uma resposta por pergunta) **e** `@@unique([sessionId, inboundMessageId])` (mesma mensagem inbound nunca avança Q2 após Q1 — redelivery da Evolution após `currentQuestionOrder` já ter avançado). Mesmo espírito de `@@unique([conversationId, ruleType, inboundMessageId])` de `WhatsAppAutoResponseLog`. Reaproveitar `WhatsAppConversationTag` para o resultado (em vez de um enum de "temperatura do lead") mantém a tag como single source of truth de rotulagem de conversa.

### D8 — Precedência de execução: sessão de qualificação em andamento intercepta a mensagem ANTES do motor de regras simples

Novo `ProcessWhatsAppQualificationInboundUseCase`, chamado em `ProcessEvoWebhookUseCase` **antes** de `ProcessWhatsAppInboundAutoResponseUseCase` (que **não é modificado**). Fluxo:

1. Se existe `WhatsAppQualificationSession` com `status = IN_PROGRESS` para a conversa → a mensagem inbound é tratada como **resposta** à pergunta corrente:
   - **Guarda de idempotência por `inboundMessageId` (obrigatória, antes de qualquer avanço):** se já existir `WhatsAppQualificationAnswer` com o mesmo `(sessionId, inboundMessageId)`, tratar como no-op idempotente (`consumed: true`, sem reaplicar score / sem avançar `currentQuestionOrder` / sem reenviar pergunta). Isso cobre redelivery da Evolution **depois** que Q1 já avançou o order — cenário em que `@@unique([sessionId, questionId])` sozinho falha porque a mensagem seria aplicada à Q2.
   - Caso contrário: grava `WhatsAppQualificationAnswer` (claim via `@@unique([sessionId, questionId])` + `@@unique([sessionId, inboundMessageId])`, mesmo padrão CAS de `claimWelcomeSlot`), soma `scoreAwarded`, avança `currentQuestionOrder` (update condicional `WHERE currentQuestionOrder = X`), envia a próxima pergunta ou, se era a última, calcula `totalScore`, resolve `WhatsAppQualificationScoreBand`, aplica a tag (upsert em `WhatsAppConversationTagAssignment`), cria `LeadActivity` (D9) e marca `COMPLETED`. **Consome a mensagem** → regras simples são **puladas** neste ciclo.
2. Se não há sessão ativa: avalia se o `WhatsAppQualificationFlow` ativo deveria iniciar (`FIRST_CONTACT` = primeira mensagem processada da conversa; `KEYWORD` = texto casa com `triggerKeywords`/`matchMode`). Se sim, cria a sessão, envia a primeira pergunta, e **também consome a mensagem**.
3. Se nada aplicável, retorna sem consumir → `ProcessEvoWebhookUseCase` segue chamando `ProcessWhatsAppInboundAutoResponseUseCase` normalmente.

**Justificativa:** evita reescrever `pickAutoResponseRule`/`ProcessWhatsAppInboundAutoResponseUseCase` (ponto forte de idempotência já auditado) para "conhecer" qualificação — orquestração fica só no ponto de entrada. Resolve deterministicamente o conflito "resposta do lead a uma pergunta bate com uma regra KEYWORD do mesmo config" — sessão ativa sempre ganha.

### D9 — Efeito no lead: reaproveitar `ActivityType.whatsapp` + `WhatsAppLeadActivityService`, sem novo valor de enum

`IWhatsAppLeadActivityService`/`WhatsAppLeadActivityService` (já existentes, hoje só com `recordConversationMilestone`) ganham `recordQualificationResult(input: { teamId, leadId, conversationId, sessionId, flowName, totalScore, resultLabel, answers: {prompt, answer}[] })`, implementado com o **mesmo padrão** de `recordConversationMilestone`: `createIdempotentLeadActivity({ type: "whatsapp", body: "Qualificação via bot concluída: <label> (<score> pts)", sourceKey: "whatsapp:qualification_result:${sessionId}", payload: { kind: "qualification_result", sessionId, flowName, totalScore, resultLabel, answers } })`.

**Justificativa:** `ActivityType.studio_bot` já existe no enum mas **pertence ao domínio Bethânia/backoffice** — reutilizá-lo violaria o isolamento de domínio exigido por `agents.md`. Adicionar um enum novo exigiria migration de schema tocando um enum compartilhado por todo o sistema de atividades; reaproveitar `whatsapp` com discriminador em `payload.kind` é exatamente o padrão que `recordConversationMilestone` já estabeleceu.

### D10 — Regras simples (`WhatsAppAutoResponseRule`): reaproveitáveis sem mudança de schema, precisam de 1 ajuste cirúrgico de use case

`WhatsAppAutoResponseRule.configId` já é a FK certa — sem mudança de modelo. Único ponto a mudar: `WhatsAppAutoResponseRuleUseCase.resolveConfig(teamId)`, hoje implicitamente fixado em INBOX. Ganha `purpose: WhatsAppConfigPurpose = "INBOX"` propagado por todos os métodos públicos (`list`/`create`/`update`/`delete`/`toggle`) — default preserva 100% o comportamento das rotas/página `/whatsapp/auto-respostas` existentes. Novas rotas `app/api/v1/teams/[teamId]/whatsapp/bot/auto-response-rules/**` (espelhando as existentes) passam `purpose: "BOT"` explicitamente.

**Justificativa:** reaproveitamento total do motor (`pickAutoResponseRule`, `WhatsAppAutoResponseLog`, idempotência) sem duplicar nenhuma lógica.

### D11 — Inbox unificado: filtro por `configId`, não página nova

`ListConversationsUseCase` ganha `configId?: string` (passado para `WhatsAppRepository.listConversations`, que ganha `...(params.configId ? { configId: params.configId } : {})` no `baseWhere` — mesmo padrão dos filtros `leadId`/`assignedProfileId`/`tagIds` já existentes). Frontend: `IWhatsAppInboxService`/`WhatsAppInboxService`/`WhatsAppInboxContext`/`WhatsAppInboxTypes` ganham estado `selectedConfigId` e a lista de configs do time; novo componente `ConversationNumberFilter.tsx`, espelhando `ConversationTagFilter.tsx` já existente.

**Justificativa:** exigência explícita do usuário. Tecnicamente trivial porque `WhatsAppConversation.configId` já existe e já é indexado.

### D12 — Handoff: nenhuma mudança de código, só validação

`handoffMode` é campo de `WhatsAppConversation`, já `configId`-agnóstico na sua lógica (setado por `AssignConversationUseCase`/`TakeoverConversationUseCase`/`SetConversationHandoffUseCase`, todos operando por `conversationId`). Nenhum desses use cases lê `TeamWhatsAppConfig.purpose` hoje — **não há mudança necessária**.

**Ação deste plano:** validação manual explícita no Estágio 7 (assumir conversa do bot, mandar keyword, confirmar que auto-resposta some).

### D13 — UI de configuração do bot: página própria `/whatsapp/bot`, não seção dentro de `/whatsapp/configuracoes`

Nova página `app/[supabaseId]/whatsapp/bot/page.tsx` com `features/{context,services,container,components}` canônico, abas internas (Tabs shadcn) para: Conexão (reaproveita componentes de QR/status de `configuracoes/features/components`), Identidade (nome+avatar), Respostas rápidas (reaproveita `RuleCard`/`RuleFormDialog`/`OffHoursScheduleEditor`, apontando para as rotas `bot/auto-response-rules`), Qualificação (builder de perguntas, novo).

**Justificativa:** o escopo agregado (conexão + identidade + regras + builder de qualificação) é maior que qualquer seção de `/whatsapp/configuracoes` hoje — mesmo dilema que já levou `/whatsapp/auto-respostas` a ser página própria em vez de aba. `/whatsapp/bot` fica **paralela** a `/whatsapp/configuracoes` e `/whatsapp/auto-respostas`, não filha delas.

### D14 — `featureSlug` novo `whatsapp-bot`, billed separately, filho de `whatsapp`, com `productSlug` próprio

Filho de `whatsapp` na árvore de features, mas **com produto de billing distinto**. Em `prisma/seed-backoffice-products.ts`: `{ slug: "whatsapp-bot", name: "Bot de Respostas Automáticas", accessMode: ADDON, defaultAccessLevel: FULL, betaEnabled: true, inheritParentSettings: false, sortOrder: 173, parentSlug: "whatsapp", productSlug: "whatsapp-bot" }` + entrada em `FEATURES_WITHOUT_PARENT_INHERITANCE` + `ACCESS_RULES_BY_SLUG["whatsapp-bot"]` com `MASTER`/`MANAGER` = `FULL` (mesma regra de `whatsapp-settings`/`whatsapp-auto-responses` — feature de gestão, não de atendimento; `OPERATOR` não gerencia bot). Migration de dados `bun run db:migrate:new seed-whatsapp-bot-feature`, espelhando `20260624145557_seed-whatsapp-auto-responses.sql` (incluindo `"productSlug" = 'whatsapp-bot'`).

**Crítico — billing:** `FeatureAccessService.resolveBillingProductSlug` retorna `feature.productSlug` quando `billedSeparately` é true. Se `productSlug` continuar `"whatsapp"`, qualquer time que já paga o produto WhatsApp base desbloqueia `whatsapp-bot` sem comprar o addon. Por isso o product slug **deve ser `"whatsapp-bot"`** (não reutilizar `"whatsapp"`). Garantir também o mapeamento do produto no catálogo/Asaas (ou `FEATURE_PRODUCT_SLUG_MAP` se aplicável) antes do go-live do Estágio 2. `teamHasWhatsAppBotFeature` gateia pelo slug da feature `whatsapp-bot` (que por sua vez resolve billing pelo product `whatsapp-bot`).

**Justificativa:** `inheritParentSettings: false` = billed separately é a escolha certa porque a feature agrega valor de produto superior ao addon `whatsapp` base (segundo número + motor de qualificação são upsell natural). Parent slug `whatsapp` só organiza a árvore/UI; o **produto cobrado** é `whatsapp-bot`. `lib/features/feature-slugs.ts` ganha `WHATSAPP_BOT: "whatsapp-bot"`. `lib/whatsapp/team-has-whatsapp-feature.ts` ganha irmã `teamHasWhatsAppBotFeature(teamId)`.

---

## Estágios de implementação

> Cada estágio é um PR independente, na ordem abaixo. Todos os prompts assumem sessão nova sem contexto além deste documento. Validação obrigatória em todo estágio: `bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check && bun run lint:pt-br` (+ `bun run design:check` quando houver UI, + `bun run db:migrate:reset:local` quando houver migration).

### Estágio 1 — Schema base: `purpose` no config + identidade do bot + sweep de call-sites

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (D1, D2, D3). Tarefa backend, sem UI, sem rota nova.

1. Schema (prisma/schema.prisma):
   - enum WhatsAppConfigPurpose { INBOX BOT }
   - TeamWhatsAppConfig: adicionar `purpose WhatsAppConfigPurpose @default(INBOX)`,
     `botAvatarPath String? @db.Text`, `botAvatarUrl String? @db.Text`; trocar
     `teamId String @unique @db.Uuid` por `teamId String @db.Uuid` e adicionar
     `@@unique([teamId, purpose])`.
   Migration: bun run db:migrate:from-prisma -- whatsapp-bot-config-purpose
   (requer Supabase local 55322). Revisar SQL gerado — confirmar que o backfill de
   `purpose = 'INBOX'` cobre todas as linhas existentes. NÃO aplicar no remoto.

2. Backend — IWhatsAppRepository/WhatsAppRepository:
   - findConfigByTeamId(teamId: string, purpose: WhatsAppConfigPurpose = "INBOX")
     — usar prisma.teamWhatsAppConfig.findUnique({ where: { teamId_purpose: { teamId, purpose } } }).
   - Novo método findBotConfigByTeamId(teamId) = wrapper de findConfigByTeamId(teamId, "BOT").
   - Grep TODOS os call-sites de findConfigByTeamId (WhatsAppService.ts x13,
     MarkConversationReadUseCase, GetMessageMediaUseCase,
     WhatsAppAutoResponseRuleUseCase.resolveConfig, ProcessEvoWebhookUseCase
     resolveTargetTeamContext) e confirmar que NENHUM precisa de edição (o default
     "INBOX" preserva o comportamento). Documentar essa confirmação em comentário
     no topo de WhatsAppRepository.ts perto de findConfigByTeamId.

3. WhatsAppPhonePolicy.ts: nova função
   assertBotPhoneDiffersFromInbox({ teamId, botNormalizedPhone }) lançando erro se
   o número bater com o config INBOX do mesmo time. Não chamar ainda em nenhum
   lugar (será usado no Estágio 2).

4. Espelhamento (primaryConfigId): em WhatsAppService (createConfig, reuseFromTeamId),
   adicionar assert de que sourceConfig.purpose === targetPurpose antes de vincular
   primaryConfigId — lançar erro de negócio caso contrário.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run db:migrate:reset:local
```

**Não tocar:** rotas, use cases de negócio, `ProcessEvoWebhookUseCase`, `ProcessWhatsAppInboundAutoResponseUseCase`, frontend, qualquer push remoto de migration.

**Critérios de aceite:**
- `bun run db:migrate:reset:local` recria o schema do zero sem erro, com todas as linhas existentes de `team_whatsapp_configs` migradas para `purpose = 'INBOX'`.
- Suite existente do módulo continua verde sem edição.
- `grep -rn "findConfigByTeamId(" app/api` mostra apenas chamadas com 1 argumento — nenhuma chamada nova ainda.

### Estágio 2 — Feature registration + conexão do número do bot

**Prompt (copy-paste):**

```text
Leia agents.md, WHATSAPP_BOT_SPEC.md (D13, D14) e o Estágio 1 já aplicado.
Full-stack: primeiro marco visível ao usuário.

1. Feature registration (OBRIGATÓRIO nas duas partes, agents.md "Feature
   Registration Policy"):
   - lib/features/feature-slugs.ts: WHATSAPP_BOT: "whatsapp-bot"
   - prisma/seed-backoffice-products.ts: adicionar entrada em FEATURES
     (slug whatsapp-bot, parentSlug whatsapp, productSlug whatsapp-bot —
     NÃO reutilizar productSlug "whatsapp"; ver D14),
     accessMode ADDON, inheritParentSettings false, sortOrder 173) +
     FEATURES_WITHOUT_PARENT_INHERITANCE + ACCESS_RULES_BY_SLUG["whatsapp-bot"]
     (MASTER/MANAGER FULL, resto NONE via completeRuleSet).
   - Migration de dados: bun run db:migrate:new seed-whatsapp-bot-feature
     espelhando 20260624145557_seed-whatsapp-auto-responses.sql, com
     productSlug = 'whatsapp-bot'. NÃO aplicar remoto.
   - lib/whatsapp/team-has-whatsapp-feature.ts: nova função
     teamHasWhatsAppBotFeature(teamId) usando FEATURE_SLUGS.WHATSAPP_BOT.

2. Backend — reaproveitar WhatsAppService para o config BOT:
   - CreateWhatsAppConfigUseCase e WhatsAppService.createConfig ganham
     purpose: "BOT" opcional no input; quando "BOT", chamar
     teamHasWhatsAppBotFeature em vez de teamHasWhatsAppFeature, e chamar
     assertBotPhoneDiffersFromInbox (Estágio 1) após a instância conectar.
   - GetWhatsAppConfigUseCase, ReconnectWhatsAppUseCase, DisconnectWhatsAppUseCase:
     mesmo tratamento — aceitar purpose opcional (default "INBOX") e propagar para
     findConfigByTeamId.
   - Novas rotas espelhando as existentes, sob app/api/v1/teams/[teamId]/whatsapp/bot/:
     GET/POST bot/config, POST bot/reconnect, POST bot/disconnect — reaproveitam os
     mesmos use cases com purpose: "BOT" fixo no corpo da chamada (não expor purpose
     como input do cliente HTTP).

3. Frontend — nova página app/[supabaseId]/whatsapp/bot/page.tsx com
   features/{context,services,container,components} canônico. Container com Tabs
   (shadcn MCP antes de markup custom): aba "Conexão" reaproveitando os mesmos
   componentes visuais de QR/status de whatsapp/configuracoes/features/components
   (extrair um componente compartilhado se a duplicação for grande). Sidebar: item
   novo managerOnly com featureSlug "whatsapp-bot".

4. Postman: adicionar os 3 endpoints novos.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check && bun run db:migrate:reset:local
```

**Não tocar:** `/whatsapp/configuracoes` (config INBOX intocado), motor de auto-resposta, motor de qualificação (ainda não existe), inbox.

**Critérios de aceite:**
- Time sem addon `whatsapp-bot` não vê o item na sidebar e a API recusa `POST bot/config` com 403.
- Time que **só** tem o produto/billing `whatsapp` (sem produto `whatsapp-bot`) **não** desbloqueia a feature — `productSlug` distinto é obrigatório (D14).
- Time com addon conecta um número diferente do INBOX via QR — tentar conectar o mesmo número do INBOX é recusado com mensagem clara.
- Desconectar/reconectar o bot não afeta o config INBOX (testar os dois em paralelo).
- `db:migrate:reset:local` aplica a nova seed migration sem erro; `backoffice_features` tem a linha `whatsapp-bot` com `parent_slug = whatsapp` e `product_slug = whatsapp-bot`.

### Estágio 3 — Identidade do bot (avatar + nome no perfil Evolution)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (D3, D4, D5). Full-stack.

1. IEvoApiService/EvoApiService: adicionar updateProfileName({instanceName, name,
   hostBaseUrl?}) e updateProfilePicture({instanceName, pictureUrl, hostBaseUrl?}),
   wrappers de PUT /chat/updateProfileName/{instance} e
   PUT /chat/updateProfilePicture/{instance}. Seguir o padrão HTTP de
   setWebhook/disconnectInstance já existentes no arquivo.

2. lib/supabase/storage.ts: STORAGE_BUCKETS.WHATSAPP_BOT_AVATARS +
   BUCKET_CONFIGS correspondente (maxFileSize 2MB, allowedTypes image/jpeg|png|webp).

3. Migration do bucket (OBRIGATÓRIA — constantes sozinhas não criam o bucket):
   bun run db:migrate:new create-whatsapp-bot-avatars-bucket
   SQL idempotente espelhando 20260701173214_email-template-assets-bucket.sql:
   - INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     VALUES ('whatsapp-bot-avatars', 'whatsapp-bot-avatars', true, 2097152,
     ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT DO UPDATE ...
   - Policy SELECT pública em storage.objects (Evolution baixa pictureUrl via HTTP).
   NÃO aplicar no remoto sem autorização.

4. Novo app/api/services/whatsapp/WhatsAppBotAvatarService.ts (thin wrapper sobre
   SupabaseStorageService, mesmo shape de app/api/services/profile/ProfileIconService.ts).

5. Novo UpdateWhatsAppBotIdentityUseCase (Output): valida manager/master +
   teamHasWhatsAppBotFeature; aceita { name?, avatarFile? }; se avatarFile, faz
   upload, grava botAvatarPath/botAvatarUrl no config BOT, chama
   evoApiService.updateProfilePicture; se name, grava displayName do config BOT e
   chama evoApiService.updateProfileName. Rollback do arquivo recém-enviado se a
   chamada à Evolution falhar (mesmo padrão de
   app/api/v1/profiles/[supabaseId]/icon/route.ts).

6. Rota POST /api/v1/teams/[teamId]/whatsapp/bot/identity (FormData: name?, avatar?)
   e DELETE (remove avatar).

7. Frontend: aba "Identidade" em whatsapp/bot — nome (Field) + avatar
   (drag-and-drop + preview local, mesmo padrão de app/[supabaseId]/account/page.tsx).
   Lock no submit.

8. Postman: endpoint novo.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check && bun run db:migrate:reset:local
```

**Não tocar:** motor de auto-resposta, motor de qualificação, inbox, config INBOX.

**Critérios de aceite:**
- `db:migrate:reset:local` cria o bucket `whatsapp-bot-avatars` (público) sem erro; upload não falha com "Bucket not found".
- Upload de avatar reflete no próprio WhatsApp do bot (validar manualmente abrindo uma conversa nova com o número em outro aparelho).
- Falha simulada na chamada à Evolution não deixa arquivo órfão no bucket (rollback).
- Trocar avatar remove o arquivo anterior do bucket.

### Estágio 4 — Regras simples reaproveitadas para o config BOT

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (D10). Full-stack.

1. WhatsAppAutoResponseRuleUseCase.ts: todos os métodos públicos (list, create,
   update, delete, toggle) e o privado resolveConfig ganham
   purpose: WhatsAppConfigPurpose = "INBOX" no input, propagado para
   findConfigByTeamId(teamId, purpose). Rotas existentes continuam chamando sem
   passar purpose — comportamento idêntico ao atual.

2. Novas rotas app/api/v1/teams/[teamId]/whatsapp/bot/auto-response-rules/** —
   copiar a estrutura de app/api/v1/teams/[teamId]/whatsapp/auto-response-rules/**
   (GET/POST, [ruleId]/route.ts, [ruleId]/toggle/route.ts), chamando os mesmos
   métodos de WhatsAppAutoResponseRuleUseCase com purpose: "BOT".

3. Frontend: aba "Respostas rápidas" em whatsapp/bot — reaproveitar
   RuleCard.tsx, RuleFormDialog.tsx, OffHoursScheduleEditor.tsx de
   auto-respostas/features/components (importar diretamente ou extrair para pasta
   compartilhada se o import cross-feature violar a convenção do projeto).
   Serviço da feature aponta para as rotas bot/auto-response-rules.

4. Postman: endpoints novos.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check
```

**Não tocar:** `pickAutoResponseRule`, `WhatsAppAutoResponseLog`, dedupe/idempotência.

**Critérios de aceite:**
- Regra WELCOME ativa no config BOT dispara só para conversas do número do bot; regra WELCOME do config INBOX continua intocada.
- Página `/whatsapp/auto-respostas` (INBOX) segue funcionando sem nenhuma mudança visível.
- Criar regra idêntica (mesmo `type`) nos dois configs do mesmo team não gera conflito.

### Estágio 5 — Motor de qualificação: schema + builder (CRUD)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (D7). Full-stack.

1. Schema: os 5 modelos + 4 enums de D7 completos + relações inversas em
   WhatsAppConversation.qualificationSessions e WhatsAppConversationTag.scoreBands.
   Migration: bun run db:migrate:from-prisma -- whatsapp-qualification-flow.
   NÃO aplicar remoto.

2. Repositório app/api/infra/data/repositories/whatsapp/WhatsAppQualificationRepository.ts
   (padrão dos repositórios existentes): CRUD de flow (1 por config BOT, upsert),
   CRUD de questions (reordenação via transação), CRUD de score bands.

3. UseCases (Route → UseCase → Repository → Prisma, Output, manager/master only):
   WhatsAppQualificationFlowUseCase (getOrCreate, update),
   WhatsAppQualificationQuestionUseCase (list, create, update, delete, reorder),
   WhatsAppQualificationScoreBandUseCase (list, create, update, delete — validar
   faixas não sobrepostas dentro do mesmo flow).

4. Rotas sob app/api/v1/teams/[teamId]/whatsapp/bot/qualification/:
   GET/PATCH flow, GET/POST questions, PATCH/DELETE questions/[questionId],
   POST questions/reorder, GET/POST score-bands, PATCH/DELETE score-bands/[bandId].

5. Frontend: aba "Qualificação" em whatsapp/bot — builder de perguntas
   (lista reordenável — verificar shadcn MCP antes de criar custom; se não houver
   componente de drag-and-drop no design system, usar botões subir/descer),
   editor de opções por pergunta (SINGLE_CHOICE/YES_NO com pontuação por opção),
   editor de faixas de pontuação com seletor de tag (reaproveitar
   ConversationTagPicker.tsx).

6. Postman: endpoints novos.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check && bun run db:migrate:reset:local
```

**Não tocar:** webhook, `ProcessEvoWebhookUseCase`, nenhum runtime de envio de mensagem — este estágio é só o builder, o motor de execução é o Estágio 6.

**Critérios de aceite:**
- Time cria um flow com 3 perguntas (1 texto livre, 2 múltipla escolha com pontuação), reordena, define 3 faixas de pontuação cada uma com uma tag distinta.
- Faixas sobrepostas são recusadas pela API com mensagem clara.
- Flow inativo (`isActive = false`) não aparece como executável (validação reservada para o Estágio 6, mas o campo já existe e é editável aqui).

### Estágio 6 — Motor de qualificação: runtime (orquestração no webhook)

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (D6, D8, D9). Backend puro.

1. Novo ProcessWhatsAppQualificationInboundUseCase.ts (mesmo estilo defensivo de
   ProcessWhatsAppInboundAutoResponseUseCase — try/catch amplo, Output, logs
   [ClassName][execute]):
   - Se isGroupChat(externalChatId) → no-op (mesma guarda de auto-resposta).
   - Busca WhatsAppQualificationSession IN_PROGRESS da conversa. Se existir e não
     expirada (TTL 48h — se expirada, marcar ABANDONED e cair no fluxo de
     "sem sessão ativa"):
     - IDEMPOTÊNCIA por inboundMessageId (ANTES de score/avanço): se já existir
       answer com (sessionId, inboundMessageId), retornar { consumed: true } sem
       reaplicar score nem avançar currentQuestionOrder (redeivery pós-Q1).
     - grava WhatsAppQualificationAnswer com inboundMessageId obrigatório
       (claim via unique [sessionId, questionId] E [sessionId, inboundMessageId],
       mesmo padrão de "já respondida, ignorar" de auto-resposta);
     - para SINGLE_CHOICE/YES_NO, casa a resposta contra `options` (número, depois
       rótulo, conforme D6) — se não casar, reenviar a mesma pergunta com "não
       entendi, escolha uma das opções" (não avança currentQuestionOrder);
     - soma scoreAwarded, avança currentQuestionOrder via update condicional;
     - se era a última pergunta: calcula totalScore, resolve
       WhatsAppQualificationScoreBand, aplica a tag via upsert em
       WhatsAppConversationTagAssignment, chama
       whatsAppLeadActivityService.recordQualificationResult SE conversation.leadId
       existir (se não, deixar a sessão COMPLETED sem leadId — backfill no
       Estágio 8), marca sessão COMPLETED, envia completionMessage se configurada;
     - retorna { consumed: true }.
   - Se não há sessão ativa: busca WhatsAppQualificationFlow ativo do configId;
     avalia triggerMode (FIRST_CONTACT ou KEYWORD, reaproveitando a mesma função
     pura de matching já usada por auto-resposta). Se disparar: cria sessão
     IN_PROGRESS, currentQuestionOrder = 1, envia a primeira pergunta via
     whatsAppService.sendAutoResponseMessage, retorna { consumed: true }. Senão,
     { consumed: false }.

2. IWhatsAppLeadActivityService/WhatsAppLeadActivityService: adicionar
   recordQualificationResult conforme D9.

3. ProcessEvoWebhookUseCase.ts: no ponto onde hoje chama
   processWhatsAppInboundAutoResponseUseCase.execute(...), chamar ANTES
   processWhatsAppQualificationInboundUseCase.execute(...); se result.consumed,
   pular a chamada ao motor de regras simples neste ciclo. Documentar em
   comentário a precedência (D8).

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br
```

**Não tocar:** `ProcessWhatsAppInboundAutoResponseUseCase.ts` (zero edição de linha — só é chamado condicionalmente), `pickAutoResponseRule`, pipeline de idempotência de `WhatsAppAutoResponseLog`, RLS/realtime (novas tabelas não entram no realtime nesta fase).

**Critérios de aceite:**
- Enviar mensagem de um número novo com flow `FIRST_CONTACT` ativo → recebe a primeira pergunta; responder todas → recebe `completionMessage`, tag correta é aplicada à conversa, `LeadActivity` aparece na timeline do lead (se vinculado).
- Resposta que não casa com nenhuma opção de uma pergunta `SINGLE_CHOICE` reenvia a mesma pergunta, sem avançar.
- Redelivery do mesmo webhook (mesmo inboundMessageId) não duplica resposta nem
  avança a pergunta duas vezes — inclusive quando o redelivery chega após Q1 já
  ter avançado currentQuestionOrder (guarda por inboundMessageId, não só por questionId).
- Durante uma sessão ativa, uma regra `KEYWORD` de auto-resposta do mesmo config **não** dispara sobre a resposta do lead à pergunta.
- `LeadStatus` do lead nunca muda como efeito colateral da qualificação (validar explicitamente).

### Estágio 7 — Inbox unificado com filtro por número

**Prompt (copy-paste):**

```text
Leia agents.md, DESIGN.md e WHATSAPP_BOT_SPEC.md (D11). Full-stack.

1. Backend: ListConversationsUseCase ganha configId?: string no input, propagado
   para whatsAppRepository.listConversations (baseWhere ganha
   ...(params.configId ? { configId: params.configId } : {}), mesmo padrão dos
   filtros leadId/tagIds já existentes). Rota
   GET /api/v1/teams/[teamId]/whatsapp/conversations aceita ?configId= como
   querystring opcional.

2. Novo endpoint leve GET /api/v1/teams/[teamId]/whatsapp/configs (lista os
   configs do time — INBOX e BOT se existirem — com id, purpose, displayName,
   phoneNumber, status) para popular o seletor do inbox. Novo
   ListTeamWhatsAppConfigsUseCase.

3. Frontend (app/[supabaseId]/whatsapp/features/**):
   - WhatsAppInboxTypes.ts: adicionar selectedConfigId ao estado do contexto.
   - IWhatsAppInboxService/WhatsAppInboxService: método listConfigs() + threading
     de configId nas chamadas de listConversations.
   - WhatsAppInboxContext.tsx/WhatsAppInboxHook.ts: carregar configs no mount
     (dedupe/in-flight guard — regra "Request Discipline" já causou um incidente
     documentado em WHATSAPP_AUDIT.md §4.9); estado selectedConfigId, default
     "Todos os números".
   - Novo componente ConversationNumberFilter.tsx espelhando
     ConversationTagFilter.tsx; posicionar ao lado do filtro de tags na
     ConversationList.
   - ConversationItem.tsx: badge pequeno indicando o número/purpose da conversa
     quando o time tem mais de 1 config.

4. Postman: atualizar GET conversations com o querystring novo; adicionar GET configs.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run design:check
```

**Não tocar:** RLS/realtime (o filtro é client-side sobre o resultado já visível por RBAC), `WhatsAppInboxHook` realtime subscriptions.

**Critérios de aceite:**
- Time com só config INBOX não vê nenhuma UI nova de filtro por número (zero-regressão visual quando não há bot).
- Time com os dois configs filtra e vê só as conversas do número selecionado; "Todos os números" mostra ambos misturados, ordenados por `lastMessageAt` como hoje.
- Realtime continua funcionando igual para as duas categorias.

### Estágio 8 — Hardening & edge cases

**Prompt (copy-paste):**

```text
Leia agents.md e WHATSAPP_BOT_SPEC.md (seção Edge cases). Backend puro
(+ 1 endpoint de cancelamento manual).

1. Expiração de sessão travada (TTL 48h sem resposta): em
   ProcessWhatsAppQualificationInboundUseCase, ao encontrar uma sessão
   IN_PROGRESS com updatedAt mais antigo que 48h, marcar ABANDONED (lazy, sem
   cron) antes de decidir se inicia uma nova sessão. Adicionar também endpoint
   manual POST bot/qualification/sessions/[sessionId]/cancel (manager/master)
   para o time destravar uma conversa sem esperar o TTL.

2. Backfill de LeadActivity quando o lead é vinculado DEPOIS da sessão completar:
   em LinkConversationToLeadUseCase e CreateLeadFromConversationUseCase, após
   vincular leadId à conversa, buscar WhatsAppQualificationSession COMPLETED
   dessa conversationId com leadId nulo e chamar
   whatsAppLeadActivityService.recordQualificationResult retroativamente
   (idempotente via sourceKey). Atualizar WhatsAppQualificationSession.leadId
   nessas sessões.

3. Bot desconectado no meio de uma sessão em andamento: se
   whatsAppService.sendAutoResponseMessage falhar ao enviar a próxima pergunta,
   seguir o mesmo padrão já usado no motor de regras simples — NÃO avançar
   currentQuestionOrder nem marcar COMPLETED; deixar IN_PROGRESS para retry na
   próxima mensagem do lead.

4. Grupo (isGroupChat): já bloqueado no Estágio 6 — adicionar teste explícito.

5. Conflito de keyword entre WhatsAppAutoResponseRule (KEYWORD) do config BOT e
   WhatsAppQualificationFlow (triggerMode KEYWORD) do mesmo config: adicionar
   validação de aviso (não bloqueio) na API de create/update do flow — se algum
   triggerKeywords do flow colide com triggerKeywords de uma regra KEYWORD ativa
   do mesmo configId, retornar no Output um warning para a UI exibir.

6. Teste: matriz de precedência do Estágio 6 (sessão ativa > trigger de
   qualificação > regras simples) em formato de teste unitário.

7. Postman: endpoint de cancelamento manual.

Validar: bun run typecheck 2>&1 | head -20 && bun run lint && bun run governance:check
&& bun run lint:pt-br && bun run db:migrate:reset:local
```

**Não tocar:** UI (exceto exibir o warning de conflito de keyword, se trivial), motor de regras simples, RBAC.

**Critérios de aceite:**
- Sessão travada há mais de 48h é abandonada automaticamente na próxima mensagem do contato, sem intervenção manual.
- Vincular lead a uma conversa com sessão de qualificação já completada gera a `LeadActivity` retroativamente, uma única vez mesmo se a rota for chamada duas vezes.
- Desconectar o número do bot no meio de uma sessão e reconectar depois retoma exatamente na mesma pergunta, sem perder respostas já dadas.
- Conflito de keyword gera aviso visível na UI de builder, sem impedir salvar.

---

## Edge cases & error handling (transversais)

| Edge case | Onde é tratado |
|---|---|
| Grupo (`isGroupChat`) tenta iniciar qualificação | Estágio 6, guarda idêntica à de auto-resposta |
| Conversa já tem lead vinculado quando qualificação roda | Caminho normal, `LeadActivity` criada na hora (Estágio 6) |
| Conversa SEM lead quando qualificação completa | Sessão fica `COMPLETED` com `leadId = null`; backfill quando lead for vinculado depois (Estágio 8) |
| Time desconecta o número do bot em sessão ativa | Sessão não avança até reconectar; sem perda de progresso (Estágio 8) |
| Resposta do lead não casa com nenhuma opção | Repergunta, não avança `currentQuestionOrder` (Estágio 6) |
| Redelivery de webhook (mesma mensagem 2x) | Guarda por `inboundMessageId` + `@@unique([sessionId, inboundMessageId])` e `@@unique([sessionId, questionId])` (Estágio 6 / D7–D8) |
| Sessão trava indefinidamente (lead sumiu) | TTL 48h + lazy expiration + cancelamento manual (Estágio 8) |
| Conflito keyword entre regra simples e trigger de qualificação | Aviso não-bloqueante na API/UI (Estágio 8) |
| Master espelha (`primaryConfigId`) número humano de um time como bot de outro | Bloqueado por assert de `purpose` igual (Estágio 1) |
| Team tenta conectar o mesmo número nos dois propósitos | Bloqueado por `assertBotPhoneDiffersFromInbox` (Estágio 1/2) |

## Security & privacy

- Nenhum estágio altera isolamento entre masters/times — todas as rotas novas seguem `getTeamAccess()` + `access.teamId !== teamId → 403`, mesmo padrão das rotas existentes.
- Feature `whatsapp-bot` é gated por addon (`teamHasWhatsAppBotFeature`) em toda rota/use case de criação e execução — não apenas na UI.
- `LeadActivity` de qualificação nunca muta `LeadStatus` — validado explicitamente em teste (Estágio 6).
- Avatar do bot é armazenado em bucket dedicado (`WHATSAPP_BOT_AVATARS`), sem reuso de bucket de dados pessoais de perfil de usuário (`PROFILE_ICONS`).
- Push de migrations ao remoto sempre requer autorização explícita do owner (`bun run db:migrate:push:dry-run` antes).

## Success criteria

1. Time consegue conectar um número de bot diferente do número humano, configurar identidade (nome+foto), regras simples e um fluxo de qualificação — tudo pela mesma área `/whatsapp/bot`.
2. Conversas do bot aparecem no inbox único `/whatsapp`, filtráveis por número, sem regressão para times sem bot.
3. Resultado de qualificação gera tag de conversa + `LeadActivity`, nunca `LeadStatus`.
4. Handoff humano funciona idêntico para conversas do bot, sem código novo.
5. Nenhum dos 18 call-sites de `findConfigByTeamId` pré-existentes precisou de edição de comportamento (só a assinatura ganhou parâmetro opcional).
6. `governance:check`, `typecheck`, `lint`, `design:check` verdes em todos os PRs.

## Open questions

1. **Estágio 4/5:** compartilhar componentes React entre `auto-respostas/features/components` e `bot/features/components` via import direto cross-feature, ou extrair para uma pasta compartilhada? Decidir durante o Estágio 4 observando o tamanho da duplicação.
2. **Estágio 5:** builder de reordenação de perguntas — biblioteca de drag-and-drop (se já houver no design system) ou botões subir/descer? Verificar `components.json`/shadcn registry antes de decidir.
3. **Estágio 6:** TTL de 48h para abandono de sessão é um número arbitrário deste plano — confirmar com produto se faz sentido ou se deveria ser configurável por flow.
4. **D6:** se a Evolution API se mostrar confiável para listas/botões nativos no futuro, `WhatsAppQualificationQuestion.inputType = SINGLE_CHOICE` já acomoda isso sem migration — nota de forward-compatibility, não bloqueante.

## Decisions log

| Data | Decisão | Referência |
|------|---------|------------|
| 2026-07-14 | Multi-config via `purpose` com default preservando os 18 call-sites existentes, não relaxamento cru da unique | D1 |
| 2026-07-14 | Bot precisa de número diferente do INBOX do mesmo time, validado no servidor | D2 |
| 2026-07-14 | Identidade do bot reaproveita `displayName` existente + 2 campos novos de avatar, sem tabela nova | D3 |
| 2026-07-14 | Upload de avatar via bucket dedicado + service fino, mesmo padrão de `ProfileIconService` | D4 |
| 2026-07-14 | Novos métodos `updateProfileName`/`updateProfilePicture` em `IEvoApiService` | D5 |
| 2026-07-14 | Sem mensagens interativas nativas na v1; múltipla escolha é texto numerado | D6 |
| 2026-07-14 | Schema de qualificação: 5 modelos novos, 1 flow ativo por config BOT, reaproveita `WhatsAppConversationTag` | D7 |
| 2026-07-14 | Sessão de qualificação ativa intercepta a mensagem antes do motor de regras simples | D8 |
| 2026-07-14 | Resultado da qualificação vira `LeadActivity` via `ActivityType.whatsapp` + payload discriminador | D9 |
| 2026-07-14 | `WhatsAppAutoResponseRule` reaproveitado sem mudança de schema, só `resolveConfig` ganha `purpose` opcional | D10 |
| 2026-07-14 | Inbox unificado com filtro por `configId`, sem tocar RLS/realtime | D11 |
| 2026-07-14 | Handoff funciona sem código novo | D12 |
| 2026-07-14 | Página própria `/whatsapp/bot`, não seção dentro de `/whatsapp/configuracoes` | D13 |
| 2026-07-14 | `featureSlug whatsapp-bot`, billed separately, filho de `whatsapp`, manager-only | D14 |
| 2026-07-14 | Decisões de escopo confirmadas com o usuário: motor combinado, qualificação vira tag/pontuação sem mexer em `LeadStatus`, inbox unificado com filtro, handoff habilitado | Background |
| 2026-07-17 | Idempotência de qualificação também por `inboundMessageId` (além de questionId) para redelivery pós-avanço de order | D7, D8, Estágio 6 |
| 2026-07-17 | `productSlug` do bot é `whatsapp-bot` (não `whatsapp`) para billing separado real no FeatureAccessService | D14, Estágio 2 |
| 2026-07-17 | Bucket `whatsapp-bot-avatars` exige migration SQL pública (não só constante em storage.ts) | D4, Estágio 3 |
