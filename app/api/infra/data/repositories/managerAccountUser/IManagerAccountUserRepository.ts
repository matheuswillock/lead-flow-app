import type {
  PendingAction,
  PendingOperator,
  Prisma,
  TeamMember,
  UserFunction,
  UserRole,
} from "@prisma/client";
import type { BillingOwnerProfile } from "@/app/api/shared/billing/billingOwnerProfile";

export type { BillingOwnerProfile };

export interface DelegatedAccountPermissions {
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
  canViewAllTeams: boolean;
}

export interface CreateAccountUserRecordsParams {
  teamId: string;
  masterId: string;
  fullName: string;
  email: string;
  role: UserRole;
  functions: UserFunction[];
  hasPermanentSubscription: boolean;
  delegatedPermissions: DelegatedAccountPermissions;
}

export interface CreatedAccountUserRecords {
  profile: {
    id: string;
    fullName: string | null;
    email: string;
    profileIconId: string | null;
    profileIconUrl: string | null;
  };
  teamMemberRecord: {
    role: UserRole;
    functions: UserFunction[];
    createdAt: Date;
    updatedAt: Date;
    canCreateAccountUsers: boolean;
    canManageAccountTeams: boolean;
    canTransferAccountLeads: boolean;
    canViewAllTeams: boolean;
  };
}

/**
 * Shape devolvido pela listagem do time.
 *
 * Equivale, campo a campo, ao antigo `teamMember.findMany` que carregava a
 * relação `profile` por `include`, e não por `select`: aquele modo trazia
 * TODOS os escalares de `TeamMember` (id, teamId, profileId,
 * role, functions, canCreateAccountUsers, canManageAccountTeams,
 * canTransferAccountLeads, canViewAllTeams, createdAt, updatedAt) mais a
 * relação `profile` com o mesmo `select`. O `select` explícito repete essa
 * lista para que o payload da API continue idêntico.
 */
export interface AccountUserListItem {
  id: string;
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
  canViewAllTeams: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    id: string;
    fullName: string | null;
    email: string;
    profileIconId: string | null;
    profileIconUrl: string | null;
    hasPermanentSubscription: boolean;
    googleConnection: {
      refreshToken: string | null;
      revokedAt: Date | null;
    } | null;
    _count: {
      leadsAsAssignee: number;
      leadsAsCloser: number;
    };
  };
}

/**
 * Shape devolvido após o update do PUT.
 *
 * Mesma equivalência descrita em {@link AccountUserListItem}: os 11 escalares
 * de `TeamMember` que a carga por relação trazia implicitamente, mais
 * `profile` com o mesmo `select` de antes.
 */
export interface AccountUserWithProfileSummary {
  id: string;
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
  canViewAllTeams: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    fullName: string | null;
    email: string;
    profileIconId: string | null;
    profileIconUrl: string | null;
  };
}

export interface ProfileLabelFields {
  fullName: string | null;
  email: string;
}

export interface CreateTeamMemberParams {
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
}

export interface UpdateTeamMemberByMasterParams {
  profileId: string;
  masterId: string;
  data: {
    role?: UserRole;
    functions?: UserFunction[];
    canCreateAccountUsers?: boolean;
    canManageAccountTeams?: boolean;
    canTransferAccountLeads?: boolean;
    canViewAllTeams?: boolean;
  };
}

export interface CreatePendingAddUserActionParams {
  masterId: string;
  teamId: string;
  payload: Prisma.InputJsonValue;
}

export interface IManagerAccountUserRepository {
  findTeamNameById(teamId: string): Promise<{ name: string } | null>;
  findProfileLabelById(profileId: string): Promise<ProfileLabelFields | null>;
  findProfileEmailById(profileId: string): Promise<{ email: string } | null>;
  findBillingOwnerProfile(profileId: string): Promise<BillingOwnerProfile | null>;

  findProfileIdByEmail(email: string): Promise<{ id: string } | null>;
  findOpenPendingOperatorIdByEmail(email: string): Promise<{ id: string } | null>;
  findOpenAddUserActionIdByEmail(email: string): Promise<{ id: string } | null>;

  runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  createAccountUserRecords(
    params: CreateAccountUserRecordsParams,
    tx?: Prisma.TransactionClient
  ): Promise<CreatedAccountUserRecords>;
  updateProfileSupabaseId(profileId: string, supabaseId: string): Promise<void>;
  deleteTeamMember(teamId: string, profileId: string): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;

  createPendingAddUserAction(
    params: CreatePendingAddUserActionParams
  ): Promise<{ id: string }>;
  updatePendingActionPayload(
    pendingActionId: string,
    payload: Prisma.InputJsonValue
  ): Promise<void>;

  findAccountUsersByTeam(teamId: string): Promise<AccountUserListItem[]>;
  findOpenPendingOperatorsByTeam(teamId: string): Promise<PendingOperator[]>;
  findOpenAddUserActionsByTeam(teamId: string): Promise<PendingAction[]>;

  findTeamMember(teamId: string, profileId: string): Promise<TeamMember | null>;
  findTeamMemberWithProfile(
    teamId: string,
    profileId: string
  ): Promise<AccountUserWithProfileSummary | null>;
  createTeamMember(params: CreateTeamMemberParams): Promise<TeamMember>;
  updateTeamMembersByMaster(params: UpdateTeamMemberByMasterParams): Promise<void>;
}
