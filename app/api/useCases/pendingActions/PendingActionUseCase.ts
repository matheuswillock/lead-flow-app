import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository";
import type { ApplicablePendingAction } from "@/app/api/infra/data/repositories/pendingAction/IPendingActionRepository";
import { Output } from "@/lib/output";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getFullUrl } from "@/lib/utils/app-url";
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link";
import { getEmailService } from "@/lib/services/EmailService";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { subscriptionCreditService } from "@/app/api/services/billing/SubscriptionCreditService";
import type { BillingOwnerProfile } from "@/app/api/services/billing/IIncrementalBillingService";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import type { Prisma, UserFunction, UserRole } from "@prisma/client";
import { buildAddedToTeamEmail } from "@/lib/emails/buildAddedToTeamEmail";
import { getAppUrl } from "@/lib/utils/app-url";

type ApplyPendingActionOptions = {
  skipSubscriptionSync?: boolean;
  paymentStatus?: string;
  waivedReason?: string;
};

type ResolvedPendingAction = ApplicablePendingAction;
type PendingActionPayload = Record<string, any>;
type CreatedPendingUser = {
  profileId: string;
  email: string;
  name: string;
  role: string;
};
type AppliedPendingActionResult = {
  teamId: string;
  createdUser?: CreatedPendingUser;
};

const toBillingOwnerProfile = (action: ResolvedPendingAction): BillingOwnerProfile => ({
  id: action.master.id,
  fullName: action.master.fullName,
  email: action.master.email,
  cpfCnpj: action.master.cpfCnpj,
  phone: action.master.phone,
  postalCode: action.master.postalCode,
  address: action.master.address,
  addressNumber: action.master.addressNumber,
  neighborhood: action.master.neighborhood,
  complement: action.master.complement,
  asaasCustomerId: action.master.asaasCustomerId,
  asaasSubscriptionId: action.master.asaasSubscriptionId,
  subscriptionStatus: action.master.subscriptionStatus,
  subscriptionNextDueDate: action.master.subscriptionNextDueDate,
  subscriptionCycle: action.master.subscriptionCycle,
  hasPermanentSubscription: action.master.hasPermanentSubscription,
  hasUnlimitedUsers: action.master.hasUnlimitedUsers,
  timezone: action.master.timezone,
});

export class PendingActionUseCase {
  async applyPendingActionByCheckout(checkoutId: string, paymentId?: string): Promise<Output> {
    const action = await pendingActionRepository.findApplicableByCheckoutId(checkoutId);
    if (!action) {
      return new Output(false, [], ["Ação pendente não encontrada"], null);
    }

    return this.applyResolvedPendingAction(action, paymentId);
  }

