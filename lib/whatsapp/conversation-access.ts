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

/**
 * Sync-history imports conversations with createdByProfileId = null.
 * Those remain visible only to the account master until an operator engages.
 */
export const WHATSAPP_SYNC_HISTORY_VISIBILITY_NOTE =
  "Conversas importadas por sync-history ficam visíveis ao master até envolvimento de operator."
