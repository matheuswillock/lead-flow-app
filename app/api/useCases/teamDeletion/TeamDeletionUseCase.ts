import { Output } from "@/lib/output"
import type {
  ITeamDataExporter,
  ITeamDeleter,
  ITeamDeletionDetailsSource,
  ITeamDeletionJobStore,
  ITeamExportNotifier,
  ITeamExportStorage,
  NewTeamDeletionJob,
  TeamDeletionJobRecord,
} from "@/app/api/shared/teamDeletion/teamDeletionTypes"

/** O arquivo da exportação fica disponível por 7 dias e depois é apagado. */
export const EXPORT_VALIDITY_DAYS = 7
/** Tentativas de gerar o arquivo antes de desistir (e avisar). */
export const MAX_EXPORT_ATTEMPTS = 3
const STALE_PROCESSING_MINUTES = 15
const MAX_JOBS_PER_RUN = 2
/** Link de download gerado a cada clique: vale poucos minutos. */
const DOWNLOAD_URL_SECONDS = 300
const DAY_MS = 24 * 60 * 60 * 1000

export type RequestTeamDeletionInput = Pick<
  NewTeamDeletionJob,
  "teamId" | "requesterProfileId" | "requesterEmail" | "billingOwnerId"
> & { exportData: boolean }

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "erro desconhecido"
}

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "time"
  )
}

/**
 * Exclusão definitiva de time. Com exportação: o pedido entra numa fila, o arquivo é gerado em segundo
 * plano e SÓ DEPOIS de guardado o time é excluído. Qualquer falha antes disso mantém o time intacto.
 */
