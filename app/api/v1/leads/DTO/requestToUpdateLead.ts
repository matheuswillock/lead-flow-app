import { z } from "zod";
import { LeadStatus, AgeRange } from "@prisma/client";

export const UpdateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  email: z.string().email("Email deve ser válido").nullish().transform(val => val || undefined),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").nullish().transform(val => val || undefined),
  cnpj: z.string().nullish().transform(val => val || undefined),
  age: z.array(z.nativeEnum(AgeRange)).optional(),
  hasHealthPlan: z.boolean().optional(),
  currentHealthPlan: z.string().nullish().transform(val => val || undefined),
  currentValue: z.number().min(0, "Valor deve ser maior ou igual a zero").nullish().transform(val => val || undefined),
  referenceHospital: z.string().nullish().transform(val => val || undefined),
  currentTreatment: z.string().nullish().transform(val => val || undefined),
  meetingDate: z.string().datetime().nullish().transform(val => val || undefined),
  notes: z.string().nullish().transform(val => val || undefined),
  assignedTo: z.string().uuid("ID do operador deve ser um UUID válido").nullish().transform(val => val || undefined),
  status: z.nativeEnum(LeadStatus).optional(),
  updatedBy: z.string().uuid("ID do atualizador deve ser um UUID válido").optional()
});

export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;