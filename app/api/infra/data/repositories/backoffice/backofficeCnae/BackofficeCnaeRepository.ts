import { prisma } from "@/app/api/infra/data/prisma"
import type { CnaeItem, IBackofficeCnaeRepository } from "./IBackofficeCnaeRepository"

export class BackofficeCnaeRepository implements IBackofficeCnaeRepository {
  async search(q?: string): Promise<CnaeItem[]> {
    return prisma.backofficeCnae.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    })
  }
}

export const backofficeCnaeRepository = new BackofficeCnaeRepository()
