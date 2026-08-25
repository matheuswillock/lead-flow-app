import { createHash } from "node:crypto"
import { once } from "node:events"
import { PassThrough, Transform } from "node:stream"
import { finished } from "node:stream/promises"
import JSZip from "jszip"
import { BackofficeDatabaseBackupExportRepository } from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/BackofficeDatabaseBackupExportRepository"
import type {
  BackupModelChunk,
  IBackofficeDatabaseBackupExportRepository,
} from "@/app/api/infra/data/repositories/backoffice/DatabaseBackupRepository/IBackofficeDatabaseBackupExportRepository"
import type {
  IBackofficeDatabaseBackupExportService,
  BackupArchive,
  BackupArchiveStats,
} from "./IBackofficeDatabaseBackupExportService"

const ENTRY_HIGH_WATER_MARK = 1 << 20

type ArchiveEntry = {
  modelName: string
  stream: PassThrough
}

function buildFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}.zip`
}

async function writeWithBackpressure(
  stream: PassThrough,
  text: string
): Promise<void> {
  if (stream.write(text)) return
  await once(stream, "drain")
}

/**
 * Encaminha os pedaços do export para o arquivo correto do ZIP.
 *
 * O JSZip lê as entradas na ordem em que foram registradas e o repositório
 * produz os modelos nessa mesma ordem, então basta fechar as entradas que
 * ficaram para trás quando um novo modelo começa. Modelos sem nenhuma linha não
 * geram pedaço algum e são fechados vazios — o arquivo continua existindo no ZIP.
 */
class ArchiveEntryWriter {
  private cursor = 0
  private readonly indexByModel: Map<string, number>

  constructor(private readonly entries: ArchiveEntry[]) {
    this.indexByModel = new Map(
      entries.map((entry, index) => [entry.modelName, index])
    )
  }

  async write(chunk: BackupModelChunk): Promise<void> {
    const index = this.indexByModel.get(chunk.modelName)

    if (index === undefined) {
      throw new Error(
        `Backup inconsistente: modelo ${chunk.modelName} não foi registrado no arquivo`
      )
    }
    if (index < this.cursor) {
      throw new Error(
        `Backup inconsistente: modelo ${chunk.modelName} recebeu dados depois de ser fechado`
      )
    }

    this.closeEntriesBefore(index)
    await writeWithBackpressure(this.entries[index]!.stream, chunk.ndjson)
  }

  finish(): void {
    this.closeEntriesBefore(this.entries.length)
  }

  abort(error: Error): void {
    for (const entry of this.entries) {
      entry.stream.destroy(error)
    }
  }

  private closeEntriesBefore(index: number): void {
    while (this.cursor < index) {
      this.entries[this.cursor]!.stream.end()
      this.cursor += 1
    }
  }
}

export class BackofficeDatabaseBackupExportService
  implements IBackofficeDatabaseBackupExportService
{
  constructor(
    private readonly exportRepository: IBackofficeDatabaseBackupExportRepository = new BackofficeDatabaseBackupExportRepository()
  ) {}

  createArchive(): BackupArchive {
    const zip = new JSZip()
    const entries = this.exportRepository
      .listExportableModelNames()
      .map((modelName) => {
        const stream = new PassThrough({ highWaterMark: ENTRY_HIGH_WATER_MARK })
        // Sem um listener, o destroy(error) de um abort derrubaria o processo.
        stream.on("error", () => {})
        zip.file(`${modelName}.ndjson`, stream)
        return { modelName, stream }
      })

    const zipStream = zip.generateNodeStream({
      type: "nodebuffer",
      streamFiles: true,
      compression: "DEFLATE",
    })

    const hash = createHash("sha256")
    let sizeBytes = 0

    const body = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        sizeBytes += chunk.length
        callback(null, chunk)
      },
    })

    zipStream.on("error", (error: Error) => body.destroy(error))
    zipStream.pipe(body)

    // Registrado agora, e não dentro da promise abaixo, para que o body nunca
    // fique sem tratamento de erro entre a criação e o primeiro await.
    const bodyFinished = finished(body)
    bodyFinished.catch(() => {})

    const writer = new ArchiveEntryWriter(entries)

    const completion = (async (): Promise<BackupArchiveStats> => {
      let summary
      try {
        summary = await this.exportRepository.exportSnapshot((chunk) =>
          writer.write(chunk)
        )
        writer.finish()
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error))
        writer.abort(failure)
        throw failure
      }

      await bodyFinished

      return {
        sizeBytes,
        checksumSha256: hash.digest("hex"),
        modelCount: summary.modelCount,
        rowCount: summary.rowCount,
      }
    })()

    completion.catch(() => {})

    return {
      fileName: buildFileName(new Date()),
      body,
      completion,
      abort: (error: Error) => {
        writer.abort(error)
        body.destroy(error)
      },
    }
  }
}
