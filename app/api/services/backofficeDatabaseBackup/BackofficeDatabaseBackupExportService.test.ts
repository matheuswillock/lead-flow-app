import { describe, expect, it } from "bun:test"
import { createHash } from "node:crypto"
import JSZip from "jszip"
import type {
  BackupChunkWriter,
  BackupSnapshotSummary,
  IBackofficeDatabaseBackupExportRepository,
} from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupExportRepository"
import { BackofficeDatabaseBackupExportService } from "./BackofficeDatabaseBackupExportService"
import type { BackupArchive } from "./IBackofficeDatabaseBackupExportService"

type Fixture = Record<string, string[]>

/**
 * Repositório falso que emite NDJSON em pedaços, como o real, sem tocar no banco.
 */
function createRepository(
  fixture: Fixture,
  options: { failAfterChunks?: number } = {}
): IBackofficeDatabaseBackupExportRepository {
  return {
    listExportableModelNames: () => Object.keys(fixture),
    exportSnapshot: async (
      writeChunk: BackupChunkWriter
    ): Promise<BackupSnapshotSummary> => {
      let written = 0
      let rowCount = 0

      for (const [modelName, lines] of Object.entries(fixture)) {
        for (const line of lines) {
          if (
            options.failAfterChunks !== undefined &&
            written >= options.failAfterChunks
          ) {
            throw new Error("Transaction already closed")
          }
          await writeChunk({ modelName, ndjson: `${line}\n`, rowCount: 1 })
          written += 1
          rowCount += 1
        }
      }

      return { modelCount: Object.keys(fixture).length, rowCount }
    },
  }
}

async function readAll(archive: BackupArchive): Promise<Buffer> {
  const parts: Buffer[] = []
  for await (const chunk of archive.body) {
    parts.push(Buffer.from(chunk as Buffer))
  }
  return Buffer.concat(parts)
}

describe("BackofficeDatabaseBackupExportService", () => {
  it("grava um arquivo NDJSON por modelo, com uma linha por registro", async () => {
    const fixture: Fixture = {
      Lead: [
        JSON.stringify({ id: "lead-1", name: "Ana" }),
        JSON.stringify({ id: "lead-2", name: "Bruno" }),
      ],
      Team: [JSON.stringify({ id: "team-1" })],
    }

    const service = new BackofficeDatabaseBackupExportService(
      createRepository(fixture)
    )
    const archive = service.createArchive()
    const buffer = await readAll(archive)
    const stats = await archive.completion

    const zip = await JSZip.loadAsync(buffer)
    const leadFile = await zip.file("Lead.ndjson")!.async("string")
    const teamFile = await zip.file("Team.ndjson")!.async("string")

    expect(leadFile.split("\n").filter(Boolean)).toEqual(fixture.Lead!)
    expect(teamFile.split("\n").filter(Boolean)).toEqual(fixture.Team!)
    expect(JSON.parse(leadFile.split("\n")[0]!)).toEqual({
      id: "lead-1",
      name: "Ana",
    })
    expect(stats.rowCount).toBe(3)
    expect(stats.modelCount).toBe(2)
  })

  it("cria entrada vazia para modelo sem nenhuma linha", async () => {
    const fixture: Fixture = {
      Lead: [JSON.stringify({ id: "lead-1" })],
      SemDados: [],
      Team: [JSON.stringify({ id: "team-1" })],
    }

    const service = new BackofficeDatabaseBackupExportService(
      createRepository(fixture)
    )
    const archive = service.createArchive()
    const buffer = await readAll(archive)
    await archive.completion

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files).sort()).toEqual([
      "Lead.ndjson",
      "SemDados.ndjson",
      "Team.ndjson",
    ])
    expect(await zip.file("SemDados.ndjson")!.async("string")).toBe("")
    // O modelo posterior nao pode ser engolido pela entrada vazia.
    expect(await zip.file("Team.ndjson")!.async("string")).toContain("team-1")
  })

  it("mede tamanho e checksum a partir dos bytes realmente enviados", async () => {
    const fixture: Fixture = {
      Lead: Array.from({ length: 500 }, (_, index) =>
        JSON.stringify({ id: `lead-${index}`, payload: "x".repeat(200) })
      ),
    }

    const service = new BackofficeDatabaseBackupExportService(
      createRepository(fixture)
    )
    const archive = service.createArchive()
    const buffer = await readAll(archive)
    const stats = await archive.completion

    expect(stats.sizeBytes).toBe(buffer.length)
    expect(stats.checksumSha256).toBe(
      createHash("sha256").update(buffer).digest("hex")
    )
    expect(archive.fileName).toMatch(/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/)
  })

  it("falha o arquivo inteiro quando o export quebra no meio", async () => {
    const fixture: Fixture = {
      Lead: Array.from({ length: 50 }, (_, index) =>
        JSON.stringify({ id: `lead-${index}` })
      ),
    }

    const service = new BackofficeDatabaseBackupExportService(
      createRepository(fixture, { failAfterChunks: 10 })
    )
    const archive = service.createArchive()

    // Um backup truncado nunca pode chegar ao Drive como se fosse valido:
    // tanto o corpo quanto o completion precisam falhar.
    await expect(readAll(archive)).rejects.toThrow("Transaction already closed")
    await expect(archive.completion).rejects.toThrow("Transaction already closed")
  })

  it("abort interrompe a producao e propaga o motivo", async () => {
    const fixture: Fixture = {
      Lead: Array.from({ length: 100_000 }, (_, index) =>
        JSON.stringify({ id: `lead-${index}`, payload: "y".repeat(500) })
      ),
    }

    const service = new BackofficeDatabaseBackupExportService(
      createRepository(fixture)
    )
    const archive = service.createArchive()

    archive.abort(new Error("socket hang up"))

    await expect(archive.completion).rejects.toThrow("socket hang up")
  })
})
