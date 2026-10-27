import { z } from "zod";
import { inboundV2PayloadSchema } from "./payload";
import { INBOUND_RESULT_CODES, type InboundResultCode } from "./resultCodes";

/**
 * Documentação legível por máquina do contrato v2 (SPEC 11 DA8 e SPEC 14 DA6). Tudo sai do mesmo Zod que
 * valida o evento, mais as descrições e exemplos daqui; nenhum dado de time entra. O que é publicado em
 * `GET /api/webhooks/studio/v2/schema` e `GET /api/studio/v1/openapi.json` é só contrato.
 */

export const WEBHOOK_V2_PATH = "/api/webhooks/studio/v2/{teamId}";
export const AVAILABILITY_PATH = "/api/studio/v1/availability";
export const WEBHOOK_V2_SCHEMA_PATH = "/api/webhooks/studio/v2/schema";
export const OPENAPI_PATH = "/api/studio/v1/openapi.json";

export const CREATE_EXAMPLE = {
  external_id: "evento-123",
  lead: { name: "Maria Souza", phone: "+5511999998888", email: "maria@exemplo.com", notes: "Pediu retorno à tarde" },
  source: "youpop",
};

export const SCHEDULE_EXAMPLE = {
  external_id: "evento-124",
  lead: { name: "Maria Souza", phone: "+5511999998888", email: "maria@exemplo.com" },
  schedule: {
    closer: { profile_id: "UUID_DO_CLOSER" },
    starts_at: "2026-11-03T14:00:00-03:00",
    type: "call",
    title: "Apresentação do plano",
  },
  source: "youpop",
};

export const FIELD_DESCRIPTIONS: Record<string, string> = {
  external_id: "Identificador do evento no sistema de vocês. Aparece nos logs e ajuda a rastrear o evento.",
  lead: "Dados do lead.",
  "lead.name": "Nome do lead. Obrigatório.",
  "lead.phone": "Telefone do lead. Obrigatório.",
  "lead.email": "E-mail do lead. Obrigatório quando schedule.type for \"online\".",
  "lead.cnpj": "CNPJ do lead.",
  "lead.notes": "Observações sobre o lead.",
  assigned_to: "Quem recebe o lead. Sem este campo, o Corretor Studio distribui os leads em rodízio entre os SDRs do webhook.",
  "assigned_to.profile_id": "Identificador do perfil que recebe o lead.",
  schedule:
    "Reunião para o lead já sair agendado. Consulte antes os horários livres em GET /api/studio/v1/availability. A duração é a configurada no time; duration_minutes não faz parte do contrato e é ignorado.",
  "schedule.closer": "Closer da reunião.",
  "schedule.closer.profile_id": "O closer_id devolvido pela API de horários disponíveis.",
  "schedule.starts_at": "Início da reunião, com fuso (RFC 3339), entre 5 minutos e 180 dias depois do envio.",
  "schedule.type": "Tipo da reunião. Sem este campo, vale \"call\". \"online\" exige lead.email.",
  "schedule.title": "Título da reunião.",
  "schedule.notes": "Observações da reunião.",
  "schedule.guests": "E-mails de convidados (até 3). Só membros do time são aceitos.",
  source: "Origem do lead.",
  metadata: "Objeto livre. É guardado no log do evento e não altera o lead.",
};

/** Campos obrigatórios por objeto; o Zod embrulha os opcionais em preprocess, então a lista é explícita. */
const REQUIRED_BY_PATH: Record<string, string[]> = {
  "": ["lead"],
  lead: ["name", "phone"],
  schedule: ["closer", "starts_at"],
  "schedule.closer": ["profile_id"],
};

type JsonSchemaNode = {
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
};

function enrich(node: JsonSchemaNode, path: string): void {
  const description = FIELD_DESCRIPTIONS[path];
  if (description) node.description = description;
  if (node.properties) {
    const required = REQUIRED_BY_PATH[path];
    if (required) node.required = required;
    else delete node.required;
    for (const [key, child] of Object.entries(node.properties)) {
      enrich(child, path ? `${path}.${key}` : key);
    }
  }
}

/** JSON Schema do corpo do evento, gerado do mesmo Zod do processamento. */
export function buildInboundV2JsonSchema(): JsonSchemaNode {
  const schema = z.toJSONSchema(inboundV2PayloadSchema, { io: "input", unrepresentable: "any" }) as JsonSchemaNode;
  enrich(schema, "");
  schema.title = "Evento do webhook de entrada v2";
  schema.description =
    "Corpo do POST em /api/webhooks/studio/v2/{teamId}. Campos desconhecidos são aceitos, ignorados e listados no log do evento.";
  schema.examples = [CREATE_EXAMPLE, SCHEDULE_EXAMPLE];
  return schema;
}

