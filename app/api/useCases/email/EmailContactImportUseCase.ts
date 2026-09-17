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
  AUDIENCE_REASON_NO_MX,
  evaluateEmailForAudience,
  splitAudienceEmailParts,
} from "@/lib/email/audience-prevalidation"
import { DomainMailDnsCache } from "@/lib/email/domain-mx-check"
import {
  addToImportValidationCounts,
  classifyImportSkipReason,
  computeImportRiskLevel,
  countRemovalsRelevantForRisk,
  formatImportVerdictSummary,
  IMPORT_RISK_LEVEL_LABELS,
  mergeImportValidationCounts,
  pickVolatileImportValidationCounts,
  type EmailImportRiskLevelValue,
  type ImportValidationCounts,
} from "@/lib/email/import-validation-verdict"
import { withConcurrencyLimit } from "@/lib/async/with-concurrency-limit"
import {
  BLOCK_REASON_IMPORT,
  blockTeamEmailsBulk,
  findBlocklistedEmailsAmong,
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

/** Lookups DoH simultâneos por lote — acima disso os resolvers começam a atrasar o job. */
const MAIL_DNS_LOOKUP_CONCURRENCY = 8
/**
 * Orçamento de DNS por LOTE. Estourou (resolvers lentos/fora), o restante do
 * lote passa sem veredito — fail-open: indisponibilidade de resolver não pode
 * recusar contato nem estourar o `maxDuration` do cron.
 */
const MAIL_DNS_BATCH_BUDGET_MS = 20_000

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

  /** Import para a blocklist: só recusa linha sem e-mail; o resto vira bloqueio. */
  private collectRowsWithEmail(rows: ImportRow[]): {
    validRows: ImportRow[]
    skipped: number
    skippedIssues: SkippedImportIssue[]
  } {
    const validRows: ImportRow[] = []
    const skippedIssues: SkippedImportIssue[] = []
    const seen = new Set<string>()

    for (const row of rows) {
      const email = this.normalizeEmail(row.email ?? "")
      if (!email) {
        skippedIssues.push({ line: row.line, email: "(vazio)", reason: "E-mail ausente na linha" })
        continue
      }
      if (seen.has(email)) continue
      seen.add(email)
      validRows.push({ line: row.line, email, name: row.name?.trim() || undefined })
    }

    return {
      validRows,
      skipped: skippedIssues.length,
      skippedIssues: skippedIssues.slice(0, SKIPPED_ISSUES_PERSIST_LIMIT),
    }
  }

  /** Lote de lista comum: grava, enfileira Radar e replica na lista padrão. */
  private async importContactsBatch(params: {
    listId: string
    teamId: string
    importJobId: string
    batch: ImportRow[]
    hasRadarFeature: boolean
    fanOutToDefaultList: boolean
    ctx: TeamContext
  }): Promise<{ imported: number; updated: number }> {
    const batchResult = await this.upsertContactsBatch(params.listId, params.batch)

    if (params.hasRadarFeature) {
      const batchContacts = await this.db.emailContact.findMany({
        where: {
          listId: params.listId,
          email: { in: params.batch.map((row) => row.email) },
        },
        select: { id: true },
      })

      if (batchContacts.length > 0) {
        await emailContactRadarSyncOutboxRepository.upsertPendingForContacts(
          batchContacts.map((batchContact) => ({
            emailContactId: batchContact.id,
            teamId: params.teamId,
            emailImportJobId: params.importJobId,
          }))
        )
      }
    }

    if (params.fanOutToDefaultList) {
      const defaultList = await this.ensureDefaultList(params.ctx)
      await this.upsertContactsBatch(defaultList.id, params.batch)
    }

    return batchResult
  }

  /**
   * O lote inteiro vira bloqueio numa transação só. Uma transação por linha
   * estourava o `maxDuration = 60` do cron antes do primeiro checkpoint.
   */
  private async blockContactsBatch(
    teamId: string,
    createdBy: string,
    batch: ImportRow[]
  ): Promise<number> {
    const result = await this.db.$transaction(async (tx) =>
      blockTeamEmailsBulk(tx, {
        teamId,
        createdBy,
        contacts: batch.map((row) => ({ email: row.email, name: row.name ?? null })),
        reason: BLOCK_REASON_IMPORT,
      })
    )
    return result.blockedCount
  }

  /**
   * Porta de descarte ESTÁVEL: pré-validação de audiência, que é pura — mesmo
   * arquivo, mesmo resultado, em qualquer claim.
   *
   * Essa estabilidade é requisito, não detalhe. `processedRows` é um offset
   * POSICIONAL sobre a lista devolvida aqui (`batchIndex = processedRows /
   * BATCH_SIZE`). Se a lista pudesse encolher entre claims, todo o sufixo
   * deslocaria para a esquerda e a linha no offset nunca seria gravada nem
   * reportada como recusada — some em silêncio.
   *
   * Por isso bounce e blocklist NÃO entram aqui: são estado mutável (a
   * blocklist é escrita em runtime pelo descadastro, endpoint público, e
   * imports grandes rodam justamente durante disparo de campanha). Esses dois
   * são aplicados por lote em `partitionBatchBySuppression`.
   */
  private collectAudienceValidRows(rows: ImportRow[]): {
    validRows: ImportRow[]
    skipped: number
    skippedIssues: SkippedImportIssue[]
  } {
    const validRows: ImportRow[] = []
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
      validRows.push({
        line: row.line,
        email: validation.email,
        name: row.name?.trim() || undefined,
        customFields: row.customFields,
      })
    }

    return { validRows, skipped: skippedIssues.length, skippedIssues }
  }

  /**
   * Portas de descarte VOLÁTEIS: bounce e blocklist do time. Aplicadas por lote,
   * imediatamente antes da escrita, e por isso enxergam bloqueios feitos DURANTE
   * o import — comportamento desejável, e que a filtragem antecipada não tinha.
   *
   * Roda antes do fan-out para a lista padrão, senão o endereço descartado na
   * lista alvo entraria por "Todos contatos".
   */
  private async partitionBatchBySuppression(
    batch: ImportRow[],
    teamId: string,
    mailDnsCache: DomainMailDnsCache
  ): Promise<{ allowed: ImportRow[]; skippedIssues: SkippedImportIssue[] }> {
    if (batch.length === 0) return { allowed: [], skippedIssues: [] }

    const skippedIssues: SkippedImportIssue[] = []

    const bouncedEmails = await emailContactListRepository.findBouncedEmails(
      batch.map((row) => row.email)
    )
    const notBouncedRows: ImportRow[] = []
    for (const row of batch) {
      if (bouncedEmails.has(row.email)) {
        skippedIssues.push({ line: row.line, email: row.email, reason: AUDIENCE_REASON_BOUNCED })
        continue
      }
      notBouncedRows.push(row)
    }

    // Escopado aos endereços DESTE lote: a versão sem predicado traz a blocklist
    // inteira do time, e rodando uma vez por lote custaria O(lotes × blocklist).
    const blocklistedEmails = await findBlocklistedEmailsAmong(
      teamId,
      notBouncedRows.map((row) => row.email)
    )
    const { allowed, blocked } = partitionByBlocklist(notBouncedRows, blocklistedEmails)
    for (const row of blocked) {
      skippedIssues.push({
        line: row.line,
        email: row.email,
        reason: AUDIENCE_REASON_BLOCKLISTED,
      })
    }

    // MX/DNS por último — só nos sobreviventes, poupando lookup de quem já
    // caiu por bounce/blocklist. É porta VOLÁTIL de propósito: DNS é estado
    // externo e resolver pode falhar; a porta estável precisa continuar pura
    // (offset posicional entre claims).
    const mailDns = await this.partitionBatchByMailDns(allowed, mailDnsCache)
    skippedIssues.push(...mailDns.skippedIssues)

    return { allowed: mailDns.allowed, skippedIssues }
  }

  /**
   * Rejeita domínio SEM servidor de e-mail (nem MX, nem A — bounce garantido).
   * `unknown` (resolver indisponível/orçamento estourado) passa: fail-open.
   */
  private async partitionBatchByMailDns(
    rows: ImportRow[],
    mailDnsCache: DomainMailDnsCache
  ): Promise<{ allowed: ImportRow[]; skippedIssues: SkippedImportIssue[] }> {
    if (rows.length === 0) return { allowed: [], skippedIssues: [] }

    const domains = [
      ...new Set(
        rows
          .map((row) => splitAudienceEmailParts(row.email).domain)
          .filter((domain) => domain.length > 0)
      ),
    ]

    const deadline = Date.now() + MAIL_DNS_BATCH_BUDGET_MS
    const verdictByDomain = new Map<string, Awaited<ReturnType<DomainMailDnsCache["resolve"]>>>()
    await withConcurrencyLimit(domains, MAIL_DNS_LOOKUP_CONCURRENCY, async (domain) => {
      if (Date.now() > deadline) {
        verdictByDomain.set(domain, "unknown")
        return
      }
      verdictByDomain.set(domain, await mailDnsCache.resolve(domain))
    })

    const allowed: ImportRow[] = []
    const skippedIssues: SkippedImportIssue[] = []
    for (const row of rows) {
      const domain = splitAudienceEmailParts(row.email).domain
      if (verdictByDomain.get(domain) === "undeliverable") {
        skippedIssues.push({ line: row.line, email: row.email, reason: AUDIENCE_REASON_NO_MX })
        continue
      }
      allowed.push(row)
    }

    return { allowed, skippedIssues }
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

      let parsed: ReturnType<EmailContactListService["parseCsvWithIssues"]>
      try {
        parsed = this.contactListService.parseCsvWithIssues(csvContent)
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : "Erro ao processar CSV"
        return new Output(false, [], [message], null)
      }

      if (parsed.contacts.length === 0) {
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
        // Linhas de DADOS do arquivo (com e sem e-mail): o denominador do
        // veredito de risco e a barra de progresso partem do arquivo real,
        // não do que sobrou depois do parser.
        totalRows: parsed.contacts.length + parsed.issues.length,
      })

      return new Output(true, ["Importação enfileirada"], [], { importId: job.importId })
    } catch (error) {
      console.error("[EmailContactImportUseCase][enqueueCsvImport]", error)
      return new Output(false, [], ["Erro ao enfileirar importação do CSV"], null)
    }
  }

  /**
   * Linha inválida do CSV NÃO é mais descartada em silêncio: o parser devolve
   * cada linha sem e-mail como issue (com a linha REAL do arquivo), e linhas
   * com e-mail sintaticamente inválido seguem no fluxo para o gate estável
   * classificar e reportar — as duas acabam em `skippedIssues` como as demais.
   */
  private async parseStoredRows(
    sourceFormat: string,
    storagePath: string
  ): Promise<{ rows: ImportRow[]; parserIssues: SkippedImportIssue[] }> {
    const raw = await downloadEmailImportPayload(storagePath)

    if (sourceFormat === "csv") {
      const parsed = this.contactListService.parseCsvWithIssues(raw)
      return {
        rows: parsed.contacts.map((row) => ({
          line: row.line,
          email: row.email,
          name: row.name,
          customFields: row.customFields,
        })),
        parserIssues: parsed.issues.map((issue) => ({
          line: issue.line,
          email: issue.email,
          reason: issue.reason,
        })),
      }
    }

    const parsed = JSON.parse(raw) as { rows?: ImportRow[] }
    return { rows: parsed.rows ?? [], parserIssues: [] }
  }

  private parseFailedBatches(value: Prisma.JsonValue | null): FailedBatchEntry[] {
    if (!value || !Array.isArray(value)) return []
    return value as FailedBatchEntry[]
  }

  private parseAttemptsByBatch(value: Prisma.JsonValue | null): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return value as Record<string, number>
  }

  private parseSkippedIssues(value: Prisma.JsonValue | null): SkippedImportIssue[] {
    if (!value || !Array.isArray(value)) return []
    return (value as SkippedImportIssue[]).filter(
      (issue) => issue && typeof issue.email === "string" && typeof issue.reason === "string"
    )
  }

  /** Une amostras preservando a ordem e sem repetir o par (e-mail, motivo). */
  private mergeSkippedIssues(...groups: SkippedImportIssue[][]): SkippedImportIssue[] {
    const byKey = new Map<string, SkippedImportIssue>()
    for (const group of groups) {
      for (const issue of group) {
        const key = `${this.normalizeEmail(issue.email)}|${issue.reason}`
        if (!byKey.has(key)) byKey.set(key, issue)
      }
    }
    return [...byKey.values()]
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
    hasRadarFeature: boolean,
    verdict: {
      counts: ImportValidationCounts
      riskLevel: EmailImportRiskLevelValue
      listName: string
    } | null = null
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
      data: {
        status,
        ...(verdict
          ? {
              validationCounts: verdict.counts as Prisma.InputJsonValue,
              riskLevel: verdict.riskLevel,
            }
          : {}),
      },
    })

    // Quarentena: risco ALTO tira a lista de circulação — ela não entra em
    // audiência de campanha até liberação explícita (manager/owner) no
    // relatório de importação.
    let quarantined = false
    if (verdict?.riskLevel === "high") {
      const quarantineReason = `Importação ${job.importId} com risco ALTO — ${formatImportVerdictSummary(verdict.counts)}.`
      await emailContactListRepository.quarantineList({
        listId: job.listId,
        reason: quarantineReason,
        now: new Date(),
      })
      quarantined = true
      console.info(
        `[EmailContactImport][${job.importId}] Lista ${job.listId} quarentenada — risco ALTO`
      )
    }

    const failedBatchCount = failedBatches.length
    const pendingRadarSync = hasRadarFeature
      ? await emailContactRadarSyncOutboxRepository.countPendingByImportJobId(job.id)
      : 0
    const radarSyncSuffix =
      pendingRadarSync > 0
        ? ` ${pendingRadarSync} contato(s) aguardando sincronização com o Radar.`
        : ""
    const verdictSuffix = verdict
      ? ` Veredito: ${formatImportVerdictSummary(verdict.counts)} · risco ${IMPORT_RISK_LEVEL_LABELS[verdict.riskLevel]}.`
      : ""
    const quarantineSuffix = quarantined
      ? ` A lista "${verdict?.listName ?? ""}" foi colocada em quarentena e não entra em campanhas até liberação explícita.`
      : ""
    const message =
      `Importação concluída: ${job.importedCount} importados, ${job.skippedCount} recusados, ${job.updatedCount} atualizados, ${failedBatchCount} lote(s) com falha.` +
      verdictSuffix +
      quarantineSuffix +
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
        ...(verdict
          ? {
              validationCounts: verdict.counts,
              riskLevel: verdict.riskLevel,
              quarantined,
            }
          : {}),
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
        select: { id: true, name: true, isSystemDefault: true, isBlocklist: true },
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

      const { rows: allRows, parserIssues } = await this.parseStoredRows(
        claimed.sourceFormat,
        claimed.storagePath
      )
      // Import cujo destino é a blocklist não passa pelas portas de descarte:
      // typo de domínio, provedor morto e bounce anterior são exatamente o que
      // se quer bloquear. Só linhas sem e-mail são recusadas.
      const gate = list.isBlocklist
        ? this.collectRowsWithEmail(allRows)
        : this.collectAudienceValidRows(allRows)
      const { validRows } = gate
      // As issues do parser (linha sem e-mail no CSV) são tão estáveis quanto
      // as da pré-validação: derivam só do arquivo. Entram na parcela ATRIBUÍDA.
      const initialSkipped = gate.skipped + parserIssues.length
      const initialSkippedIssues = [...parserIssues, ...gate.skippedIssues]

      // Veredito por categoria — só para import de audiência (blocklist não
      // tem risco: bloquear lixo é o objetivo, não um sintoma).
      // Estáveis: recomputadas do arquivo a cada claim (atribuídas).
      // Voláteis: recuperadas do JSON persistido e acumuladas por lote.
      const stableCounts: ImportValidationCounts = {}
      const volatileCounts: ImportValidationCounts = list.isBlocklist
        ? {}
        : pickVolatileImportValidationCounts(claimed.validationCounts)
      const totalDataRows = allRows.length + parserIssues.length
      if (!list.isBlocklist) {
        for (const issue of initialSkippedIssues) {
          addToImportValidationCounts(stableCounts, classifyImportSkipReason(issue.reason))
        }
        // Duplicados no arquivo: contam no veredito (não somam audiência) mas
        // NÃO viram skippedIssues — o upsert continua tratando como update.
        const uniqueValidEmails = new Set(validRows.map((row) => row.email))
        addToImportValidationCounts(
          stableCounts,
          "duplicate",
          validRows.length - uniqueValidEmails.size
        )
      }
      const buildVerdictCounts = (): ImportValidationCounts | null =>
        list.isBlocklist ? null : mergeImportValidationCounts(stableCounts, volatileCounts)

      // Cache DoH por domínio para a vida DESTE claim do job.
      const mailDnsCache = new DomainMailDnsCache()

      let processedRows = claimed.processedRows
      let importedCount = claimed.importedCount
      let updatedCount = claimed.updatedCount

      // `initialSkipped` é estável: vem só da pré-validação, que é pura sobre o
      // mesmo arquivo. Por isso é ATRIBUÍDO a cada claim, não somado.
      //
      // Os recusados por bounce/blocklist são descobertos lote a lote e
      // precisam sobreviver ao resume. Não há coluna própria para eles, então
      // são derivados: o que o job já tinha em `skippedCount` menos a parcela
      // estável. Como a parcela estável é idêntica em todo claim, a subtração
      // devolve exatamente o volátil acumulado até aqui.
      let suppressedSkippedCount = Math.max(0, claimed.skippedCount - initialSkipped)
      // Parte das amostras persistidas: as recusas voláteis de claims anteriores
      // não são recomputáveis (o lote já passou), e descartá-las fazia a
      // notificação de conclusão perder justamente os exemplos que explicam o
      // contador. As estáveis são reconciliadas por chave para não duplicar.
      const skippedIssues = this.mergeSkippedIssues(
        this.parseSkippedIssues(claimed.skippedIssues),
        initialSkippedIssues
      )
      const failedBatches = this.parseFailedBatches(claimed.failedBatches)
      const attemptsByBatch = this.parseAttemptsByBatch(claimed.attemptsByBatch)

      const totalBatches = Math.ceil(validRows.length / BATCH_SIZE) || 0
      let batchIndex = Math.floor(processedRows / BATCH_SIZE)
      const hasRadarFeature = await teamHasRadarFeature(claimed.teamId)

      while (batchIndex < totalBatches) {
        if (Date.now() - startedAt > MAX_PROCESSING_MS) {
          const timeoutVerdictCounts = buildVerdictCounts()
          await this.db.emailImportJob.update({
            where: { id: claimed.id },
            data: {
              status: "pending",
              processedRows,
              importedCount,
              updatedCount,
              skippedCount: initialSkipped + suppressedSkippedCount,
              skippedIssues: skippedIssues.slice(
                0,
                SKIPPED_ISSUES_PERSIST_LIMIT
              ) as unknown as Prisma.InputJsonValue,
              failedBatches: failedBatches as unknown as Prisma.InputJsonValue,
              attemptsByBatch: attemptsByBatch as unknown as Prisma.InputJsonValue,
              ...(timeoutVerdictCounts
                ? { validationCounts: timeoutVerdictCounts as Prisma.InputJsonValue }
                : {}),
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

        // Recusas do lote ficam em stage: só entram no acumulado quando o lote
        // AVANÇA — por sucesso ou por esgotar as tentativas. Contabilizar antes
        // da escrita repetia a mesma recusa a cada retry; contabilizar só no
        // sucesso perdia as recusas do lote que morre no retry, cujo
        // `processedRows` avança do mesmo jeito no catch.
        let stagedSkipped: SkippedImportIssue[] = []
        const commitStagedSkipped = () => {
          if (stagedSkipped.length === 0) return
          suppressedSkippedCount += stagedSkipped.length
          skippedIssues.push(...stagedSkipped)
          for (const issue of stagedSkipped) {
            addToImportValidationCounts(volatileCounts, classifyImportSkipReason(issue.reason))
          }
          stagedSkipped = []
        }

        try {
          // Nenhum ramo pode sair do laço por `continue`: o checkpoint de
          // progresso está depois do try/catch, e pulá-lo deixa
          // processedRows/importedCount parados — um job interrompido reprocessa
          // lotes já concluídos.
          if (list.isBlocklist) {
            const blocked = await this.blockContactsBatch(
              claimed.teamId,
              claimed.requestedBy,
              batch
            )
            importedCount += blocked
            processedRows += batch.length
            console.info(
              `[EmailContactImport][${claimed.importId}] Lote ${batchIndex + 1}/${totalBatches} — ${blocked} bloqueio(s) — sucesso`
            )
          } else {
            // Bounce e blocklist são checados AQUI, não na montagem de
            // `validRows`: mantém os índices estáveis entre claims e ainda
            // enxerga bloqueios feitos durante o import.
            const { allowed, skippedIssues: batchSkipped } =
              await this.partitionBatchBySuppression(batch, claimed.teamId, mailDnsCache)
            stagedSkipped = batchSkipped

            const batchResult = await this.importContactsBatch({
              listId: claimed.listId,
              teamId: claimed.teamId,
              importJobId: claimed.id,
              batch: allowed,
              hasRadarFeature,
              fanOutToDefaultList: !list.isSystemDefault,
              ctx,
            })
            commitStagedSkipped()
            importedCount += batchResult.imported
            updatedCount += batchResult.updated
            // Avança pelo tamanho do LOTE, não pelo dos permitidos: o offset
            // indexa `validRows`, que não muda.
            processedRows += batch.length
            console.info(
              `[EmailContactImport][${claimed.importId}] Lote ${batchIndex + 1}/${totalBatches} — ${allowed.length} contatos, ${batchSkipped.length} recusado(s) — sucesso`
            )
          }

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
            // O lote avança em definitivo aqui; as recusas já apuradas nele não
            // serão reapuradas por ninguém.
            commitStagedSkipped()
            processedRows += batch.length
            batchIndex += 1
          }
        }

        const checkpointVerdictCounts = buildVerdictCounts()
        await this.db.emailImportJob.update({
          where: { id: claimed.id },
          data: {
            processedRows,
            importedCount,
            updatedCount,
            skippedCount: initialSkipped + suppressedSkippedCount,
            skippedIssues: skippedIssues.slice(
              0,
              SKIPPED_ISSUES_PERSIST_LIMIT
            ) as unknown as Prisma.InputJsonValue,
            failedBatches: failedBatches as unknown as Prisma.InputJsonValue,
            attemptsByBatch: attemptsByBatch as unknown as Prisma.InputJsonValue,
            ...(checkpointVerdictCounts
              ? { validationCounts: checkpointVerdictCounts as Prisma.InputJsonValue }
              : {}),
          },
        })
      }

      const skippedCount = initialSkipped + suppressedSkippedCount

      const finalVerdictCounts = buildVerdictCounts()
      const verdict = finalVerdictCounts
        ? {
            counts: finalVerdictCounts,
            riskLevel: computeImportRiskLevel({
              removedCount: countRemovalsRelevantForRisk(finalVerdictCounts),
              totalRows: totalDataRows,
            }),
            listName: list.name,
          }
        : null

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
          skippedIssues: skippedIssues.slice(
            0,
            SKIPPED_ISSUES_PERSIST_LIMIT
          ) as unknown as Prisma.JsonValue,
          failedBatches: failedBatches as unknown as Prisma.JsonValue,
        },
        list.isSystemDefault,
        ctx,
        hasRadarFeature,
        verdict
      )

      return new Output(true, ["Job processado"], [], {
        importId: claimed.importId,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        failedBatches: failedBatches.length,
        ...(verdict
          ? { riskLevel: verdict.riskLevel, validationCounts: verdict.counts }
          : {}),
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
