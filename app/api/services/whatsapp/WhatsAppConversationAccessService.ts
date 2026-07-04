import type { Prisma } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import type { WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import {
  resolveVisibilityScope,
  WhatsAppAccessDeniedError,
  buildOperatorConversationVisibilityWhere,
} from "@/lib/whatsapp/conversation-access"

export { WhatsAppAccessDeniedError } from "@/lib/whatsapp/conversation-access"
export {
  canManageWhatsAppInfrastructure,
  resolveVisibilityScope,
  WHATSAPP_SYNC_HISTORY_VISIBILITY_NOTE,
} from "@/lib/whatsapp/conversation-access"
export type { WhatsAppVisibilityScope } from "@/lib/whatsapp/conversation-access"

export async function buildConversationVisibilityWhere(
  access: TeamAccess
): Promise<Prisma.WhatsAppConversationWhereInput | undefined> {
  const scope = resolveVisibilityScope(access)
  const { teamId, profileId } = access

  // RBAC-alvo (WHATSAPP_SPEC.md, Estágio 1): master e manager veem todas as
  // conversas do time; operator vê atribuídas a ele OU sem responsável, mais
  // as cláusulas aditivas de lead. Qualquer mudança aqui MUST ser espelhada em
  // public.whatsapp_user_can_view_conversation (RLS do realtime).
  if (scope === "master" || scope === "manager") {
    return undefined
  }

  const operatorLeadPhones = await whatsAppRepository.getOperatorLeadPhones(teamId, profileId)
  return buildOperatorConversationVisibilityWhere(profileId, operatorLeadPhones)
}

export async function canAccessConversation(
  access: TeamAccess,
  conversation: Pick<WhatsAppConversationSelect, "id" | "teamId">
): Promise<boolean> {
  if (conversation.teamId !== access.teamId) {
    return false
  }

  const scope = resolveVisibilityScope(access)
  if (scope === "master") return true

  const visibilityWhere = await buildConversationVisibilityWhere(access)
  if (!visibilityWhere) return true

  const count = await whatsAppRepository.countConversationsWithVisibility(
    conversation.id,
    access.teamId,
    visibilityWhere
  )

  return count > 0
}

export async function assertCanAccessConversation(
  access: TeamAccess,
  conversationId: string
): Promise<WhatsAppConversationSelect> {
  const conversation = await whatsAppRepository.findConversationByIdForTeam(
    conversationId,
    access.teamId
  )

  if (!conversation) {
    throw new WhatsAppAccessDeniedError("Conversa não encontrada")
  }

  const allowed = await canAccessConversation(access, conversation)
  if (!allowed) {
    throw new WhatsAppAccessDeniedError()
  }

  return conversation
}

export async function buildOperatorContactPhoneFilter(
  access: TeamAccess
): Promise<Prisma.TeamWhatsAppContactWhereInput | undefined> {
  const scope = resolveVisibilityScope(access)
  if (scope !== "operator") return undefined

  const operatorLeadPhones = await whatsAppRepository.getOperatorLeadPhones(
    access.teamId,
    access.profileId
  )
  const visibilityWhere = await buildConversationVisibilityWhere(access)

  const visibleConversations = await whatsAppRepository.listConversationContactKeysForTeam(
    access.teamId,
    visibilityWhere
  )

  const phones = new Set<string>(operatorLeadPhones)
  const remoteJids = new Set<string>()
  for (const conv of visibleConversations) {
    phones.add(conv.normalizedPhone)
    if (conv.externalChatId) remoteJids.add(conv.externalChatId)
  }

  const phoneList = Array.from(phones).filter(Boolean)
  const jidList = Array.from(remoteJids).filter(Boolean)

  if (phoneList.length === 0 && jidList.length === 0) {
    return { id: { in: [] } }
  }

  const orFilters: Prisma.TeamWhatsAppContactWhereInput[] = []
  if (phoneList.length > 0) {
    orFilters.push({ phoneNumber: { in: phoneList } })
    for (const phone of phoneList) {
      orFilters.push({ phoneNumber: { contains: phone.slice(-11) } })
    }
  }
  if (jidList.length > 0) {
    orFilters.push({ remoteJid: { in: jidList } })
  }

  return { OR: orFilters }
}
