# WhatsApp Cloud API - Plano de Implementacao (Corretor Studio)

## Objetivo
Implementar notificacoes de WhatsApp para agendamentos de reuniao no Corretor Studio usando a **Meta WhatsApp Cloud API oficial**, com foco em confiabilidade operacional, rastreabilidade e aderencia de compliance.

## Decisoes Fechadas
- Baseline principal: **branch `main`**.
- Provedor de producao: **Meta WhatsApp Cloud API**.
- Escopo de mensagens da V1:
  - confirmacao no momento do agendamento;
  - lembrete 2 horas antes da reuniao.
- Politica de consentimento: **opt-in explicito obrigatorio**.
- Estrategia de credenciais:
  - V1: credencial global por ambiente;
  - V2: evolucao para credenciais por time (multi-tenant).
- Evolution Go: fora do escopo de implementacao desta entrega.

## Estado Atual (Referencia de Arquitetura)
- `main`: fluxo de agendamento centralizado em rota `app/api/v1/leads/[id]/schedule/route.ts`.
- `develop`: existe `LeadScheduleService` e tracking de `inviteDispatch` (Google/Resend).
- Integracao Meta existente no projeto e voltada a **Lead Ads**, nao a envio de mensagens WhatsApp.

## Arquitetura Alvo

```text
UI (Board/CRM/Pipeline)
  -> POST /api/v1/leads/:id/schedule
      -> persiste agendamento
      -> cria dispatch(es) WhatsApp (outbox)
  -> resposta rapida para UI

Worker (cron)
  -> busca dispatch pendente e vencido
  -> envia template via Meta Cloud API
  -> atualiza status/providerMessageId/tentativas

Webhook Meta WhatsApp
  -> recebe sent/delivered/read/failed
  -> atualiza dispatch
  -> registra atividade no lead
```

## Escopo Funcional

### V1
- Enfileirar confirmacao no agendamento.
- Enfileirar lembrete para `meetingDate - 2h`.
- Nao enviar se:
  - lead sem opt-in explicito;
  - telefone invalido sem normalizacao E.164.
- Falha de WhatsApp nao deve impedir persistencia do agendamento.

### V2 (planejada, fora da entrega inicial)
- Credenciais por `teamId`.
- Rotacionamento seguro de segredos por tenant.
- Selecao de numero/template por time.

## Modelagem de Dados (Prisma)

### Ajustes em `Lead`
Adicionar campos de consentimento e telefone de envio:

```prisma
model Lead {
  // ...campos existentes
  whatsappPhoneE164      String?   @db.Text
  whatsappOptInAt        DateTime? @db.Timestamptz(6)
  whatsappOptInSource    String?   @db.Text
  whatsappOptInTextVersion String? @db.Text
  whatsappOptOutAt       DateTime? @db.Timestamptz(6)
}
```

### Nova entidade de dispatch
Rastrear lifecycle completo do envio por agendamento:

```prisma
enum ScheduleDispatchChannel {
  whatsapp
}

enum ScheduleDispatchType {
  schedule_confirmation
  schedule_reminder_2h
}

enum ScheduleDispatchStatus {
  pending
  processing
  sent
  delivered
  read
  failed
  canceled
}

model LeadScheduleDispatch {
  id                String                 @id @default(uuid()) @db.Uuid
  leadId            String                 @db.Uuid
  scheduleId        String                 @db.Uuid
  teamId            String                 @db.Uuid
  channel           ScheduleDispatchChannel
  type              ScheduleDispatchType
  status            ScheduleDispatchStatus @default(pending)
  provider          String                 @db.Text // meta_cloud_api
  templateName      String                 @db.Text
  templateLanguage  String                 @default("pt_BR") @db.Text
  recipient         String                 @db.Text // E.164
  payload           Json?
  providerMessageId String?                @db.Text
  dedupeKey         String                 @unique @db.Text
  attempts          Int                    @default(0)
  maxAttempts       Int                    @default(5)
  scheduledFor      DateTime               @db.Timestamptz(6)
  sentAt            DateTime?              @db.Timestamptz(6)
  deliveredAt       DateTime?              @db.Timestamptz(6)
  readAt            DateTime?              @db.Timestamptz(6)
  failedAt          DateTime?              @db.Timestamptz(6)
  canceledAt        DateTime?              @db.Timestamptz(6)
  lastError         String?                @db.Text
  createdAt         DateTime               @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime               @updatedAt @db.Timestamptz(6)

  lead     Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  schedule LeadsSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  @@index([teamId, status, scheduledFor])
  @@index([leadId])
  @@index([scheduleId])
  @@map("lead_schedule_dispatches")
}
```

## Contratos de Servico

