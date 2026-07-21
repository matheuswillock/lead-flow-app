import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import { buildAddedToTeamEmail } from "@/lib/emails/buildAddedToTeamEmail";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import { backofficeIncrementalBillingCoordinator } from "@/app/api/useCases/backoffice/BackofficeIncrementalBillingCoordinator";
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository";
import { TeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { teamMembersUseCase } from "@/app/api/useCases/teamMembers/TeamMembersUseCase";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { auditLogService } from "@/app/api/services/audit/AuditLogService";
import { NotificationType } from "@prisma/client";
import type {
  ICrossAccountMembersUseCase,
  InviteExternalMemberInput,
} from "./ICrossAccountMembersUseCase";

function getDisplayName(profile: { fullName: string | null; email: string | null }) {
  return profile.fullName || profile.email || "Usuário";
}

export class CrossAccountMembersUseCase implements ICrossAccountMembersUseCase {
  constructor(
    private readonly platformUsersRepository = new BackofficePlatformUsersRepository(),
    private readonly teamMembersRepository = new TeamMembersRepository()
  ) {}

  private async resolveRequesterAccess(supabaseId: string, teamId: string) {
    const profile = await this.teamMembersRepository.findRequesterProfile(supabaseId);

    if (!profile) {
      return null;
    }

    const team = await this.teamMembersRepository.findTeam(teamId);

    if (!team) {
      return { error: new Output(false, [], ["Time não encontrado"], null) };
    }

    const membership = await this.teamMembersRepository.findMembership(teamId, profile.id);

    const isTeamMaster = team.masterId === profile.id;
    const canManage =
      isTeamMaster ||
      (membership?.role === "manager" && membership.canManageAccountTeams === true);

    if (!canManage) {
      return {
        error: new Output(
          false,
          [],
          ["Apenas o master ou um manager delegado pode adicionar membros externos"],
          null
        ),
      };
    }

    return { profile, team, isTeamMaster };
  }

  async lookupProfileByEmail(
    supabaseId: string,
    teamId: string,
    email: string
  ): Promise<Output> {
    try {
      const access = await this.resolveRequesterAccess(supabaseId, teamId);
      if (!access || "error" in access) {
        return access?.error ?? new Output(false, [], ["Perfil não encontrado"], null);
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return new Output(false, [], ["E-mail inválido"], null);
      }

      const existingProfile = await this.platformUsersRepository.findProfileByEmail(normalizedEmail);
      if (!existingProfile) {
        return new Output(true, [], [], { found: false });
      }

      return new Output(true, [], [], {
        found: true,
        profileId: existingProfile.id,
        name: getDisplayName(existingProfile),
        email: existingProfile.email,
        hasActiveAccount: Boolean(existingProfile.supabaseId),
      });
    } catch (error) {
      console.error("[CrossAccountMembersUseCase][lookupProfileByEmail]", error);
      return new Output(false, [], ["Erro ao buscar usuário por e-mail"], null);
    }
  }

  async inviteExternalMember(
    supabaseId: string,
    teamId: string,
    data: InviteExternalMemberInput
  ): Promise<Output> {
    try {
      const access = await this.resolveRequesterAccess(supabaseId, teamId);
      if (!access || "error" in access) {
        return access?.error ?? new Output(false, [], ["Perfil não encontrado"], null);
      }

      const { profile: requester, team } = access;
      const normalizedEmail = data.email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return new Output(false, [], ["E-mail inválido"], null);
      }

      const targetProfile = await this.platformUsersRepository.findProfileByEmail(normalizedEmail);
      if (!targetProfile) {
        return new Output(
          false,
          [],
          ["Usuário não encontrado. Crie o usuário em Gerenciar Usuários antes de convidar externamente."],
          null
        );
      }

      if (!targetProfile.supabaseId) {
        return new Output(false, [], ["Usuário precisa ter conta ativa no sistema"], null);
      }

      const alreadyInTeam = await this.platformUsersRepository.findTeamMember(
        teamId,
        targetProfile.id
      );
      if (alreadyInTeam) {
        return new Output(false, [], ["Usuário já pertence a este time"], null);
      }

      const belongsToMaster = await this.platformUsersRepository.profileBelongsToMasterAccount(
        targetProfile.id,
        team.masterId
      );

      const delegatedPermissions = {
        canCreateAccountUsers: data.role === "manager" && data.canCreateAccountUsers === true,
        canManageAccountTeams: data.role === "manager" && data.canManageAccountTeams === true,
        canTransferAccountLeads:
          (data.role === "manager" || data.role === "backoffice") &&
          data.canTransferAccountLeads === true,
      };

      if (belongsToMaster) {
        return teamMembersUseCase.addMember(supabaseId, teamId, targetProfile.id);
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(team.masterId);
      if (!master) {
        return new Output(false, [], ["Master da conta não encontrado"], null);
      }

      const billingOwner = master;

      if (await memberProBillingUseCase.shouldBypassIncrementalCharge(team.masterId)) {
        const created = await this.platformUsersRepository.addExistingProfileToTeam(
          targetProfile.id,
          teamId,
          data.role,
          data.functions,
          delegatedPermissions
        );

        await auditLogService.logAudit({
          entityType: "TEAM_MEMBER",
          entityId: created.teamMemberId,
          action: "CREATE",
          actorProfileId: requester.id,
          before: null,
          after: { profileId: targetProfile.id, teamId, role: data.role, functions: data.functions, ...delegatedPermissions },
          metadata: { teamId, flow: "cross_account_bypass_charge" },
        });

        await this.sendAddedNotifications({
          requester,
          team,
          targetProfileId: targetProfile.id,
          targetEmail: targetProfile.email,
          targetName: getDisplayName(targetProfile),
        });

        await memberProBillingUseCase.syncUsageToSubscription(team.masterId, "add_member");

        return new Output(true, ["Membro externo adicionado com sucesso"], [], {
          profileId: targetProfile.id,
          teamId,
        });
      }

      const projectedBilling = await incrementalBillingService.projectBilling(team.masterId, {
        additionalUsers: 1,
      });

      if (
        !billingOwner.hasPermanentSubscription &&
        projectedBilling.billingDelta > 0
      ) {
        const chargeError = backofficeIncrementalBillingCoordinator.assertChargeableMaster(billingOwner);
        if (chargeError) {
          return new Output(false, [], [chargeError], null);
        }

        const pending = await backofficeIncrementalBillingCoordinator.createAddMemberPendingAction({
          master: billingOwner,
          teamId,
          profileId: targetProfile.id,
          profileEmail: targetProfile.email,
          profileName: getDisplayName(targetProfile),
          role: data.role,
          functions: data.functions,
          ...delegatedPermissions,
          initiatedBy: "product",
        });

        return new Output(
          true,
          ["Cobrança pendente criada. O usuário será adicionado após o pagamento."],
          [],
          {
            requiresPayment: true,
            pendingActionId: pending.pendingActionId,
            checkoutUrl: pending.checkoutUrl,
            totalCharge: pending.totalCharge,
            remainingMonths: pending.remainingMonths,
          }
        );
      }

      await this.platformUsersRepository.assertUserSubscriptionCapacity(team.masterId);
      const createdMember = await this.platformUsersRepository.addExistingProfileToTeam(
        targetProfile.id,
        teamId,
        data.role,
        data.functions,
        delegatedPermissions
      );

      await auditLogService.logAudit({
        entityType: "TEAM_MEMBER",
        entityId: createdMember.teamMemberId,
        action: "CREATE",
        actorProfileId: requester.id,
        before: null,
        after: { profileId: targetProfile.id, teamId, role: data.role, functions: data.functions, ...delegatedPermissions },
        metadata: { teamId, flow: "cross_account_direct" },
      });

      await this.sendAddedNotifications({
        requester,
        team,
        targetProfileId: targetProfile.id,
        targetEmail: targetProfile.email,
        targetName: getDisplayName(targetProfile),
      });

      return new Output(true, ["Membro externo adicionado com sucesso"], [], {
        profileId: targetProfile.id,
        teamId,
      });
    } catch (error) {
      console.error("[CrossAccountMembersUseCase][inviteExternalMember]", error);
      return new Output(false, [], ["Erro ao convidar membro externo"], null);
    }
  }

  private async sendAddedNotifications(args: {
    requester: { id: string; fullName: string | null; email: string | null };
    team: { id: string; name: string };
    targetProfileId: string;
    targetEmail: string;
    targetName: string;
  }) {
    const emailService = createEmailService();
    const appUrl = getAppUrl({ removeTrailingSlash: true });

    await emailService
      .sendEmail({
        to: [args.targetEmail],
        subject: "Corretor Studio - Você foi adicionado a um novo time",
        html: buildAddedToTeamEmail({
          userName: args.targetName,
          loginUrl: `${appUrl}/sign-in`,
        }),
        tracking: {
          teamId: args.team.id,
          category: "transactional",
          sourceType: "team_member_added",
        },
      })
      .catch((err: unknown) => {
        console.error("[CrossAccountMembersUseCase] Erro ao enviar e-mail ao membro:", err);
      });

    try {
      await notificationService.createTeamMembershipNotification({
        teamId: args.team.id,
        actorProfileId: args.requester.id,
        actorName: getDisplayName(args.requester),
        teamName: args.team.name,
        recipientProfileId: args.targetProfileId,
        type: NotificationType.TEAM_MEMBER_ADDED,
      });
    } catch (notificationError) {
      console.error("[CrossAccountMembersUseCase] Erro ao criar notificação:", notificationError);
    }
  }
}

export const crossAccountMembersUseCase = new CrossAccountMembersUseCase();
