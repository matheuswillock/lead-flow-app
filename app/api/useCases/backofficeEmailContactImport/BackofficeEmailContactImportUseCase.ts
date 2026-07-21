import { BackofficeEmailImportJobStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import {
  backofficeEmailImportJobRepository,
  type BackofficeEmailImportJobRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailImportJob/BackofficeEmailImportJobRepository"
import {
  backofficeEmailContactRepository,
  type BackofficeEmailContactRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContact/BackofficeEmailContactRepository"
import {
  backofficeEmailContactListRepository,
  type BackofficeEmailContactListRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContactList/BackofficeEmailContactListRepository"
import {
  backofficeEmailContactImportService,
  type BackofficeEmailContactImportService,
} from "@/app/api/services/backofficeEmailCampaign/BackofficeEmailContactImportService"
import type { IBackofficeEmailContactImportUseCase } from "./IBackofficeEmailContactImportUseCase"

const BATCH_SIZE = 5

export class BackofficeEmailContactImportUseCase implements IBackofficeEmailContactImportUseCase {
  constructor(
    private readonly importJobRepository: BackofficeEmailImportJobRepository = backofficeEmailImportJobRepository,
    private readonly contactRepository: BackofficeEmailContactRepository = backofficeEmailContactRepository,
    private readonly listRepository: BackofficeEmailContactListRepository = backofficeEmailContactListRepository,
    private readonly importService: BackofficeEmailContactImportService = backofficeEmailContactImportService
  ) {}

  async processPendingJobs(): Promise<Output> {
    const jobs = await this.importJobRepository.findPendingBatch(BATCH_SIZE)
    let processed = 0

    for (const job of jobs) {
      const claimed = await this.importJobRepository.markProcessing(job.id)
      if (!claimed) continue

      try {
        const parsed =
          claimed.sourceFormat === "csv"
            ? this.importService.parseCsv(claimed.rawContent)
            : this.importService.parseJson(claimed.rawContent)

        let importedCount = 0
        for (const row of parsed.rows) {
          await this.contactRepository.upsertActive({
            listId: claimed.listId,
            email: row.email,
            name: row.name ?? null,
            customFields: row.customFields ?? null,
          })
          importedCount += 1
        }

        if (importedCount > 0) {
          await this.listRepository.recountTotalContacts(claimed.listId)
        }

        await this.importJobRepository.updateResult(claimed.id, {
          status: BackofficeEmailImportJobStatus.completed,
          totalRows: parsed.rows.length + parsed.skippedCount,
          processedRows: parsed.rows.length + parsed.skippedCount,
          importedCount,
          skippedCount: parsed.skippedCount,
          errorCount: 0,
        })
        processed += 1
      } catch (error) {
        console.error("[BackofficeEmailContactImportUseCase][processPendingJobs]", error)
        await this.importJobRepository.updateResult(claimed.id, {
          status: BackofficeEmailImportJobStatus.failed,
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
        })
      }
    }

    return new Output(true, [], [], { processed, total: jobs.length })
  }
}

export const backofficeEmailContactImportUseCase = new BackofficeEmailContactImportUseCase()
