import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"

export type WhatsAppVisibilityScope = "master" | "manager" | "operator"

export class WhatsAppAccessDeniedError extends Error {
  constructor(message = "Acesso negado a esta conversa") {
    super(message)
    this.name = "WhatsAppAccessDeniedError"
  }
}

export function canManageWhatsAppInfrastructure(access: TeamAccess): boolean {
  return access.isMaster || isManagerLikeRole(access.teamMember.role)
}

export function resolveVisibilityScope(access: TeamAccess): WhatsAppVisibilityScope {
  if (access.isMaster) return "master"
  if (isManagerLikeRole(access.teamMember.role)) return "manager"
  return "operator"
}

import type { Prisma } from "@prisma/client"

/**
 * RBAC-alvo: conversas sem responsável (assignedProfileId = null) são visíveis
 * a todos os operators do time, inclusive as importadas por sync-history.
 */
export const WHATSAPP_SYNC_HISTORY_VISIBILITY_NOTE =
  "Conversas importadas por sync-history sem responsável ficam visíveis a operators do time."

export function buildOperatorConversationVisibilityWhere(
  profileId: string,
  operatorLeadPhones: string[]
): Prisma.WhatsAppConversationWhereInput {
  const orFilters: Prisma.WhatsAppConversationWhereInput[] = [
    { assignedProfileId: profileId },
    { assignedProfileId: null },
    {
      lead: {
        OR: [{ assignedTo: profileId }, { closerId: profileId }],
      },
    },
  ]

  if (operatorLeadPhones.length > 0) {
    orFilters.push({
      leadId: null,
      normalizedPhone: { in: operatorLeadPhones },
    })
  }

  return { OR: orFilters }
}
