import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type PlanQuoteScope = { teamId: string; ownerProfileId: string }

export type PlanQuoteInput = {
  nome: string
  state: Prisma.InputJsonValue
  resumo?: Prisma.InputJsonValue
}

const quoteSelect = {
  id: true,
  nome: true,
  state: true,
  resumo: true,
  createdAt: true,
  updatedAt: true,
} as const

export class PrismaPlanQuoteRepository {
  async list(scope: PlanQuoteScope) {
    return prisma.planQuote.findMany({
      where: scope,
      select: quoteSelect,
      orderBy: { updatedAt: "desc" },
    })
  }

  async findOwned(id: string, scope: PlanQuoteScope) {
    return prisma.planQuote.findFirst({ where: { id, ...scope }, select: quoteSelect })
  }

  async create(scope: PlanQuoteScope, data: PlanQuoteInput) {
    return prisma.planQuote.create({ data: { ...scope, ...data }, select: quoteSelect })
  }

  async update(id: string, data: Partial<PlanQuoteInput>) {
    return prisma.planQuote.update({ where: { id }, data, select: quoteSelect })
  }

  async delete(id: string) {
    await prisma.planQuote.delete({ where: { id } })
  }

  async createShare(quoteId: string, token: string, payload: Prisma.InputJsonValue) {
    return prisma.planQuoteShare.create({
      data: { quoteId, token, payload },
      select: { id: true, token: true, createdAt: true },
    })
  }

  async findShareByToken(token: string) {
    return prisma.planQuoteShare.findUnique({
      where: { token },
      select: { token: true, payload: true, createdAt: true, expiresAt: true },
    })
  }
}
