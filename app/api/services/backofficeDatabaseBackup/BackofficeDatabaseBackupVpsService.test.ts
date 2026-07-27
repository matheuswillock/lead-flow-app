import { afterEach, describe, expect, it, mock } from "bun:test"
import { BackofficeDatabaseBackupVpsService } from "./BackofficeDatabaseBackupVpsService"

const ORIGINAL_BACKUP_URL = process.env.BACKUP_VPS_WEBHOOK_URL
const ORIGINAL_BACKUP_TOKEN = process.env.BACKUP_VPS_TOKEN
const ORIGINAL_OPS_TOKEN = process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN

afterEach(() => {
  if (ORIGINAL_BACKUP_URL === undefined) delete process.env.BACKUP_VPS_WEBHOOK_URL
  else process.env.BACKUP_VPS_WEBHOOK_URL = ORIGINAL_BACKUP_URL
  if (ORIGINAL_BACKUP_TOKEN === undefined) delete process.env.BACKUP_VPS_TOKEN
  else process.env.BACKUP_VPS_TOKEN = ORIGINAL_BACKUP_TOKEN
  if (ORIGINAL_OPS_TOKEN === undefined) delete process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN
  else process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN = ORIGINAL_OPS_TOKEN
})

describe("BackofficeDatabaseBackupVpsService", () => {
  it("usa BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN quando BACKUP_VPS_TOKEN está ausente", async () => {
    delete process.env.BACKUP_VPS_TOKEN
    delete process.env.BACKUP_VPS_WEBHOOK_URL
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
    delete process.env.BACKUP_VPS_TOKEN
    delete process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN

    const service = new BackofficeDatabaseBackupVpsService()
    const result = await service.runBackup("backup-id")
    expect(result.ok).toBe(false)
    expect(result.error).toContain("BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN")
  })

  it("trata payload HTTP 200 com ok=false como falha", async () => {
    process.env.BACKUP_VPS_TOKEN = "tok"
    process.env.BACKUP_VPS_WEBHOOK_URL = "https://ops.example.com/backup/run"

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: false, error: "script missing" }), { status: 200 })
    ) as unknown as typeof fetch

    try {
      const service = new BackofficeDatabaseBackupVpsService()
      const result = await service.runBackup("backup-id")
      expect(result.ok).toBe(false)
      expect(result.error).toBe("script missing")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
