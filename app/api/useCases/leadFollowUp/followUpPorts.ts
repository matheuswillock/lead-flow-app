/** Portas que os casos de uso de acompanhamento usam; as implementações ficam na composição. */

export type CreateFollowUpTask = (input: {
  leadId: string
  teamId: string
  ownerProfileId: string
  title: string
  body: string
  dueAt: Date
}) => Promise<{ taskId: string | null; error: string | null }>

export type NotifyProfile = (input: {
  teamId: string
  recipientProfileId: string
  message: string
  metadata: Record<string, unknown>
}) => Promise<void>

export type AppendLeadActivity = (input: {
  leadId: string
  actorProfileId: string | null
  type: "whatsapp" | "note"
  body: string
}) => Promise<void>
