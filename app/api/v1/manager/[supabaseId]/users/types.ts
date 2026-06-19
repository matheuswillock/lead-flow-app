// DTOs para os endpoints de Manager Users
import { z } from "zod";
import { UserRole, UserFunction } from "@prisma/client";

// Request Schemas
export const CreateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  role: z.enum(["manager", "backoffice", "operator"], {
    message: "Role deve ser 'manager', 'backoffice' ou 'operator'"
  }),
  functions: z.array(z.enum(["SDR", "CLOSER"]))
    .max(2, "Selecione no máximo 2 funções")
    .optional(),
  billingType: z.enum(["PIX", "CREDIT_CARD"]).optional().default("PIX"),
  profileIconUrl: z.string().url("URL do ícone deve ser válida").optional(),
  hasPermanentSubscription: z.boolean().optional().default(false),
  canCreateAccountUsers: z.boolean().optional(),
  canManageAccountTeams: z.boolean().optional(),
  canTransferAccountLeads: z.boolean().optional(),
});

export const UpdateUserSchema = z.object({
  id: z.string().uuid("ID do usuário deve ser um UUID válido"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(["manager", "backoffice", "operator"], {
    message: "Role deve ser 'manager', 'backoffice' ou 'operator'"
  }).optional(),
  functions: z.array(z.enum(["SDR", "CLOSER"]))
    .max(2, "Selecione no máximo 2 funções")
    .optional(),
  profileIconUrl: z.string().url("URL do ícone deve ser válida").optional().nullable(),
  canCreateAccountUsers: z.boolean().optional(),
  canManageAccountTeams: z.boolean().optional(),
  canTransferAccountLeads: z.boolean().optional(),
});

export const AssociateOperatorSchema = z.object({
  action: z.literal("associate"),
  profileId: z.string().uuid("ID do usuário deve ser um UUID válido"),
  role: z.enum(["manager", "backoffice", "operator"]).optional(),
  functions: z.array(z.enum(["SDR", "CLOSER"])).optional()
});

export const DissociateOperatorSchema = z.object({
  action: z.literal("dissociate"),
  profileId: z.string().uuid("ID do usuário deve ser um UUID válido")
});

// Response Types
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  functions?: UserFunction[];
  profileIconId?: string | null;
  profileIconUrl?: string;
  managerId?: string; // For operators
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagerResponseDTO extends UserResponseDTO {
  role: "manager" | "backoffice";
  operators?: OperatorResponseDTO[];
}

export interface OperatorResponseDTO extends UserResponseDTO {
  role: "operator";
  managerId?: string;
}

// Request Types
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type AssociateOperatorRequest = z.infer<typeof AssociateOperatorSchema>;
export type DissociateOperatorRequest = z.infer<typeof DissociateOperatorSchema>;