export class TeamDeletionUseCase {
  constructor(
    private readonly jobs: ITeamDeletionJobStore,
    private readonly storage: ITeamExportStorage,
    private readonly exporter: ITeamDataExporter,
    private readonly deleter: ITeamDeleter,
    private readonly notifier: ITeamExportNotifier,
    private readonly details: ITeamDeletionDetailsSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async requestDeletion(input: RequestTeamDeletionInput): Promise<Output> {
    try {
      if (!input.exportData) {
        const counts = await this.deleter.deleteNow({
          teamId: input.teamId,
          actorProfileId: input.requesterProfileId,
          billingOwnerId: input.billingOwnerId,
        })
        return new Output(true, ["Time deletado com sucesso"], [], { mode: "deleted", teamId: input.teamId, ...counts })
      }

      const { requesterName, teamName } = await this.details.findDetails(input.requesterProfileId, input.teamId)
      const job = await this.jobs.create({
        teamId: input.teamId,
        teamName,
        requesterProfileId: input.requesterProfileId,
        requesterEmail: input.requesterEmail,
        requesterName,
        billingOwnerId: input.billingOwnerId,
      })
      return new Output(
        true,
        ["Exportação iniciada. O time será excluído quando o arquivo ficar pronto e você receberá um aviso."],
        [],
        { mode: "export_queued", jobId: job.id, teamId: input.teamId },
      )
    } catch (error) {
      console.error("[TeamDeletionUseCase][requestDeletion]", { message: describeError(error) })
      return new Output(false, [], ["Erro interno ao deletar time"], null)
    }
  }

  /** Processa os pedidos pendentes (cron). Devolve à fila os que ficaram presos. */
  async processPending(): Promise<{ processed: number }> {
    await this.jobs.reclaimStale(new Date(this.now().getTime() - STALE_PROCESSING_MINUTES * 60 * 1000))
    let processed = 0
    while (processed < MAX_JOBS_PER_RUN) {
      const job = await this.jobs.claimNext()
      if (!job) break
      await this.processJob(job)
      processed += 1
    }
    return { processed }
  }

  async processJob(job: TeamDeletionJobRecord): Promise<void> {
    const generatedAt = this.now()
    const filePath = `exports/${job.id}.zip`
    let counts: Record<string, number>
    let size: number

    try {
      const built = await this.exporter.buildZip({ teamId: job.teamId, teamName: job.teamName, generatedAt })
      counts = built.counts
      size = built.zip.byteLength
      await this.storage.upload(filePath, built.zip)
    } catch (error) {
      await this.handleExportFailure(job, describeError(error))
      return
    }

    try {
      const deleted = await this.deleter.deleteNow({
        teamId: job.teamId,
        actorProfileId: job.requesterProfileId,
        billingOwnerId: job.billingOwnerId,
      })
      counts = { ...counts, deletedLeads: deleted.leads, deletedMembers: deleted.members }
    } catch (error) {
      await this.removeQuietly(filePath)
      const reason = `A exportação ficou pronta, mas não foi possível excluir o time: ${describeError(error)}`
      await this.jobs.markFailed(job.id, reason)
      await this.notifyFailedQuietly(job, reason)
      return
    }

    const expiresAt = new Date(this.now().getTime() + EXPORT_VALIDITY_DAYS * DAY_MS)
    await this.jobs.markReady(job.id, { filePath, fileSizeBytes: size, expiresAt, counts })
    try {
      await this.notifier.notifyReady(job, { expiresAt })
    } catch (error) {
      console.error("[TeamDeletionUseCase][processJob] falha ao avisar que a exportação está pronta", {
        jobId: job.id,
        message: describeError(error),
      })
    }
  }

  /** Download pela pessoa logada: resolve o perfil e entrega um link curto, só se o pedido for dela. */
  async createDownloadUrlForUser(input: { jobId: string; supabaseId: string }): Promise<Output> {
    const profileId = await this.details.findProfileIdBySupabaseId(input.supabaseId)
    if (!profileId) return new Output(false, [], ["Exportação não encontrada"], { code: "not_found" })
    return this.createDownloadUrl({ jobId: input.jobId, requesterProfileId: profileId })
  }

  async createDownloadUrl(input: { jobId: string; requesterProfileId: string }): Promise<Output> {
    const job = await this.jobs.findById(input.jobId)
    // Mesma resposta para "não existe" e "não é seu": não revela pedidos de outras contas.
    if (!job || job.requesterProfileId !== input.requesterProfileId) {
      return new Output(false, [], ["Exportação não encontrada"], { code: "not_found" })
    }
    if (job.status === "purged") {
      return new Output(false, [], ["O prazo para baixar este arquivo terminou"], { code: "expired" })
    }
    if (job.status !== "ready" || !job.filePath) {
      return new Output(false, [], ["O arquivo ainda não está disponível"], { code: "not_ready" })
    }
    const now = this.now()
    if (!job.expiresAt || job.expiresAt.getTime() <= now.getTime()) {
      return new Output(false, [], ["O prazo para baixar este arquivo terminou"], { code: "expired" })
    }

    const fileName = `exportacao-${slug(job.teamName)}-${now.toISOString().slice(0, 10)}.zip`
    const url = await this.storage.createSignedUrl(job.filePath, DOWNLOAD_URL_SECONDS, fileName)
    await this.jobs.registerDownload(job.id, input.requesterProfileId, now)
    return new Output(true, [], [], { url, fileName })
  }

  /** Apaga o arquivo dos pedidos cujo prazo venceu. Se algum falhar, tenta de novo na próxima execução. */
  async purgeExpired(): Promise<{ purged: number }> {
    const now = this.now()
    const expired = await this.jobs.listExpired(now)
    let purged = 0
    for (const job of expired) {
      try {
        if (job.filePath) await this.storage.remove(job.filePath)
        await this.jobs.markPurged(job.id, now)
        purged += 1
      } catch (error) {
        console.error("[TeamDeletionUseCase][purgeExpired]", { jobId: job.id, message: describeError(error) })
      }
    }
    return { purged }
  }

  private async handleExportFailure(job: TeamDeletionJobRecord, reason: string): Promise<void> {
    console.error("[TeamDeletionUseCase][processJob] falha ao gerar a exportação", {
      jobId: job.id,
      attempts: job.attempts,
      reason,
    })
    if (job.attempts < MAX_EXPORT_ATTEMPTS) {
      await this.jobs.requeue(job.id, reason)
      return
    }
    const finalReason = `Não foi possível gerar o arquivo da exportação. O time não foi excluído. (${reason})`
    await this.jobs.markFailed(job.id, finalReason)
    await this.notifyFailedQuietly(job, finalReason)
  }

  private async removeQuietly(path: string): Promise<void> {
    try {
      await this.storage.remove(path)
    } catch (error) {
      console.error("[TeamDeletionUseCase] falha ao remover arquivo", { path, message: describeError(error) })
    }
  }

  private async notifyFailedQuietly(job: TeamDeletionJobRecord, reason: string): Promise<void> {
    try {
      await this.notifier.notifyFailed(job, reason)
    } catch (error) {
      console.error("[TeamDeletionUseCase] falha ao avisar a falha da exportação", {
        jobId: job.id,
        message: describeError(error),
      })
    }
  }
}
