import { prisma } from "@/app/api/infra/data/prisma";
import { escapeLikePattern } from "@/lib/prisma/escape-like-pattern";
import { applicablePendingActionSelect } from "./IPendingActionRepository";
import type {
  ApplicablePendingAction,
  BillingPendingActionRecord,
  CreateTeamMemberParams,
  IPendingActionRepository,
  MarkPendingActionAppliedParams,
  MarkPendingActionFailedParams,
  PendingActionOwnershipLookup,
  PendingActionProfileContact,
  TeamMemberAccessParams,
  TeamMembershipKey,
} from "./IPendingActionRepository";
import { PendingAction, Prisma } from "@prisma/client";
import type { UserFunction, UserRole } from "@prisma/client";
import type { AsaasAccountId } from "@/lib/asaas";

export class PendingActionRepository implements IPendingActionRepository {
  async findById(id: string) {
    // Achado Codex (PR #1137, P1, round 8): select explícito em vez de
    // include — fecha a exceção prismaIncludeAllowlist deste arquivo.
    return prisma.pendingAction.findUnique({
      where: { id },
      select: {
        id: true,
        masterId: true,
        teamId: true,
        actionType: true,
        status: true,
        payload: true,
        checkoutId: true,
        paymentId: true,
        asaasAccount: true,
        createdAt: true,
        updatedAt: true,
        master: {
          select: {
            id: true,
            fullName: true,
            email: true,
            cpfCnpj: true,
            phone: true,
            postalCode: true,
            address: true,
            addressNumber: true,
            neighborhood: true,
            complement: true,
            city: true,
            state: true,
            asaasCustomerId: true,
            asaasCustomerAccount: true,
            asaasSubscriptionId: true,
            asaasSubscriptionAccount: true,
            subscriptionStatus: true,
            subscriptionNextDueDate: true,
            subscriptionCycle: true,
            hasPermanentSubscription: true,
            timezone: true,
          },
        },
      },
    });
  }

  async findByIdSimple(id: string): Promise<PendingAction | null> {
    return prisma.pendingAction.findUnique({
      where: { id },
    });
  }

  async findByPaymentId(paymentId: string): Promise<PendingAction | null> {
    return prisma.pendingAction.findFirst({
      where: { paymentId },
    });
  }

