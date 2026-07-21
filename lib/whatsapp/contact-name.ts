import type { WhatsAppContactNameSource } from "@prisma/client"
import { formatDisplayPhone } from "@/lib/radar/normalization"

export type ContactNameSource = WhatsAppContactNameSource

const SOURCE_RANK: Record<ContactNameSource, number> = {
  MANUAL: 4,
  LEAD: 3,
  PHONE_BOOK: 2,
  PUSH_NAME: 1,
}

export function getContactNameSourceRank(source: ContactNameSource): number {
  return SOURCE_RANK[source]
}

export function canApplyContactName(
  currentSource: ContactNameSource,
  incomingSource: ContactNameSource
): boolean {
  return getContactNameSourceRank(incomingSource) >= getContactNameSourceRank(currentSource)
}

export function resolveContactNameUpdate(input: {
  currentName: string | null
  currentSource: ContactNameSource
  incomingName: string | null | undefined
  incomingSource: ContactNameSource
}): { contactName: string; contactNameSource: ContactNameSource } | null {
  const trimmed = input.incomingName?.trim()
  if (!trimmed) return null
  if (!canApplyContactName(input.currentSource, input.incomingSource)) return null
  if (trimmed === input.currentName?.trim() && input.incomingSource === input.currentSource) {
    return null
  }
  return { contactName: trimmed, contactNameSource: input.incomingSource }
}

export function resolveDisplayName(input: {
  contactName: string | null
  contactPhone: string
  externalChatId?: string | null
}): string {
  if (input.contactName?.trim()) return input.contactName.trim()
  const externalChatId = input.externalChatId ?? ""
  if (externalChatId.endsWith("@g.us")) return "Grupo"
  if (externalChatId.endsWith("@lid")) return "Número não disponível"
  const formatted = formatDisplayPhone(input.contactPhone)
  if (formatted && !formatted.includes("@")) return formatted
  return "Número não disponível"
}
