import { z } from "zod";
import type { TeamAutomationActionType, TeamAutomationTriggerType } from "@prisma/client";
import { TEMPLATE_MAX_LENGTH } from "./types";

const leadStatusSchema = z.enum([
  "new_opportunity",
  "scheduled",
  "no_show",
  "pricingRequest",
  "future_sale",
  "offerNegotiation",
  "pending_documents",
  "offerSubmission",
  "dps_agreement",
  "invoicePayment",
  "disqualified",
  "opportunityLost",
  "operator_denied",
  "contract_finalized",
]);

const idleUnitSchema = z.enum(["hours", "days"]);

const triggerConfigByType: Record<TeamAutomationTriggerType, z.ZodType> = {
  lead_created: z.object({}).strict(),
  status_changed: z
    .object({
      targetStatus: leadStatusSchema,
    })
    .strict(),
  lead_idle_in_status: z
    .object({
      targetStatus: leadStatusSchema,
      idleValue: z.number().int().positive(),
      idleUnit: idleUnitSchema,
    })
    .strict(),
  meeting_scheduled: z.object({}).strict(),
  meeting_no_show: z.object({}).strict(),
};

const actionConfigByType: Record<TeamAutomationActionType, z.ZodType> = {
  send_whatsapp_message: z
    .object({
      messageTemplate: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH),
    })
    .strict(),
  send_email: z
    .object({
      emailSubject: z.string().trim().min(1).max(200),
      emailBodyTemplate: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH),
    })
    .strict(),
  create_notification: z
    .object({
      messageTemplate: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH),
      notifyProfileIds: z.array(z.string().uuid()).optional(),
    })
    .strict(),
  assign_operator: z
    .object({
      assignStrategy: z.enum(["specific_operator", "round_robin"]),
      operatorProfileId: z.string().uuid().optional(),
    })
    .strict()
    .refine(
      (value) => value.assignStrategy !== "specific_operator" || !!value.operatorProfileId,
      { message: "operatorProfileId é obrigatório para atribuição específica" }
    ),
};

const automationRuleBaseSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  description: z.string().trim().max(400).nullable().optional(),
  triggerType: z.enum([
    "lead_created",
    "status_changed",
    "lead_idle_in_status",
    "meeting_scheduled",
    "meeting_no_show",
  ]),
  triggerConfig: z.record(z.string(), z.unknown()),
  actionType: z.enum([
    "send_whatsapp_message",
    "send_email",
    "create_notification",
    "assign_operator",
  ]),
  actionConfig: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean().optional(),
});

type AutomationRuleConfigShape = {
  triggerType?: TeamAutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  actionType?: TeamAutomationActionType;
  actionConfig?: Record<string, unknown>;
};

function refineAutomationRuleConfigs(
  value: AutomationRuleConfigShape,
  ctx: z.RefinementCtx,
  options: { requireComplete: boolean }
) {
  if (options.requireComplete || (value.triggerType !== undefined && value.triggerConfig !== undefined)) {
    if (!value.triggerType || value.triggerConfig === undefined) {
      if (options.requireComplete) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "triggerType e triggerConfig são obrigatórios",
          path: ["triggerConfig"],
        });
      }
    } else {
      const triggerParser = triggerConfigByType[value.triggerType];
      const triggerResult = triggerParser.safeParse(value.triggerConfig);
      if (!triggerResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `triggerConfig inválido para ${value.triggerType}: ${triggerResult.error.issues.map((i) => i.message).join(", ")}`,
          path: ["triggerConfig"],
        });
      }
    }
  }

  if (options.requireComplete || (value.actionType !== undefined && value.actionConfig !== undefined)) {
    if (!value.actionType || value.actionConfig === undefined) {
      if (options.requireComplete) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "actionType e actionConfig são obrigatórios",
          path: ["actionConfig"],
        });
      }
    } else {
      const actionParser = actionConfigByType[value.actionType];
      const actionResult = actionParser.safeParse(value.actionConfig);
      if (!actionResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `actionConfig inválido para ${value.actionType}: ${actionResult.error.issues.map((i) => i.message).join(", ")}`,
          path: ["actionConfig"],
        });
      }
    }
  }
}

export const createAutomationRuleSchema = automationRuleBaseSchema.superRefine((value, ctx) => {
  refineAutomationRuleConfigs(value, ctx, { requireComplete: true });
});

export const updateAutomationRuleSchema = automationRuleBaseSchema
  .partial()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.triggerType !== undefined ||
      value.triggerConfig !== undefined ||
      value.actionType !== undefined ||
      value.actionConfig !== undefined ||
      value.isEnabled !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  )
  .superRefine((value, ctx) => {
    refineAutomationRuleConfigs(value, ctx, { requireComplete: false });
  });

export function validateActionConfigForType(
  actionType: TeamAutomationActionType,
  actionConfig: Record<string, unknown>
) {
  return actionConfigByType[actionType].safeParse(actionConfig);
}
