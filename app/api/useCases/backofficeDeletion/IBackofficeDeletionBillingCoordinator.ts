export interface IBackofficeDeletionBillingCoordinator {
  cancelAsaasSubscription(subscriptionId: string): Promise<void>
  syncMemberProAfterNonMasterDeletion(managerId: string): Promise<void>
}
