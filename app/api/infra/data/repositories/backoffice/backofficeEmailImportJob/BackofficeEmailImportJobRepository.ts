import { BackofficeEmailImportJobStatus, type BackofficeEmailImportJob } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeEmailImportJobInput,
  IBackofficeEmailImportJobRepository,
  UpdateBackofficeEmailImportJobResultInput,
} from "./IBackofficeEmailImportJobRepository"

export class BackofficeEmailImportJobRepository implements IBackofficeEmailImportJobRepository {
  async create(data: CreateBackofficeEmailImportJobInput): Promise<BackofficeEmailImportJob> {
    return prisma.backofficeEmailImportJob.create({
      data: {
        listId: data.listId,
        sourceFormat: data.sourceFormat,
        rawContent: data.rawContent,
        createdByBackofficeUserId: data.createdByBackofficeUserId,
      },
    })
  }

  async findPendingBatch(limit: number): Promise<BackofficeEmailImportJob[]> {
    return prisma.backofficeEmailImportJob.findMany({
      where: { status: BackofficeEmailImportJobStatus.pending },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
  }

  async findById(id: string): Promise<BackofficeEmailImportJob | null> {
    return prisma.backofficeEmailImportJob.findUnique({ where: { id } })
  }

  async markProcessing(id: string): Promise<BackofficeEmailImportJob | null> {
    const result = await prisma.backofficeEmailImportJob.updateMany({
      where: { id, status: BackofficeEmailImportJobStatus.pending },
      data: { status: BackofficeEmailImportJobStatus.processing },
    })
    if (result.count === 0) return null
    return prisma.backofficeEmailImportJob.findUnique({ where: { id } })
  }

  async updateResult(
    id: string,
    data: UpdateBackofficeEmailImportJobResultInput
  ): Promise<BackofficeEmailImportJob> {
    return prisma.backofficeEmailImportJob.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.totalRows !== undefined ? { totalRows: data.totalRows } : {}),
        ...(data.processedRows !== undefined ? { processedRows: data.processedRows } : {}),
        ...(data.importedCount !== undefined ? { importedCount: data.importedCount } : {}),
        ...(data.skippedCount !== undefined ? { skippedCount: data.skippedCount } : {}),
        ...(data.errorCount !== undefined ? { errorCount: data.errorCount } : {}),
        ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      },
    })
  }
}

export const backofficeEmailImportJobRepository = new BackofficeEmailImportJobRepository()
