import { randomUUID } from "crypto"
import { NotificationType, Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { radarImportJobRepository } from "@/app/api/infra/data/repositories/radar/RadarImportJobRepository"
import { teamRadarFieldDefinitionRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarFieldDefinitionRepository"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { generateRadarImportId } from "@/lib/radar/generate-import-id"
import {
  downloadRadarImportPayload,
  uploadRadarImportPayload,
} from "@/lib/radar/radar-import-storage"
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"
import {
  formatTransientTransactionErrorMessage,
  withTransientTransactionRetry,
} from "@/lib/prisma/retry-transient-transaction"
import {
  inferRadarFieldValueType,
  isRadarNewFieldKey,
  profileDataKeyForImportField,
  RADAR_IMPORT_MAX_ROWS,
  RADAR_IMPORT_SOCIOS_PROFILE_DATA_KEY,
  slugifyRadarFieldKey,
} from "@/lib/radarImport/radarImportFields"
import type { ParsedRadarImportRow } from "@/lib/radarImport/parseRadarImportBuffer"
import {
  formatDisplayPhone,
  isValidRadarPrimaryIdentity,
  normalizeRadarDocument,
  normalizeRadarEmail,
  normalizeRadarName,
  normalizeRadarPhone,
} from "@/lib/radar/normalization"
import { buildGenderCandidateFromFieldRecord } from "@/lib/radar/email-contact-gender"
import {
  resolveGender,
  type GenderState,
  type RadarGender,
  type RadarGenderSource,
} from "@/lib/radar/gender"

const BATCH_SIZE = 500
const MAX_BATCH_ATTEMPTS = 3
const SKIPPED_ISSUES_PERSIST_LIMIT = 100
const RADAR_BULK_IMPORT_QUEUE_PUBLISH_FAILED_TAG = "radar_bulk_import_queue_publish_failed"

type RadarBulkImportPayload = {
  jobId: string
  batchIndex: number
}

type PublishRadarBulkImportBatch = (
  payload: RadarBulkImportPayload
) => Promise<{ messageId: string | null }>

async function defaultPublishBatch(
  payload: RadarBulkImportPayload
): Promise<{ messageId: string | null }> {
  const { publishRadarBulkImportBatch } = await import("@/lib/queues/radar-bulk-import")
  return publishRadarBulkImportBatch(payload)
}

export type RadarBaseImportDeps = {
  publishBatch?: PublishRadarBulkImportBatch
}
const PREVIEW_ROW_LIMIT = 5

type StoredImportPayload = {
  columns: string[]
  rows: ParsedRadarImportRow[]
  sourceFormat: string
}

type SkippedImportIssue = {
  line?: number
  reason: string
}

type FailedBatchEntry = {
  batchIndex: number
  attempts: number
  lastError: string
}

export class RadarBaseImportUseCase {
  constructor(private readonly deps: RadarBaseImportDeps = {}) {}

  private publishBatch(payload: RadarBulkImportPayload) {
    return (this.deps.publishBatch ?? defaultPublishBatch)(payload)
  }

  private parseStoredPayload(raw: string): StoredImportPayload {
    return JSON.parse(raw) as StoredImportPayload
  }

  private buildDedupeKey(params: {
    normalizedPhone: string
    normalizedName: string
    normalizedEmail: string
  }): string {
    if (params.normalizedPhone && params.normalizedName) {
      return `phone:${params.normalizedPhone}:${params.normalizedName}`
    }
    if (params.normalizedEmail) {
      return `email:${params.normalizedEmail}`
    }
    return ""
  }

  private extractMappedValues(
    row: ParsedRadarImportRow,
    fieldMapping: Record<string, string>
  ): Record<string, string> {
    const values: Record<string, string> = {}
    for (const [fieldKey, column] of Object.entries(fieldMapping)) {
      const value = row.values[column]
      if (value?.trim()) {
        values[fieldKey] = value.trim()
      }
    }
    return values
  }

  private mergeProfileData(
    existing: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {}
    return { ...base, ...patch } as Prisma.InputJsonValue
  }

  private buildProfileDataPatch(
    mappedValues: Record<string, string>,
    fieldMapping: Record<string, string>
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    for (const fieldKey of Object.keys(fieldMapping)) {
      if (
        fieldKey === "name" ||
        fieldKey === "phone" ||
        fieldKey === "email" ||
        fieldKey === "document" ||
        fieldKey === "gender" ||
        fieldKey === "socios"
      ) {
        continue
      }
      const value = mappedValues[fieldKey]
      if (!value) continue
      patch[profileDataKeyForImportField(fieldKey)] = value
    }
    if (mappedValues.socios) {
      patch[RADAR_IMPORT_SOCIOS_PROFILE_DATA_KEY] = mappedValues.socios
    }
    return patch
  }

  private async applyResolvedGender(
    profileId: string,
    teamId: string,
    current: GenderState,
    mappedValues: Record<string, string>
  ): Promise<void> {
    if (!mappedValues.gender && !mappedValues.socios) {
      return
    }

    const candidate = buildGenderCandidateFromFieldRecord({
      gender: mappedValues.gender,
      socios: mappedValues.socios,
    })
    if (!candidate) return

    const update = resolveGender(current, candidate)
    if (
      update &&
      (update.gender === "male" || update.gender === "female") &&
      (update.genderSource === "mapped" || update.genderSource === "inferred")
    ) {
      await radarRepository.updateProfileGender(
        profileId,
        teamId,
        update.gender,
        update.genderSource
      )
    }
  }

  private async upsertFieldDefinitions(
    teamId: string,
    profileId: string,
    fieldMapping: Record<string, string>,
    rows: ParsedRadarImportRow[],
    importJobId: string
  ): Promise<Record<string, string>> {
    const resolvedMapping = { ...fieldMapping }

    for (const [fieldKey, column] of Object.entries(fieldMapping)) {
      if (!isRadarNewFieldKey(fieldKey)) continue

      const slug = fieldKey.slice(4) || slugifyRadarFieldKey(column)
      const label = column
      const samples = rows
        .map((row) => row.values[column])
        .filter((value): value is string => Boolean(value?.trim()))
        .slice(0, 20)

      await teamRadarFieldDefinitionRepository.upsertDefinition({
        id: randomUUID(),
        teamId,
        key: slug,
        label,
        valueType: inferRadarFieldValueType(samples),
        createdBy: profileId,
        importJobId,
      })

      resolvedMapping[`new:${slug}`] = column
      delete resolvedMapping[fieldKey]
    }

    return resolvedMapping
  }

  private async processRow(
    teamId: string,
    importJobId: string,
    row: ParsedRadarImportRow,
    fieldMapping: Record<string, string>,
    seenKeys: Set<string>
  ): Promise<{ outcome: "created" | "enriched" | "skipped" | "deferred"; issue?: SkippedImportIssue }> {
    const mappedValues = this.extractMappedValues(row, fieldMapping)
    const rawName = mappedValues.name ?? ""
    const rawPhone = mappedValues.phone ?? ""
    const rawEmail = mappedValues.email ?? ""
    const rawDocument = mappedValues.document ?? ""

    const normalizedName = normalizeRadarName(rawName)
    const normalizedPhone = normalizeRadarPhone(rawPhone)
    const normalizedEmail = normalizeRadarEmail(rawEmail)
    const normalizedDocument = normalizeRadarDocument(rawDocument)

    const emailValidation = rawEmail ? evaluateEmailForAudience(rawEmail) : null
    const hasValidEmail = emailValidation?.ok === true
    const hasValidPhoneIdentity = isValidRadarPrimaryIdentity(rawPhone, rawName)

    const skippedEmailIssue =
      rawEmail && !hasValidEmail
        ? {
            line: row.line,
            reason:
              emailValidation && !emailValidation.ok ? emailValidation.reason : "E-mail inválido",
          }
        : undefined

    if (!hasValidPhoneIdentity && !hasValidEmail) {
      if (skippedEmailIssue) {
        return { outcome: "skipped", issue: skippedEmailIssue }
      }
      return {
        outcome: "deferred",
        issue: { line: row.line, reason: "Sem identidade válida (telefone+nome ou e-mail)" },
      }
    }

    const dedupeKey = this.buildDedupeKey({ normalizedPhone, normalizedName, normalizedEmail: hasValidEmail ? normalizedEmail : "" })
    if (dedupeKey && seenKeys.has(dedupeKey)) {
      return { outcome: "skipped", issue: { line: row.line, reason: "Duplicata na importação" } }
    }
    if (dedupeKey) seenKeys.add(dedupeKey)

    const profileDataPatch = this.buildProfileDataPatch(mappedValues, fieldMapping)
    const now = new Date()
    let profileId: string
    let wasExisting = false

    if (hasValidPhoneIdentity) {
      const email = hasValidEmail && emailValidation?.ok ? emailValidation.email : null
      const resolved = await radarRepository.resolveProfileForPhone({
        teamId,
        normalizedPhone,
        normalizedName,
        displayName: rawName.trim(),
        displayPhone: formatDisplayPhone(rawPhone),
        phoneValue: rawPhone,
        phoneSource: "base_import",
        primaryEmail: email,
        normalizedPrimaryEmail: email,
        primaryDocument: rawDocument || null,
        normalizedPrimaryDocument: normalizedDocument || null,
        lastSeenAt: now,
      })
      profileId = resolved.profile.id
      wasExisting = resolved.wasExisting
    } else {
      if (!emailValidation || !emailValidation.ok) {
        return {
          outcome: "skipped",
          issue: { line: row.line, reason: "E-mail inválido" },
        }
      }
      const validatedEmail = emailValidation.email
      const resolved = await radarRepository.resolveProfileForEmail({
        teamId,
        normalizedEmail: validatedEmail,
        emailValue: rawEmail.trim(),
        displayName: rawName.trim() || null,
        normalizedName: normalizedName || null,
        emailSource: "base_import",
        lastSeenAt: now,
      })
      profileId = resolved.profile.id
      wasExisting = resolved.wasExisting
    }

    if (normalizedDocument) {
      await radarRepository.upsertIdentity({
        profileId,
        teamId,
        type: "document",
        value: rawDocument,
        normalizedValue: normalizedDocument,
        source: "base_import",
      })
    }

    const existingProfile = await radarImportJobRepository.findProfileData(profileId, teamId)

    await this.applyResolvedGender(
      profileId,
      teamId,
      {
        gender: (existingProfile?.gender as RadarGender | null | undefined) ?? null,
        genderSource:
          (existingProfile?.genderSource as RadarGenderSource | null | undefined) ?? null,
      },
      mappedValues
    )

    await radarRepository.updateProfileData(
      profileId,
      teamId,
      this.mergeProfileData(existingProfile?.profileData, profileDataPatch)
    )

    await radarRepository.upsertSourceLink({
      profileId,
      teamId,
      sourceType: "base_import",
      sourceId: `${importJobId}:row:${row.line}`,
      sourceMetadata: { line: row.line },
    })

    await radarRepository.appendEventIfNew({
      profileId,
      teamId,
      eventType: "profile.imported",
      sourceType: "base_import",
      sourceId: `${importJobId}:${row.line}`,
      occurredAt: now,
      metadata: { importJobId },
    })

    return {
      outcome: wasExisting ? "enriched" : "created",
      issue: skippedEmailIssue,
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    ctx: TeamAccess
  ): Promise<Output> {
    try {
      const { parseRadarImportBuffer } = await import("@/lib/radarImport/parseRadarImportBuffer")
      const parsed = parseRadarImportBuffer(buffer, fileName)

      if (parsed.rows.length === 0) {
        return new Output(false, [], ["Nenhuma linha válida encontrada no arquivo"], null)
      }

      if (parsed.rows.length > RADAR_IMPORT_MAX_ROWS) {
        return new Output(
          false,
          [],
          [`O arquivo excede o limite de ${RADAR_IMPORT_MAX_ROWS} linhas`],
          null
        )
      }

      const importId = generateRadarImportId()
      const storagePath = await uploadRadarImportPayload(
        ctx.teamId,
        importId,
        JSON.stringify({
          columns: parsed.columns,
          rows: parsed.rows,
          sourceFormat: parsed.sourceFormat,
        })
      )

      return new Output(true, [], [], {
        importId,
        storagePath,
        columns: parsed.columns,
        previewRows: parsed.rows.slice(0, PREVIEW_ROW_LIMIT),
        totalRows: parsed.rows.length,
        sourceFormat: parsed.sourceFormat,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar arquivo"
      console.error("[RadarBaseImportUseCase][uploadFile]", error)
      return new Output(false, [], [message], null)
    }
  }

  async enqueueMappedImport(input: {
    importId: string
    storagePath: string
    baseName: string
    fieldMapping: Record<string, string>
    sourceFormat: string
    totalRows: number
    ctx: TeamAccess
  }): Promise<Output> {
    try {
      if (!input.baseName.trim()) {
        return new Output(false, [], ["Informe o nome da base"], null)
      }

      if (Object.keys(input.fieldMapping).length === 0) {
        return new Output(false, [], ["Mapeie ao menos um campo"], null)
      }

      const hasIdentityMapping = ["name", "phone", "email"].some((key) => input.fieldMapping[key])
      if (!hasIdentityMapping) {
        return new Output(false, [], ["Mapeie pelo menos nome, telefone ou e-mail"], null)
      }

      const raw = await downloadRadarImportPayload(input.storagePath)
      const payload = this.parseStoredPayload(raw)

      const jobId = randomUUID()

      // Create the job first so field definitions can reference it via FK
      await radarImportJobRepository.create({
        id: jobId,
        importId: input.importId,
        team: { connect: { id: input.ctx.teamId } },
        requester: { connect: { id: input.ctx.profileId } },
        baseName: input.baseName.trim(),
        sourceFormat: input.sourceFormat,
        storagePath: input.storagePath,
        fieldMapping: input.fieldMapping,
        status: "pending",
        totalRows: input.totalRows,
        batchSize: BATCH_SIZE,
        failedBatches: Prisma.JsonNull,
      })

      const resolvedFieldMapping = await this.upsertFieldDefinitions(
        input.ctx.teamId,
        input.ctx.profileId,
        input.fieldMapping,
        payload.rows,
        jobId
      )

      await radarImportJobRepository.updateJob(jobId, {
        fieldMapping: resolvedFieldMapping as unknown as Prisma.InputJsonValue,
      })

      return new Output(true, ["Importação enfileirada"], [], { importId: input.importId })
    } catch (error) {
      console.error("[RadarBaseImportUseCase][enqueueMappedImport]", error)
      return new Output(false, [], ["Erro ao enfileirar importação"], null)
    }
  }

  async getJobStatus(teamId: string, importId: string): Promise<Output> {
    const job = await radarImportJobRepository.findByImportId(teamId, importId)

    if (!job) {
      return new Output(false, [], ["Job de importação não encontrado"], null)
    }

    return new Output(true, [], [], job)
  }

  private parseFailedBatches(value: Prisma.JsonValue | null): FailedBatchEntry[] {
    if (!value || !Array.isArray(value)) return []
    return value as FailedBatchEntry[]
  }

  private async finalizeJob(job: {
    id: string
    importId: string
    teamId: string
    requestedBy: string
    createdCount: number
    enrichedCount: number
    skippedCount: number
    deferredCount: number
    skippedIssues: Prisma.JsonValue | null
    failedBatches: Prisma.JsonValue | null
  }): Promise<void> {
    const failedBatches = this.parseFailedBatches(job.failedBatches)
    const status = failedBatches.length > 0 ? "completed_with_errors" : "completed"

    await radarImportJobRepository.updateJob(job.id, { status })

    const { enqueueRadarProfileSync } = await import(
      "@/app/api/useCases/radar/enqueueRadarProfileSync"
    )
    await enqueueRadarProfileSync(
      { source: "bulk_import_finalize", teamId: job.teamId },
      {
        fallback: async () => {
          const { syncRadarProfileDataForTeamUseCase } = await import(
            "@/app/api/useCases/radar/SyncRadarProfileDataForTeamUseCase"
          )
          await syncRadarProfileDataForTeamUseCase.execute({ teamId: job.teamId })
        },
      }
    )

    const message =
      `Importação da base "${job.importId}" concluída: ${job.createdCount} criados, ${job.enrichedCount} enriquecidos, ${job.skippedCount} ignorados (não entram na base), ${job.deferredCount} adiados.`

    await notificationService.createSystemNotification({
      recipientProfileId: job.requestedBy,
      teamId: job.teamId,
      type: NotificationType.EMAIL_IMPORT_COMPLETED,
      message,
      metadata: {
        event: "RADAR_IMPORT_COMPLETED",
        importId: job.importId,
        created: job.createdCount,
        enriched: job.enrichedCount,
        skipped: job.skippedCount,
        deferred: job.deferredCount,
        failedBatches: failedBatches.length,
      },
    })

    console.info(`[RadarBaseImport][${job.importId}] Concluído — ${message}`)
  }

  async processPendingJobs(): Promise<Output> {
    try {
      const claimed = await withTransientTransactionRetry(
        () => radarImportJobRepository.claimPendingJob(),
        { label: "RadarBaseImportUseCase.claimPendingJob" }
      )

      if (!claimed) {
        return new Output(true, ["Nenhum job pendente"], [], { processedJobs: 0 })
      }

      const batchIndex = Math.floor(claimed.processedRows / BATCH_SIZE)
      const payload = { jobId: claimed.id, batchIndex }

      try {
        await this.publishBatch(payload)
      } catch (error) {
        console.error(
          `[RadarBaseImportUseCase][processPendingJobs] ${RADAR_BULK_IMPORT_QUEUE_PUBLISH_FAILED_TAG}`,
          error
        )
        return this.processClaimedBatch(payload)
      }

      return new Output(true, ["Lote enfileirado"], [], {
        importId: claimed.importId,
        jobId: claimed.id,
        batchIndex,
      })
    } catch (error) {
      console.error("[RadarBaseImportUseCase][processPendingJobs]", error)
      return new Output(
        false,
        [],
        [formatTransientTransactionErrorMessage(error)],
        null
      )
    }
  }

  async processClaimedBatch(
    input: RadarBulkImportPayload,
    options: { deliveryCount?: number } = {}
  ): Promise<Output> {
    const job = await radarImportJobRepository.findById(input.jobId)
    if (!job) {
      return new Output(false, [], ["Job de importação não encontrado"], null)
    }
    if (job.status === "completed" || job.status === "completed_with_errors" || job.status === "failed") {
      return new Output(true, ["Job já finalizado"], [], { jobId: job.id, skipped: true })
    }

    let stored: StoredImportPayload
    try {
      stored = this.parseStoredPayload(await downloadRadarImportPayload(job.storagePath))
    } catch (setupError) {
      console.error(`[RadarBaseImport][${job.importId}] Falha no setup do job`, setupError)
      await radarImportJobRepository.updateJob(job.id, { status: "failed" })
      return new Output(false, [], ["Falha ao carregar payload do job"], null)
    }

    const fieldMapping = job.fieldMapping as Record<string, string>
    const totalBatches = Math.ceil(stored.rows.length / BATCH_SIZE) || 0
    const batchIndex = input.batchIndex

    if (totalBatches === 0 || job.processedRows >= stored.rows.length) {
      await this.finalizeJob(job)
      return new Output(true, ["Job processado"], [], {
        importId: job.importId,
        created: job.createdCount,
        enriched: job.enrichedCount,
        skipped: job.skippedCount,
        deferred: job.deferredCount,
      })
    }

    if (batchIndex < 0 || batchIndex >= totalBatches) {
      return new Output(false, [], ["batchIndex inválido"], null)
    }

    const batchEnd = Math.min((batchIndex + 1) * BATCH_SIZE, stored.rows.length)
    if (job.processedRows >= batchEnd) {
      const nextIndex = Math.floor(job.processedRows / BATCH_SIZE)
      if (job.processedRows >= stored.rows.length) {
        await this.finalizeJob(job)
        return new Output(true, ["Job processado"], [], { importId: job.importId, replayed: true })
      }
      await this.publishNextOrRequeue(job.id, nextIndex)
      return new Output(true, ["Lote já processado"], [], {
        importId: job.importId,
        batchIndex,
        replayed: true,
      })
    }

    let processedRows = job.processedRows
    let createdCount = job.createdCount
    let enrichedCount = job.enrichedCount
    let skippedCount = job.skippedCount
    let deferredCount = job.deferredCount
    const skippedIssues: SkippedImportIssue[] = Array.isArray(job.skippedIssues)
      ? ([...job.skippedIssues] as SkippedImportIssue[])
      : []
    const failedBatches = this.parseFailedBatches(job.failedBatches)
    const seenKeys = new Set<string>()
    const batch = stored.rows.slice(batchIndex * BATCH_SIZE, batchEnd)
    const deliveryCount = Math.max(1, options.deliveryCount ?? 1)

    try {
      for (const row of batch) {
        const result = await this.processRow(
          job.teamId,
          job.id,
          row,
          fieldMapping,
          seenKeys
        )
        if (result.outcome === "created") createdCount += 1
        if (result.outcome === "enriched") enrichedCount += 1
        if (result.outcome === "skipped") {
          skippedCount += 1
        }
        if (result.outcome === "deferred") {
          deferredCount += 1
        }
        if (result.issue && skippedIssues.length < SKIPPED_ISSUES_PERSIST_LIMIT) {
          skippedIssues.push(result.issue)
        }
        processedRows += 1
      }

      console.info(
        `[RadarBaseImport][${job.importId}] Lote ${batchIndex + 1}/${totalBatches} — sucesso`
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Erro desconhecido"
      console.error(
        `[RadarBaseImport][${job.importId}] Lote ${batchIndex + 1}/${totalBatches} — falha, tentativa ${deliveryCount}/${MAX_BATCH_ATTEMPTS} — ${reason}`
      )
      if (deliveryCount < MAX_BATCH_ATTEMPTS) {
        throw error
      }
      failedBatches.push({ batchIndex, attempts: deliveryCount, lastError: reason })
      processedRows = batchEnd
    }

    await radarImportJobRepository.updateJob(job.id, {
      processedRows,
      createdCount,
      enrichedCount,
      skippedCount,
      deferredCount,
      skippedIssues: skippedIssues.slice(0, SKIPPED_ISSUES_PERSIST_LIMIT) as unknown as Prisma.InputJsonValue,
      failedBatches: failedBatches as unknown as Prisma.InputJsonValue,
    })

    if (processedRows >= stored.rows.length) {
      await this.finalizeJob({
        id: job.id,
        importId: job.importId,
        teamId: job.teamId,
        requestedBy: job.requestedBy,
        createdCount,
        enrichedCount,
        skippedCount,
        deferredCount,
        skippedIssues: skippedIssues as unknown as Prisma.JsonValue,
        failedBatches: failedBatches as unknown as Prisma.JsonValue,
      })
      return new Output(true, ["Job processado"], [], {
        importId: job.importId,
        created: createdCount,
        enriched: enrichedCount,
        skipped: skippedCount,
        deferred: deferredCount,
        failedBatches: failedBatches.length,
      })
    }

    await this.publishNextOrRequeue(job.id, batchIndex + 1)
    return new Output(true, ["Lote processado"], [], {
      importId: job.importId,
      batchIndex,
      processedRows,
    })
  }

  private async publishNextOrRequeue(jobId: string, batchIndex: number): Promise<void> {
    try {
      await this.publishBatch({ jobId, batchIndex })
    } catch (error) {
      console.error(
        `[RadarBaseImportUseCase][publishNextOrRequeue] ${RADAR_BULK_IMPORT_QUEUE_PUBLISH_FAILED_TAG}`,
        error
      )
      await radarImportJobRepository.updateJob(jobId, { status: "pending" })
    }
  }

}

export const radarBaseImportUseCase = new RadarBaseImportUseCase()
