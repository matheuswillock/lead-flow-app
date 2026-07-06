import { randomUUID } from "crypto"
import { NotificationType, Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailContactListService } from "@/app/api/services/EmailContactList/EmailContactListService"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import {
  downloadEmailImportPayload,
  uploadEmailImportPayload,
} from "@/lib/email/email-import-storage"
import { generateEmailImportId } from "@/lib/email/generate-import-id"

const DEFAULT_LIST_NAME = "Todos contatos"
const BATCH_SIZE = 500
const MAX_BATCH_ATTEMPTS = 3
const MAX_PROCESSING_MS = 45_000

type ImportRow = {
  line?: number
  email: string
  name?: string
  customFields?: Record<string, string>
}

type FailedBatchEntry = {
  batchIndex: number
  attempts: number
  lastError: string
}

export class EmailContactImportUseCase {
  private contactListService = new EmailContactListService()

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private dedupeRowsByEmail<T extends { email: string }>(rows: T[]): T[] {
    const byEmail = new Map<string, T>()
    for (const row of rows) {
      byEmail.set(row.email, row)
    }
    return Array.from(byEmail.values())
  }

  private async ensureDefaultList(ctx: TeamContext): Promise<{ id: string }> {
    const existingDefault = await prisma.emailContactList.findFirst({
      where: {
        teamId: ctx.teamId,
        isArchived: false,
        isSystemDefault: true,
      },
      select: { id: true },
    })

    if (existingDefault) {
      return existingDefault
    }

    return prisma.emailContactList.create({
      data: {
        id: randomUUID(),
        teamId: ctx.teamId,
        createdBy: ctx.profileId,
        name: DEFAULT_LIST_NAME,
        isSystemDefault: true,
      },
      select: { id: true },
    })
  }

  private async upsertContactsBatch(
    listId: string,
    rows: ImportRow[]
  ): Promise<{ imported: number; updated: number }> {
    if (rows.length === 0) {
      return { imported: 0, updated: 0 }
    }

    const uniqueRows = this.dedupeRowsByEmail(rows)
    const emails = uniqueRows.map((row) => row.email)
    const existingContacts = await prisma.emailContact.findMany({
      where: { listId, email: { in: emails } },
      select: { email: true },
    })
    const existingEmails = new Set(existingContacts.map((contact) => contact.email))

    const newRows = uniqueRows.filter((row) => !existingEmails.has(row.email))
    const updateRows = uniqueRows.filter((row) => existingEmails.has(row.email))

    let imported = 0
    if (newRows.length > 0) {
      const result = await prisma.emailContact.createMany({
        data: newRows.map((row) => ({
          id: randomUUID(),
          listId,
          email: row.email,
          name: row.name ?? null,
          customFields: (row.customFields as object) ?? null,
        })),
        skipDuplicates: true,
      })
      imported = result.count
    }

    if (updateRows.length > 0) {
      await Promise.all(
        updateRows.map((row) =>
          prisma.emailContact.update({
            where: { listId_email: { listId, email: row.email } },
            data: {
              name: row.name ?? null,
              customFields: (row.customFields as object) ?? null,
            },
          })
        )
      )
    }

    return { imported, updated: updateRows.length }
  }

  private validateRows(rows: ImportRow[]): {
    validRows: ImportRow[]
    skipped: number
  } {
    let skipped = 0
    const validRows: ImportRow[] = []

    for (const row of rows) {
      const normalizedEmail = this.normalizeEmail(row.email ?? "")
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        skipped += 1
        continue
      }
      validRows.push({
        line: row.line,
        email: normalizedEmail,
        name: row.name?.trim() || undefined,
        customFields: row.customFields,
      })
    }

