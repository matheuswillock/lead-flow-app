/**
 * Validates structural integrity of Evolution API webhook payloads.
 *
 * The Evolution API does NOT send HMAC signatures or any authentication headers.
 * The webhook secret (32-char random hex) embedded in the URL path acts as the
 * primary authentication factor, similar to Stripe's URL-based signing approach.
 *
 * This module adds a defence-in-depth layer by validating the payload structure
 * matches expected Evolution API event format and rejecting malformed payloads
 * that could indicate forgery attempts.
 */

const KNOWN_EVENT_TYPES = new Set([
  "MESSAGES_UPSERT",
  "MESSAGES.UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES.UPDATE",
  "CONNECTION_UPDATE",
  "CONNECTION.UPDATE",
  "QRCODE_UPDATED",
  "QRCODE.UPDATED",
  "SEND_MESSAGE",
  "SEND.MESSAGE",
  "CONTACTS_UPSERT",
  "CONTACTS.UPSERT",
  "CONTACTS_UPDATE",
  "CONTACTS.UPDATE",
  "GROUPS_UPSERT",
  "GROUPS.UPSERT",
  "CHATS_UPSERT",
  "CHATS.UPSERT",
  "CHATS_UPDATE",
  "CHATS.UPDATE",
  "CHATS_DELETE",
  "CHATS.DELETE",
  "PRESENCE_UPDATE",
  "PRESENCE.UPDATE",
  "MESSAGES_DELETE",
  "MESSAGES.DELETE",
  "GROUP_PARTICIPANTS_UPDATE",
  "GROUP_PARTICIPANTS.UPDATE",
  "GROUP-PARTICIPANTS.UPDATE",
  "NEW_TOKEN",
  "APPLICATION_STARTUP",
  "MESSAGES_SET",
  "CONTACTS_SET",
  "CHATS_SET",
])

export function isValidEvoWebhookPayload(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false

  const record = payload as Record<string, unknown>

  const eventType = record["event"] ?? record["type"]
  if (typeof eventType !== "string") return false

  const normalized = eventType.toUpperCase()
  if (!KNOWN_EVENT_TYPES.has(normalized)) {
    console.info(
      "[webhook-signature] Unknown event type, allowing forward-compat:",
      normalized
    )
  }

  if (!("data" in record) && !("instance" in record)) return false

  return true
}
