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

/**
 * Espera a produção parar de avançar — o sinal observável de que um `write`
 * ficou pendente por contrapressão. Esperar tempo fixo aqui deixaria o teste
 * passar de graça no caminho trivial (abortar antes da primeira escrita), que é
 * justamente o que o teste precisa evitar.
 */
async function aguardarProducaoTravada(estado: {
  escritos: number
  terminou: boolean
}): Promise<void> {
  let anterior = -1

  for (let tentativa = 0; tentativa < 200; tentativa += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))

    if (estado.terminou) {
      throw new Error(
        "A produção terminou sem travar: aumente o fixture para estourar os buffers"
      )
    }
    if (estado.escritos > 0 && estado.escritos === anterior) return
    anterior = estado.escritos
  }

  throw new Error("A produção nunca ficou presa em contrapressão")
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

  /**
   * Review PR #1057. O teste acima aborta antes de qualquer escrita, então nunca
   * exercitou o caminho de contrapressão e passava mesmo com o bug.
   *
   * Com ninguém consumindo o corpo, o JSZip para de puxar as entradas e o
   * `write` do produtor fica pendente. `destroy(error)` — o que `abort()` faz
   * quando o upload ao Drive falha — não emite "drain" nem invoca o callback do
   * write pendente, inclusive quando o `write` devolveu `true` e o pedaço ficou
   * parado no `Transform[kCallback]`. A Promise nunca resolvia: o cron de backup
   * só morria no teto de `maxDuration`, sem gravar `failed` nem alertar.
   *
   * Sem a correção este teste não falha por asserção — ele *trava*, e é a corrida
   * com o marcador abaixo que transforma o travamento em falha legível.
   */
  it("abort no meio da escrita sob contrapressao falha rapido, sem travar", async () => {
    const fixture: Fixture = {
      Lead: Array.from({ length: 200_000 }, (_, index) =>
        JSON.stringify({ id: `lead-${index}`, payload: "z".repeat(500) })
      ),
    }

    const base = createRepository(fixture)
    const estado = { escritos: 0, terminou: false }
    const repository: IBackofficeDatabaseBackupExportRepository = {
      listExportableModelNames: () => base.listExportableModelNames(),
      exportSnapshot: async (writeChunk: BackupChunkWriter) => {
        const summary = await base.exportSnapshot(async (chunk) => {
          await writeChunk(chunk)
          estado.escritos += 1
        })
        estado.terminou = true
        return summary
      },
    }

    const service = new BackofficeDatabaseBackupExportService(repository)
    const archive = service.createArchive()

    // Ninguém lê o corpo: os buffers enchem e a produção trava no meio do write.
    await aguardarProducaoTravada(estado)
    expect(estado.escritos).toBeGreaterThan(0)

    archive.abort(new Error("upload failed"))

    const desfecho = await Promise.race([
      archive.completion
        .then(() => "resolveu")
        .catch((error: Error) => `rejeitou: ${error.message}`),
      new Promise<string>((resolve) => setTimeout(() => resolve("travou"), 3_000)),
    ])

    expect(desfecho).toBe("rejeitou: upload failed")
  })
})
