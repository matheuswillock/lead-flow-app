import { z } from "zod"
import { inverseRuleAction } from "./engine"
import { normalizeThankYouPages } from "./thank-you-pages"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"
import type { PublicFormDraftInput } from "./types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidPublicFormId(value: string): boolean {
  return UUID_RE.test(value)
}

const uuid = z.string().uuid("Identificador inválido"),
  color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  text = z.string().trim().max(2000).nullable().optional()

const option = z.object({
  id: uuid.optional(),
  label: z.string().trim().min(1).max(300),
  value: z.string().trim().min(1).max(300),
  score: z.number().int().min(0).max(100).default(0),
  scorePolarity: z.enum(["positive", "negative"]).default("positive"),
})

const coverHighlight = z.object({
  id: z.string().min(1).max(80),
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
})

const successAction = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().trim().min(1).max(80),
    type: z.enum(["link", "whatsapp", "close"]),
    url: z.string().trim().max(2000).nullable().optional(),
    whatsappPhone: z.string().trim().max(30).nullable().optional(),
    whatsappMessage: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "link" && !value.url?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Informe a URL do botão",
      })
    }
    if (value.type === "whatsapp" && !value.whatsappPhone?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["whatsappPhone"],
        message: "Informe o WhatsApp do botão",
      })
    }
  })

/**
 * mappingKey nativos que exigem um `type` específico pro autocomplete e pro
 * teclado do browser funcionarem (e-mail precisa de type="email", telefone
 * precisa de type="phone") — achado em produção: 7 perguntas mappingKey=email
 * tipadas como text, 1 pergunta mappingKey=phone tipada como email.
 */
const REQUIRED_TYPE_BY_NATIVE_MAPPING_KEY: Record<string, string> = {
  email: "email",
  phone: "phone",
}

const question = z
  .object({
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
      "calculation",
    ]),
    title: z.string().trim().min(1).max(500),
    description: text,
    placeholder: z.string().max(300).nullable().optional(),
    required: z.boolean().default(false),
    scoreWeight: z.number().int().min(0).max(100).default(0),
    config: z.record(z.string(), z.unknown()).default({}),
    mappingTarget: z.enum(["native_field", "custom_field", "notes", "history"]).nullable().optional(),
    mappingKey: z.string().max(200).nullable().optional(),
    options: z.array(option).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (value.mappingTarget !== "native_field" || !value.mappingKey) return
    const requiredType = REQUIRED_TYPE_BY_NATIVE_MAPPING_KEY[value.mappingKey]
    if (requiredType && value.type !== requiredType) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: `Pergunta mapeada para "${value.mappingKey}" precisa ser do tipo "${requiredType}"`,
      })
    }
  })

const thankYouPage = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  description: text,
  actions: z.array(successAction).max(6).default([]),
  kind: z.enum(["standard", "simulation"]).default("standard"),
  isDefault: z.boolean().optional(),
})

