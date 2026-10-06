import { z } from "zod"

const processStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
})

export const landingPageDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  publicFormId: z.string().uuid(),
  templateSlug: z.string().trim().min(1).max(120),
  content: z.object({
    brandName: z.string().optional(),
    logoUrl: z.string().url().nullable().optional(),
    heroEyebrow: z.string().optional(),
    heroTitle: z.string().optional(),
    heroDescription: z.string().optional(),
    processTitle: z.string().optional(),
    processDescription: z.string().optional(),
    processSteps: z.array(processStepSchema).optional(),
    testimonialsEnabled: z.boolean().optional(),
    footerText: z.string().optional(),
    templateConfig: z
      .object({
        identity: z.object({
          tradeName: z.string().min(1),
          legalName: z.string().optional(),
          cnpj: z.string().optional(),
          logoUrl: z.string().url().nullable().optional(),
          copyright: z.string().optional(),
        }),
        templateSlug: z.enum(["black-and-white", "alvora"]),
        contact: z.object({
          phoneDisplay: z.string().optional(),
          phoneE164: z.string().optional(),
          whatsappE164: z.string().optional(),
          whatsappMessage: z.string().optional(),
          email: z.string().email().optional(),
          businessHours: z.string().optional(),
        }),
        seo: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            canonical: z.string().url().optional(),
            socialImageUrl: z.string().url().nullable().optional(),
          })
          .optional(),
        hero: z
          .object({
            eyebrow: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            primaryCta: z.string().optional(),
            secondaryCta: z.string().optional(),
          })
          .optional(),
        sections: z
          .record(
            z.string(),
            z.object({
              enabled: z.boolean().optional(),
              title: z.string().optional(),
              description: z.string().optional(),
              items: z
                .array(
                  z.object({
                    title: z.string(),
                    description: z.string().optional(),
                    value: z.union([z.string(), z.number()]).optional(),
                    imageUrl: z.string().url().nullable().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
        media: z
          .record(
            z.string(),
            z.object({ url: z.string().url().nullable().optional(), alt: z.string().optional() }),
          )
          .optional(),
      })
      .optional(),
  }),
  offer: z.object({
    enabled: z.boolean(),
    badge: z.string(),
    percentage: z.number().int().min(0).max(100).nullable(),
    title: z.string(),
    items: z.array(z.string()),
    disclaimer: z.string(),
  }),
})
