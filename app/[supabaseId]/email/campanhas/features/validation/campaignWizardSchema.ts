import { z } from "zod"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"

export type WizardTabId = "geral" | "template" | "audiencia" | "agendamento" | "subcampanhas"

export const campaignWizardGeralSchema = z.object({
  name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
})

export const campaignWizardTemplateSchema = z.object({
  templateId: z.string().uuid("Selecione um template válido"),
})

export const campaignWizardAudienciaSchema = z
  .object({
    recipientSource: z.enum(["contact_list", "radar_segment"]),
    contactListIds: z.array(z.string().uuid()).default([]),
    listStrategy: z.enum(["single", "merge", "per_list"]).optional(),
    radarSegmentSlug: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipientSource === "contact_list") {
      if (data.contactListIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione ao menos uma lista de contatos",
          path: ["contactListIds"],
        })
      }
      if (data.contactListIds.length > 1 && !data.listStrategy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Defina como as listas serão usadas",
          path: ["listStrategy"],
        })
      }
      return
    }

    if (!data.radarSegmentSlug?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um segmento Radar",
        path: ["radarSegmentSlug"],
      })
    }
  })

export const campaignWizardAgendamentoSchema = z.object({
  scheduledAt: z.date().optional(),
  uniformSchedule: z.boolean().default(true),
  scheduleIntervalDays: z.number().int().optional(),
})

export const campaignWizardSubCampaignsSchema = z.object({
  subCampaignSchedules: z
    .array(
      z.object({
        index: z.number().int().min(1),
        scheduledAt: z.date(),
      })
    )
    .default([]),
})

export function buildCampaignWizardSubmitSchema(params: {
  recipientCount: number
  recipientSource: "contact_list" | "radar_segment"
  needsSplit: boolean
  uniformSchedule: boolean
  subCampaignCount: number
}) {
  const radarExceedsLimit =
    params.recipientSource === "radar_segment" &&
    params.recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB

  return z
    .object({
      name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
      templateId: z.string().uuid("Selecione um template válido"),
      recipientSource: z.enum(["contact_list", "radar_segment"]),
      contactListIds: z.array(z.string().uuid()).default([]),
      listStrategy: z.enum(["single", "merge", "per_list"]).optional(),
      radarSegmentSlug: z.string().optional(),
      scheduledAt: z.date().optional(),
      uniformSchedule: z.boolean().default(true),
      scheduleIntervalDays: z.number().int().optional(),
      subCampaignSchedules: z
        .array(
          z.object({
            index: z.number().int().min(1),
            scheduledAt: z.date(),
          })
        )
        .default([]),
    })
    .superRefine((data, ctx) => {
      const audiencia = campaignWizardAudienciaSchema.safeParse({
        recipientSource: data.recipientSource,
        contactListIds: data.contactListIds,
        listStrategy: data.listStrategy,
        radarSegmentSlug: data.radarSegmentSlug,
      })
      if (!audiencia.success) {
        for (const issue of audiencia.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: issue.path,
          })
        }
      }

      if (radarExceedsLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Segmentos Radar com mais de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários não são suportados. Crie uma lista de contatos a partir do segmento`,
          path: ["radarSegmentSlug"],
        })
      }

      const needsScheduling = params.needsSplit || params.subCampaignCount > 1

      if (!needsScheduling) {
        if (data.scheduledAt && data.scheduledAt <= new Date()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data de agendamento deve ser no futuro",
            path: ["scheduledAt"],
          })
        }
        return
      }

      if (data.uniformSchedule) {
        if (!data.scheduledAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Agendamento inicial é obrigatório para campanhas com sub-campanhas",
            path: ["scheduledAt"],
          })
        } else if (data.scheduledAt <= new Date()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data de agendamento deve ser no futuro",
            path: ["scheduledAt"],
          })
        }

        if (
          data.scheduleIntervalDays == null ||
          !Number.isInteger(data.scheduleIntervalDays) ||
          data.scheduleIntervalDays < 1
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe o intervalo em dias (mínimo 1)",
            path: ["scheduleIntervalDays"],
          })
        }
        return
      }

      if (data.subCampaignSchedules.length !== params.subCampaignCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe uma data para cada sub-campanha",
          path: ["subCampaignSchedules"],
        })
      }

      for (const entry of data.subCampaignSchedules) {
        if (entry.scheduledAt <= new Date()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Todas as datas de sub-campanha devem ser no futuro",
            path: ["subCampaignSchedules"],
          })
          break
        }
      }
    })
}

export { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB }
