import { randomUUID } from "crypto"
import { NotificationType, Prisma, type PrismaClient } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma, getImportCronPrisma } from "@/app/api/infra/data/prisma"
import { emailContactRadarSyncOutboxRepository } from "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/EmailContactRadarSyncOutboxRepository"
import { EmailContactListService } from "@/app/api/services/EmailContactList/EmailContactListService"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import {
  downloadEmailImportPayload,
  uploadEmailImportPayload,
} from "@/lib/email/email-import-storage"
import { generateEmailImportId } from "@/lib/email/generate-import-id"
import {
  AUDIENCE_REASON_BLOCKLISTED,
  AUDIENCE_REASON_BOUNCED,
  evaluateEmailForAudience,
} from "@/lib/email/audience-prevalidation"
import {
  findTeamBlocklistedEmails,
  partitionByBlocklist,
} from "@/lib/email/email-contact-blocklist"
import { emailContactListRepository } from "@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository"
import {
  formatTransientTransactionErrorMessage,
  withTransientTransactionRetry,
} from "@/lib/prisma/retry-transient-transaction"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"

const DEFAULT_LIST_NAME = "Todos contatos"
const BATCH_SIZE = 500
const MAX_BATCH_ATTEMPTS = 3
const MAX_PROCESSING_MS = 45_000
const SKIPPED_ISSUES_PERSIST_LIMIT = 100
const STUCK_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000

type ImportRow = {
  line?: number
  email: string
  name?: string
  customFields?: Record<string, string>
}

type SkippedImportIssue = {
  line?: number
  email: string
  reason: string
}

type FailedBatchEntry = {
  batchIndex: number
  attempts: number
  lastError: string
}

export class EmailContactImportUseCase {
  private contactListService = new EmailContactListService()

  constructor(private readonly db: PrismaClient = prisma) {}

  static forImportCron(): EmailContactImportUseCase {
    return new EmailContactImportUseCase(getImportCronPrisma())
  }

  private async reclaimStuckJobs(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - STUCK_PROCESSING_THRESHOLD_MS)
    const result = await this.db.emailImportJob.updateMany({
      where: { status: "processing", updatedAt: { lt: threshold } },
      data: { status: "pending" },
    })
    if (result.count > 0) {
      console.info(`[EmailContactImportUseCase][reclaimStuckJobs] ${result.count} job(s) devolvido(s) a pending`)
    }
    return result.count
  }

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
    const existingDefault = await this.db.emailContactList.findFirst({
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

    return this.db.emailContactList.create({
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
    const existingContacts = await this.db.emailContact.findMany({
      where: { listId, email: { in: emails } },
      select: { email: true },
    })
    const existingEmails = new Set(existingContacts.map((contact) => contact.email))

    const newRows = uniqueRows.filter((row) => !existingEmails.has(row.email))
    const updateRows = uniqueRows.filter((row) => existingEmails.has(row.email))

    let imported = 0
    if (newRows.length > 0) {
      const result = await this.db.emailContact.createMany({
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
          this.db.emailContact.update({
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

  /**
   * Três portas de descarte, nesta ordem: pré-validação de audiência, bounce e
   * blocklist do time. Roda antes do fan-out para a lista padrão, senão o
   * endereço descartado na lista alvo entraria por "Todos contatos".
   */
  private async validateRows(
    rows: ImportRow[],
    teamId: string
  ): Promise<{
    validRows: ImportRow[]
    skipped: number
    skippedIssues: SkippedImportIssue[]
  }> {
    const candidates: ImportRow[] = []
    const skippedIssues: SkippedImportIssue[] = []

    for (const row of rows) {
      const validation = evaluateEmailForAudience(row.email ?? "")
      if (!validation.ok) {
        skippedIssues.push({
          line: row.line,
          email: this.normalizeEmail(row.email ?? "") || "(vazio)",
          reason: validation.reason,
        })
        continue
      }
      candidates.push({
        line: row.line,
        email: validation.email,
        name: row.name?.trim() || undefined,
        customFields: row.customFields,
      })
    }

    const bouncedEmails = await emailContactListRepository.findBouncedEmails(
      candidates.map((row) => row.email)
    )
    const notBouncedRows: ImportRow[] = []
    for (const row of candidates) {
      if (bouncedEmails.has(row.email)) {
        skippedIssues.push({
          line: row.line,
          email: row.email,
          reason: AUDIENCE_REASON_BOUNCED,
        })
        continue
      }
      notBouncedRows.push(row)
    }

    const blocklistedEmails = await findTeamBlocklistedEmails(teamId)
    const { allowed: validRows, blocked } = partitionByBlocklist(
      notBouncedRows,
      blocklistedEmails
    )
    for (const row of blocked) {
      skippedIssues.push({
        line: row.line,
        email: row.email,
        reason: AUDIENCE_REASON_BLOCKLISTED,
      })
    }

    return {
      validRows,
      skipped: skippedIssues.length,
      skippedIssues: skippedIssues.slice(0, SKIPPED_ISSUES_PERSIST_LIMIT),
    }
  }

  private formatSkippedNotificationSuffix(skippedCount: number, issues: SkippedImportIssue[]): string {
    if (skippedCount <= 0) return ""
    const samples = issues.slice(0, 5).map((issue) => {
      const linePart = typeof issue.line === "number" ? `linha ${issue.line}: ` : ""
      return `${linePart}${issue.email} (${issue.reason})`
    })
    const remaining = skippedCount - samples.length
    const sampleText = samples.join("; ")
    const moreText = remaining > 0 ? `; e mais ${remaining}` : ""
    return ` Exemplos recusados: ${sampleText}${moreText}.`
  }

  private async createImportJob(params: {
    importId: string
    listId: string
    ctx: TeamContext
    sourceFormat: "csv" | "json"
    storagePath: string
    totalRows: number
  }): Promise<{ importId: string; jobId: string }> {
    const job = await this.db.emailImportJob.create({
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
      const existing = await this.db.emailContactList.findFirst({
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
      const existing = await this.db.emailContactList.findFirst({
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
      skippedIssues: Prisma.JsonValue | null
      failedBatches: Prisma.JsonValue | null
    },
    listIsSystemDefault: boolean,
    ctx: TeamContext,
    hasRadarFeature: boolean
  ): Promise<void> {
    const totalCount = await this.db.emailContact.count({ where: { listId: job.listId } })
    await this.db.emailContactList.update({
      where: { id: job.listId },
      data: { totalContacts: totalCount },
    })

    if (!listIsSystemDefault) {
      const defaultList = await this.ensureDefaultList(ctx)
      const defaultTotalCount = await this.db.emailContact.count({
        where: { listId: defaultList.id },
      })
      await this.db.emailContactList.update({
        where: { id: defaultList.id },
        data: { totalContacts: defaultTotalCount },
      })
    }

    const failedBatches = this.parseFailedBatches(job.failedBatches)
    const skippedIssues = Array.isArray(job.skippedIssues)
      ? (job.skippedIssues as SkippedImportIssue[])
      : []
    const status =
      failedBatches.length > 0 ? "completed_with_errors" : "completed"

    await this.db.emailImportJob.update({
      where: { id: job.id },
      data: { status },
    })

    const failedBatchCount = failedBatches.length
    const pendingRadarSync = hasRadarFeature
      ? await emailContactRadarSyncOutboxRepository.countPendingByImportJobId(job.id)
      : 0
    const radarSyncSuffix =
      pendingRadarSync > 0
        ? ` ${pendingRadarSync} contato(s) aguardando sincronização com o Radar.`
        : ""
    const message =
      `Importação concluída: ${job.importedCount} importados, ${job.skippedCount} recusados, ${job.updatedCount} atualizados, ${failedBatchCount} lote(s) com falha.` +
      this.formatSkippedNotificationSuffix(job.skippedCount, skippedIssues) +
      radarSyncSuffix

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
        skippedIssues,
        failedBatches: failedBatchCount,
        pendingRadarSync,
      },
    })

    console.info(`[EmailContactImport][${job.importId}] Concluído — ${message}`)
  }

  async processPendingJobs(): Promise<Output> {
    const startedAt = Date.now()

    try {
      await this.reclaimStuckJobs()

      const claimed = await withTransientTransactionRetry(
        () =>
          this.db.$transaction(async (tx) => {
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
          }),
        { label: "EmailContactImportUseCase.claimPendingJob" }
      )

      if (!claimed) {
        return new Output(true, ["Nenhum job pendente"], [], { processedJobs: 0 })
      }

      const list = await this.db.emailContactList.findFirst({
        where: { id: claimed.listId, teamId: claimed.teamId },
        select: { id: true, isSystemDefault: true },
      })
      if (!list) {
        await this.db.emailImportJob.update({
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
      const {
        validRows,
        skipped: initialSkipped,
        skippedIssues: initialSkippedIssues,
      } = await this.validateRows(allRows, claimed.teamId)

      let processedRows = claimed.processedRows
      let importedCount = claimed.importedCount
      let updatedCount = claimed.updatedCount
      // Validação é refeita no arquivo completo a cada claim — não somar de novo no resume.
      const skippedCount = initialSkipped
      const skippedIssues = initialSkippedIssues
      const failedBatches = this.parseFailedBatches(claimed.failedBatches)
      const attemptsByBatch = this.parseAttemptsByBatch(claimed.attemptsByBatch)

      const totalBatches = Math.ceil(validRows.length / BATCH_SIZE) || 0
      let batchIndex = Math.floor(processedRows / BATCH_SIZE)
      const hasRadarFeature = await teamHasRadarFeature(claimed.teamId)

      while (batchIndex < totalBatches) {
        if (Date.now() - startedAt > MAX_PROCESSING_MS) {
          await this.db.emailImportJob.update({
            where: { id: claimed.id },
            data: {
              status: "pending",
              processedRows,
              importedCount,
              updatedCount,
              skippedCount,
              skippedIssues: skippedIssues as unknown as Prisma.InputJsonValue,
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

          if (hasRadarFeature) {
            const batchContacts = await this.db.emailContact.findMany({
              where: { listId: claimed.listId, email: { in: batch.map((row) => row.email) } },
              select: { id: true },
            })

            if (batchContacts.length > 0) {
              await emailContactRadarSyncOutboxRepository.upsertPendingForContacts(
                batchContacts.map((batchContact) => ({
                  emailContactId: batchContact.id,
                  teamId: claimed.teamId,
                  emailImportJobId: claimed.id,
                }))
              )
            }
          }

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

        await this.db.emailImportJob.update({
          where: { id: claimed.id },
          data: {
            processedRows,
            importedCount,
            updatedCount,
            skippedCount,
            skippedIssues: skippedIssues as unknown as Prisma.InputJsonValue,
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
          skippedIssues: skippedIssues as unknown as Prisma.JsonValue,
          failedBatches: failedBatches as unknown as Prisma.JsonValue,
        },
        list.isSystemDefault,
        ctx,
        hasRadarFeature
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
      return new Output(
        false,
        [],
        [formatTransientTransactionErrorMessage(error)],
        null
      )
    }
  }
}
