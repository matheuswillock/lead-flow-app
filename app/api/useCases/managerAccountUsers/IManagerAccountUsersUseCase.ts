import type { Output } from "@/lib/output";

export interface ManagerAccountUsersResult {
  output: Output;
  status: number;
}

export interface ManagerAccountUsersListResult extends ManagerAccountUsersResult {
  stats: {
    totalOperators: number;
    totalManagers: number;
    totalUsers: number;
  };
}

export type AccountUserRole = "manager" | "backoffice" | "operator";
export type AccountUserFunction = "SDR" | "CLOSER";

export interface CreateAccountUserInput {
  name: string;
  email: string;
  role: AccountUserRole;
  functions?: AccountUserFunction[];
  billingType?: "PIX" | "CREDIT_CARD";
  hasPermanentSubscription?: boolean;
  canCreateAccountUsers?: boolean;
  canManageAccountTeams?: boolean;
  canTransferAccountLeads?: boolean;
  canViewAllTeams?: boolean;
}

export interface UpdateAccountUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: AccountUserRole;
  functions?: AccountUserFunction[];
  canCreateAccountUsers?: boolean;
  canManageAccountTeams?: boolean;
  canTransferAccountLeads?: boolean;
  canViewAllTeams?: boolean;
}

export interface AssociateAccountUserInput {
  profileId: string;
  role?: AccountUserRole;
  functions?: AccountUserFunction[];
}

export interface DissociateAccountUserInput {
  profileId: string;
}

export interface AccountUserTeamContext {
  teamId: string;
  profileId: string;
  managerId: string;
  isMaster: boolean;
}

export interface CreateAccountUserParams {
  ctx: AccountUserTeamContext;
  userData: CreateAccountUserInput;
}

export interface ListAccountUsersParams {
  ctx: AccountUserTeamContext;
  canListPendingUsers: boolean;
}

export interface UpdateAccountUserParams {
  ctx: AccountUserTeamContext;
  userData: UpdateAccountUserInput;
}

export interface AssociateAccountUserParams {
  ctx: AccountUserTeamContext;
  userData: AssociateAccountUserInput;
}

export interface DissociateAccountUserParams {
  ctx: AccountUserTeamContext;
  userData: DissociateAccountUserInput;
}

export interface RemoveAccountUserParams {
  ctx: AccountUserTeamContext;
  userId: string | null;
}

export interface IManagerAccountUsersUseCase {
  createAccountUser(params: CreateAccountUserParams): Promise<ManagerAccountUsersResult>;
  checkEmailAvailability(email: string): Promise<ManagerAccountUsersResult>;
  listAccountUsers(params: ListAccountUsersParams): Promise<ManagerAccountUsersListResult>;
  associateTeamMember(params: AssociateAccountUserParams): Promise<ManagerAccountUsersResult>;
  dissociateTeamMember(params: DissociateAccountUserParams): Promise<ManagerAccountUsersResult>;
  updateAccountUser(params: UpdateAccountUserParams): Promise<ManagerAccountUsersResult>;
  removeAccountUser(params: RemoveAccountUserParams): Promise<ManagerAccountUsersResult>;
}
