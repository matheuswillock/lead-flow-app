import { z } from "zod";
import { LeadStatus, MeetingHeald } from "@prisma/client";
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from "./leadValueLimits";
import { isValidCNPJ, sanitizeDocumentDigits } from "@/lib/masks";

export const CreateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email deve ser válido").nullish().transform(val => val || undefined),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").nullish().transform(val => val || undefined),
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
  age: z.string().nullish().transform(val => val || undefined),
  currentHealthPlan: z.string().trim().min(1, "Plano de saúde deve ser válido").nullish().transform(val => val || undefined),
  currentValue: z
    .number()
    .min(0, "Valor deve ser maior ou igual a zero")
    .max(MAX_DECIMAL_VALUE, `Valor deve ser menor que ${MAX_DECIMAL_LABEL}`)
    .nullish()
    .transform((val) => val ?? undefined),
  referenceHospital: z.string().nullish().transform(val => val || undefined),
  currentTreatment: z.string().nullish().transform(val => val || undefined),
  meetingDate: z.string().datetime().nullish().transform(val => val || undefined),
  meetingTitle: z.string().nullish().transform(val => val || undefined),
  meetingNotes: z.string().nullish().transform(val => val || undefined),
  meetingLink: z.string().url("Link da reunião inválido").nullish().transform(val => val || undefined),
  // Allow null to align with update flow (unchecked clears the flag).
  meetingHeald: z.nativeEnum(MeetingHeald).nullable().optional(),
  notes: z.string().nullish().transform(val => val || undefined),
  assignedTo: z.string().uuid("ID do operador deve ser um UUID válido").nullish().transform(val => val || undefined),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").nullish().transform(val => val || undefined),
  status: z.nativeEnum(LeadStatus).nullable().optional(),
  saveAsDraft: z.boolean().optional(),
  createdBy: z.string().uuid("ID do criador deve ser um UUID válido").optional(),
  updatedBy: z.string().uuid("ID do atualizador deve ser um UUID válido").optional(),
  // Novos campos de venda (sempre null/undefined na criação)
  ticket: z
    .number()
    .min(0)
    .max(MAX_DECIMAL_VALUE, `Ticket deve ser menor que ${MAX_DECIMAL_LABEL}`)
    .nullish()
    .transform((val) => val ?? undefined),
  contractDueDate: z.string().datetime().nullish().transform(val => val || undefined),
  soldPlan: z.string().trim().min(1, "Plano vendido deve ser válido").nullish().transform(val => val || undefined),
  // Meeting type & referral fields
  meetingType: z.enum(["online", "call", "whatsapp"]).optional(),
  isTransfer: z.boolean().optional(),
  isReferral: z.boolean().optional(),
  referrerLeadId: z.string().uuid("ID do lead indicador deve ser um UUID válido").optional(),
  referrerName: z.string().optional(),
  referrerPhone: z.string().optional(),
  confirmDuplicate: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;
