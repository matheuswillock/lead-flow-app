export interface IBackofficeDeletionBillingService {
  cancelAsaasSubscription(subscriptionId: string): Promise<void>
  syncMemberProAfterNonMasterDeletion(managerId: string): Promise<void>
}
