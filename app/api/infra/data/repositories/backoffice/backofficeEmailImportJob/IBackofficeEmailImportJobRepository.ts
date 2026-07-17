import type {
  BackofficeEmailImportJob,
  BackofficeEmailImportJobStatus,
  BackofficeEmailImportSourceFormat,
} from "@prisma/client"

export interface CreateBackofficeEmailImportJobInput {
  listId: string
  sourceFormat: BackofficeEmailImportSourceFormat
  rawContent: string
  createdByBackofficeUserId: string
}

export interface UpdateBackofficeEmailImportJobResultInput {
  status: BackofficeEmailImportJobStatus
  totalRows?: number
  processedRows?: number
  importedCount?: number
  skippedCount?: number
  errorCount?: number
  errorMessage?: string | null
}

export interface IBackofficeEmailImportJobRepository {
  create(data: CreateBackofficeEmailImportJobInput): Promise<BackofficeEmailImportJob>
  findPendingBatch(limit: number): Promise<BackofficeEmailImportJob[]>
  findById(id: string): Promise<BackofficeEmailImportJob | null>
  markProcessing(id: string): Promise<BackofficeEmailImportJob | null>
  updateResult(
    id: string,
    data: UpdateBackofficeEmailImportJobResultInput
  ): Promise<BackofficeEmailImportJob>
}
