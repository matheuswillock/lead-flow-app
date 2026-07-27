import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"
import type { IBackofficeDeletionBillingCoordinator } from "./IBackofficeDeletionBillingCoordinator"

/**
 * Backoffice boundary for deletion-side billing side effects.
 * Product Asaas / Member PRO stay behind this coordinator so the deletion
 * use case does not import them directly.
 */
export class BackofficeDeletionBillingCoordinator implements IBackofficeDeletionBillingCoordinator {
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

export const backofficeDeletionBillingCoordinator = new BackofficeDeletionBillingCoordinator()
