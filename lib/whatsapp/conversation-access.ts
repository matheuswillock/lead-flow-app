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

/** Espelha whatsapp_user_can_view_conversation para operator (paridade TS×RLS em testes). */
export function operatorCanViewConversation(input: {
  profileId: string
  assignedProfileId: string | null
  leadId: string | null
  normalizedPhone: string | null
  leadAssignedTo: string | null
  leadCloserId: string | null
  operatorLeadPhones: string[]
}): boolean {
  if (input.assignedProfileId === input.profileId) return true
  if (input.assignedProfileId === null) return true
  if (
    input.leadId &&
    (input.leadAssignedTo === input.profileId || input.leadCloserId === input.profileId)
  ) {
    return true
  }
  if (
    !input.leadId &&
    input.normalizedPhone &&
    input.operatorLeadPhones.includes(input.normalizedPhone)
  ) {
    return true
  }
  return false
}
