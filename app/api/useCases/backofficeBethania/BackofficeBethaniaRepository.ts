export type BethaniaEventControlRecord = {
  eventType: string
  paused: boolean
}

export type BethaniaDeliveryLogRecord = {
  id: string
  eventType: string
  status: string
  errorCode: string | null
  createdAt: Date
  attempts: number
}

export interface BackofficeBethaniaRepository {
  getGlobalPause(): Promise<boolean>
  listEventControls(): Promise<BethaniaEventControlRecord[]>
  setGlobalPause(input: { paused: boolean; actorProfileId: string }): Promise<void>
  setEventPause(input: { eventType: string; paused: boolean; actorProfileId: string }): Promise<void>
  getSenderConfig(): Promise<{ webhookUrl: string } | null>
  upsertSenderConfig(input: { webhookUrl: string; actorProfileId: string }): Promise<{
    webhookUrl: string
    updatedByProfileId: string | null
  }>
  listLogs(input: {
    eventType?: string
    status?: string
    skip: number
    take: number
  }): Promise<{ rows: BethaniaDeliveryLogRecord[]; total: number }>
}
