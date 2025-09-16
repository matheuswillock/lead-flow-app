import { z } from "zod";
import { LeadStatus } from "@prisma/client";

export const CreateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email deve ser válido").optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").optional().or(z.literal("")),
  cnpj: z.string().optional().or(z.literal("")),
  age: z.number().int().positive("Idade deve ser um número positivo").optional(),
  hasHealthPlan: z.boolean().optional(),
  currentValue: z.number().positive("Valor deve ser positivo").optional(),
  referenceHospital: z.string().optional().or(z.literal("")),
  currentTreatment: z.string().optional().or(z.literal("")),
  meetingDate: z.string().datetime().optional(),
  notes: z.string().optional().or(z.literal("")),
  assignedTo: z.string().uuid("ID do operador deve ser um UUID válido").optional(),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.new_opportunity)
});

export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;