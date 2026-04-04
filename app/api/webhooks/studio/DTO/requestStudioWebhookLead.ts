import { z } from "zod";
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from "@/app/api/v1/leads/DTO/leadValueLimits";

const isValidCnpj = (value: string): boolean => {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number.parseInt(digit, 10) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstDigit === Number.parseInt(cnpj[12], 10) && secondDigit === Number.parseInt(cnpj[13], 10);
};

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
      .transform((value) => value || undefined)
      .refine((value) => !value || isValidCnpj(value), "cnpj must be valid"),
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
