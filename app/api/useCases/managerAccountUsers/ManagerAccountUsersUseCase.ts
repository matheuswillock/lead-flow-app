import { NotificationType } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import { Output } from "@/lib/output";
import { getEmailService } from "@/lib/services/EmailService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link";
import { getFullUrl } from "@/lib/utils/app-url";
import { isManagerLikeRole } from "@/lib/roles";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { managerAccountUserRepository } from "@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository";
import type {
  CreatedAccountUserRecords,
  DelegatedAccountPermissions,
  IManagerAccountUserRepository,
} from "@/app/api/infra/data/repositories/managerAccountUser/IManagerAccountUserRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import type { IIncrementalBillingService } from "@/app/api/services/billing/IIncrementalBillingService";
import { subscriptionCreditService } from "@/app/api/services/billing/SubscriptionCreditService";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import type {
  AccountUserBillingCapacityPort,
  AccountUserNotificationPort,
  MemberProBillingPort,
} from "./IManagerAccountUsersUseCase";
import type {
  AssociateAccountUserParams,
  CreateAccountUserInput,
  CreateAccountUserParams,
  DissociateAccountUserParams,
  IManagerAccountUsersUseCase,
  ListAccountUsersParams,
  ManagerAccountUsersListResult,
  ManagerAccountUsersResult,
  RemoveAccountUserParams,
  UpdateAccountUserParams,
} from "./IManagerAccountUsersUseCase";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveDelegatedPermissions(
  role: CreateAccountUserInput["role"],
  requestedPermissions: {
    canCreateAccountUsers?: boolean;
    canManageAccountTeams?: boolean;
    canTransferAccountLeads?: boolean;
    canViewAllTeams?: boolean;
  },
  options: {
    canManageDelegation: boolean;
  }
): DelegatedAccountPermissions {
  if (!options.canManageDelegation) {
    return {
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
      canViewAllTeams: false,
    };
  }

  const isManagerLike = role === "manager" || role === "backoffice";

  return {
    canCreateAccountUsers: role === "manager" && requestedPermissions.canCreateAccountUsers === true,
    canManageAccountTeams: role === "manager" && requestedPermissions.canManageAccountTeams === true,
    canTransferAccountLeads: isManagerLike && requestedPermissions.canTransferAccountLeads === true,
    canViewAllTeams: isManagerLike && requestedPermissions.canViewAllTeams === true,
  };
}

export class ManagerAccountUsersUseCase implements IManagerAccountUsersUseCase {
  // Dependências injetadas por interface, com o singleton concreto só como
  // default — mantém os chamadores existentes intactos e torna o use case
  // substituível em teste, que era o ponto do DIP.
  constructor(
    private readonly repository: IManagerAccountUserRepository,
    private readonly profiles: IProfileRepository = profileRepository,
    private readonly billing: IIncrementalBillingService = incrementalBillingService,
    private readonly capacity: AccountUserBillingCapacityPort = subscriptionCreditService,
    private readonly notifications: AccountUserNotificationPort = notificationService,
    private readonly memberProBilling: MemberProBillingPort = memberProBillingUseCase
  ) {}

  private async getTeamName(teamId: string) {
    const team = await this.repository.findTeamNameById(teamId);
    return team?.name || "Time";
  }

  private async getProfileLabel(profileId: string) {
    const profile = await this.repository.findProfileLabelById(profileId);
    return profile?.fullName || profile?.email || "Usuário";
  }

