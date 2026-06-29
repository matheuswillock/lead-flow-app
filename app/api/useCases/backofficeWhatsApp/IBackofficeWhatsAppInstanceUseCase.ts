import type { WhatsAppConnectionStatus } from "@prisma/client"
import type { Output } from "@/lib/output"

export interface IBackofficeWhatsAppInstanceUseCase {
  listInstances(
    filters: { q?: string; status?: WhatsAppConnectionStatus },
    pagination: { page: number; pageSize: number }
  ): Promise<Output>
  getInstance(configId: string): Promise<Output>
  updateInstance(
    configId: string,
    data: {
      usageLimitMonthly?: number
      billingEnabled?: boolean
      hostBaseUrl?: string | null
      updatedByProfileId: string
    }
  ): Promise<Output>
  provisionInstance(data: {
    teamId: string
    profileId: string
    usageLimitMonthly?: number
    hostBaseUrl?: string
  }): Promise<Output>
  reconnectInstance(configId: string, profileId: string): Promise<Output>
  disconnectInstance(configId: string, profileId: string): Promise<Output>
  syncHistory(configId: string): Promise<Output>
  listTeamsWithoutInstance(
    filters: { q?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output>
}
