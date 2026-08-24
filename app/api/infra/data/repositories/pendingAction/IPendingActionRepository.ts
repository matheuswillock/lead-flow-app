import { PendingAction } from "@prisma/client";
import type { Prisma, UserFunction, UserRole } from "@prisma/client";

/**
 * Shape lido pelo fluxo de aplicação de ação pendente. Lista os 10 escalares de
 * `PendingAction` explicitamente para substituir o `include` sem alterar o objeto
 * devolvido — ele escapa do repositório e é lido campo a campo pelo UseCase.
 */
export const applicablePendingActionSelect = {
  id: true,
  masterId: true,
  teamId: true,
  actionType: true,
  status: true,
  payload: true,
  checkoutId: true,
  paymentId: true,
  createdAt: true,
  updatedAt: true,
  master: {
    select: {
      id: true,
      fullName: true,
      email: true,
      functions: true,
      cpfCnpj: true,
      phone: true,
      postalCode: true,
      address: true,
      addressNumber: true,
      neighborhood: true,
      complement: true,
      asaasCustomerId: true,
      asaasSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionNextDueDate: true,
      subscriptionCycle: true,
      hasPermanentSubscription: true,
      hasUnlimitedUsers: true,
      timezone: true,
    },
  },
} satisfies Prisma.PendingActionSelect;

export type ApplicablePendingAction = Prisma.PendingActionGetPayload<{
  select: typeof applicablePendingActionSelect;
}>;

export type PendingActionProfileContact = {
  email: string;
  fullName: string | null;
};

export type MarkPendingActionAppliedParams = {
  id: string;
  paymentId: string | null;
  /** Omitido (undefined) mantém o valor atual — usado por update_subscription_credits. */
  teamId?: string | null;
  payload: Record<string, unknown>;
};

export type MarkPendingActionFailedParams = {
  id: string;
  paymentId: string | null;
  payload: Record<string, unknown>;
};

export type TeamMembershipKey = {
  teamId: string;
  profileId: string;
};

export type DelegatedTeamPermissions = {
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
};

export type CreateTeamMemberParams = TeamMembershipKey & {
  role: UserRole;
  functions: UserFunction[];
} & DelegatedTeamPermissions;

export type TeamMemberAccessParams = CreateTeamMemberParams & {
  canViewAllTeams: boolean;
};

export type BillingPendingActionRecord = {
  id: string;
  actionType: string;
  status: string;
  paymentId: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload: unknown;
};

export interface IPendingActionRepository {
  findById(id: string): Promise<(PendingAction & { master: any }) | null>;
  findByIdSimple(id: string): Promise<PendingAction | null>;
  findByPaymentId(paymentId: string): Promise<PendingAction | null>;
  create(data: {
    masterId: string;
    teamId?: string | null;
    actionType: string;
    status: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }>;
  updatePaymentId(id: string, paymentId: string): Promise<void>;
  clearPaymentId(id: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  updatePayload(id: string, payload: Record<string, unknown>): Promise<void>;
  listBillingByMasterId(masterId: string): Promise<BillingPendingActionRecord[]>;

  // --- Aplicação de ação pendente (checkout pago / dispensa de cobrança) ---

  findApplicableByCheckoutId(checkoutId: string): Promise<ApplicablePendingAction | null>;
  findApplicableById(id: string): Promise<ApplicablePendingAction | null>;
  findApplicableByPaymentId(paymentId: string): Promise<ApplicablePendingAction | null>;
  markFailed(params: MarkPendingActionFailedParams): Promise<void>;
  findProfileContact(profileId: string): Promise<PendingActionProfileContact | null>;
  linkProfileSupabaseIdentity(profileId: string, supabaseId: string): Promise<void>;

  /**
   * Executa a orquestração da aplicação numa única transação. O UseCase mantém a
   * ordem das operações; o cliente Prisma não sai desta camada.
   */
  runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;

  // --- Escritas transacionais: recebem o cliente de transação do UseCase ---

  markApplied(
    tx: Prisma.TransactionClient,
    params: MarkPendingActionAppliedParams
  ): Promise<void>;
  createTeam(
    tx: Prisma.TransactionClient,
    params: { name: string; masterId: string; isDefault: boolean }
  ): Promise<{ id: string }>;
  findTeamOwner(
    tx: Prisma.TransactionClient,
    teamId: string
  ): Promise<{ masterId: string } | null>;
  transferTeamOwnership(
    tx: Prisma.TransactionClient,
    params: { teamId: string; newMasterId: string }
  ): Promise<void>;
  upsertTeamManagerMembership(
    tx: Prisma.TransactionClient,
    params: TeamMembershipKey & { functions: UserFunction[] }
  ): Promise<void>;
  hasTeamMembership(tx: Prisma.TransactionClient, params: TeamMembershipKey): Promise<boolean>;
  createTeamMember(tx: Prisma.TransactionClient, params: CreateTeamMemberParams): Promise<void>;
  createTeamMemberAccess(
    tx: Prisma.TransactionClient,
    params: TeamMemberAccessParams
  ): Promise<void>;
  updateTeamMemberAccess(
    tx: Prisma.TransactionClient,
    params: TeamMemberAccessParams
  ): Promise<void>;
  promoteMembershipToManager(
    tx: Prisma.TransactionClient,
    params: TeamMembershipKey
  ): Promise<void>;
  findProfileIdByEmail(
    tx: Prisma.TransactionClient,
    email: string
  ): Promise<{ id: string } | null>;
  createManagedProfile(
    tx: Prisma.TransactionClient,
    params: {
      fullName: string;
      email: string;
      role: UserRole;
      functions: UserFunction[];
      managerId: string;
    }
  ): Promise<{ id: string }>;
  assignProfileManager(
    tx: Prisma.TransactionClient,
    params: { profileId: string; fullName: string; managerId: string }
  ): Promise<void>;
  promoteProfileToMaster(tx: Prisma.TransactionClient, profileId: string): Promise<void>;
}
