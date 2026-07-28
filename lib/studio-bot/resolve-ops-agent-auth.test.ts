import { afterEach, describe, expect, it, mock } from "bun:test"
import { hashAgentToken } from "@/lib/studio-bot/host-cipher"
import {
  buildBackupDownloadUrl,
  mapVpsUnauthorizedError,
  resolveOpsAgentAuthForBackup,
} from "@/lib/studio-bot/resolve-ops-agent-auth"

const ORIGINAL_BACKUP_URL = process.env.BACKUP_VPS_WEBHOOK_URL
const ORIGINAL_BACKUP_TOKEN = process.env.BACKUP_VPS_TOKEN
const ORIGINAL_OPS_TOKEN = process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN

const mockGetOrCreateSettings = mock(async () => ({
  id: "settings-1",
  agentBaseUrl: "https://ops.corretorstudio.com",
  agentTokenHash: hashAgentToken("ops-token-123"),
}))

mock.module("@/app/api/infra/data/repositories/backofficeBot/BackofficeBotHostRepository", () => ({
  BackofficeBotHostRepository: class {
    getOrCreateSettings = mockGetOrCreateSettings
  },
}))

afterEach(() => {
  if (ORIGINAL_BACKUP_URL === undefined) delete process.env.BACKUP_VPS_WEBHOOK_URL
  else process.env.BACKUP_VPS_WEBHOOK_URL = ORIGINAL_BACKUP_URL
  if (ORIGINAL_BACKUP_TOKEN === undefined) delete process.env.BACKUP_VPS_TOKEN
  else process.env.BACKUP_VPS_TOKEN = ORIGINAL_BACKUP_TOKEN
  if (ORIGINAL_OPS_TOKEN === undefined) delete process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN
  else process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = ORIGINAL_OPS_TOKEN
  mockGetOrCreateSettings.mockClear()
})

describe("resolveOpsAgentAuthForBackup", () => {
  it("aceita token válido e monta URL a partir do agentBaseUrl", async () => {
    delete process.env.BACKUP_VPS_TOKEN
    delete process.env.BACKUP_VPS_WEBHOOK_URL
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = "ops-token-123"

    const config = await resolveOpsAgentAuthForBackup()
    expect(config.ok).toBe(true)
    if (config.ok) {
      expect(config.token).toBe("ops-token-123")
      expect(config.webhookUrl).toBe("https://ops.corretorstudio.com/backup/run")
    }
  })

  it("rejeita token que não confere com o hash salvo", async () => {
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = "token-errado"

    const config = await resolveOpsAgentAuthForBackup()
    expect(config.ok).toBe(false)
    if (!config.ok) {
      expect(config.error).toContain("não confere")
    }
  })
})

describe("mapVpsUnauthorizedError", () => {
  it("traduz 401/unauthorized para instrução de sincronizar OPS_AGENT_TOKEN", () => {
    const message = mapVpsUnauthorizedError(401, "unauthorized")
    expect(message).toContain("OPS_AGENT_TOKEN")
    expect(message).toContain("BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN")
  })
})

describe("buildBackupDownloadUrl", () => {
  it("substitui /backup/run por /backup/download", () => {
    expect(buildBackupDownloadUrl("https://ops.example.com/backup/run")).toBe(
      "https://ops.example.com/backup/download"
    )
  })
})