    return { validRows, skipped }
  }

  private async createImportJob(params: {
    importId: string
    listId: string
    ctx: TeamContext
    sourceFormat: "csv" | "json"
    storagePath: string
    totalRows: number
  }): Promise<{ importId: string; jobId: string }> {
    const job = await prisma.emailImportJob.create({
      data: {
        id: randomUUID(),
        importId: params.importId,
        teamId: params.ctx.teamId,
        listId: params.listId,
        requestedBy: params.ctx.profileId,
        sourceFormat: params.sourceFormat,
        storagePath: params.storagePath,
        status: "pending",
        totalRows: params.totalRows,
        batchSize: BATCH_SIZE,
        failedBatches: Prisma.JsonNull,
        attemptsByBatch: Prisma.JsonNull,
      },
      select: { id: true, importId: true },
    })
    return { importId: job.importId, jobId: job.id }
  }

  async enqueueMappedImport(
    listId: string,
    rows: ImportRow[],
    ctx: TeamContext
  ): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id: listId, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      if (rows.length === 0) {
        return new Output(false, [], ["Nenhum contato enviado para importar"], null)
      }

      const importId = generateEmailImportId()
      const storagePath = await uploadEmailImportPayload(
        ctx.teamId,
        importId,
        JSON.stringify({ rows }),
        "json"
      )

      const job = await this.createImportJob({
        importId,
        listId,
        ctx,
        sourceFormat: "json",
        storagePath,
        totalRows: rows.length,
      })

      return new Output(true, ["Importação enfileirada"], [], { importId: job.importId })
    } catch (error) {
      console.error("[EmailContactImportUseCase][enqueueMappedImport]", error)
      return new Output(false, [], ["Erro ao enfileirar importação"], null)
    }
  }

  async enqueueCsvImport(
    listId: string,
    csvContent: string,
    ctx: TeamContext
  ): Promise<Output> {
    try {
      const existing = await prisma.emailContactList.findFirst({
        where: { id: listId, teamId: ctx.teamId, isArchived: false },
      })

      if (!existing) {
        return new Output(false, [], ["Lista não encontrada"], null)
      }

      let contacts: ReturnType<EmailContactListService["parseCsv"]>
      try {
        contacts = this.contactListService.parseCsv(csvContent)
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : "Erro ao processar CSV"
        return new Output(false, [], [message], null)
      }

      if (contacts.length === 0) {
        return new Output(false, [], ["Nenhum contato válido encontrado no CSV"], null)
      }

      const importId = generateEmailImportId()
      const storagePath = await uploadEmailImportPayload(
        ctx.teamId,
        importId,
        csvContent,
        "csv"
      )

      const job = await this.createImportJob({
        importId,
        listId,
        ctx,
        sourceFormat: "csv",
        storagePath,
        totalRows: contacts.length,
      })

      return new Output(true, ["Importação enfileirada"], [], { importId: job.importId })
    } catch (error) {
      console.error("[EmailContactImportUseCase][enqueueCsvImport]", error)
      return new Output(false, [], ["Erro ao enfileirar importação do CSV"], null)
    }
  }

  private async parseStoredRows(
    sourceFormat: string,
    storagePath: string
  ): Promise<ImportRow[]> {
    const raw = await downloadEmailImportPayload(storagePath)

    if (sourceFormat === "csv") {
      return this.contactListService.parseCsv(raw).map((row, index) => ({
        line: index + 1,
        email: row.email,
        name: row.name,
        customFields: row.customFields as Record<string, string> | undefined,
      }))
    }

    const parsed = JSON.parse(raw) as { rows?: ImportRow[] }
    return parsed.rows ?? []
  }

  private parseFailedBatches(value: Prisma.JsonValue | null): FailedBatchEntry[] {
    if (!value || !Array.isArray(value)) return []
    return value as FailedBatchEntry[]
  }

  private parseAttemptsByBatch(value: Prisma.JsonValue | null): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return value as Record<string, number>
  }

  private async finalizeJob(
    job: {
      id: string
      importId: string
      teamId: string
      listId: string
      requestedBy: string
      importedCount: number
      updatedCount: number
      skippedCount: number
      failedBatches: Prisma.JsonValue | null
    },
    listIsSystemDefault: boolean,
    ctx: TeamContext
  ): Promise<void> {
    const totalCount = await prisma.emailContact.count({ where: { listId: job.listId } })
    await prisma.emailContactList.update({
      where: { id: job.listId },
      data: { totalContacts: totalCount },
    })

    if (!listIsSystemDefault) {
      const defaultList = await this.ensureDefaultList(ctx)
      const defaultTotalCount = await prisma.emailContact.count({
        where: { listId: defaultList.id },
      })
      await prisma.emailContactList.update({
        where: { id: defaultList.id },
        data: { totalContacts: defaultTotalCount },
      })
    }

    const failedBatches = this.parseFailedBatches(job.failedBatches)
    const status =
      failedBatches.length > 0 ? "completed_with_errors" : "completed"

    await prisma.emailImportJob.update({
      where: { id: job.id },
      data: { status },
    })

    const failedBatchCount = failedBatches.length
    const message = `Importação concluída: ${job.importedCount} importados, ${job.skippedCount} ignorados, ${job.updatedCount} atualizados, ${failedBatchCount} lote(s) com falha`

    await notificationService.createSystemNotification({
      recipientProfileId: job.requestedBy,
      teamId: job.teamId,
      type: NotificationType.EMAIL_IMPORT_COMPLETED,
      message,
      metadata: {
        event: "EMAIL_IMPORT_COMPLETED",
        importId: job.importId,
        listId: job.listId,
        imported: job.importedCount,
        updated: job.updatedCount,
        skipped: job.skippedCount,
        failedBatches: failedBatchCount,
      },
    })

    console.info(`[EmailContactImport][${job.importId}] Concluído — ${message}`)
  }

  async processPendingJobs(): Promise<Output> {
    const startedAt = Date.now()

    try {
      const claimed = await prisma.$transaction(async (tx) => {
        const pending = await tx.emailImportJob.findFirst({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
        })
        if (!pending) return null

        const updated = await tx.emailImportJob.updateMany({
          where: { id: pending.id, status: "pending" },
          data: { status: "processing" },
        })
        if (updated.count !== 1) return null
        return pending
      })

      if (!claimed) {
        return new Output(true, ["Nenhum job pendente"], [], { processedJobs: 0 })
      }

      const list = await prisma.emailContactList.findFirst({
        where: { id: claimed.listId, teamId: claimed.teamId },
        select: { id: true, isSystemDefault: true },
      })
      if (!list) {
        await prisma.emailImportJob.update({
          where: { id: claimed.id },
          data: { status: "failed" },
        })
        return new Output(false, [], ["Lista do job não encontrada"], null)
      }

      const ctx = {
        profileId: claimed.requestedBy,
        teamId: claimed.teamId,
      } as TeamContext

      const allRows = await this.parseStoredRows(claimed.sourceFormat, claimed.storagePath)
      const { validRows, skipped: initialSkipped } = this.validateRows(allRows)

      let processedRows = claimed.processedRows
      let importedCount = claimed.importedCount
      let updatedCount = claimed.updatedCount
      const skippedCount = claimed.skippedCount + initialSkipped
      const failedBatches = this.parseFailedBatches(claimed.failedBatches)
      const attemptsByBatch = this.parseAttemptsByBatch(claimed.attemptsByBatch)

      const totalBatches = Math.ceil(validRows.length / BATCH_SIZE) || 0
      let batchIndex = Math.floor(processedRows / BATCH_SIZE)

      while (batchIndex < totalBatches) {
        if (Date.now() - startedAt > MAX_PROCESSING_MS) {
          await prisma.emailImportJob.update({
            where: { id: claimed.id },
            data: {
              status: "pending",
              processedRows,
              importedCount,
              updatedCount,
              skippedCount,
              failedBatches: failedBatches as unknown as Prisma.InputJsonValue,
              attemptsByBatch: attemptsByBatch as unknown as Prisma.InputJsonValue,
            },
          })
          console.info(
            `[EmailContactImport][${claimed.importId}] Tempo esgotado no lote ${batchIndex + 1}/${totalBatches} — re-enfileirado`
          )
          return new Output(true, ["Job re-enfileirado por tempo"], [], {
            importId: claimed.importId,
            resumedAtBatch: batchIndex + 1,
          })
        }

        const batchKey = String(batchIndex)
        const currentAttempts = attemptsByBatch[batchKey] ?? 0
        const batch = validRows.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE)

        try {
          const batchResult = await this.upsertContactsBatch(claimed.listId, batch)
          importedCount += batchResult.imported
          updatedCount += batchResult.updated
          processedRows += batch.length

          if (!list.isSystemDefault) {
            const defaultList = await this.ensureDefaultList(ctx)
            await this.upsertContactsBatch(defaultList.id, batch)
          }

          console.info(
            `[EmailContactImport][${claimed.importId}] Lote ${batchIndex + 1}/${totalBatches} — ${batch.length} contatos — sucesso`
          )

          batchIndex += 1
        } catch (error) {
          const nextAttempt = currentAttempts + 1
          attemptsByBatch[batchKey] = nextAttempt
          const reason = error instanceof Error ? error.message : "Erro desconhecido"

          console.error(
            `[EmailContactImport][${claimed.importId}] Lote ${batchIndex + 1}/${totalBatches} — falha, tentativa ${nextAttempt}/${MAX_BATCH_ATTEMPTS} — ${reason}`
          )

          if (nextAttempt >= MAX_BATCH_ATTEMPTS) {
            failedBatches.push({
              batchIndex,
              attempts: nextAttempt,
              lastError: reason,
            })
            processedRows += batch.length
            batchIndex += 1
          }
        }

        await prisma.emailImportJob.update({
          where: { id: claimed.id },
          data: {
            processedRows,
            importedCount,
            updatedCount,
            skippedCount,
            failedBatches: failedBatches as unknown as Prisma.InputJsonValue,
            attemptsByBatch: attemptsByBatch as unknown as Prisma.InputJsonValue,
          },
        })
      }

      await this.finalizeJob(
        {
          id: claimed.id,
          importId: claimed.importId,
          teamId: claimed.teamId,
          listId: claimed.listId,
          requestedBy: claimed.requestedBy,
          importedCount,
          updatedCount,
          skippedCount,
          failedBatches: failedBatches as unknown as Prisma.JsonValue,
        },
        list.isSystemDefault,
        ctx
      )

      return new Output(true, ["Job processado"], [], {
        importId: claimed.importId,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        failedBatches: failedBatches.length,
      })
    } catch (error) {
      console.error("[EmailContactImportUseCase][processPendingJobs]", error)
      return new Output(false, [], ["Erro ao processar jobs de importação"], null)
    }
  }
}
