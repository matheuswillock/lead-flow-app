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

export type HostHealth = {
  ok: boolean
  containers?: Array<{ name: string; status: string; image?: string }>
  workflows?: Array<{ id: string; name: string; active: boolean | null }>
  hostVersion?: string | null
  bethaniaProductionCheck?: {
    ok: boolean
    env: {
      n8n: Array<{ key: string; configured: boolean }>
      evolution: Array<{ key: string; configured: boolean }>
    }
    workflows: Array<{
      name: string
      expected: "active" | "inactive"
      actual: boolean | "missing" | null
      ok: boolean
    }>
    containers: { n8nImage: string | null; imagePinned: boolean }
    productionEvidenceRequired: string[]
  }
  error?: string
}

export type HostLogsResult = {
  service: "n8n" | "api"
  lines: string[]
  fetchedAt: string
}

export type ApiOutput<T = unknown> = {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}
