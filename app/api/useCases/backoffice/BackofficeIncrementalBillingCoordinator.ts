import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService"
import type { BillingOwnerProfile } from "@/app/api/services/billing/IIncrementalBillingService"
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository"
import { getEmailService } from "@/lib/services/EmailService"
import { getFullUrl } from "@/lib/utils/app-url"
import type {
  BackofficeAddUserPendingInput,
  BackofficeAddMemberPendingInput,
  BackofficeCreateTeamPendingInput,
  BackofficePendingChargeResult,
  IBackofficeIncrementalBillingCoordinator,
} from "./IBackofficeIncrementalBillingCoordinator"

const BACKOFFICE_REQUESTER_NAME = "Backoffice Corretor Studio"

export class BackofficeIncrementalBillingCoordinator implements IBackofficeIncrementalBillingCoordinator {
  assertChargeableMaster(master: BillingOwnerProfile): string | null {
    if (master.hasPermanentSubscription) {
      return null
    }

    if (!master.subscriptionStatus || master.subscriptionStatus === "canceled") {
      return "Master não possui assinatura ativa para gerar cobrança"
    }

    return null
  }

  async createAddUserPendingAction(
    input: BackofficeAddUserPendingInput
  ): Promise<BackofficePendingChargeResult> {
    const chargeError = this.assertChargeableMaster(input.master)
    if (chargeError) {
      throw new Error(chargeError)
    }

    const projectedBilling = await incrementalBillingService.projectBilling(input.master.id, {
      additionalUsers: 1,
    })

    if (projectedBilling.billingDelta <= 0) {
      throw new Error("Não há cobrança incremental para este usuário. Use adição direta.")
    }

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(
      input.master.id,
      "user"
    )
    const totalCharge = proportionalData.totalCharge ?? projectedBilling.billingDelta
    const billingType: "PIX" | "CREDIT_CARD" = "PIX"

    const payload = {
      name: input.fullName,
      email: input.email,
      role: input.role,
      functions: input.functions,
      teamId: input.teamId,
      requestedByProfileId: input.master.id,
      requestedByName: BACKOFFICE_REQUESTER_NAME,
      requestedByEmail: input.master.email,
      canCreateAccountUsers: input.canCreateAccountUsers,
      canManageAccountTeams: input.canManageAccountTeams,
      canTransferAccountLeads: input.canTransferAccountLeads,
      billingType,
      billingDelta: proportionalData.billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      maxInstallments: proportionalData.maxInstallments,
      monthlyPrice: proportionalData.billingDelta,
      initiatedBy: "backoffice",
    }

    const pendingAction = await pendingActionRepository.create({
      masterId: input.master.id,
      teamId: input.teamId,
      actionType: "add_user",
      status: "pending",
      payload,
    })

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`)
    const emailService = getEmailService()

    await emailService.sendAddOnPendingPaymentEmail({
      masterName: input.master.fullName || input.master.email,
      masterEmail: input.master.email,
      addonType: "user",
      addonLabel: "Licença Usuário",
      addonDetail: `${input.fullName} (${input.email})`,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: BACKOFFICE_REQUESTER_NAME,
      requesterEmail: input.master.email,
    })

    return {
      pendingActionId: pendingAction.id,
      checkoutUrl,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      billingType,
    }
  }

  async createAddMemberPendingAction(
    input: BackofficeAddMemberPendingInput
  ): Promise<BackofficePendingChargeResult> {
    const chargeError = this.assertChargeableMaster(input.master)
    if (chargeError) {
      throw new Error(chargeError)
    }

    const projectedBilling = await incrementalBillingService.projectBilling(input.master.id, {
      additionalUsers: 1,
    })

    if (projectedBilling.billingDelta <= 0) {
      throw new Error("Não há cobrança incremental para este membro. Use adição direta.")
    }

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(
      input.master.id,
      "user"
    )
    const totalCharge = proportionalData.totalCharge ?? projectedBilling.billingDelta
    const billingType: "PIX" | "CREDIT_CARD" = "PIX"

    const payload = {
      profileId: input.profileId,
      profileEmail: input.profileEmail,
      profileName: input.profileName,
      role: input.role,
      functions: input.functions,
      teamId: input.teamId,
      requestedByProfileId: input.master.id,
      requestedByName: input.master.fullName || input.master.email,
      requestedByEmail: input.master.email,
      canCreateAccountUsers: input.canCreateAccountUsers,
      canManageAccountTeams: input.canManageAccountTeams,
      canTransferAccountLeads: input.canTransferAccountLeads,
      billingType,
      billingDelta: proportionalData.billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      maxInstallments: proportionalData.maxInstallments,
      monthlyPrice: proportionalData.billingDelta,
      initiatedBy: input.initiatedBy ?? "backoffice",
    }

    const pendingAction = await pendingActionRepository.create({
      masterId: input.master.id,
      teamId: input.teamId,
      actionType: "add_member",
      status: "pending",
      payload,
    })

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`)
    const emailService = getEmailService()

    await emailService.sendAddOnPendingPaymentEmail({
      masterName: input.master.fullName || input.master.email,
      masterEmail: input.master.email,
      addonType: "user",
      addonLabel: "Licença Usuário",
      addonDetail: `${input.profileName} (${input.profileEmail})`,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: BACKOFFICE_REQUESTER_NAME,
      requesterEmail: input.master.email,
    })

    return {
      pendingActionId: pendingAction.id,
      checkoutUrl,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      billingType,
    }
  }

  async createCreateTeamPendingAction(
    input: BackofficeCreateTeamPendingInput
  ): Promise<BackofficePendingChargeResult> {
    const chargeError = this.assertChargeableMaster(input.master)
    if (chargeError) {
      throw new Error(chargeError)
    }

    const projectedBilling = await incrementalBillingService.projectBilling(input.master.id, {
      additionalTeams: 1,
    })

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(
      input.master.id,
      "team"
    )
    const { billingDelta, totalCharge } = proportionalData

    if (billingDelta <= 0) {
      throw new Error("Não há cobrança incremental para este time. Use criação direta.")
    }

    const billingType: "PIX" | "CREDIT_CARD" = "PIX"
    const pendingPayload = {
      teamName: input.teamName,
      billingType,
      requestedByProfileId: input.master.id,
      requestedByName: BACKOFFICE_REQUESTER_NAME,
      requestedByEmail: input.master.email,
      requestedByFunctions: input.masterFunctions,
      billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      maxInstallments: proportionalData.maxInstallments,
      initiatedBy: "backoffice",
    }

    const pendingAction = await pendingActionRepository.create({
      masterId: input.master.id,
      actionType: "create_team",
      status: "pending",
      payload: pendingPayload,
    })

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`)
    const emailService = getEmailService()

    await emailService.sendAddOnPendingPaymentEmail({
      masterName: input.master.fullName || input.master.email,
      masterEmail: input.master.email,
      addonType: "team",
      addonLabel: "Time adicional",
      addonDetail: input.teamName,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: BACKOFFICE_REQUESTER_NAME,
      requesterEmail: input.master.email,
    })

    return {
      pendingActionId: pendingAction.id,
      checkoutUrl,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      billingType,
    }
  }
}

export const backofficeIncrementalBillingCoordinator = new BackofficeIncrementalBillingCoordinator()
