import { prisma } from "@/app/api/infra/data/prisma"
import type { BackofficeLeadExtractionStatus } from "@prisma/client"
import type {
  ExtractionListItem,
  ExtractionWithResults,
  IBackofficeLeadExtractionRepository,
  LeadExtractionFilters,
  LeadExtractionResultData,
} from "./IBackofficeLeadExtractionRepository"

export class BackofficeLeadExtractionRepository implements IBackofficeLeadExtractionRepository {
  async create(profileId: string, filters: LeadExtractionFilters): Promise<ExtractionListItem> {
    return prisma.backofficeLeadExtraction.create({
      data: { profileId, filters: filters as object, status: "PENDING", totalCount: 0 },
      select: {
        id: true, profileId: true, filters: true,
        totalCount: true, status: true, createdAt: true, updatedAt: true,
      },
    })
  }

  async updateStatus(id: string, status: BackofficeLeadExtractionStatus, totalCount?: number): Promise<void> {
    await prisma.backofficeLeadExtraction.update({
      where: { id },
      data: { status, ...(totalCount !== undefined ? { totalCount } : {}) },
    })
  }

  async saveResults(extractionId: string, results: LeadExtractionResultData[]): Promise<void> {
    if (results.length === 0) return
    await prisma.backofficeLeadExtractionResult.createMany({
      data: results.map((r) => ({
        extractionId,
        taxId: r.taxId,
        name: r.name,
        tradeName: r.tradeName ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        city: r.city ?? null,
        state: r.state ?? null,
        cnae: r.cnae ?? null,
        cnaeName: r.cnaeName ?? null,
        type: r.type ?? null,
        raw: (r.raw as object) ?? undefined,
      })),
    })
  }

  async findById(id: string): Promise<ExtractionListItem | null> {
    return prisma.backofficeLeadExtraction.findUnique({
      where: { id },
      select: {
        id: true, profileId: true, filters: true,
        totalCount: true, status: true, createdAt: true, updatedAt: true,
      },
    })
  }

  async findWithResults(id: string, page: number, pageSize: number): Promise<ExtractionWithResults | null> {
    const extraction = await prisma.backofficeLeadExtraction.findUnique({
      where: { id },
      select: {
        id: true, profileId: true, filters: true,
        totalCount: true, status: true, createdAt: true, updatedAt: true,
        results: {
          select: {
            id: true, taxId: true, name: true, tradeName: true,
            email: true, phone: true, city: true, state: true,
            cnae: true, cnaeName: true, type: true, raw: true, createdAt: true,
          },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        },
      },
    })
    if (!extraction) return null
    return extraction as ExtractionWithResults
  }

  async listByProfile(
    profileId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: ExtractionListItem[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.backofficeLeadExtraction.findMany({
        where: { profileId },
        select: {
          id: true, profileId: true, filters: true,
          totalCount: true, status: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backofficeLeadExtraction.count({ where: { profileId } }),
    ])
    return { items, total }
  }
}
