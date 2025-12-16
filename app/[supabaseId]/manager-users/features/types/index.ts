import { z } from "zod";

// Interfaces principais
export interface ManagerUser {
  id: string;
  name: string;
  email: string;
  role: "manager" | "operator";
  profileIconUrl?: string;
  managerId?: string; // Para operators
  leadsCount?: number; // Contador de leads
  createdAt: Date;
  updatedAt: Date;
  isPending?: boolean; // Indica se é um operador pendente
  pendingPayment?: {
    id: string;
    paymentId: string;
    paymentStatus: 'PENDING' | 'CONFIRMED' | 'FAILED';
    paymentMethod: 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
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
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'FAILED';
  paymentMethod: 'PIX' | 'CREDIT_CARD';
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
  status: 'active' | 'pending_payment' | 'payment_confirmed' | 'payment_failed' | 'pending_creation';
}

// Schemas de validação para formulários
export const CreateManagerUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido"),
  role: z.enum(["manager", "operator"], { 
    message: "Selecione um papel válido"
  }),
});

export const UpdateManagerUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo").optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(["manager", "operator"], { 
    message: "Selecione um papel válido"
  }).optional(),
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
  role: "all" | "manager" | "operator";
  sortBy: "name" | "email" | "role" | "createdAt";
  sortOrder: "asc" | "desc";
}