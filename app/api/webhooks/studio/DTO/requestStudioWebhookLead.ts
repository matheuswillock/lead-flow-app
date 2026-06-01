import { z } from "zod";
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from "@/app/api/v1/leads/DTO/leadValueLimits";
import { isValidCNPJ, sanitizeDocumentDigits } from "@/lib/masks";

export const StudioWebhookLeadRequestSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    email: z.string().trim().email("email must be a valid email"),
    phone: z
      .string()
      .trim()
      .min(8, "phone is invalid")
      .max(30, "phone is invalid"),
    cnpj: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((value) => {
        if (!value) return undefined;
        return sanitizeDocumentDigits(value) || undefined;
      })
      .refine((value) => !value || isValidCNPJ(value), "cnpj must be valid"),
    ages: z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined),
    current_health_plan: z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined),
    current_value: z.coerce
      .number()
      .min(0, "current_value must be greater than or equal to 0")
      .max(MAX_DECIMAL_VALUE, `current_value must be lower than ${MAX_DECIMAL_LABEL}`)
      .optional(),
    reference_hospital: z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined),
    current_treatment: z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined),
    source: z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type StudioWebhookLeadRequest = z.infer<typeof StudioWebhookLeadRequestSchema>;
