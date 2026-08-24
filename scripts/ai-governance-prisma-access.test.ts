import { describe, expect, it } from "bun:test"
import { containsPrismaDataAccess } from "./ai-governance"

describe("containsPrismaDataAccess", () => {
  it("detecta o client compartilhado exportado como prisma", async () => {
    const source = `
      import { prisma } from "@/app/api/infra/data/prisma"
      const leads = await prisma.lead.findMany({ where: { teamId } })
    `
    expect(await containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta client injetado no construtor com outro nome (this.db.)", async () => {
    const source = `
      import type { PrismaClient } from "@prisma/client"
      class EmailCampaignUseCase {
        constructor(private readonly db: PrismaClient) {}
        async list() {
          return this.db.emailCampaign.findMany({ where: { teamId } })
        }
      }
    `
    expect(await containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta transaction client recebido como parametro", async () => {
    const source = `
      async function persist(tx: Prisma.TransactionClient) {
        await tx.lead.update({ where: { id }, data: { status } })
      }
    `
    expect(await containsPrismaDataAccess(source)).toBe(true)
  })

  it("detecta $queryRaw em client injetado", async () => {
    const source = `
      class ImportUseCase {
        constructor(private readonly database: PrismaClient) {}
        async lock() {
          return this.database.$queryRaw\`SELECT pg_try_advisory_lock(1)\`
        }
      }
    `
    expect(await containsPrismaDataAccess(source)).toBe(true)
  })

  it("nao acusa UseCase que so depende de Repository", async () => {
    const source = `
      import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
      class LeadUseCase {
        async list() {
          return leadRepository.findLeads({ teamId })
        }
      }
    `
    expect(await containsPrismaDataAccess(source)).toBe(false)
  })

  it("nao acusa import de tipo do @prisma/client sem acesso ao banco", async () => {
    const source = `
      import type { LeadStatus, PrismaClient } from "@prisma/client"
      export type LeadDto = { status: LeadStatus }
    `
    expect(await containsPrismaDataAccess(source)).toBe(false)
  })

  it("nao acusa objeto de dominio com propriedade lead", async () => {
    const source = `
      const payload = { lead: { name: "Ana" } }
      console.info(payload.lead.name)
    `
    expect(await containsPrismaDataAccess(source)).toBe(false)
  })
})
