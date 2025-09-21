import { z } from "zod";
import { LeadStatus, AgeRange } from "@prisma/client";

export const UpdateLeadRequestSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  email: z.string().email("Email deve ser válido").optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").optional().or(z.literal("")),
  cnpj: z.string().optional().or(z.literal("")),
  age: z.array(z.nativeEnum(AgeRange)).optional(),
  hasHealthPlan: z.boolean().optional(),
  currentValue: z.number().positive("Valor deve ser positivo").optional(),
  referenceHospital: z.string().optional().or(z.literal("")),
  currentTreatment: z.string().optional().or(z.literal("")),
  meetingDate: z.string().datetime().optional(),
  notes: z.string().optional().or(z.literal("")),
  assignedTo: z.string().uuid("ID do operador deve ser um UUID válido").optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  updatedBy: z.string().uuid("ID do atualizador deve ser um UUID válido").optional()
});

export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;