  async create(data: {
    masterId: string;
    teamId?: string | null;
    actionType: string;
    status: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: data.masterId,
        teamId: data.teamId ?? null,
        actionType: data.actionType as PendingAction["actionType"],
        status: data.status as PendingAction["status"],
        payload: data.payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return pendingAction;
  }

  async updatePaymentId(id: string, paymentId: string, account: AsaasAccountId): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { paymentId, asaasAccount: account },
    });
  }

  async clearPaymentId(id: string): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { paymentId: null },
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { status: status as PendingAction["status"] },
    });
  }

  async updatePayload(id: string, payload: Record<string, unknown>): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { payload: payload as Prisma.InputJsonValue },
    });
  }

  async listBillingByMasterId(masterId: string): Promise<BillingPendingActionRecord[]> {
    const rows = await prisma.pendingAction.findMany({
      where: {
        masterId,
        actionType: { in: ["add_user", "add_member", "create_team"] },
        status: { in: ["pending", "applied", "failed"] },
      },
      select: {
        id: true,
        actionType: true,
        status: true,
        paymentId: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
        payload: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      status: row.status,
      paymentId: row.paymentId,
      teamId: row.teamId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payload: row.payload,
    }));
  }

  // --- Aplicação de ação pendente (checkout pago / dispensa de cobrança) ---

  async findApplicableByCheckoutId(
    checkoutId: string,
    account: AsaasAccountId
  ): Promise<ApplicablePendingAction | null> {
    return prisma.pendingAction.findFirst({
      where: { checkoutId, asaasAccount: account },
      select: applicablePendingActionSelect,
    });
  }

  async findApplicableById(id: string): Promise<ApplicablePendingAction | null> {
    return prisma.pendingAction.findUnique({
      where: { id },
      select: applicablePendingActionSelect,
    });
  }

  async findApplicableByPaymentId(
    paymentId: string,
    account: AsaasAccountId
  ): Promise<ApplicablePendingAction | null> {
    return prisma.pendingAction.findFirst({
      where: { paymentId, asaasAccount: account },
      select: applicablePendingActionSelect,
    });
  }

  async findByPaymentIdAndMasterId(
    paymentId: string,
    masterId: string
  ): Promise<PendingActionOwnershipLookup | null> {
    return prisma.pendingAction.findFirst({
      where: { paymentId, masterId },
      select: { id: true, masterId: true, status: true, asaasAccount: true },
    });
  }

  async markFailed(params: MarkPendingActionFailedParams): Promise<void> {
    await prisma.pendingAction.update({
      where: { id: params.id },
      data: {
        status: "failed",
        paymentId: params.paymentId,
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  }

  async findProfileContact(profileId: string): Promise<PendingActionProfileContact | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { email: true, fullName: true },
    });
  }

  async linkProfileSupabaseIdentity(profileId: string, supabaseId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { supabaseId },
    });
  }

  async runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(work);
  }

  // --- Escritas transacionais: recebem o cliente de transação do UseCase ---

  async markApplied(
    tx: Prisma.TransactionClient,
    params: MarkPendingActionAppliedParams
  ): Promise<void> {
    await tx.pendingAction.update({
      where: { id: params.id },
      data: {
        status: "applied",
        paymentId: params.paymentId,
        // `teamId` ausente mantém o valor atual — update_subscription_credits não o grava.
        ...(params.teamId === undefined ? {} : { teamId: params.teamId }),
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  }

  async createTeam(
    tx: Prisma.TransactionClient,
    params: { name: string; masterId: string; isDefault: boolean }
  ): Promise<{ id: string }> {
    return tx.team.create({
      data: {
        name: params.name,
        masterId: params.masterId,
        isDefault: params.isDefault,
      },
      select: { id: true },
    });
  }

  async findTeamOwner(
    tx: Prisma.TransactionClient,
    teamId: string
  ): Promise<{ masterId: string } | null> {
    return tx.team.findUnique({
      where: { id: teamId },
      select: { masterId: true },
    });
  }

  async transferTeamOwnership(
    tx: Prisma.TransactionClient,
    params: { teamId: string; newMasterId: string }
  ): Promise<void> {
    await tx.team.update({
      where: { id: params.teamId },
      data: { masterId: params.newMasterId },
    });
  }

  async upsertTeamManagerMembership(
    tx: Prisma.TransactionClient,
    params: TeamMembershipKey & { functions: UserFunction[] }
  ): Promise<void> {
    await tx.teamMember.upsert({
      where: {
        teamId_profileId: {
          teamId: params.teamId,
          profileId: params.profileId,
        },
      },
      update: {
        role: "manager",
        functions: params.functions,
      },
      create: {
        teamId: params.teamId,
        profileId: params.profileId,
        role: "manager",
        functions: params.functions,
      },
    });
  }

  async hasTeamMembership(
    tx: Prisma.TransactionClient,
    params: TeamMembershipKey
  ): Promise<boolean> {
    const membership = await tx.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId: params.teamId,
          profileId: params.profileId,
        },
      },
      select: { id: true },
    });

    return membership !== null;
  }

  async createTeamMember(
    tx: Prisma.TransactionClient,
    params: CreateTeamMemberParams
  ): Promise<void> {
    await tx.teamMember.create({
      data: {
        teamId: params.teamId,
        profileId: params.profileId,
        role: params.role,
        functions: params.functions,
        canCreateAccountUsers: params.canCreateAccountUsers,
        canManageAccountTeams: params.canManageAccountTeams,
        canTransferAccountLeads: params.canTransferAccountLeads,
      },
    });
  }

  async createTeamMemberAccess(
    tx: Prisma.TransactionClient,
    params: TeamMemberAccessParams
  ): Promise<void> {
    await tx.teamMember.create({
      data: {
        teamId: params.teamId,
        profileId: params.profileId,
        role: params.role,
        functions: params.functions,
        canCreateAccountUsers: params.canCreateAccountUsers,
        canManageAccountTeams: params.canManageAccountTeams,
        canTransferAccountLeads: params.canTransferAccountLeads,
        canViewAllTeams: params.canViewAllTeams,
      },
    });
  }

  async updateTeamMemberAccess(
    tx: Prisma.TransactionClient,
    params: TeamMemberAccessParams
  ): Promise<void> {
    await tx.teamMember.update({
      where: {
        teamId_profileId: {
          teamId: params.teamId,
          profileId: params.profileId,
        },
      },
      data: {
        role: params.role,
        functions: params.functions,
        canCreateAccountUsers: params.canCreateAccountUsers,
        canManageAccountTeams: params.canManageAccountTeams,
        canTransferAccountLeads: params.canTransferAccountLeads,
        canViewAllTeams: params.canViewAllTeams,
      },
    });
  }

  async promoteMembershipToManager(
    tx: Prisma.TransactionClient,
    params: TeamMembershipKey
  ): Promise<void> {
    await tx.teamMember.update({
      where: {
        teamId_profileId: {
          teamId: params.teamId,
          profileId: params.profileId,
        },
      },
      data: { role: "manager" },
    });
  }

  /**
   * Busca insensível a caixa. `escapeLikePattern` é obrigatório porque o Prisma
   * traduz `equals` + `mode: "insensitive"` para ILIKE com o valor cru — ver
   * `lib/prisma/escape-like-pattern.ts`.
   */
  async findProfileIdByEmail(
    tx: Prisma.TransactionClient,
    email: string
  ): Promise<{ id: string } | null> {
    return tx.profile.findFirst({
      where: { email: { equals: escapeLikePattern(email), mode: "insensitive" } },
      select: { id: true },
    });
  }

  async createManagedProfile(
    tx: Prisma.TransactionClient,
    params: {
      fullName: string;
      email: string;
      role: UserRole;
      functions: UserFunction[];
      managerId: string;
    }
  ): Promise<{ id: string }> {
    return tx.profile.create({
      data: {
        fullName: params.fullName,
        email: params.email,
        role: params.role,
        functions: params.functions,
        managerId: params.managerId,
        isMaster: false,
      },
      select: { id: true },
    });
  }

  async assignProfileManager(
    tx: Prisma.TransactionClient,
    params: { profileId: string; fullName: string; managerId: string }
  ): Promise<void> {
    await tx.profile.update({
      where: { id: params.profileId },
      data: {
        fullName: params.fullName,
        managerId: params.managerId,
      },
    });
  }

  async promoteProfileToMaster(
    tx: Prisma.TransactionClient,
    profileId: string
  ): Promise<void> {
    await tx.profile.update({
      where: { id: profileId },
      data: { isMaster: true },
    });
  }
}

export const pendingActionRepository = new PendingActionRepository();
