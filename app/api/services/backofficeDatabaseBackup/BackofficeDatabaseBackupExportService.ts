import { createHash } from "node:crypto"
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

/**
 * Escreve respeitando contrapressão e falhando rápido se o fluxo morreu.
 *
 * `destroy(error)` — o que `abort()` faz quando o upload ao Drive falha — não
 * libera nenhuma das duas vias normais de conclusão de um write pendente, e por
 * isso a Promise precisa escutar "error"/"close" nos **dois** ramos:
 *
 * - Quando `write` devolve `false`, só "drain" resolveria, e `destroy` não emite
 *   "drain".
 * - Quando `write` devolve `true`, só o callback resolveria — mas num Transform
 *   (`PassThrough`) o lado writable aceita o pedaço enquanto o lado readable já
 *   está cheio, e aí o `_write` guarda o callback em `Transform[kCallback]` para
 *   chamar quando o consumidor voltar a ler. `destroy` **não** invoca esse
 *   callback guardado (medido em Node v22.23.2, o mesmo runtime da Vercel).
 *
 * O segundo caso é o que acontece de fato aqui: com o JSZip parado por
 * contrapressão do corpo, o primeiro write logo após um "drain" volta `true` e
 * fica órfão. Sem isto a Promise nunca resolvia, o cron de backup só morria no
 * teto de `maxDuration` e nem gravava `failed` nem alertava.
 *
 * Os listeners são removidos no settle para não vazar em export de milhares de
 * chunks.
 */
async function writeWithBackpressure(
  stream: PassThrough,
  text: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let done = false
    const onDrain = () => settle(null)
    const onError = (error: Error) => settle(error)
    const onClose = () =>
      settle(new Error("Fluxo do backup foi encerrado antes de drenar a escrita"))

    function settle(error: Error | null): void {
      if (done) return
      done = true
      stream.off("drain", onDrain)
      stream.off("error", onError)
      stream.off("close", onClose)
      if (error) reject(error)
      else resolve()
    }

    stream.once("error", onError)
    stream.once("close", onClose)

    const flushed = stream.write(text, (error) => {
      if (error) settle(error)
      else if (flushed) settle(null)
    })

    if (!done && !flushed) {
      stream.once("drain", onDrain)
    }
  })
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
  private abortReason: Error | null = null
  private readonly indexByModel: Map<string, number>

  constructor(private readonly entries: ArchiveEntry[]) {
    this.indexByModel = new Map(
      entries.map((entry, index) => [entry.modelName, index])
    )
  }

  async write(chunk: BackupModelChunk): Promise<void> {
    // Sem isto o produtor veria só "stream was destroyed" e o motivo real do
    // aborto (falha de upload, por exemplo) se perderia.
    if (this.abortReason) throw this.abortReason

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
    this.abortReason ??= error
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

    // Derruba o arquivo inteiro, sem depender de o JSZip já ter começado a ler
    // as entradas. É o que garante que um export interrompido nunca chegue ao
    // destino como um ZIP truncado porém válido.
    const abortArchive = (error: Error) => {
      writer.abort(error)
      body.destroy(error)
    }

    const completion = (async (): Promise<BackupArchiveStats> => {
      let summary
      try {
        summary = await this.exportRepository.exportSnapshot((chunk) =>
          writer.write(chunk)
        )
        writer.finish()
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error))
        abortArchive(failure)
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
      abort: abortArchive,
    }
  }
}
