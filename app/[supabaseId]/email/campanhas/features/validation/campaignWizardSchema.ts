import { z } from "zod"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"

export type WizardTabId = "geral" | "audiencia" | "subcampanhas" | "revisao"

export const campaignWizardGeralSchema = z.object({
  name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
  description: z.string().max(500).optional(),
})

export const campaignWizardTemplateSchema = z.object({
  templateId: z.string().uuid("Selecione um template válido"),
})

export const campaignWizardAudienciaSchema = z
  .object({
    contactListIds: z.array(z.string().uuid()).default([]),
    listStrategy: z.enum(["single", "merge", "per_list"]).optional(),
    radarSegmentSlug: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLists = data.contactListIds.length > 0
    const hasRadar = Boolean(data.radarSegmentSlug?.trim())

    if (!hasLists && !hasRadar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma lista de contatos ou um segmento Radar",
        path: ["contactListIds"],
      })
    }

    if (hasLists && data.contactListIds.length > 1 && !data.listStrategy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Defina como as listas serão usadas",
        path: ["listStrategy"],
      })
    }

    if (hasLists && hasRadar && data.listStrategy === "per_list") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estratégia por lista não é compatível com segmento Radar. Use juntar listas",
        path: ["listStrategy"],
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
  hasRadarSegment: boolean
  hasContactLists: boolean
  needsSplit: boolean
  subCampaignCount: number
}) {
  const radarOnlyExceedsLimit =
    params.hasRadarSegment &&
    !params.hasContactLists &&
    params.recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB

  return z
    .object({
      name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
      description: z.string().max(500).optional(),
      templateId: z.string().uuid("Selecione um template válido"),
      contactListIds: z.array(z.string().uuid()).default([]),
      listStrategy: z.enum(["single", "merge", "per_list"]).optional(),
      radarSegmentSlug: z.string().optional(),
      saveAsRadarSegment: z.boolean().optional(),
      saveAsRadarSegmentName: z.string().max(120).optional(),
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

      if (radarOnlyExceedsLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Audiência excede o limite de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários por campanha de segmento. Refine as condições ou materialize em lista de contatos`,
          path: ["radarSegmentSlug"],
        })
      }

      if (data.saveAsRadarSegment) {
        const slug = data.radarSegmentSlug?.trim() ?? ""
        if (!slug.startsWith("custom:")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Salvar como segmento só se aplica a segmentos custom com regras DSL (não a listas ou segmentos do sistema)",
            path: ["saveAsRadarSegment"],
          })
        }
        if (!data.saveAsRadarSegmentName?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe o nome do novo segmento",
            path: ["saveAsRadarSegmentName"],
          })
        }
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

      if (data.subCampaignSchedules.length !== params.subCampaignCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe uma data para cada sub-campanha",
          path: ["subCampaignSchedules"],
        })
        return
      }

      const byIndex = new Set(data.subCampaignSchedules.map((entry) => entry.index))
      for (let index = 1; index <= params.subCampaignCount; index++) {
        if (!byIndex.has(index)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe uma data para cada sub-campanha",
            path: ["subCampaignSchedules"],
          })
          return
        }
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