/** Lista exaustiva: um código novo em `INBOUND_RESULT_CODES` não compila sem descrição. */
export const RESULT_CODE_DESCRIPTIONS: Record<InboundResultCode, string> = {
  processed: "Evento processado: lead criado e, se houve schedule, reunião registrada.",
  processed_new_lead_for_existing_contact: "O contato já existia em outro status; um lead novo foi criado.",
  lead_merged: "O contato já existia como nova oportunidade; os dados novos foram mesclados no lead existente.",
  duplicate_scheduled_lead: "O contato já tem reunião agendada; nada foi criado nem alterado.",
  invalid_payload: "O corpo tem dado obrigatório faltando ou inválido; o log lista os campos.",
  missing_scope: "O webhook não tem o escopo necessário para parte do evento, por exemplo agendar reuniões.",
  schedule_conflict_flagged:
    "O closer já tem reunião nesse horário: lead criado como nova oportunidade, sem reunião, com o selo \"Remarcar urgente\".",
  closer_not_in_team: "O closer informado não é do time: lead criado sem reunião, com alerta de remarcação.",
  schedule_in_past: "O horário já passou: lead criado sem reunião, com alerta de remarcação.",
  schedule_out_of_range: "O horário está fora da janela de 5 minutos a 180 dias: lead criado sem reunião, com alerta de remarcação.",
  online_without_email: "Reunião online exige e-mail do lead: lead criado sem reunião, com alerta de remarcação.",
  closer_without_google: "O closer não tem Google conectado e o webhook não tem link de Meet padrão: lead criado sem reunião, com alerta.",
  schedule_failed: "Não foi possível registrar a reunião: lead criado sem reunião, com alerta de remarcação.",
  duplicate_conflict: "Conflito de duplicidade que o sistema não resolveu sozinho; o evento falhou e será reprocessado.",
  no_valid_assignee: "Nenhum SDR válido para receber o lead.",
  webhook_inactive: "O webhook estava desativado ou pausado quando o evento foi processado.",
  account_restricted: "O acesso da conta está pausado.",
  team_not_found: "O time do evento não existe mais.",
};

export const RESULT_CODES: Array<{ code: InboundResultCode; description: string }> = Object.values(
  INBOUND_RESULT_CODES,
).map((code) => ({ code, description: RESULT_CODE_DESCRIPTIONS[code] }));

type ErrorDoc = { status: number; code: string; description: string };

export const WEBHOOK_ERRORS: ErrorDoc[] = [
  { status: 400, code: "invalid_json", description: "JSON mal formado, que não é um objeto ou com estrutura inválida." },
  { status: 400, code: "invalid_team", description: "O identificador do time na URL é inválido." },
  { status: 400, code: "invalid_idempotency_key", description: "A Idempotency-Key tem mais de 255 caracteres." },
  { status: 400, code: "version_mismatch", description: "O webhook não é da versão 2: use a URL da versão configurada." },
  { status: 401, code: "unauthorized", description: "Token ausente ou inválido." },
  { status: 401, code: "token_expired", description: "O token expirou: gere um novo no app." },
  { status: 403, code: "missing_scope", description: "O token não tem permissão para criar leads." },
  { status: 403, code: "webhook_inactive", description: "Webhook desativado ou pausado." },
  { status: 403, code: "account_restricted", description: "O acesso da conta está pausado." },
  { status: 413, code: "payload_too_large", description: "Corpo grande demais." },
  { status: 429, code: "rate_limited", description: "Limite de chamadas atingido: espere o tempo do header Retry-After." },
];

export const AVAILABILITY_ERRORS: ErrorDoc[] = [
  { status: 400, code: "invalid_date", description: "Informe a data no formato AAAA-MM-DD." },
  { status: 400, code: "date_out_of_range", description: "A data deve estar entre hoje e 180 dias à frente." },
  { status: 401, code: "unauthorized", description: "Token ausente ou inválido." },
  { status: 403, code: "resource_inactive", description: "A API de horários está desativada para o time." },
  { status: 403, code: "feature_unavailable", description: "O time não tem acesso à API de integrações." },
  { status: 403, code: "account_restricted", description: "O acesso da conta está pausado." },
  { status: 429, code: "rate_limited", description: "Limite de 30 consultas por minuto por token: espere o tempo do header Retry-After." },
];

function errorResponses(errors: ErrorDoc[]): Record<string, unknown> {
  const byStatus = new Map<number, ErrorDoc[]>();
  for (const error of errors) byStatus.set(error.status, [...(byStatus.get(error.status) ?? []), error]);
  const responses: Record<string, unknown> = {};
  for (const [status, docs] of byStatus) {
    responses[String(status)] = {
      description: docs.map((doc) => `${doc.code}: ${doc.description}`).join(" "),
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { received: false, error: docs[0].code, message: docs[0].description },
        },
      },
      ...(status === 429 ? { headers: { "Retry-After": { description: "Segundos até poder tentar de novo.", schema: { type: "integer" } } } } : {}),
    };
  }
  return responses;
}

