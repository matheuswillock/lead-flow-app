import { z } from "zod"
const uuid = z.string().uuid("Identificador inválido"),
  color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  text = z.string().trim().max(2000).nullable().optional()
const option = z.object({
  id: uuid.optional(),
  label: z.string().trim().min(1).max(300),
  value: z.string().trim().min(1).max(300),
  score: z.number().int().min(-10000).max(10000).default(0),
})
const question = z.object({
  id: uuid.optional(),
  type: z.enum([
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "currency",
    "date",
    "url",
    "single_choice",
    "multiple_choice",
    "boolean",
    "health_plan",
    "crm_field",
    "custom_field",
    "scheduling",
    "consent",
  ]),
  title: z.string().trim().min(1).max(500),
  description: text,
  placeholder: z.string().max(300).nullable().optional(),
  required: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).default({}),
  mappingTarget: z.enum(["native_field", "custom_field", "notes", "history"]).nullable().optional(),
  mappingKey: z.string().max(200).nullable().optional(),
  options: z.array(option).max(100).default([]),
})
export const publicFormDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: text,
  assignedSdrId: uuid.nullable().optional(),
  eligibleCloserIds: z.array(uuid).max(100).default([]),
  coverTitle: text,
  coverDescription: text,
  ctaLabel: z.string().trim().min(1).max(80).default("Começar"),
  successTitle: z.string().trim().min(1).max(200).default("Respostas enviadas"),
  successDescription: text,
  useDefaultTheme: z.boolean().default(true),
  backgroundColor: color.nullable().optional(),
  textColor: color.nullable().optional(),
  lineColor: color.nullable().optional(),
  schedulingEnabled: z.boolean().default(false),
  meetingDurationMinutes: z.number().int().min(5).max(480).default(30),
  schedulingMessage: text,
  formKind: z.enum(["standard", "health_plan_simulator"]).default("standard"),
  questions: z.array(question).max(200).default([]),
  rules: z
    .array(
      z.object({
        id: uuid.optional(),
        sourceQuestionId: uuid,
        targetQuestionId: uuid,
        operator: z.enum(["equals", "not_equals", "contains", "selected", "not_selected"]),
        comparisonValue: z.unknown().optional(),
        action: z.enum(["show", "skip"]),
      }),
    )
    .max(500)
    .default([]),
  scoreBands: z
    .array(
      z.object({
        id: uuid.optional(),
        label: z.string().trim().min(1).max(200),
        summary: text,
        minScore: z.number().int(),
        maxScore: z.number().int(),
      }),
    )
    .max(100)
    .default([]),
})
export const publicFormSettingsSchema = z
  .object({
    approvalRequired: z.boolean(),
    approverRoles: z.array(z.enum(["manager", "backoffice", "operator"])),
    defaultBackgroundColor: color,
    defaultTextColor: color,
    defaultLineColor: color,
  })
  .superRefine((value, context) => {
    if (value.approvalRequired && value.approverRoles.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["approverRoles"],
        message: "Selecione ao menos uma função aprovadora",
      })
    }
  })
export const publicFormSubmissionSchema = z.object({
  requestKey: z.string().min(8).max(200),
  answers: z.array(z.object({ questionId: uuid, value: z.unknown() })).max(200),
  origin: z.record(z.string(), z.unknown()).default({}),
  scheduling: z.object({ startsAt: z.string().datetime() }).optional(),
})
export const publicFormMetricEventSchema = z.object({
  visitorSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  eventType: z.enum([
    "form_viewed",
    "form_started",
    "question_viewed",
    "question_answered",
    "question_skipped",
    "form_completed",
  ]),
  questionId: uuid.optional(),
  eventKey: z.string().regex(/^[A-Za-z0-9:_-]{16,250}$/),
  origin: z.record(z.string(), z.unknown()).default({}),
})
