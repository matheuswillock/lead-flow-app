import { describe, expect, it } from "bun:test"
import { containsPrismaDataAccess } from "./ai-governance"

describe("containsPrismaDataAccess", () => {
  it("detecta o client compartilhado exportado como prisma", () => {
    const source = `
      import { prisma } from "@/app/api/infra/data/prisma"
      const leads = await prisma.lead.findMany({ where: { teamId } })
    `
    expect(containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta client injetado no construtor com outro nome (this.db.)", () => {
    const source = `
      import type { PrismaClient } from "@prisma/client"
      class EmailCampaignUseCase {
        constructor(private readonly db: PrismaClient) {}
        async list() {
          return this.db.emailCampaign.findMany({ where: { teamId } })
        }
      }
    `
    expect(containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta transaction client recebido como parametro", () => {
    const source = `
      async function persist(tx: Prisma.TransactionClient) {
        await tx.lead.update({ where: { id }, data: { status } })
      }
    `
    expect(containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta client vindo de factory sem anotacao de tipo", () => {
    const source = `
      import { getEmailCronPrisma } from "@/app/api/infra/data/prisma"
      const db = getEmailCronPrisma()
      const logs = await db.emailLog.findMany({ where: { dispatchId } })
    `
    expect(containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta $queryRaw em client injetado", () => {
    const source = `
      class ImportUseCase {
        constructor(private readonly database: PrismaClient) {}
        async lock() {
          return this.database.$queryRaw\`SELECT pg_try_advisory_lock(1)\`
        }
      }
    `
    expect(containsPrismaDataAccess(source)).toBe(true)
  })

  it("nao acusa UseCase que so depende de Repository", () => {
    const source = `
      import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
      class LeadUseCase {
        async list() {
          return leadRepository.findLeads({ teamId })
        }
      }
    `
    expect(containsPrismaDataAccess(source)).toBe(false)
  })

  it("nao acusa import de tipo do @prisma/client sem acesso ao banco", () => {
    const source = `
      import type { LeadStatus, PrismaClient } from "@prisma/client"
      export type LeadDto = { status: LeadStatus }
    `
    expect(containsPrismaDataAccess(source)).toBe(false)
  })

  it("nao acusa objeto que tem propriedade com nome de model", () => {
    const source = `
      const cache = buildCache()
      const total = cache.lead.count()
      store.team.update({ name })
    `
    expect(containsPrismaDataAccess(source)).toBe(false)
  })

  it("nao acusa objeto de dominio com propriedade lead", () => {
    const source = `
      const payload = { lead: { name: "Ana" } }
      console.info(payload.lead.name)
    `
    expect(containsPrismaDataAccess(source)).toBe(false)
  })
})
