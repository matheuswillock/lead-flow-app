export type ApiOutput<T> = {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T | null
}

export type BethaniaAiConfiguration = {
  enabled: boolean
  shadowMode: boolean
  rolloutPercentage: number
  primaryProvider: string
  primaryModel: string
  fallbackModel: string | null
  dailyUserLimit: number
  dailyGlobalLimit: number
  timeoutMs: number
  retentionDays: number
}

export type BethaniaAiOverview = {
  configuration: {
    enabled: boolean
    shadowMode: boolean
    rolloutPercentage: number
    primaryModel: string
    fallbackModel: string | null
  }
  metrics: {
    interactions: number
    successes: number
    failures: number
  }
  aiActive: boolean
  message: string | null
}
