export type TriggerExampleErrorInput = {
  message: string
}

export interface SentryExamplePageContextValue {
  errorMessage: string
  eventId: string | null
  isTriggering: boolean
  triggerExampleError(input: TriggerExampleErrorInput): Promise<void>
}
