import { z } from "zod";

export type UserFunction = "SDR" | "CLOSER";

// Interfaces principais
export interface ManagerUser {
  id: string;
  name: string;
  fullName?: string; // Alias para name
  email: string;
  role: "manager" | "backoffice" | "operator";
  googleCalendarConnected?: boolean;
  functions?: UserFunction[];
  profileIconId?: string | null;
  profileIconUrl?: string;
  managerId?: string; // Para operators
  canCreateAccountUsers?: boolean;
  canManageAccountTeams?: boolean;
  leadsCount?: number; // Contador de leads
  meetingsCount?: number; // Contador de agendamentos (closer)
  hasPermanentSubscription?: boolean; // Indica assinatura permanente
  createdAt: Date | string; // Pode vir como Date do Prisma ou string do JSON
  updatedAt: Date | string; // Pode vir como Date do Prisma ou string do JSON
  isPending?: boolean; // Indica se é um operador pendente
  pendingPayment?: {
    id: string;
    paymentId: string;
    paymentStatus: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RECEIVED' | 'APPROVED' | 'RECEIVED_IN_CASH';
    paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
    operatorCreated: boolean;
  };
}

export interface PendingOperator {
  id: string;
  managerId: string;
  name: string;
  email: string;
  role: string;
  paymentId: string;
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RECEIVED' | 'APPROVED' | 'RECEIVED_IN_CASH';
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  operatorCreated: boolean;
  operatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorPaymentData {
  paymentId: string;
  paymentStatus: string;
  paymentMethod: string;
  dueDate?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  operatorCreated: boolean;
  operatorId?: string;
}

export interface ManagerUserTableRow extends ManagerUser {
  canEdit: boolean;
  canDelete: boolean;
  status: 'active' | 'pending_payment' | 'payment_confirmed' | 'payment_failed' | 'pending_creation' | 'subscription_updated';
  pendingPayment?: PendingOperator;
}

export interface ManagerUserTeamSummary {
  id: string;
  name: string;
  leadsCount: number;
  meetingsCount: number;
}

// Schemas de validação para formulários
export const CreateManagerUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  role: z.enum(["manager", "backoffice", "operator"], {
    message: "Selecione um nível de acesso válido"
  }),
  functions: z.array(z.enum(["SDR", "CLOSER"]))
    .max(2, "Selecione no máximo 2 funções")
    .optional(),
  billingType: z.enum(["PIX", "CREDIT_CARD"]).optional().default("PIX"),
  canCreateAccountUsers: z.boolean().optional(),
  canManageAccountTeams: z.boolean().optional(),
});

export const UpdateManagerUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo").optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(["manager", "backoffice", "operator"], {
    message: "Selecione um nível de acesso válido"
  }).optional(),
  functions: z.array(z.enum(["SDR", "CLOSER"]))
    .max(2, "Selecione no máximo 2 funções")
    .optional(),
  canCreateAccountUsers: z.boolean().optional(),
  canManageAccountTeams: z.boolean().optional(),
});

// Tipos inferidos dos schemas
export type CreateManagerUserFormData = z.infer<typeof CreateManagerUserSchema>;
export type UpdateManagerUserFormData = z.infer<typeof UpdateManagerUserSchema>;

// Estados de UI
export interface ManagerUsersState {
  users: ManagerUser[];
  loading: boolean;
  error: string | null;
  selectedUser: ManagerUser | null;
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  stats?: {
    totalOperators: number;
    totalManagers: number;
    totalUsers: number;
  };
}

// API Response types
export interface ManagerUsersApiResponse {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: ManagerUser[] | null;
  stats?: {
    totalOperators: number;
    totalManagers: number;
    totalUsers: number;
  };
}

export interface ManagerUserApiResponse {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: ManagerUser | null;
}

export interface ManagerUserTeamsApiResponse {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: { teams: ManagerUserTeamSummary[] } | null;
}

// Permissões
export interface UserPermissions {
  canCreateUser: boolean;
  canEditUser: boolean;
  canDeleteUser: boolean;
  canManageOperators: boolean;
}

// Filtros e ordenação
export interface TableFilters {
  search: string;
  role: "all" | "manager" | "backoffice" | "operator";
  sortBy: "name" | "email" | "role" | "createdAt";
  sortOrder: "asc" | "desc";
}
