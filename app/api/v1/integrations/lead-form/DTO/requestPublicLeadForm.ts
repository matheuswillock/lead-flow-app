import { z } from "zod";
import { MAX_DECIMAL_VALUE, MAX_DECIMAL_LABEL } from "../../../leads/DTO/leadValueLimits";
import { isValidCNPJ, sanitizeDocumentDigits } from "@/lib/masks";

export const PublicLeadFormRequestSchema = z
  .object({
    supabaseId: z.string().uuid("supabaseId deve ser um UUID válido").nullish().transform((val) => val || undefined),
    teamId: z.string().uuid("teamId deve ser um UUID válido"),

    // Lead fields
    name: z.string().min(2, "Nome inválido"),
    email: z.string().email("Email inválido").nullish().transform((val) => val || undefined),
    phone: z.string().min(8, "Telefone inválido").max(20, "Telefone inválido"),
    cnpj: z
      .string()
      .nullish()
      .refine((value) => {
        if (!value || value.trim() === "") return true;
        return isValidCNPJ(value);
      }, "CNPJ deve ser válido")
      .transform((val) => {
        if (!val || val.trim() === "") return undefined;
        return sanitizeDocumentDigits(val);
      }),
    age: z
      .string()
      .nullish()
      .refine((val) => {
        if (!val || !val.trim()) return true;
        return /^[\d:,\s]+$/.test(val);
      }, "Formato de idades inválido")
      .refine((val) => {
        if (!val || !val.trim()) return true;
        if (/^\d+:\d+(,\d+:\d+)*$/.test(val.trim())) {
          return val
            .split(",")
            .map((p) => Number.parseInt(p.trim().split(":")[0], 10))
            .filter((a) => !Number.isNaN(a))
            .every((a) => a <= 120);
        }
        return val
          .split(",")
          .map((a) => Number.parseInt(a.trim(), 10))
          .filter((a) => !Number.isNaN(a))
          .every((a) => a <= 120);
      }, "Todas as idades devem ser no máximo 120 anos")
      .transform((val) => val || undefined),
    currentHealthPlan: z.string().trim().nullish().transform((val) => val || undefined),
    currentValue: z
      .number()
      .min(0, "Valor deve ser maior ou igual a zero")
      .max(MAX_DECIMAL_VALUE, `Valor deve ser menor que ${MAX_DECIMAL_LABEL}`)
      .nullish()
      .transform((val) => val ?? undefined),
    referenceHospital: z.string().nullish().transform((val) => val || undefined),
    currentTreatment: z.string().nullish().transform((val) => val || undefined),
    notes: z.string().nullish().transform((val) => val || undefined),
    assignedTo: z.string().uuid("ID do SDR deve ser um UUID válido"),

    // Transfer flag (optional)
    isTransfer: z.boolean().nullish().transform((val) => val ?? undefined),

    // Scheduling fields (optional)
    closerId: z.string().uuid("ID do closer deve ser um UUID válido").nullish().transform((val) => val || undefined),
    meetingDate: z.string().datetime().nullish().transform((val) => val || undefined),
    meetingTitle: z.string().nullish().transform((val) => val || undefined),
    meetingNotes: z.string().nullish().transform((val) => val || undefined),
    extraGuests: z
      .array(z.string().email("Convidados extras devem conter emails válidos"))
      .nullish()
      .transform((guests) => {
        if (!guests || guests.length === 0) return undefined;
        const normalized = guests
          .map((guest) => guest.trim().toLowerCase())
          .filter(Boolean);
        return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
      }),

    // Tracking/origin fields (optional)
    source: z.string().nullish().transform((val) => val || undefined),
    utmSource: z.string().nullish().transform((val) => val || undefined),
    utmMedium: z.string().nullish().transform((val) => val || undefined),
    utmCampaign: z.string().nullish().transform((val) => val || undefined),
    utmContent: z.string().nullish().transform((val) => val || undefined),
    utmTerm: z.string().nullish().transform((val) => val || undefined),
    landingUrl: z.string().nullish().transform((val) => val || undefined),
    referrer: z.string().nullish().transform((val) => val || undefined),
    saveAsDraft: z.boolean().optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.saveAsDraft) return true;
      if (data.isTransfer && !data.meetingDate) return false;
      return true;
    },
    {
      message: "Selecione uma data para o pré-agendamento da transferência.",
      path: ["meetingDate"],
    }
  )
  .refine(
    (data) => {
      if (data.closerId && (!data.meetingDate || !data.meetingTitle)) {
        return false;
      }
      return true;
    },
    {
      message: "Ao selecionar um closer, data e título da reunião são obrigatórios",
      path: ["meetingDate"],
    }
  );

export type PublicLeadFormRequest = z.infer<typeof PublicLeadFormRequestSchema>;
