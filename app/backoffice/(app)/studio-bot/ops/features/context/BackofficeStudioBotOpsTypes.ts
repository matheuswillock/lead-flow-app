import type { HostAgentService } from "@/lib/studio-bot/host-services"

/** Alias local — a lista canônica vive em `lib/studio-bot/host-services.ts`. */
export type HostService = HostAgentService

export type MaskedEnvField = {
  key: string
  isSet: boolean
  isSecret: boolean
  value: string | null
}

export type BackofficeBotHostSettings = {
  id: string
  agentBaseUrl: string | null
  agentTokenConfigured: boolean
  desiredHostVersion: string | null
  appliedHostVersion: string | null
  lastAppliedAt: string | null
  lastApplyStatus: "never" | "succeeded" | "failed"
  lastApplyError: string | null
  n8nEnv: MaskedEnvField[]
  evolutionEnv: MaskedEnvField[]
  updatedAt: string
}

export type BackofficeBotHostJob = {
  id: string
  type: string
  status: string
  payload: unknown
  result: unknown
  errorMessage: string | null
  requestedByProfileId: string
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type HostServiceState = {
  service: HostService
  container: string | null
  image: string | null
  status: string | null
  ok: boolean
}

export type HostHealth = {
  ok: boolean
  containers?: Array<{ name: string; status: string; image?: string }>
  hostVersion?: string | null
  vpsStackCheck?: {
    ok: boolean
    services: HostServiceState[]
  }
  error?: string
}

export type HostLogsResult = {
  service: HostService
  lines: string[]
  fetchedAt: string
}

export type BethaniaWebhookResyncResult = {
  mode: "dry-run" | "apply"
  instanceName: string
  webhookUrl: string
  ok: boolean
  error?: string
}

export type ApiOutput<T = unknown> = {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}
