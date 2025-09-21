// DTOs para os endpoints de Manager Users
import { z } from "zod";
import { UserRole } from "@prisma/client";

// Request Schemas
export const CreateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  role: z.enum(["manager", "operator"], { 
    message: "Role deve ser 'manager' ou 'operator'"
  }),
  profileIconUrl: z.string().url("URL do ícone deve ser válida").optional()
});

export const AssociateOperatorSchema = z.object({
  action: z.literal("associate"),
  managerId: z.string().uuid("ID do manager deve ser um UUID válido"),
  operatorId: z.string().uuid("ID do operator deve ser um UUID válido")
});

export const DissociateOperatorSchema = z.object({
  action: z.literal("dissociate"),
  operatorId: z.string().uuid("ID do operator deve ser um UUID válido")
});

// Response Types
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileIconUrl?: string;
  managerId?: string; // For operators
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagerResponseDTO extends UserResponseDTO {
  role: "manager";
  operators?: OperatorResponseDTO[];
}

export interface OperatorResponseDTO extends UserResponseDTO {
  role: "operator";
  managerId?: string;
}

// Request Types
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type AssociateOperatorRequest = z.infer<typeof AssociateOperatorSchema>;
export type DissociateOperatorRequest = z.infer<typeof DissociateOperatorSchema>;