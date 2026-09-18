import type { Prisma } from "@prisma/client"
import type { SendingHealthSnapshot } from "@/lib/email/sending-health"

export type BackofficeTeamSendingHealthSettingsRow = {
  teamId: string
  teamName: string
  masterName: string | null
  status: string
  reason: string | null
  changedAt: Date | null
}

export type BackofficeTeamSendingHealthMeta = {
  status: string
  metricsJson: Prisma.JsonValue | null
}

export interface IBackofficeTeamSendingHealthRepository {
  /** Com `teamIds`: só os pedidos; sem: todos os times fora de `healthy`. */
  listHealthSettings(teamIds?: string[]): Promise<BackofficeTeamSendingHealthSettingsRow[]>

  getTeamHealthMeta(teamId: string): Promise<BackofficeTeamSendingHealthMeta | null>

  upsertTeamHealth(params: {
    teamId: string
    status: string
    reason: string | null
    changedAt: Date
    snapshot?: SendingHealthSnapshot
  }): Promise<void>
}