  async applyPendingActionByPaymentId(paymentId: string): Promise<Output> {
    let action = await pendingActionRepository.findApplicableByPaymentId(paymentId);

    if (!action) {
      try {
        const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "GET" });
        const externalReference = payment?.externalReference as string | undefined;

        if (externalReference?.startsWith("pending-action-")) {
          const actionId = externalReference.replace("pending-action-", "");
          action = await pendingActionRepository.findApplicableById(actionId);

          if (action && !action.paymentId) {
            await pendingActionRepository.updatePaymentId(action.id, paymentId);
            action = { ...action, paymentId };
          }
        }
      } catch (error) {
        console.warn("[PendingActionUseCase] Erro ao buscar payment no Asaas:", error);
      }
    }

    if (!action) {
      return new Output(false, [], ["Ação pendente não encontrada"], null);
    }

    return this.applyResolvedPendingAction(action, paymentId);
  }


  /**
   * Aplica PendingAction add_user sem cobrança incremental.
   * Cancela cobrança Asaas aberta (se houver), nunca sincroniza targetRecurringTotal do payload
   * e, para Member PRO ativo, sincroniza uso via syncUsageToSubscription.
   */
  async forceApplyPendingActionWithoutCharge(
    pendingActionId: string,
    options: { reason: string }
  ): Promise<Output> {
    const action = await pendingActionRepository.findApplicableById(pendingActionId);
    if (!action) {
      return new Output(false, [], ["Ação pendente não encontrada"], null);
    }

    if (action.status === "applied") {
      return new Output(true, ["Ação já aplicada"], [], action);
    }

    if (action.status !== "pending") {
      return new Output(false, [], [`Ação não está pendente (status=${action.status})`], null);
    }

    if (action.actionType !== "add_user") {
      return new Output(
        false,
        [],
        [`Tipo de ação não suportado no backfill sem cobrança: ${action.actionType}`],
        null
      );
    }

    const bypass = await memberProBillingUseCase.shouldBypassIncrementalCharge(action.masterId);
    if (!bypass) {
      return new Output(
        false,
        [],
        ["Master não elegível a bypass de cobrança (sem usuários ilimitados / Member PRO ativo)"],
        null
      );
    }

    if (action.paymentId) {
      try {
        const payment = await asaasFetch(`${asaasApi.payments}/${action.paymentId}`, {
          method: "GET",
        });
        const paymentStatus = String(payment?.status ?? "PENDING");
        const paidStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
        if (paidStatuses.has(paymentStatus)) {
          return new Output(
            false,
            [],
            [
              `Cobrança Asaas ${action.paymentId} já está paga (${paymentStatus}); não é possível dispensar`,
            ],
            null
          );
        }

        const cancelableStatuses = new Set(["PENDING", "AWAITING_RISK_ANALYSIS", "OVERDUE"]);
        if (cancelableStatuses.has(paymentStatus)) {
          await asaasFetch(`${asaasApi.payments}/${action.paymentId}`, { method: "DELETE" });
          console.info(
            `[PendingActionUseCase][forceApplyPendingActionWithoutCharge] Cobrança Asaas cancelada paymentId=${action.paymentId} status=${paymentStatus}`
          );
        }
      } catch (error) {
        console.error(
          `[PendingActionUseCase][forceApplyPendingActionWithoutCharge] Falha ao cancelar cobrança Asaas ${action.paymentId}:`,
          error
        );
        return new Output(
          false,
          [],
          ["Não foi possível cancelar a cobrança Asaas aberta antes de dispensar"],
          null
        );
      }

      await pendingActionRepository.clearPaymentId(action.id);
      action.paymentId = null;
    }

    console.info(
      `[PendingActionUseCase][forceApplyPendingActionWithoutCharge] Aplicando ${pendingActionId} reason=${options.reason}`
    );

    // Nunca aplica targetRecurringTotal do payload (evita subir mensalidade no waive).
    const result = await this.applyResolvedPendingAction(action, undefined, {
      skipSubscriptionSync: true,
      paymentStatus: "WAIVED",
      waivedReason: options.reason,
    });

    if (result.isValid) {
      const memberProContext = await memberProBillingUseCase.getMemberProContext(action.masterId);
      if (memberProContext.isActive) {
        await memberProBillingUseCase.syncUsageToSubscription(action.masterId, "add_user");
      }
    }

    return result;
  }

  private async applyResolvedPendingAction(
    action: ResolvedPendingAction,
    paymentId?: string,
    options?: ApplyPendingActionOptions
  ): Promise<Output> {
    if (action.status === "applied") {
      return new Output(true, ["Ação já aplicada"], [], action);
    }

    if (action.status === "canceled") {
      return new Output(false, [], ["Ação cancelada"], null);
    }

    const paymentStatus = options?.paymentStatus ?? "CONFIRMED";

    try {
      const appliedResult = await pendingActionRepository.runInTransaction(async (tx) => {
        if (action.actionType === "create_team") {
          return this.applyCreateTeam(tx, action, paymentId);
        }

        if (action.actionType === "add_member") {
          return this.applyAddMember(tx, action, paymentId);
        }

        if (action.actionType === "add_user") {
          return this.applyAddUser(tx, action, paymentId, {
            paymentStatus,
            waivedReason: options?.waivedReason,
          });
        }

        if (action.actionType === "transfer_team") {
          return this.applyTransferTeam(tx, action, paymentId);
        }

        if (action.actionType === "update_subscription_credits") {
          return this.applyUpdateSubscriptionCredits(tx, action, paymentId);
        }

        throw new Error(`Tipo de ação não suportado: ${action.actionType}`);
      });

      if (appliedResult.createdUser) {
        await this.sendInviteForCreatedUser(action, appliedResult.createdUser);
      }

      if (action.actionType === "add_member") {
        await this.sendAddedToTeamEmailForMember(action);
      }

      const targetRecurringTotal = Number((action.payload as PendingActionPayload)?.targetRecurringTotal ?? 0);
      if (
        !options?.skipSubscriptionSync &&
        !Number.isNaN(targetRecurringTotal) &&
        targetRecurringTotal > 0
      ) {
        try {
          await incrementalBillingService.syncRecurringSubscription({
            master: toBillingOwnerProfile(action),
            targetRecurringTotal,
            reason: `Atualização recorrente após ${action.actionType}`,
          });

          await pendingActionRepository.updatePayload(action.id, {
            ...(action.payload as PendingActionPayload),
            paymentStatus,
            subscriptionSyncStatus: "updated",
            subscriptionUpdatedAt: new Date().toISOString(),
          });
        } catch (subscriptionError) {
          console.error("[PendingActionUseCase] Falha ao sincronizar assinatura recorrente:", subscriptionError);
          await pendingActionRepository.updatePayload(action.id, {
            ...(action.payload as PendingActionPayload),
            paymentStatus,
            subscriptionSyncStatus: "failed",
          });
        }
      }

      return new Output(true, ["Ação pendente aplicada com sucesso"], [], appliedResult);
    } catch (error: any) {
      console.error("Erro ao aplicar ação pendente:", error);

      await pendingActionRepository.markFailed({
        id: action.id,
        paymentId: paymentId ?? action.paymentId,
        payload: {
          ...(action.payload as PendingActionPayload),
          paymentStatus: "FAILED",
        },
      });

      return new Output(false, [], [error?.message || "Erro ao aplicar ação pendente"], null);
    }
  }

  private async applyCreateTeam(
    tx: Prisma.TransactionClient,
    action: ResolvedPendingAction,
    paymentId?: string
  ): Promise<AppliedPendingActionResult> {
    const payload = (action.payload as PendingActionPayload) || {};
    const teamName = (payload.teamName as string | undefined) ?? (payload.name as string | undefined);

    if (!teamName) {
      throw new Error("Nome do time não informado na ação pendente");
    }

    const team = await pendingActionRepository.createTeam(tx, {
      name: teamName,
      masterId: action.masterId,
      isDefault: false,
    });

    await pendingActionRepository.upsertTeamManagerMembership(tx, {
      teamId: team.id,
      profileId: action.masterId,
      functions: action.master.functions ?? [],
    });

    const requesterProfileId = payload.requestedByProfileId as string | undefined;
    const requesterFunctions = (payload.requestedByFunctions as UserFunction[] | undefined) ?? [];
    if (requesterProfileId && requesterProfileId !== action.masterId) {
      await pendingActionRepository.upsertTeamManagerMembership(tx, {
        teamId: team.id,
        profileId: requesterProfileId,
        functions: requesterFunctions,
      });
    }

    await pendingActionRepository.markApplied(tx, {
      id: action.id,
      paymentId: paymentId ?? action.paymentId,
      teamId: team.id,
      payload: {
        ...payload,
        paymentStatus: "CONFIRMED",
      },
    });

    return { teamId: team.id };
  }

  private async applyAddMember(
    tx: Prisma.TransactionClient,
    action: ResolvedPendingAction,
    paymentId?: string
  ): Promise<AppliedPendingActionResult> {
    const payload = (action.payload as PendingActionPayload) || {};
    const teamId = action.teamId || payload.teamId;
    const profileId = payload.profileId as string | undefined;

    if (!teamId || !profileId) {
      throw new Error("Dados insuficientes para adicionar membro");
    }

    const alreadyMember = await pendingActionRepository.hasTeamMembership(tx, {
      teamId,
      profileId,
    });

    if (!alreadyMember) {
      const role = (payload.role || "operator") as UserRole;
      await pendingActionRepository.createTeamMember(tx, {
        teamId,
        profileId,
        role,
        functions: (payload.functions as UserFunction[] | undefined) ?? [],
        canCreateAccountUsers: role === "manager" && payload.canCreateAccountUsers === true,
        canManageAccountTeams: role === "manager" && payload.canManageAccountTeams === true,
        canTransferAccountLeads:
          (role === "manager" || role === "backoffice") &&
          payload.canTransferAccountLeads === true,
      });
    }

    await pendingActionRepository.markApplied(tx, {
      id: action.id,
      paymentId: paymentId ?? action.paymentId,
      teamId,
      payload: {
        ...payload,
        paymentStatus: "CONFIRMED",
      },
    });

    return { teamId };
  }

  private async applyAddUser(
    tx: Prisma.TransactionClient,
    action: ResolvedPendingAction,
    paymentId?: string,
    applyOptions?: { paymentStatus?: string; waivedReason?: string }
  ): Promise<AppliedPendingActionResult> {
    const payload = (action.payload as PendingActionPayload) || {};
    const teamId = action.teamId || payload.teamId;
    const email = (payload.email as string | undefined)?.trim().toLowerCase();
    const name = payload.name as string | undefined;
    const role = (payload.role || "operator") as UserRole;
    const functions = (payload.functions as UserFunction[] | undefined) ?? [];
    const paymentStatus = applyOptions?.paymentStatus ?? "CONFIRMED";

    if (!teamId || !email || !name) {
      throw new Error("Dados insuficientes para criar usuário");
    }

    const delegatedPermissions =
      {
        canCreateAccountUsers: role === "manager" && payload.canCreateAccountUsers === true,
        canManageAccountTeams: role === "manager" && payload.canManageAccountTeams === true,
        canTransferAccountLeads:
          (role === "manager" || role === "backoffice") &&
          payload.canTransferAccountLeads === true,
        canViewAllTeams:
          (role === "manager" || role === "backoffice") &&
          payload.canViewAllTeams === true,
      };

    let profile = await pendingActionRepository.findProfileIdByEmail(tx, email);

    if (!profile) {
      profile = await pendingActionRepository.createManagedProfile(tx, {
        fullName: name,
        email,
        role,
        functions,
        managerId: action.masterId,
      });
    } else {
      await pendingActionRepository.assignProfileManager(tx, {
        profileId: profile.id,
        fullName: name,
        managerId: action.masterId,
      });
    }

    const alreadyMember = await pendingActionRepository.hasTeamMembership(tx, {
      teamId,
      profileId: profile.id,
    });

    const teamMemberAccess = {
      teamId,
      profileId: profile.id,
      role,
      functions,
      canCreateAccountUsers: delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: delegatedPermissions.canTransferAccountLeads,
      canViewAllTeams: delegatedPermissions.canViewAllTeams,
    };

    if (!alreadyMember) {
      await pendingActionRepository.createTeamMemberAccess(tx, teamMemberAccess);
    } else {
      await pendingActionRepository.updateTeamMemberAccess(tx, teamMemberAccess);
    }

    const nextPaymentId =
      paymentStatus === "WAIVED" ? null : (paymentId ?? action.paymentId);

    await pendingActionRepository.markApplied(tx, {
      id: action.id,
      paymentId: nextPaymentId,
      teamId,
      payload: {
        ...payload,
        paymentStatus,
        ...(applyOptions?.waivedReason
          ? {
              waivedReason: applyOptions.waivedReason,
              waivedAt: new Date().toISOString(),
            }
          : {}),
      },
    });

    return {
      teamId,
      createdUser: {
        profileId: profile.id,
        email,
        name,
        role,
      },
    };
  }

  private async applyTransferTeam(
    tx: Prisma.TransactionClient,
    action: ResolvedPendingAction,
    paymentId?: string
  ): Promise<AppliedPendingActionResult> {
    const payload = (action.payload as PendingActionPayload) || {};
    const teamId = action.teamId || payload.teamId;
    const newMasterId = payload.newMasterId as string | undefined;

    if (!teamId || !newMasterId) {
      throw new Error("Dados insuficientes para transferir time");
    }

    const team = await pendingActionRepository.findTeamOwner(tx, teamId);

    if (!team) {
      throw new Error("Time não encontrado");
    }

    await pendingActionRepository.transferTeamOwnership(tx, { teamId, newMasterId });

    await pendingActionRepository.promoteMembershipToManager(tx, {
      teamId,
      profileId: newMasterId,
    });

    await pendingActionRepository.promoteProfileToMaster(tx, newMasterId);

    await pendingActionRepository.markApplied(tx, {
      id: action.id,
      paymentId: paymentId ?? action.paymentId,
      teamId,
      payload: {
        ...payload,
        paymentStatus: "CONFIRMED",
      },
    });

    return { teamId };
  }

  private async applyUpdateSubscriptionCredits(
    tx: Prisma.TransactionClient,
    action: ResolvedPendingAction,
    paymentId?: string
  ): Promise<AppliedPendingActionResult> {
    const payload = (action.payload as PendingActionPayload) || {};
    const addedTeamCredits = Math.max(0, Number(payload.addedTeamCredits ?? 0));
    const addedUserCredits = Math.max(0, Number(payload.addedUserCredits ?? 0));

    if (addedTeamCredits <= 0 && addedUserCredits <= 0) {
      throw new Error("Quantidade de créditos não informada");
    }

    await subscriptionCreditService.applyCreditAddition(tx, action.masterId, {
      teams: addedTeamCredits,
      users: addedUserCredits,
    });

    await pendingActionRepository.markApplied(tx, {
      id: action.id,
      paymentId: paymentId ?? action.paymentId,
      payload: {
        ...payload,
        paymentStatus: "CONFIRMED",
      },
    });

    return { teamId: action.teamId ?? "" };
  }

  private async sendAddedToTeamEmailForMember(action: ResolvedPendingAction) {
    const payload = (action.payload as PendingActionPayload) || {};
    const profileId = payload.profileId as string | undefined;
    const profileEmail = payload.profileEmail as string | undefined;
    const profileName = payload.profileName as string | undefined;

    if (!profileId) {
      return;
    }

    const profile = await pendingActionRepository.findProfileContact(profileId);

    const email = profileEmail || profile?.email;
    if (!email) {
      return;
    }

    const userName = profileName || profile?.fullName || email;
    const appUrl = getAppUrl({ removeTrailingSlash: true });
    const emailService = getEmailService();

    await emailService.sendEmailUntracked({
      to: [email],
      subject: "Corretor Studio - Você foi adicionado a um novo time",
      html: buildAddedToTeamEmail({ userName, loginUrl: `${appUrl}/sign-in` }),
    });
  }

  private async sendInviteForCreatedUser(
    action: ResolvedPendingAction,
    createdUser: CreatedPendingUser
  ) {
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const emailService = getEmailService();
      const redirectTo = getFullUrl("/set-password");

      if (!supabaseAdmin) {
        return;
      }

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: createdUser.email,
        options: {
          redirectTo,
          data: {
            name: createdUser.name,
            invited: true,
            first_access: true,
          },
        },
      });

      if (error || !data?.properties?.action_link) {
        throw new Error("Erro ao gerar link de convite");
      }

      const supabaseUserId = (data as any)?.user?.id as string | undefined;
      if (supabaseUserId) {
        await pendingActionRepository.linkProfileSupabaseIdentity(
          createdUser.profileId,
          supabaseUserId
        );
      }

      await emailService.sendOperatorInviteEmail({
        operatorName: createdUser.name,
        operatorEmail: createdUser.email,
        operatorRole: createdUser.role,
        managerName: action.master.fullName || action.master.email,
        inviteUrl: buildSetPasswordEmailAuthLink(data, "invite"),
      });
    } catch (inviteError) {
      console.warn("Erro ao enviar convite do usuário pendente:", inviteError);
    }
  }
}

export const pendingActionUseCase = new PendingActionUseCase();
