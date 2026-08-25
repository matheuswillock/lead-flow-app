import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackupChunkWriter,
  BackupSnapshotSummary,
  IBackofficeDatabaseBackupExportRepository,
} from "./IBackofficeDatabaseBackupExportRepository"

/**
 * Mantido em 10.000 de propósito. A paginação por `skip` custa O(n²) — o
 * Postgres varre e descarta `skip` linhas a cada página — então diminuir a
 * página multiplica o custo de leitura, justamente o recurso escasso deste job
 * (`maxDuration = 300`). O consumo de memória não depende daqui: quem limita é
 * `CHUNK_FLUSH_BYTES`, e apenas uma página fica viva por vez.
 */
const PAGE_SIZE = 10_000

/**
 * Teto de bytes acumulados antes de entregar um pedaço ao consumidor.
 *
 * É o que garante o invariante central deste arquivo: o maior string vivo é
 * `CHUNK_FLUSH_BYTES` + um registro, nunca a tabela inteira. Sem esse teto o
 * export voltaria a montar uma string proporcional ao número de linhas e a
 * estourar o limite máximo de string do V8 (`Invalid string length`).
 */
const CHUNK_FLUSH_BYTES = 256 * 1024

/**
 * Teto por modelo, não pelo banco inteiro. Ver decisão sobre consistência abaixo.
 */
const MODEL_TRANSACTION_TIMEOUT_MS = 120_000
const MODEL_TRANSACTION_MAX_WAIT_MS = 15_000

const EXCLUDED_MODELS = new Set([
  // WhatsApp message history — alto volume, sem valor para DR
  "WhatsAppMessage", "WhatsAppMessageReaction", "WhatsAppMessageFavorite",
  "WhatsAppMessagePin", "WhatsAppMessageVisibility", "WhatsAppMessageActionCommand",
  "WhatsAppOutboundCommand", "WhatsAppWebhookEvent", "WhatsAppSyncJob",
  "WhatsAppAuditEvent", "WhatsAppUsageEvent", "WhatsAppAutoResponseLog",
  "WhatsAppSendRateLimitWindow",
  // Auth / sessões efêmeras
  "BackofficeBotAuthChallenge", "BackofficeBotSession",
  // Audit / notification logs
  "AuditLog", "BackofficeDeletionAuditLog", "Notification", "MeetingFollowUpDigestLog",
  // Logs de webhook e entrega de e-mail
  "BackofficeWebhookEvent", "BackofficeWebhookRequestLog",
  "BackofficeEmailDispatchEvent", "BackofficeEmailLog", "BackofficeEmailEvent", "BackofficeEmailOrphanEvent",
  "TeamStudioWebhookRequestLog", "TeamWebhookEventLog", "TeamWebhookOutbox",
  "AsaasWebhookEvent", "EmailLog", "EmailEvent", "EmailOrphanEvent",
  // Bot / AI run logs
  "TeamAutomationRunLog", "BackofficeBotEventOutbox", "BackofficeBotOutboundDelivery",
  "BackofficeBotAiInteraction", "BackofficeBotAiAttempt", "BackofficeBotAiDailyUsage",
  "BackofficeBotMessage",
  // Analytics / métricas
  "RadarEvent", "PublicFormMetricEvent", "EmailCreditUsage",
])

type PrismaModel = (typeof Prisma.dmmf.datamodel.models)[number]

type FindManyDelegate = {
  findMany: (args: {
    take: number
    skip: number
    orderBy: Record<string, "asc"> | Array<Record<string, "asc">>
  }) => Promise<unknown[]>
}

function orderByForModel(model: PrismaModel) {
  const idField = model.fields.find((f) => f.isId)?.name
  if (idField) return { [idField]: "asc" as const }

  const pkFields = model.primaryKey?.fields
  if (pkFields && pkFields.length > 0) {
    return pkFields.map((field) => ({ [field]: "asc" as const }))
  }

  return null
}

function isExportableModel(model: PrismaModel): boolean {
  const hasBytesField = model.fields.some((f) => f.type === "Bytes")
  return !hasBytesField && !EXCLUDED_MODELS.has(model.name)
}

function getExportableModels(): PrismaModel[] {
  return Prisma.dmmf.datamodel.models.filter(isExportableModel)
}

function serializeRow(row: unknown): string {
  return JSON.stringify(row, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  )
}

