import type { AsaasNotificationBackfillStatus } from "@prisma/client"

export interface IAsaasNotificationBackfillRepository {
  markCompleted(asaasCustomerId: string): Promise<void>
  markFailed(asaasCustomerId: string, error: string): Promise<void>
  getStatus(asaasCustomerId: string): Promise<AsaasNotificationBackfillStatus | null>
  listCompletedCustomerIds(): Promise<string[]>
  listProfileAsaasCustomerIds(limit: number): Promise<string[]>
}
