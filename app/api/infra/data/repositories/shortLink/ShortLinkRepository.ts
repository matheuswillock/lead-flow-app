import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IShortLinkRepository,
  ShortLinkRecord,
  ShortLinkTargetRecord,
} from "./IShortLinkRepository"

class ShortLinkRepository implements IShortLinkRepository {
  async findByTargetUrl(targetUrl: string): Promise<ShortLinkRecord | null> {
    return prisma.shortLink.findUnique({
      where: { targetUrl },
      select: { code: true, expiresAt: true },
    })
  }

  async findByCode(code: string): Promise<ShortLinkTargetRecord | null> {
    return prisma.shortLink.findUnique({
      where: { code },
      select: { targetUrl: true, expiresAt: true },
    })
  }

  async create(input: {
    code: string
    targetUrl: string
    expiresAt?: Date
  }): Promise<ShortLinkRecord> {
    return prisma.shortLink.create({
      data: {
        code: input.code,
        targetUrl: input.targetUrl,
        expiresAt: input.expiresAt ?? null,
      },
      select: { code: true, expiresAt: true },
    })
  }
}

export const shortLinkRepository = new ShortLinkRepository()