function delegateNameForModel(model: PrismaModel): string {
  return model.name.charAt(0).toLowerCase() + model.name.slice(1)
}

/**
 * Acumula linhas NDJSON até `CHUNK_FLUSH_BYTES` e entrega ao consumidor.
 * Uma linha por registro: o maior `JSON.stringify` executado é o de um único
 * registro, então o tamanho da string não depende do número de linhas da tabela.
 */
class NdjsonChunkBuffer {
  private lines: string[] = []
  private pendingBytes = 0

  constructor(
    private readonly modelName: string,
    private readonly writeChunk: BackupChunkWriter
  ) {}

  async add(row: unknown): Promise<void> {
    const line = serializeRow(row)
    this.lines.push(line)
    this.pendingBytes += line.length + 1

    if (this.pendingBytes >= CHUNK_FLUSH_BYTES) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.lines.length === 0) return

    const chunk = {
      modelName: this.modelName,
      ndjson: `${this.lines.join("\n")}\n`,
      rowCount: this.lines.length,
    }

    this.lines = []
    this.pendingBytes = 0

    await this.writeChunk(chunk)
  }
}

/**
 * Export incremental do banco em NDJSON.
 *
 * ## Decisão sobre consistência (mudança deliberada de garantia)
 *
 * A versão anterior lia o banco inteiro dentro de uma única transação
 * `RepeatableRead` de 280s, o que dava um snapshot consistente entre tabelas.
 * Essa transação estourou em produção (13–16/08/2026, 4 falhas seguidas:
 * "The timeout for this transaction was 280000 ms, however 280183 ms passed").
 * Como a rota tem `maxDuration = 300`, não existe orçamento para aumentar esse
 * teto — o snapshot global simplesmente não cabe no tempo da função.
 *
 * Passamos a usar **uma transação `RepeatableRead` por modelo**:
 *
 * - Mantido: todas as páginas de uma mesma tabela vêm do mesmo snapshot, que é
 *   o que torna a paginação por `skip`/`take` correta.
 * - Perdido: consistência referencial entre tabelas. Uma linha gravada na
 *   tabela B depois do snapshot da tabela A pode apontar para uma linha que o
 *   snapshot de A não contém.
 *
 * Consequência prática numa restauração: registros criados **durante** a janela
 * do backup podem aparecer com referências pendentes, então a carga precisa
 * tolerar FK adiada/desabilitada. Este export não é um ponto-no-tempo do banco.
 * Para snapshot realmente consistente, a ferramenta é `pg_dump`
 * (`deploy/hostinger/backup-supabase.sh`), não este job.
 */
export class BackofficeDatabaseBackupExportRepository
  implements IBackofficeDatabaseBackupExportRepository
{
  listExportableModelNames(): string[] {
    return getExportableModels().map((model) => model.name)
  }

  async exportSnapshot(
    writeChunk: BackupChunkWriter
  ): Promise<BackupSnapshotSummary> {
    const models = getExportableModels()
    let rowCount = 0

    for (const model of models) {
      rowCount += await this.exportModel(model, writeChunk)
    }

    return { modelCount: models.length, rowCount }
  }

  private async exportModel(
    model: PrismaModel,
    writeChunk: BackupChunkWriter
  ): Promise<number> {
    const orderBy = orderByForModel(model)
    if (!orderBy) {
      throw new Error(
        `Backup incompleto: modelo ${model.name} sem chave para paginação estável`
      )
    }

    const delegateName = delegateNameForModel(model)
    const buffer = new NdjsonChunkBuffer(model.name, writeChunk)

    return prisma.$transaction(
      async (tx) => {
        const delegate = (tx as unknown as Record<string, FindManyDelegate>)[
          delegateName
        ]

        let exportedRows = 0
        let skip = 0

        for (;;) {
          const page = await delegate.findMany({ take: PAGE_SIZE, skip, orderBy })

          for (const row of page) {
            await buffer.add(row)
          }

          exportedRows += page.length
          if (page.length < PAGE_SIZE) break
          skip += PAGE_SIZE
        }

        await buffer.flush()
        return exportedRows
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: MODEL_TRANSACTION_TIMEOUT_MS,
        maxWait: MODEL_TRANSACTION_MAX_WAIT_MS,
      }
    )
  }
}
