"use client"

export {
  MessagingFormattedText as WhatsAppFormattedText,
  MessagingFormattedText,
} from "@/components/messaging/formatMessagingText"

export type { MessagingContactLookup as WhatsAppContactLookup } from "@/components/messaging/types"

import type { MessagingContactLookup } from "@/components/messaging/types"

export function buildContactLookupFromList(
  contacts: Array<{ opaqueId: string; displayName: string | null; pushName: string | null }>
): MessagingContactLookup {
  const lookup: MessagingContactLookup = {}
  for (const contact of contacts) {
    const name = contact.displayName?.trim() || contact.pushName?.trim()
    if (name) {
      lookup[contact.opaqueId] = name
    }
  }
  return lookup
}
