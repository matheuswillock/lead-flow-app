import type { WhatsAppConnectionStatus } from "@prisma/client"

export interface BackofficeWhatsAppInstanceMaster {
  id: string
  fullName: string | null
  email: string | null
  supabaseId: string | null
}

export interface BackofficeWhatsAppInstanceTeam {
  id: string
  name: string
  master: BackofficeWhatsAppInstanceMaster
}

export interface BackofficeWhatsAppInstanceRow {
  id: string
  teamId: string
  provider: string
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  displayName: string | null
  status: WhatsAppConnectionStatus
  qrCodeText: string | null
  qrCodeImageUrl: string | null
  webhookSecret: string
  hostBaseUrl: string | null
  lastConnectedAt: Date | null
  lastDisconnectedAt: Date | null
  lastSyncAt: Date | null
  historySyncStatus: string
  historySyncStartedAt: Date | null
  historySyncCompletedAt: Date | null
  historySyncError: string | null
  usageLimitMonthly: number
  billingEnabled: boolean
  createdAt: Date
  updatedAt: Date
  team: BackofficeWhatsAppInstanceTeam
}

export interface BackofficeWhatsAppTeamWithoutInstance {
  id: string
  name: string
  master: BackofficeWhatsAppInstanceMaster
}

export interface ListInstancesFilters {
  q?: string
  status?: WhatsAppConnectionStatus
}

export interface IBackofficeWhatsAppInstanceRepository {
  listInstances(
    filters: ListInstancesFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppInstanceRow[]; totalItems: number }>
  findInstanceById(configId: string): Promise<BackofficeWhatsAppInstanceRow | null>
  findInstanceByTeamId(teamId: string): Promise<BackofficeWhatsAppInstanceRow | null>
  updateInstanceAdminFields(
    configId: string,
    data: {
      usageLimitMonthly?: number
      billingEnabled?: boolean
      hostBaseUrl?: string | null
      updatedByProfileId: string
    }
  ): Promise<BackofficeWhatsAppInstanceRow>
  listTeamsWithoutConfig(
    filters: { q?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppTeamWithoutInstance[]; totalItems: number }>
}
