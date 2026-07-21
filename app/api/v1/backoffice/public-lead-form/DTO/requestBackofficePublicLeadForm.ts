import { z } from "zod"
import { isValidCNPJ, isValidCPF, sanitizeDocumentDigits } from "@/lib/masks"

function isValidCpfOrCnpj(value: string): boolean {
  const digits = sanitizeDocumentDigits(value)
  if (!digits) return true
  if (digits.length <= 11) return isValidCPF(digits)
  return isValidCNPJ(digits)
}

const optionalTrimmed = z
  .string()
  .nullish()
  .transform((val) => {
    if (!val) return undefined
    const trimmed = val.trim()
    return trimmed.length > 0 ? trimmed : undefined
  })

export const BackofficePublicLeadFormRequestSchema = z
  .object({
    name: z.string().trim().min(2, "Informe ao menos 2 caracteres."),
    email: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "E-mail inválido.",
      })
      .transform((val) => {
        if (!val) return undefined
        const trimmed = val.trim()
        return trimmed.length > 0 ? trimmed : undefined
      }),
    phone: z
      .string()
      .trim()
      .nullish()
      .refine(
        (value) => {
          if (!value) return true
          const digits = value.replace(/\D/g, "")
          return digits.length === 10 || digits.length === 11
        },
        { message: "Telefone deve conter 10 ou 11 dígitos." },
      )
      .transform((val) => {
        if (!val) return undefined
        const digits = val.replace(/\D/g, "")
        return digits.length > 0 ? digits : undefined
      }),
    cpfCnpj: z
      .string()
      .trim()
      .nullish()
      .refine((value) => !value || isValidCpfOrCnpj(value), {
        message: "CPF ou CNPJ inválido.",
      })
      .transform((val) => {
        if (!val) return undefined
        const digits = sanitizeDocumentDigits(val)
        return digits.length > 0 ? digits : undefined
      }),
    notes: optionalTrimmed,
    qualificationLeadOrganization: optionalTrimmed,
    qualificationAvgUsers: optionalTrimmed,
    qualificationProfileFit: optionalTrimmed,
    utmSource: optionalTrimmed,
    utmMedium: optionalTrimmed,
    utmCampaign: optionalTrimmed,
    utmContent: optionalTrimmed,
    utmTerm: optionalTrimmed,
    landingUrl: optionalTrimmed,
    referrer: optionalTrimmed,
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Informe e-mail ou telefone.",
    path: ["email"],
  })

export type BackofficePublicLeadFormRequest = z.infer<
  typeof BackofficePublicLeadFormRequestSchema
>
