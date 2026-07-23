import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

class ProcessWhatsAppContactSyncJobsUseCase {
  async execute(limit = 4): Promise<Output> {
    const workerId = `cron-${crypto.randomUUID()}`
    const targets = await whatsAppRepository.listConnectedContactSyncTargets()
    await Promise.all(
      targets
        .filter((target) => isWhatsAppV3Enabled("sync", target.teamId))
        .map((target) => whatsAppRepository.enqueueContactSyncJob(target))
    )
    let processed = 0
    let failed = 0
    for (let index = 0; index < limit; index += 1) {
      const job = await whatsAppRepository.claimNextContactSyncJob(workerId)
      if (!job) break
      if (!isWhatsAppV3Enabled("sync", job.teamId)) break
      try {
        await whatsAppService.syncContacts(job.teamId)
        await whatsAppRepository.completeContactSyncJob({ jobId: job.id })
        processed += 1
      } catch (error) {
        await whatsAppRepository.completeContactSyncJob({
          jobId: job.id,
          error: error instanceof Error ? error.message : "Falha no sync de contatos",
        })
        failed += 1
      }
    }
    return new Output(true, ["Jobs de contatos processados"], [], { processed, failed })
  }
}

export const processWhatsAppContactSyncJobsUseCase = new ProcessWhatsAppContactSyncJobsUseCase()
