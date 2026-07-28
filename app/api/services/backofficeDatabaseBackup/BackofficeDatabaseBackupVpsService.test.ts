import { afterEach, describe, expect, it, mock } from "bun:test"
import { hashAgentToken } from "@/lib/studio-bot/host-cipher"
import { BackofficeDatabaseBackupVpsService } from "./BackofficeDatabaseBackupVpsService"

const ORIGINAL_OPS_TOKEN = process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN

mock.module("@/app/api/infra/data/repositories/backofficeBot/BackofficeBotHostRepository", () => ({
  BackofficeBotHostRepository: class {
    getOrCreateSettings = async () => ({
      id: "settings-1",
      agentBaseUrl: "https://ops.corretorstudio.com",
      agentTokenHash: hashAgentToken("ops-token-123"),
    })
  },
}))

afterEach(() => {
  if (ORIGINAL_OPS_TOKEN === undefined) delete process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN
  else process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = ORIGINAL_OPS_TOKEN
  delete process.env.BACKUP_VPS_TOKEN
  delete process.env.BACKUP_VPS_WEBHOOK_URL
})

describe("BackofficeDatabaseBackupVpsService", () => {
  it("envia Bearer com token validado para a VPS", async () => {
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = "ops-token-123"

    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
      expect(auth).toBe("Bearer ops-token-123")
      expect(_url).toBe("https://ops.corretorstudio.com/backup/run")
      return new Response(
        JSON.stringify({
          ok: true,
          filePath: "/tmp/full.dump",
          fileName: "full.dump",
          sizeBytes: 10,
          checksumSha256: "abc",
        }),
        { status: 200 }
      )
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const service = new BackofficeDatabaseBackupVpsService()
      const result = await service.runBackup("backup-id")
      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("falha com mensagem clara quando nenhum token está configurado", async () => {
    delete process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN

    const service = new BackofficeDatabaseBackupVpsService()
    const result = await service.runBackup("backup-id")
    expect(result.ok).toBe(false)
    expect(result.error).toContain("BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN")
  })

  it("traduz unauthorized da VPS em instrução de sincronização", async () => {
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = "ops-token-123"

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 })
    ) as unknown as typeof fetch

    try {
      const service = new BackofficeDatabaseBackupVpsService()
      const result = await service.runBackup("backup-id")
      expect(result.ok).toBe(false)
      expect(result.error).toContain("OPS_AGENT_TOKEN")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
