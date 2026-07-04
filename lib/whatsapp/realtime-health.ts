export type WhatsAppRealtimeChannelStatus =
  | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED" | string | null

export function computeWhatsAppRealtimeHealth(input: {
  convsStatus: WhatsAppRealtimeChannelStatus
  msgsStatus: WhatsAppRealtimeChannelStatus
  hasSelectedConversation: boolean
  msgsInitializing: boolean
}): boolean {
  const convsOk = input.convsStatus === "SUBSCRIBED"
  const msgsOk =
    !input.hasSelectedConversation ||
    input.msgsStatus === "SUBSCRIBED" ||
    (input.msgsInitializing && input.msgsStatus === null)
  return convsOk && msgsOk
}
