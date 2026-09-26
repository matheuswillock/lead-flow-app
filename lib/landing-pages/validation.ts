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