const AVAILABILITY_RESPONSE_EXAMPLE = {
  date: "2026-11-03",
  timezone: "America/Sao_Paulo",
  slot_minutes: 30,
  closers: [
    {
      closer_id: "uuid-do-closer",
      name: "Ana Lima",
      slots: [{ starts_at: "2026-11-03T09:00:00-03:00", ends_at: "2026-11-03T09:30:00-03:00" }],
    },
  ],
  generated_at: "2026-11-02T18:02:11-03:00",
};

/** OpenAPI 3.1 público: webhook v2 e consulta de horários, sem dado de time. */
export function buildStudioOpenApiDocument(origin: string): Record<string, unknown> {
  const eventSchema = buildInboundV2JsonSchema();
  delete eventSchema.$schema;
  return {
    openapi: "3.1.0",
    info: {
      title: "API Studio do Corretor Studio",
      version: "2",
      description:
        "Criação de leads pelo webhook v2 e consulta de horários livres dos closers. Chamadas de servidor para servidor, sempre por HTTPS. Os tokens são segredos: nunca vão na URL nem em navegador. O webhook responde 202 ao receber o evento; o resultado do processamento aparece nos logs do webhook no app, com os códigos descritos em x-result-codes.",
    },
    servers: [{ url: origin }],
    tags: [
      { name: "Webhook v2", description: "Entrada de leads, com agendamento opcional." },
      { name: "Horários disponíveis", description: "Horários livres por closer, para usar em schedule." },
    ],
    paths: {
      [WEBHOOK_V2_PATH]: {
        post: {
          tags: ["Webhook v2"],
          summary: "Envia um lead",
          description:
            "Responde só que recebeu. Reenviar o mesmo evento com a mesma Idempotency-Key não cria outro lead e devolve o mesmo event_id.",
          operationId: "createLeadEvent",
          security: [{ webhookToken: [] }],
          parameters: [
            { name: "teamId", in: "path", required: true, description: "Identificador do time, na URL do webhook.", schema: { type: "string" } },
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              description: "Texto único por evento, até 255 caracteres. Recomendado.",
              schema: { type: "string", maxLength: 255 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebhookV2Event" },
                examples: {
                  semAgendamento: { summary: "Lead sem agendamento", value: CREATE_EXAMPLE },
                  comAgendamento: { summary: "Lead com agendamento", value: SCHEDULE_EXAMPLE },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "Evento recebido. O resultado fica nos logs do webhook no app.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["received", "event_id"],
                    properties: { received: { type: "boolean", const: true }, event_id: { type: "string" } },
                  },
                  example: { received: true, event_id: "uuid-do-evento" },
                },
              },
            },
            ...errorResponses(WEBHOOK_ERRORS),
          },
          "x-result-codes": RESULT_CODES,
        },
      },
      [AVAILABILITY_PATH]: {
        get: {
          tags: ["Horários disponíveis"],
          summary: "Consulta os horários livres de um dia",
          description:
            "Devolve os horários livres de todos os closers do time, nas 24 horas do dia, no fuso do time e no tamanho de reunião configurado no time. A agenda do closer é uma só, mesmo que ele participe de mais de um time. Para hoje, só aparecem horários a partir de 5 minutos depois da consulta. Um closer sem horário livre vem com slots vazio.",
          operationId: "getAvailability",
          security: [{ availabilityToken: [] }],
          parameters: [
            {
              name: "date",
              in: "query",
              required: true,
              description: "Dia da consulta, de hoje até 180 dias à frente.",
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": {
              description: "Consulta feita.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AvailabilityResponse" },
                  example: AVAILABILITY_RESPONSE_EXAMPLE,
                },
              },
            },
            ...errorResponses(AVAILABILITY_ERRORS),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        webhookToken: {
          type: "http",
          scheme: "bearer",
          description: "Token do webhook, mostrado uma única vez ao criar ou rotacionar.",
        },
        availabilityToken: {
          type: "http",
          scheme: "bearer",
          description: "Token do recurso Horários disponíveis (prefixo cs_avail_), gerado no Catálogo de API. É outro token, separado do webhook.",
        },
      },
      schemas: {
        WebhookV2Event: eventSchema,
        Error: {
          type: "object",
          required: ["error", "message"],
          properties: {
            received: { type: "boolean", description: "false quando o evento não foi recebido." },
            error: { type: "string", description: "Código estável do erro." },
            message: { type: "string", description: "Explicação em português." },
          },
        },
        AvailabilityResponse: {
          type: "object",
          required: ["date", "timezone", "slot_minutes", "closers", "generated_at"],
          properties: {
            date: { type: "string", format: "date" },
            timezone: { type: "string", description: "Fuso do time; todos os horários vêm com offset nesse fuso." },
            slot_minutes: { type: "integer", description: "Duração da reunião configurada no time." },
            closers: {
              type: "array",
              items: {
                type: "object",
                required: ["closer_id", "name", "slots"],
                properties: {
                  closer_id: { type: "string", description: "Use em schedule.closer.profile_id." },
                  name: { type: "string" },
                  slots: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["starts_at", "ends_at"],
                      properties: {
                        starts_at: { type: "string", format: "date-time", description: "Use em schedule.starts_at." },
                        ends_at: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
            generated_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
