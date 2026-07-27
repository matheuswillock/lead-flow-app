import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"
import type { IBackofficeDeletionBillingService } from "./IBackofficeDeletionBillingService"

/**
 * Backoffice boundary for deletion-side billing side effects.
 * Product Asaas / Member PRO stay behind this adapter so backoffice use cases
 * do not import them directly.
 */
export class BackofficeDeletionBillingService implements IBackofficeDeletionBillingService {
  async cancelAsaasSubscription(subscriptionId: string): Promise<void> {
    await AsaasSubscriptionService.cancelSubscription(subscriptionId)
  }

  async syncMemberProAfterNonMasterDeletion(managerId: string): Promise<void> {
    await memberProBillingUseCase.syncBillingAfterUsageChange(
      managerId,
      "backoffice_user_delete"
    )
  }
}

export const backofficeDeletionBillingService = new BackofficeDeletionBillingService()
