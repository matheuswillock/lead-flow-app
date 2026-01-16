import { z } from "zod";
import { LeadStatus, HealthPlan } from "@prisma/client";

export const CreateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email deve ser válido").nullish().transform(val => val || undefined),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").nullish().transform(val => val || undefined),
  cnpj: z.string().nullish().transform(val => val || undefined),
  age: z.string().nullish().transform(val => val || undefined),
  currentHealthPlan: z.nativeEnum(HealthPlan).nullish().transform(val => val || undefined),
  currentValue: z.number().min(0, "Valor deve ser maior ou igual a zero").nullish().transform(val => val || undefined),
  referenceHospital: z.string().nullish().transform(val => val || undefined),
  currentTreatment: z.string().nullish().transform(val => val || undefined),
  meetingDate: z.string().datetime().nullish().transform(val => val || undefined),
  notes: z.string().nullish().transform(val => val || undefined),
  assignedTo: z.string().uuid("ID do operador deve ser um UUID válido").nullish().transform(val => val || undefined),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.new_opportunity),
  createdBy: z.string().uuid("ID do criador deve ser um UUID válido").optional(),
  updatedBy: z.string().uuid("ID do atualizador deve ser um UUID válido").optional(),
  // Novos campos de venda (sempre null/undefined na criação)
  ticket: z.number().min(0).nullish().transform(val => val || undefined),
  contractDueDate: z.string().datetime().nullish().transform(val => val || undefined),
  soldPlan: z.nativeEnum(HealthPlan).nullish().transform(val => val || undefined)
});

export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;