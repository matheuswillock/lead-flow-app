import { z } from "zod";

/**
 * Contrato v2 do webhook de entrada (SPEC 11, "Contrato v2", e Guia de Integração YouPop/3CPlus).
 *
 * - Obrigatórios: `lead.name` e `lead.phone` (D15). E-mail é opcional.
 * - Campo desconhecido é aceito, ignorado e listado em `ignoredFields` (DA8).
 * - `schedule.duration_minutes` NÃO faz parte do contrato: a duração da reunião é a configurada no
 *   time (decisão de 26/10). Se o integrador mandar, o campo é ignorado e listado.
 * - Mensagens de erro descrevem o campo, nunca repetem o valor recebido (o evento pode conter PII).
 */

const RFC3339_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(254).email().optional(),
);

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const profileIdSchema = z.string().uuid();

const scheduleSchema = z.object({
  closer: z.object({ profile_id: profileIdSchema }),
  starts_at: z
    .string()
    .regex(RFC3339_WITH_OFFSET)
    .refine((value) => !Number.isNaN(new Date(value).getTime())),
  type: z.enum(["online", "call", "whatsapp"]).optional(),
  title: optionalText(200),
  notes: optionalText(2000),
  guests: z.array(z.string().trim().max(254).email()).max(3).optional(),
});

export const inboundV2PayloadSchema = z.object({
  external_id: optionalText(255),
  lead: z.object({
    name: requiredText(200),
    phone: requiredText(32),
    email: optionalEmail,
    cnpj: optionalText(32),
    notes: optionalText(5000),
  }),
  assigned_to: z.object({ profile_id: profileIdSchema }).optional(),
  schedule: scheduleSchema.optional(),
  source: optionalText(60),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Árvore de campos conhecidos: `true` = folha (conteúdo livre ou escalar), objeto = descer. */
const KNOWN_FIELDS: Record<string, unknown> = {
  external_id: true,
  lead: { name: true, phone: true, email: true, cnpj: true, notes: true },
  assigned_to: { profile_id: true },
  schedule: {
    closer: { profile_id: true },
    starts_at: true,
    type: true,
    title: true,
    notes: true,
    guests: true,
  },
  source: true,
  metadata: true,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectIgnoredFields(value: unknown, tree: Record<string, unknown>, prefix: string, found: string[]): void {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    const path = `${prefix}${key}`;
    const known = tree[key];
    if (known === undefined) {
      found.push(path);
      continue;
    }
    if (isPlainObject(known)) collectIgnoredFields(value[key], known, `${path}.`, found);
  }
}

export type InboundV2Payload = {
  externalId?: string;
  lead: { name: string; phone: string; email?: string; cnpj?: string; notes?: string };
  assignedToProfileId?: string;
  schedule?: {
    closerProfileId: string;
    startsAt: Date;
    type?: "online" | "call" | "whatsapp";
    title?: string;
    notes?: string;
    guests?: string[];
  };
  source?: string;
  metadata?: Record<string, unknown>;
};

export type InboundV2PayloadIssue = { path: string; message: string };

export type ParseInboundV2PayloadResult =
  | { ok: true; data: InboundV2Payload; ignoredFields: string[] }
  | { ok: false; issues: InboundV2PayloadIssue[] };

function describeIssue(issue: { code: string; input?: unknown }): string {
  if (issue.input === undefined) return "campo obrigatório";
  if (issue.code === "too_big") return "valor grande demais";
  return "formato inválido";
}

export function parseInboundV2Payload(input: unknown): ParseInboundV2PayloadResult {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ path: "", message: "o corpo deve ser um objeto JSON" }] };
  }

  const parsed = inboundV2PayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: describeIssue(issue),
      })),
    };
  }

  const value = parsed.data;
  const ignoredFields: string[] = [];
  collectIgnoredFields(input, KNOWN_FIELDS, "", ignoredFields);

  const data: InboundV2Payload = {
    externalId: value.external_id,
    lead: {
      name: value.lead.name,
      phone: value.lead.phone,
      email: value.lead.email,
      cnpj: value.lead.cnpj,
      notes: value.lead.notes,
    },
    assignedToProfileId: value.assigned_to?.profile_id,
    schedule: value.schedule
      ? {
          closerProfileId: value.schedule.closer.profile_id,
          startsAt: new Date(value.schedule.starts_at),
          type: value.schedule.type,
          title: value.schedule.title,
          notes: value.schedule.notes,
          guests: value.schedule.guests,
        }
      : undefined,
    source: value.source,
    metadata: value.metadata,
  };

  return { ok: true, data, ignoredFields };
}