  private async finalizeUserCreation(args: {
    teamId: string;
    masterId: string;
    requesterProfileId: string;
    actorName: string;
    teamName: string;
    userData: CreateAccountUserInput;
    delegatedPermissions: DelegatedAccountPermissions;
    profile: CreatedAccountUserRecords["profile"];
    teamMemberRecord: CreatedAccountUserRecords["teamMemberRecord"];
  }) {
    const { profile, teamMemberRecord } = args;
    const email = normalizeEmail(args.userData.email);

    // External API calls outside any transaction — no timeout risk
    try {
      const supabaseAdmin = createSupabaseAdmin();
      if (!supabaseAdmin) {
        throw new Error("Falha ao criar cliente Supabase Admin");
      }

      const redirectTo = getFullUrl("/set-password");

      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
          data: {
            name: args.userData.name,
            invited: true,
            first_access: true,
          },
        },
      });

      if (linkError || !data?.properties?.action_link) {
        throw new Error("Erro ao gerar link de convite");
      }

      const supabaseUserId = data.user?.id;
      const inviteLink = buildSetPasswordEmailAuthLink(data, "invite");

      if (supabaseUserId) {
        await this.repository.updateProfileSupabaseId(profile.id, supabaseUserId);
      }

      const requesterProfile = await this.repository.findProfileLabelById(args.requesterProfileId);

      const emailService = getEmailService();
      await emailService.sendOperatorInviteEmail({
        operatorName: args.userData.name,
        operatorEmail: email,
        operatorRole: args.userData.role,
        managerName: requesterProfile?.fullName || requesterProfile?.email || "Manager",
        inviteUrl: inviteLink,
      });

      try {
        await this.notifications.createTeamMembershipNotification({
          teamId: args.teamId,
          actorProfileId: args.requesterProfileId,
          actorName: args.actorName,
          teamName: args.teamName,
          recipientProfileId: profile.id,
          type: NotificationType.TEAM_MEMBER_ADDED,
        });
      } catch (notificationError) {
        console.error(
          "[ManagerUsersRoute][finalizeUserCreation] Erro ao criar notificação de membro adicionado:",
          notificationError
        );
      }
    } catch (inviteError) {
      console.error("[ManagerUsersRoute][finalizeUserCreation] Invite falhou:", {
        email,
        teamId: args.teamId,
        error: inviteError instanceof Error
          ? { message: inviteError.message, stack: inviteError.stack, name: inviteError.name }
          : inviteError,
      });
      await this.repository.deleteTeamMember(args.teamId, profile.id);
      await this.repository.deleteProfile(profile.id);
      throw new Error("Erro ao enviar convite. Tente novamente.");
    }

    return {
      id: profile.id,
      name: profile.fullName || args.userData.name,
      email: profile.email,
      role: teamMemberRecord.role.toLowerCase(),
      functions: teamMemberRecord.functions,
      profileIconId: profile.profileIconId,
      profileIconUrl: profile.profileIconUrl,
      managerId: args.masterId,
      canCreateAccountUsers: args.delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: args.delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: args.delegatedPermissions.canTransferAccountLeads,
      canViewAllTeams: args.delegatedPermissions.canViewAllTeams,
      createdAt: teamMemberRecord.createdAt,
      updatedAt: teamMemberRecord.updatedAt,
    };
  }

  private async getPendingPaymentStatus(paymentId?: string | null) {
    if (!paymentId) {
      return null;
    }

    try {
      const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
        method: "GET",
      });
      return {
        paymentId,
        paymentStatus: payment?.status || "PENDING",
        paymentMethod: payment?.billingType || "UNDEFINED",
      };
    } catch (error) {
      rethrowIfPrerenderInterrupted(error);
      console.error("[ManagerUsersRoute] Erro ao consultar pagamento pendente:", error);
      return {
        paymentId,
        paymentStatus: "PENDING",
        paymentMethod: "UNDEFINED",
      };
    }
  }

  async createAccountUser(params: CreateAccountUserParams): Promise<ManagerAccountUsersResult> {
    const { teamId, profileId, managerId, isMaster } = params.ctx;
    const validatedData = params.userData;

    const [actorName, teamName, requesterProfile] = await Promise.all([
      this.getProfileLabel(profileId),
      this.getTeamName(teamId),
      this.repository.findProfileEmailById(profileId),
    ]);

    const email = normalizeEmail(validatedData.email);
    const canManageDelegation = isMaster;
    const delegatedPermissions = resolveDelegatedPermissions(validatedData.role, validatedData, {
      canManageDelegation,
    });

    if (
      !isMaster &&
      (validatedData.canCreateAccountUsers || validatedData.canManageAccountTeams || validatedData.canTransferAccountLeads || validatedData.canViewAllTeams)
    ) {
      return {
        output: new Output(
          false,
          [],
          ["Apenas o master pode delegar permissões adicionais para managers"],
          null
        ),
        status: 403,
      };
    }

    const [existingProfile, existingPendingOperator, existingPendingAction, billingOwner] = await Promise.all([
      this.repository.findProfileIdByEmail(email),
      this.repository.findOpenPendingOperatorIdByEmail(email),
      this.repository.findOpenAddUserActionIdByEmail(email),
      this.repository.findBillingOwnerProfile(managerId),
    ]);

    if (existingProfile || existingPendingOperator || existingPendingAction) {
      return {
        output: new Output(false, [], ["Email já está em uso"], null),
        status: 409,
      };
    }

    if (!billingOwner) {
      return {
        output: new Output(false, [], ["Conta master responsável pela cobrança não foi encontrada"], null),
        status: 404,
      };
    }

    const recordsParams = {
      teamId,
      masterId: managerId,
      fullName: validatedData.name,
      email,
      role: validatedData.role as UserRole,
      functions: validatedData.functions ?? [],
      hasPermanentSubscription: validatedData.hasPermanentSubscription ?? false,
      delegatedPermissions,
    };

    if (billingOwner.hasPermanentSubscription) {
      const { profile, teamMemberRecord } = await this.repository.createAccountUserRecords(recordsParams);
      const createdUser = await this.finalizeUserCreation({
        teamId,
        masterId: managerId,
        requesterProfileId: profileId,
        actorName,
        teamName,
        userData: validatedData,
        delegatedPermissions,
        profile,
        teamMemberRecord,
      });

      return {
        output: new Output(true, ["Usuário criado com sucesso"], [], createdUser),
        status: 200,
      };
    }

    if (await this.memberProBilling.shouldBypassIncrementalCharge(managerId)) {
      const { profile, teamMemberRecord } = await this.repository.createAccountUserRecords(recordsParams);
      const createdUser = await this.finalizeUserCreation({
        teamId,
        masterId: managerId,
        requesterProfileId: profileId,
        actorName,
        teamName,
        userData: validatedData,
        delegatedPermissions,
        profile,
        teamMemberRecord,
      });

      await this.memberProBilling.syncUsageToSubscription(managerId, "add_user");

      return {
        output: new Output(true, ["Usuário criado com sucesso"], [], createdUser),
        status: 200,
      };
    }

    const projectedBilling = await this.billing.projectBilling(managerId, {
      additionalUsers: 1,
    });

    if (projectedBilling.billingDelta <= 0) {
      // Transaction contains only fast DB ops — no external API calls
      const { profile, teamMemberRecord } = await this.repository.runInTransaction(async (tx) => {
        await this.capacity.assertCapacityAvailable(tx, managerId, { users: 1 });
        return this.repository.createAccountUserRecords(recordsParams, tx);
      });

      // External calls run after tx commits — no timeout risk, no FK violation
      const createdUser = await this.finalizeUserCreation({
        teamId,
        masterId: managerId,
        requesterProfileId: profileId,
        actorName,
        teamName,
        userData: validatedData,
        delegatedPermissions,
        profile,
        teamMemberRecord,
      });

      return {
        output: new Output(true, ["Usuário criado com sucesso"], [], createdUser),
        status: 200,
      };
    }

    const payload = {
      name: validatedData.name,
      email,
      role: validatedData.role,
      functions: validatedData.functions ?? [],
      teamId,
      requestedByProfileId: profileId,
      requestedByName: actorName,
      requestedByEmail: requesterProfile?.email || "",
      canCreateAccountUsers: delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: delegatedPermissions.canTransferAccountLeads,
      canViewAllTeams: delegatedPermissions.canViewAllTeams,
      billingType: validatedData.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
      billingDelta: projectedBilling.billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
    };

    const pendingAction = await this.repository.createPendingAddUserAction({
      masterId: managerId,
      teamId,
      payload,
    });

    const proportionalData = await this.billing.calculateProportionalAmount(managerId, "user");
    const totalCharge = proportionalData.totalCharge ?? projectedBilling.billingDelta;

    await this.repository.updatePendingActionPayload(pendingAction.id, {
      ...payload,
      billingDelta: proportionalData.billingDelta,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      maxInstallments: proportionalData.maxInstallments,
      monthlyPrice: proportionalData.billingDelta,
    });

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`);

    const emailService = getEmailService();
    await emailService.sendAddOnPendingPaymentEmail({
      masterName: billingOwner.fullName || billingOwner.email,
      masterEmail: billingOwner.email,
      addonType: "user",
      addonLabel: "Licença Usuário",
      addonDetail: `${validatedData.name} (${email})`,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: actorName,
      requesterEmail: requesterProfile?.email || "",
    });

    return {
      output: new Output(true, ["Cobrança pendente criada. Um link de pagamento foi enviado."], [], {
        pendingActionId: pendingAction.id,
        checkoutUrl,
        billingType: payload.billingType,
        totalCharge,
        remainingMonths: proportionalData.remainingMonths,
      }),
      status: 202,
    };
  }

  async checkEmailAvailability(email: string): Promise<ManagerAccountUsersResult> {
    const normalizedEmail = normalizeEmail(email);

    const existingProfile = await this.repository.findProfileIdByEmail(normalizedEmail);
    const existingPending = await this.repository.findOpenPendingOperatorIdByEmail(normalizedEmail);
    const existingPendingAction = await this.repository.findOpenAddUserActionIdByEmail(normalizedEmail);

    if (existingProfile || existingPending || existingPendingAction) {
      return {
        output: new Output(false, [], ["Email já está em uso"], { available: false }),
        status: 409,
      };
    }

    return {
      output: new Output(true, [], [], { available: true }),
      status: 200,
    };
  }

  async listAccountUsers(params: ListAccountUsersParams): Promise<ManagerAccountUsersListResult> {
    const { teamId, profileId, managerId, isMaster } = params.ctx;

    const teamMembers = await this.repository.findAccountUsersByTeam(teamId);

    const totalManagers = teamMembers.filter((member) => isManagerLikeRole(member.role)).length;
    const totalOperators = teamMembers.filter((member) => member.role === "operator").length;

    const activeUsers = teamMembers
      .filter((member) => (isMaster ? true : member.profileId !== profileId))
      .map((member) => ({
        id: member.profile.id,
        name: member.profile.fullName || "Usuário",
        email: member.profile.email,
        role: member.role.toLowerCase(),
        functions: member.functions,
        profileIconId: member.profile.profileIconId,
        profileIconUrl: member.profile.profileIconUrl,
        managerId,
        canCreateAccountUsers: member.canCreateAccountUsers,
        canManageAccountTeams: member.canManageAccountTeams,
        canTransferAccountLeads: member.canTransferAccountLeads,
        canViewAllTeams: member.canViewAllTeams,
        leadsCount: member.profile._count?.leadsAsAssignee ?? 0,
        meetingsCount: member.profile._count?.leadsAsCloser ?? 0,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        hasPermanentSubscription: member.profile.hasPermanentSubscription,
        googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
      }));

    const pendingAsUsers: any[] = [];
    if (params.canListPendingUsers) {
      const [pendingOperators, pendingActions] = await Promise.all([
        this.repository.findOpenPendingOperatorsByTeam(teamId),
        this.repository.findOpenAddUserActionsByTeam(teamId),
      ]);

      pendingAsUsers.push(
        ...pendingOperators.map((pending) => ({
          id: pending.id,
          name: pending.name,
          email: pending.email,
          role: String(pending.role).toLowerCase(),
          profileIconId: null,
          profileIconUrl: null,
          managerId,
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
          leadsCount: 0,
          meetingsCount: 0,
          createdAt: pending.createdAt,
          updatedAt: pending.updatedAt,
          isPending: true,
          googleCalendarConnected: false,
          pendingPayment: {
            id: pending.id,
            paymentId: pending.paymentId,
            paymentStatus: pending.paymentStatus,
            paymentMethod: pending.paymentMethod,
            operatorCreated: pending.operatorCreated,
            pendingActionId: null,
            checkoutUrl: null,
          },
        }))
      );

      const pendingActionsWithPayments = await Promise.all(
        pendingActions.map(async (action) => {
          const payload = (action.payload as any) || {};
          const payment =
            action.status === "failed"
              ? {
                  paymentId: action.paymentId || payload.paymentId || "",
                  paymentStatus: "FAILED",
                  paymentMethod: payload.billingType || "UNDEFINED",
                }
              : await this.getPendingPaymentStatus(action.paymentId || payload.paymentId || null);

          return {
            id: action.id,
            name: payload.name || "Usuário pendente",
            email: payload.email || "",
            role: String(payload.role || "operator").toLowerCase(),
            profileIconId: null,
            profileIconUrl: null,
            managerId,
            canCreateAccountUsers: payload.canCreateAccountUsers === true,
            canManageAccountTeams: payload.canManageAccountTeams === true,
            canTransferAccountLeads: payload.canTransferAccountLeads === true,
            canViewAllTeams: payload.canViewAllTeams === true,
            leadsCount: 0,
            meetingsCount: 0,
            createdAt: action.createdAt,
            updatedAt: action.updatedAt,
            isPending: true,
            googleCalendarConnected: false,
            pendingPayment: {
              id: action.id,
              paymentId: payment?.paymentId || action.paymentId || "",
              paymentStatus: payment?.paymentStatus || "PENDING",
              paymentMethod: payment?.paymentMethod || payload.billingType || "UNDEFINED",
              operatorCreated: false,
              pendingActionId: action.id,
              checkoutUrl: getFullUrl(`/addon-checkout/${action.id}`),
            },
          };
        })
      );

      pendingAsUsers.push(...pendingActionsWithPayments);
    }

    return {
      output: new Output(true, [], [], [...activeUsers, ...pendingAsUsers]),
      stats: {
        totalOperators,
        totalManagers,
        totalUsers: totalManagers + totalOperators,
      },
      status: 200,
    };
  }

  async associateTeamMember(
    params: AssociateAccountUserParams
  ): Promise<ManagerAccountUsersResult> {
    const { teamId, profileId, isMaster } = params.ctx;
    const validatedData = params.userData;

    const [actorName, teamName] = await Promise.all([
      this.getProfileLabel(profileId),
      this.getTeamName(teamId),
    ]);

    if (!isMaster) {
      return {
        output: new Output(false, [], ["Apenas o master do time pode adicionar usuários"], null),
        status: 403,
      };
    }

    const existingMember = await this.repository.findTeamMember(teamId, validatedData.profileId);

    if (existingMember) {
      return {
        output: new Output(false, [], ["Usuário já pertence a este time"], null),
        status: 409,
      };
    }

    const newMember = await this.repository.createTeamMember({
      teamId,
      profileId: validatedData.profileId,
      role: (validatedData.role ?? "operator") as UserRole,
      functions: validatedData.functions ?? [],
    });

    try {
      await this.notifications.createTeamMembershipNotification({
        teamId,
        actorProfileId: profileId,
        actorName,
        teamName,
        recipientProfileId: validatedData.profileId,
        type: NotificationType.TEAM_MEMBER_ADDED,
      });
    } catch (notificationError) {
      console.error("[ManagerUsersRoute][PUT] Erro ao criar notificação de membro adicionado:", notificationError);
    }

    return {
      output: new Output(true, ["Usuário adicionado ao time com sucesso"], [], newMember),
      status: 200,
    };
  }

  async dissociateTeamMember(
    params: DissociateAccountUserParams
  ): Promise<ManagerAccountUsersResult> {
    const { teamId, profileId, managerId, isMaster } = params.ctx;
    const validatedData = params.userData;

    const [actorName, teamName] = await Promise.all([
      this.getProfileLabel(profileId),
      this.getTeamName(teamId),
    ]);

    if (!isMaster) {
      return {
        output: new Output(false, [], ["Apenas o master do time pode remover usuários"], null),
        status: 403,
      };
    }

    if (validatedData.profileId === managerId) {
      return {
        output: new Output(false, [], ["Não é possível remover o master do time"], null),
        status: 400,
      };
    }

    try {
      await this.notifications.createTeamMembershipNotification({
        teamId,
        actorProfileId: profileId,
        actorName,
        teamName,
        recipientProfileId: validatedData.profileId,
        type: NotificationType.TEAM_MEMBER_REMOVED,
      });
    } catch (notificationError) {
      console.error("[ManagerUsersRoute][PUT] Erro ao criar notificação de membro removido:", notificationError);
    }

    await this.repository.deleteTeamMember(teamId, validatedData.profileId);

    return {
      output: new Output(true, ["Usuário removido do time com sucesso"], [], null),
      status: 200,
    };
  }

  async updateAccountUser(params: UpdateAccountUserParams): Promise<ManagerAccountUsersResult> {
    const { teamId, profileId, managerId, isMaster } = params.ctx;
    const validatedData = params.userData;

    // O handler PUT original resolvia ator e time antes de ramificar por
    // `action`, então o caminho de update também pagava estas duas leituras.
    // Mantido para preservar a sequência de acesso ao banco da rota legada.
    await Promise.all([this.getProfileLabel(profileId), this.getTeamName(teamId)]);

    const targetMember = await this.repository.findTeamMember(teamId, validatedData.id);

    if (!targetMember) {
      return {
        output: new Output(false, [], ["Usuário não encontrado no time"], null),
        status: 404,
      };
    }

    if (!isMaster && validatedData.id === managerId) {
      return {
        output: new Output(false, [], ["Você não pode editar o master do time"], null),
        status: 403,
      };
    }

    if (
      !isMaster &&
      (
        validatedData.canCreateAccountUsers !== undefined ||
        validatedData.canManageAccountTeams !== undefined ||
        validatedData.canTransferAccountLeads !== undefined ||
        validatedData.canViewAllTeams !== undefined
      )
    ) {
      return {
        output: new Output(
          false,
          [],
          ["Apenas o master pode alterar permissões delegadas de managers"],
          null
        ),
        status: 403,
      };
    }

    if (
      validatedData.id === profileId &&
      (
        validatedData.canCreateAccountUsers !== undefined ||
        validatedData.canManageAccountTeams !== undefined ||
        validatedData.canTransferAccountLeads !== undefined ||
        validatedData.canViewAllTeams !== undefined
      )
    ) {
      return {
        output: new Output(
          false,
          [],
          ["Você não pode alterar as próprias permissões delegadas"],
          null
        ),
        status: 403,
      };
    }

    if (
      validatedData.name ||
      validatedData.email
    ) {
      await this.profiles.updateProfileById(validatedData.id, {
        ...(validatedData.name ? { fullName: validatedData.name } : {}),
        ...(validatedData.email ? { email: normalizeEmail(validatedData.email) } : {}),
      });
    }

    if (
      validatedData.role ||
      validatedData.functions ||
      validatedData.canCreateAccountUsers !== undefined ||
      validatedData.canManageAccountTeams !== undefined ||
      validatedData.canTransferAccountLeads !== undefined ||
      validatedData.canViewAllTeams !== undefined
    ) {
      const hasDelegationFieldUpdate =
        validatedData.canCreateAccountUsers !== undefined ||
        validatedData.canManageAccountTeams !== undefined ||
        validatedData.canTransferAccountLeads !== undefined ||
        validatedData.canViewAllTeams !== undefined;

      if (validatedData.role || validatedData.functions) {
        await this.repository.updateTeamMembersByMaster({
          profileId: validatedData.id,
          masterId: managerId,
          data: {
            ...(validatedData.role ? { role: validatedData.role as UserRole } : {}),
            ...(validatedData.functions ? { functions: validatedData.functions } : {}),
          },
        });
      }

      if (isMaster && (validatedData.role !== undefined || hasDelegationFieldUpdate)) {
        const effectiveRole = (validatedData.role ?? targetMember.role) as UserRole;
        const delegationData: {
          canCreateAccountUsers?: boolean;
          canManageAccountTeams?: boolean;
          canTransferAccountLeads?: boolean;
          canViewAllTeams?: boolean;
        } = {};

        const assignDelegation = (
          field: "canCreateAccountUsers" | "canManageAccountTeams" | "canTransferAccountLeads" | "canViewAllTeams",
          requestedValue: boolean | undefined,
          allowed: boolean,
          currentValue: boolean
        ) => {
          if (requestedValue !== undefined) {
            delegationData[field] = allowed && requestedValue === true;
            return;
          }
          if (validatedData.role !== undefined) {
            delegationData[field] = allowed ? currentValue : false;
          }
        };

        assignDelegation(
          "canCreateAccountUsers",
          validatedData.canCreateAccountUsers,
          effectiveRole === "manager",
          targetMember.canCreateAccountUsers
        );
        assignDelegation(
          "canManageAccountTeams",
          validatedData.canManageAccountTeams,
          effectiveRole === "manager",
          targetMember.canManageAccountTeams
        );
        assignDelegation(
          "canTransferAccountLeads",
          validatedData.canTransferAccountLeads,
          effectiveRole === "manager" || effectiveRole === "backoffice",
          targetMember.canTransferAccountLeads
        );
        assignDelegation(
          "canViewAllTeams",
          validatedData.canViewAllTeams,
          effectiveRole === "manager" || effectiveRole === "backoffice",
          targetMember.canViewAllTeams
        );

        if (Object.keys(delegationData).length > 0) {
          await this.repository.updateTeamMembersByMaster({
            profileId: validatedData.id,
            masterId: managerId,
            data: delegationData,
          });
        }
      }
    }

    const updatedMember = await this.repository.findTeamMemberWithProfile(teamId, validatedData.id);

    return {
      output: new Output(true, ["Usuário atualizado com sucesso"], [], {
        id: validatedData.id,
        name: updatedMember?.profile.fullName || validatedData.name,
        email: updatedMember?.profile.email,
        role: updatedMember?.role ? updatedMember.role.toLowerCase() : validatedData.role,
        functions: updatedMember?.functions ?? validatedData.functions,
        profileIconId: updatedMember?.profile.profileIconId,
        profileIconUrl: updatedMember?.profile.profileIconUrl,
        managerId,
        canCreateAccountUsers: updatedMember?.canCreateAccountUsers ?? false,
        canManageAccountTeams: updatedMember?.canManageAccountTeams ?? false,
        canTransferAccountLeads: updatedMember?.canTransferAccountLeads ?? false,
        canViewAllTeams: updatedMember?.canViewAllTeams ?? false,
      }),
      status: 200,
    };
  }

  async removeAccountUser(params: RemoveAccountUserParams): Promise<ManagerAccountUsersResult> {
    const { teamId, profileId, managerId } = params.ctx;
    const { userId } = params;

    const [actorName, teamName] = await Promise.all([
      this.getProfileLabel(profileId),
      this.getTeamName(teamId),
    ]);

    if (!userId) {
      return {
        output: new Output(false, [], ["Parâmetro userId é obrigatório"], null),
        status: 400,
      };
    }

    if (userId === managerId) {
      return {
        output: new Output(false, [], ["Você não pode remover o master do time"], null),
        status: 400,
      };
    }

    const targetMember = await this.repository.findTeamMember(teamId, userId);

    if (!targetMember) {
      return {
        output: new Output(false, [], ["Usuário não encontrado no time"], null),
        status: 404,
      };
    }

    try {
      await this.notifications.createTeamMembershipNotification({
        teamId,
        actorProfileId: profileId,
        actorName,
        teamName,
        recipientProfileId: userId,
        type: NotificationType.TEAM_MEMBER_REMOVED,
      });
    } catch (notificationError) {
      console.error("[ManagerUsersRoute][DELETE] Erro ao criar notificação de membro removido:", notificationError);
    }

    await this.repository.deleteTeamMember(teamId, userId);

    await this.memberProBilling.syncBillingAfterUsageChange(managerId, "remove_user");

    return {
      output: new Output(true, ["Usuário removido do time com sucesso"], [], null),
      status: 200,
    };
  }
}

export const managerAccountUsersUseCase: IManagerAccountUsersUseCase =
  new ManagerAccountUsersUseCase(managerAccountUserRepository);
