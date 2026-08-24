import { prisma } from "@/app/api/infra/data/prisma";
import { escapeLikePattern } from "@/lib/prisma/escape-like-pattern";
import type { PendingAction, PendingOperator, Prisma, TeamMember } from "@prisma/client";
import type {
  AccountUserListItem,
  AccountUserWithProfileSummary,
  BillingOwnerProfile,
  CreateAccountUserRecordsParams,
  CreatePendingAddUserActionParams,
  CreatedAccountUserRecords,
  CreateTeamMemberParams,
  IManagerAccountUserRepository,
  ProfileLabelFields,
  UpdateTeamMemberByMasterParams,
} from "./IManagerAccountUserRepository";

export class ManagerAccountUserRepository implements IManagerAccountUserRepository {
  async findTeamNameById(teamId: string): Promise<{ name: string } | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
  }

  async findProfileLabelById(profileId: string): Promise<ProfileLabelFields | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { fullName: true, email: true },
    });
  }

  async findProfileEmailById(profileId: string): Promise<{ email: string } | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { email: true },
    });
  }

  async findBillingOwnerProfile(profileId: string): Promise<BillingOwnerProfile | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
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
        asaasCustomerId: true,
        asaasSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionNextDueDate: true,
        subscriptionCycle: true,
        hasPermanentSubscription: true,
        hasUnlimitedUsers: true,
        timezone: true,
      },
    });
  }

  /**
   * Guarda de e-mail já cadastrado. Sem `escapeLikePattern` o
   * `mode: "insensitive"` vira `ILIKE` com o valor cru e o `_` do endereço
   * digitado casa a conta de outra pessoa — aqui o falso positivo BLOQUEIA um
   * cadastro legítimo, e a consulta é global (sem escopo de time).
   */
  async findProfileIdByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.profile.findFirst({
      where: { email: { equals: escapeLikePattern(email), mode: "insensitive" } },
      select: { id: true },
    });
  }

  async findOpenPendingOperatorIdByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.pendingOperator.findFirst({
      where: {
        email: { equals: escapeLikePattern(email), mode: "insensitive" },
        operatorCreated: false,
      },
      select: { id: true },
    });
  }

  async findOpenAddUserActionIdByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.pendingAction.findFirst({
      where: {
        actionType: "add_user",
        status: { in: ["pending", "failed"] },
        payload: {
          path: ["email"],
          equals: email,
        },
      },
      select: { id: true },
    });
  }

  async runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(work);
  }

  async createAccountUserRecords(
    params: CreateAccountUserRecordsParams,
    tx?: Prisma.TransactionClient
  ): Promise<CreatedAccountUserRecords> {
    const db = tx ?? prisma;

    const profile = await db.profile.create({
      data: {
        fullName: params.fullName,
        email: params.email,
        role: params.role,
        functions: params.functions,
        managerId: params.masterId,
        isMaster: false,
        hasPermanentSubscription: params.hasPermanentSubscription,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileIconId: true,
        profileIconUrl: true,
      },
    });

    const teamMemberRecord = await db.teamMember.create({
      data: {
        teamId: params.teamId,
        profileId: profile.id,
        role: params.role,
        functions: params.functions,
        canCreateAccountUsers: params.delegatedPermissions.canCreateAccountUsers,
        canManageAccountTeams: params.delegatedPermissions.canManageAccountTeams,
        canTransferAccountLeads: params.delegatedPermissions.canTransferAccountLeads,
        canViewAllTeams: params.delegatedPermissions.canViewAllTeams,
      },
      select: {
        role: true,
        functions: true,
        createdAt: true,
        updatedAt: true,
        canCreateAccountUsers: true,
        canManageAccountTeams: true,
        canTransferAccountLeads: true,
        canViewAllTeams: true,
      },
    });

    return { profile, teamMemberRecord };
  }

  async updateProfileSupabaseId(profileId: string, supabaseId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { supabaseId },
    });
  }

  async deleteTeamMember(teamId: string, profileId: string): Promise<void> {
    await prisma.teamMember.delete({
      where: {
        teamId_profileId: {
          teamId,
          profileId,
        },
      },
    });
  }

  async deleteProfile(profileId: string): Promise<void> {
    await prisma.profile.delete({ where: { id: profileId } });
  }

  async createPendingAddUserAction(
    params: CreatePendingAddUserActionParams
  ): Promise<{ id: string }> {
    return prisma.pendingAction.create({
      data: {
        masterId: params.masterId,
        teamId: params.teamId,
        actionType: "add_user",
        status: "pending",
        payload: params.payload,
      },
      select: { id: true },
    });
  }

  async updatePendingActionPayload(
    pendingActionId: string,
    payload: Prisma.InputJsonValue
  ): Promise<void> {
    await prisma.pendingAction.update({
      where: { id: pendingActionId },
      data: { payload },
    });
  }

  async findAccountUsersByTeam(teamId: string): Promise<AccountUserListItem[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      select: {
        id: true,
        teamId: true,
        profileId: true,
        role: true,
        functions: true,
        canCreateAccountUsers: true,
        canManageAccountTeams: true,
        canTransferAccountLeads: true,
        canViewAllTeams: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconId: true,
            profileIconUrl: true,
            hasPermanentSubscription: true,
            googleConnection: {
              select: {
                refreshToken: true,
                revokedAt: true,
              },
            },
            _count: {
              select: {
                leadsAsAssignee: {
                  where: { teamId },
                },
                leadsAsCloser: {
                  where: { teamId, status: "scheduled" },
                },
              },
            },
          },
        },
      },
      orderBy: {
        profile: { fullName: "asc" },
      },
    });
  }

  async findOpenPendingOperatorsByTeam(teamId: string): Promise<PendingOperator[]> {
    return prisma.pendingOperator.findMany({
      where: {
        teamId,
        operatorCreated: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOpenAddUserActionsByTeam(teamId: string): Promise<PendingAction[]> {
    return prisma.pendingAction.findMany({
      where: {
        teamId,
        actionType: "add_user",
        status: { in: ["pending", "failed"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findTeamMember(teamId: string, profileId: string): Promise<TeamMember | null> {
    return prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId,
        },
      },
    });
  }

  async findTeamMemberWithProfile(
    teamId: string,
    profileId: string
  ): Promise<AccountUserWithProfileSummary | null> {
    return prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId,
        },
      },
      select: {
        id: true,
        teamId: true,
        profileId: true,
        role: true,
        functions: true,
        canCreateAccountUsers: true,
        canManageAccountTeams: true,
        canTransferAccountLeads: true,
        canViewAllTeams: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            fullName: true,
            email: true,
            profileIconId: true,
            profileIconUrl: true,
          },
        },
      },
    });
  }

  async createTeamMember(params: CreateTeamMemberParams): Promise<TeamMember> {
    return prisma.teamMember.create({
      data: {
        teamId: params.teamId,
        profileId: params.profileId,
        role: params.role,
        functions: params.functions,
      },
    });
  }

  async updateTeamMembersByMaster(params: UpdateTeamMemberByMasterParams): Promise<void> {
    await prisma.teamMember.updateMany({
      where: {
        profileId: params.profileId,
        team: { masterId: params.masterId },
      },
      data: params.data,
    });
  }
}

export const managerAccountUserRepository: IManagerAccountUserRepository =
  new ManagerAccountUserRepository();
