import { prisma } from "@/app/api/infra/data/prisma"
import type { IBackofficeShortLinkRepository } from "./IBackofficeShortLinkRepository"

export class BackofficeShortLinkRepository implements IBackofficeShortLinkRepository {
  async findByTargetUrl(targetUrl: string) {
    return prisma.shortLink.findUnique({
      where: { targetUrl },
      select: { code: true, expiresAt: true },
    })
  }

  async findByTargetUrlAfterRace(targetUrl: string) {
    return prisma.shortLink.findUnique({
      where: { targetUrl },
      select: { code: true, expiresAt: true },
    })
  }

  async create(input: { code: string; targetUrl: string; expiresAt?: Date | null }) {
    return prisma.shortLink.create({
      data: { code: input.code, targetUrl: input.targetUrl, expiresAt: input.expiresAt ?? null },
      select: { code: true },
    })
  }
}

export const backofficeShortLinkRepository = new BackofficeShortLinkRepository()