### `IMetaWhatsAppService`
```ts
interface SendTemplateInput {
  to: string; // E.164
  templateName: string;
  languageCode: "pt_BR";
  components?: unknown[];
}

interface SendTemplateResult {
  isValid: boolean;
  providerMessageId?: string;
  status?: "sent" | "failed";
  error?: string;
}

interface IMetaWhatsAppService {
  sendTemplateMessage(input: SendTemplateInput): Promise<SendTemplateResult>;
  validateWebhookSignature(signature: string, body: string): boolean;
}
```

## Endpoints Planejados

### 1) Webhook WhatsApp (infra)
- `GET /api/webhooks/meta/whatsapp`
  - valida `hub.mode`, `hub.verify_token`, `hub.challenge`.
- `POST /api/webhooks/meta/whatsapp`
  - valida assinatura;
  - processa eventos `sent`, `delivered`, `read`, `failed`;
  - atualiza `LeadScheduleDispatch`.

### 2) Worker de dispatch (infra)
- `POST /api/cron/whatsapp-dispatch`
  - protegido por `CRON_SECRET`;
  - processa lotes de dispatch com `status = pending` e `scheduledFor <= now`.

### 3) Ajuste no agendamento (produto)
- `POST /api/v1/leads/:id/schedule`
  - apos persistencia do agendamento, cria dispatch de confirmacao e lembrete 2h;
  - retornos continuam compativeis com contrato atual.

## Regras de Negocio
- So enfileirar WhatsApp se houver:
  - `whatsappOptInAt` preenchido;
  - telefone E.164 valido (`whatsappPhoneE164`).
- Reagendamento:
  - cancelar dispatch pendente de lembrete antigo;
  - gerar novo lembrete para novo horá  rio.
- Cancelamento de reuniao:
  - cancelar dispatches pendentes da reuniao.
- Idempotencia:
  - `dedupeKey` por `scheduleId + type + scheduledFor`.
- Retry:
  - aplicar backoff em erro transitorio (HTTP 429/5xx);
  - marcar `failed` ao exceder `maxAttempts`.

## Variaveis de Ambiente
Adicionar variaveis dedicadas para WhatsApp:

```env
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WHATSAPP_APP_SECRET=
META_WHATSAPP_VERIFY_TOKEN=
CRON_SECRET=
```

Observacao:
- manter separacao entre envs de Meta Lead Ads e Meta WhatsApp para evitar ambiguidade operacional.

## Templates Utility (V1)
- `cs_schedule_confirmation_v1`
- `cs_schedule_reminder_2h_v1`
- linguagem: `pt_BR`
- conteudo sem CTA promocional para manter classificacao Utility.

## Observabilidade e Auditoria
- `console.info` para fluxo, `console.error` para falhas.
- registrar atividade no lead quando:
  - dispatch for criado;
  - status mudar para `sent/delivered/read/failed`.
- incluir `providerMessageId` no payload de auditoria.

## Atualizacoes Obrigatorias de Contrato
- Atualizar `postman/Lead-Flow-API-Collection.json` com:
  - webhook WhatsApp;
  - worker cron (se exposto para testes);
  - exemplos de retorno de agendamento com resumo de dispatch.
- Atualizar `postman/Lead-Flow-Environment.json` com novas variaveis.

## Plano de Entrega

### Fase 1 - Fundacao
- Migration Prisma (consentimento + dispatch).
- Servico WhatsApp oficial (interface + implementacao).
- Normalizacao de telefone E.164.

### Fase 2 - Fluxo de Agendamento
- Integrar enqueue no `POST /api/v1/leads/:id/schedule`.
- Aplicar regras de reagendamento/cancelamento.

### Fase 3 - Processamento e Retorno
- Worker cron para envio e retry.
- Webhook para status de entrega/leitura/falha.

### Fase 4 - Operacao e Hardening
- Dashboards de monitoramento.
- Alertas basicos de falha.
- Runbook de suporte.

## Testes e Criterios de Aceite
1. Agendamento com opt-in cria 2 dispatches (`confirmation`, `reminder_2h`).
2. Agendamento sem opt-in nao cria dispatch e registra motivo.
3. Worker envia confirmacao e grava `providerMessageId`.
4. Webhook marca `delivered/read/failed` corretamente.
5. Reagendamento invalida lembrete antigo e cria novo.
6. Retry funciona em 429/5xx e respeita limite de tentativas.
7. Sem duplicidade de envio para mesma `dedupeKey`.
8. `bun run typecheck`, `bun run lint`, `bun run governance:check` sem erros.

## Nota de Compatibilidade com `develop`
- Em `develop`, reaproveitar `LeadScheduleService` e o tracking existente de `inviteDispatch` para incluir o pipeline de WhatsApp sem quebrar o comportamento atual de Google/Resend.
- Se a entrega sair primeiro em `main`, manter um patch de adaptacao para encaixe no service atual de `develop`.
