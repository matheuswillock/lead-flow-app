import { z } from "zod"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"

export const campaignCreateWizardStep1Schema = z.object({
  name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
  templateId: z.string().uuid("Selecione um template válido"),
})

export const campaignCreateWizardStep2Schema = z
  .object({
    recipientSource: z.enum(["contact_list", "cdp_segment"]),
    contactListId: z.string().optional(),
    radarSegmentSlug: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipientSource === "contact_list") {
      if (!data.contactListId || !z.string().uuid().safeParse(data.contactListId).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione uma lista de contatos",
          path: ["contactListId"],
        })
      }
      return
    }
    if (!data.radarSegmentSlug?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um segmento CDP",
        path: ["radarSegmentSlug"],
      })
    }
  })

export function buildCampaignCreateWizardSubmitSchema(params: {
  recipientCount: number
  recipientSource: "contact_list" | "cdp_segment"
}) {
  const needsSplit =
    params.recipientSource === "contact_list" &&
    params.recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB
  const cdpExceedsLimit =
    params.recipientSource === "cdp_segment" &&
    params.recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB

  return z
    .object({
      name: z.string().trim().min(1, "Nome da campanha é obrigatório"),
      templateId: z.string().uuid("Selecione um template válido"),
      recipientSource: z.enum(["contact_list", "cdp_segment"]),
      contactListId: z.string().optional(),
      radarSegmentSlug: z.string().optional(),
      scheduledAt: z.date().optional(),
      scheduleIntervalDays: z.number().int().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.recipientSource === "contact_list") {
        if (!data.contactListId || !z.string().uuid().safeParse(data.contactListId).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione uma lista de contatos",
            path: ["contactListId"],
          })
        }
      } else if (!data.radarSegmentSlug?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione um segmento CDP",
          path: ["radarSegmentSlug"],
        })
      }

      if (cdpExceedsLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Segmentos CDP com mais de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários não são suportados. Use uma lista de contatos ou reduza o segmento`,
          path: ["radarSegmentSlug"],
        })
      }

      if (needsSplit) {
        if (!data.scheduledAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Agendamento inicial é obrigatório para listas grandes",
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
      } else if (data.scheduledAt && data.scheduledAt <= new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Data de agendamento deve ser no futuro",
          path: ["scheduledAt"],
        })
      }
    })
}

export { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB }
