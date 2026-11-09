import {
  memberRemovalRepository,
} from "@/app/api/infra/data/repositories/memberRemoval/MemberRemovalRepository"
import type {
  IMemberRemovalRepository,
  OrphanNotificationRow,
  ReleasedLead,
} from "@/app/api/infra/data/repositories/memberRemoval/IMemberRemovalRepository"
import { invalidateNotificationsCache } from "@/lib/cache/invalidation"

/** Lead encerrado não precisa de redistribuição: libera o responsável, mas não avisa ninguém. */
const CLOSED_LEAD_STATUSES = new Set(["disqualified", "opportunityLost", "operator_denied", "contract_finalized"])

export type MemberRemovalFollowUpResult = {
  releasedLeads: number
  notifiedLeads: number
  sessionsRevoked: boolean
}

function buildMessage(lead: ReleasedLead, removedName: string): string {
  return `O lead ${lead.name} ficou sem responsável porque ${removedName} foi removido do time. Redistribua o lead.`
}

/**
 * Depois que um usuário é removido do time (por qualquer caminho): os leads dele ficam sem
 * responsável, master e managers recebem um aviso por lead aberto e a sessão do usuário cai na hora.
 * Cada etapa falha sozinha: o usuário já foi removido e nenhum erro aqui desfaz isso.
 */
export class MemberRemovalFollowUpService {
  constructor(
    private readonly repository: IMemberRemovalRepository = memberRemovalRepository,
    private readonly invalidate: (input: { recipientProfileIds: string[] }) => void = invalidateNotificationsCache,
  ) {}

  async handle(input: { teamId: string; removedProfileId: string }): Promise<MemberRemovalFollowUpResult> {
    const { teamId, removedProfileId } = input
    const profile = await this.safely("buscar perfil", () => this.repository.findProfileForRemoval(removedProfileId), null)
    const removedName = profile?.fullName || profile?.email || "Um usuário"

    const released = await this.safely(
      "liberar leads",
      () => this.repository.releaseLeadsOfMember(teamId, removedProfileId),
      [] as ReleasedLead[],
    )
    const notifiedLeads = await this.notifyOrphans(teamId, removedProfileId, removedName, released)
    const sessionsRevoked = await this.revokeSessions(profile?.supabaseId ?? null)

    return { releasedLeads: released.length, notifiedLeads, sessionsRevoked }
  }

  private async notifyOrphans(
    teamId: string,
    removedProfileId: string,
    removedName: string,
    released: ReleasedLead[],
  ): Promise<number> {
    const openLeads = released.filter((lead) => !CLOSED_LEAD_STATUSES.has(lead.status ?? ""))
    if (openLeads.length === 0) return 0

    return this.safely(
      "notificar leads órfãos",
      async () => {
        const recipients = (await this.repository.findRedistributionRecipientIds(teamId)).filter(
          (id) => id !== removedProfileId,
        )
        const uniqueRecipients = Array.from(new Set(recipients))
        if (uniqueRecipients.length === 0) return 0

        const rows: OrphanNotificationRow[] = openLeads.flatMap((lead) =>
          uniqueRecipients.map((recipientProfileId) => ({
            recipientProfileId,
            teamId,
            type: "LEAD_ORPHANED" as const,
            message: buildMessage(lead, removedName),
            metadata: {
              leadId: lead.id,
              leadCode: lead.leadCode,
              leadName: lead.name,
              removedProfileId,
            },
          })),
        )
        await this.repository.createLeadOrphanNotifications(rows)
        this.invalidate({ recipientProfileIds: uniqueRecipients })
        return openLeads.length
      },
      0,
    )
  }

  private async revokeSessions(authUserId: string | null): Promise<boolean> {
    if (!authUserId) return false
    return this.safely(
      "encerrar sessões",
      async () => {
        await this.repository.revokeAuthSessions(authUserId)
        return true
      },
      false,
    )
  }

  private async safely<T>(step: string, run: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await run()
    } catch (error) {
      console.error(`[MemberRemovalFollowUpService] falha ao ${step}`, {
        message: error instanceof Error ? error.message : "unknown",
      })
      return fallback
    }
  }
}

export const memberRemovalFollowUpService = new MemberRemovalFollowUpService()