export const publicFormDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: text,
    assignedSdrId: uuid.nullable().optional(),
    eligibleCloserIds: z.array(uuid).max(100).default([]),
    coverTitle: text,
    coverDescription: text,
    coverBadge: z.string().trim().max(80).nullable().optional(),
    coverHighlights: z.array(coverHighlight).max(6).default([]),
    ctaLabel: z.string().trim().min(1).max(80).default("Começar"),
    successTitle: z.string().trim().min(1).max(200).default("Respostas enviadas"),
    successDescription: text,
    successActions: z.array(successAction).max(6).default([]),
    thankYouPages: z.array(thankYouPage).min(1).max(20).default([]),
    defaultThankYouPageId: uuid.optional(),
    useDefaultTheme: z.boolean().default(true),
    backgroundColor: color.nullable().optional(),
    textColor: color.nullable().optional(),
    lineColor: color.nullable().optional(),
    accentColor: color.nullable().optional(),
    buttonTextColor: color.nullable().optional(),
    inputBackgroundColor: color.nullable().optional(),
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
          targetQuestionId: z.union([uuid, z.literal(PUBLIC_FORM_THANK_YOU_TARGET)]),
          targetThankYouPageId: uuid.nullable().optional(),
          operator: z.enum(["equals", "not_equals", "contains", "selected", "not_selected"]),
          comparisonValue: z.unknown().optional(),
          action: z.enum(["show", "skip", "jump_to"]),
          elseAction: z.enum(["show", "skip", "jump_to"]).optional(),
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
          minScore: z.number().int().min(0).max(100),
          maxScore: z.number().int().min(0).max(100),
        }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    if (value.questions.length === 0) return
    const total = value.questions.reduce((sum, question) => sum + question.scoreWeight, 0)
    if (total !== 100) {
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "A soma das pontuações das perguntas deve ser 100%",
      })
    }
  })
  .transform((value) => normalizeThankYouPages(value as PublicFormDraftInput))
  .superRefine((value, context) => {
    if (value.thankYouPages.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["thankYouPages"],
        message: "Adicione ao menos uma página de agradecimentos",
      })
    }
    const defaultCount = value.thankYouPages.filter((page) => page.isDefault).length
    if (value.thankYouPages.length > 0 && defaultCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["thankYouPages"],
        message: "Defina exatamente uma página de agradecimentos como padrão",
      })
    }
    const pageIds = new Set(value.thankYouPages.map((page) => page.id))
    for (const rule of value.rules) {
      if (
        rule.targetThankYouPageId &&
        !pageIds.has(rule.targetThankYouPageId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["rules"],
          message: "Regra referencia página de agradecimentos inexistente",
        })
      }

      const elseAction = rule.elseAction ?? inverseRuleAction(rule.action)
      const jumpActions = [rule.action, elseAction].filter((action) => action === "jump_to")
      if (jumpActions.length === 0) continue

      if (rule.targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET) {
        context.addIssue({
          code: "custom",
          path: ["rules"],
          message: "Pular até pergunta não pode usar a página de agradecimentos como destino",
        })
        continue
      }

      const sourceIndex = value.questions.findIndex(
        (question) => question.id === rule.sourceQuestionId,
      )
      const targetIndex = value.questions.findIndex(
        (question) => question.id === rule.targetQuestionId,
      )
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex <= sourceIndex) {
        context.addIssue({
          code: "custom",
          path: ["rules"],
          message: "Pular até pergunta exige um destino posterior à pergunta de origem",
        })
      }
    }
  })

export const publicFormSettingsSchema = z
  .object({
    approvalRequired: z.boolean(),
    approverRoles: z.array(z.enum(["manager", "backoffice", "operator"])),
    defaultBackgroundColor: color,
    defaultTextColor: color,
    defaultLineColor: color,
    defaultAccentColor: color,
    defaultButtonTextColor: color,
    defaultInputBackgroundColor: color,
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
  schemaVersion: z.literal(1).optional(),
  eventId: uuid.optional(),
  occurredAt: z.string().datetime().optional(),
  scheduling: z.object({ startsAt: z.string().datetime() }).optional(),
  thankYouPageId: uuid.optional(),
  visitorSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/).optional(),
})

export const publicFormProgressSchema = z.object({
  visitorSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  answers: z.array(z.object({ questionId: uuid, value: z.unknown() })).max(200),
  origin: z.record(z.string(), z.unknown()).default({}),
  lastQuestionId: uuid.optional(),
  schemaVersion: z.literal(1).optional(),
  eventId: uuid.optional(),
  occurredAt: z.string().datetime().optional(),
  trigger: z.enum(["blur", "change", "page_flush", "submit_reconciliation"]).optional(),
})

export const publicFormMetricEventSchema = z.object({
  visitorSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  eventType: z.enum([
    "form_viewed",
    "form_started",
    "question_viewed",
    "question_skipped",
    "form_completed",
  ]),
  questionId: uuid.optional(),
  eventKey: z.string().regex(/^[A-Za-z0-9:_-]{16,250}$/),
  origin: z.record(z.string(), z.unknown()).default({}),
  schemaVersion: z.literal(1).optional(),
  eventId: uuid.optional(),
  occurredAt: z.string().datetime().optional(),
  answerValue: z.string().max(2000).optional(),
})
