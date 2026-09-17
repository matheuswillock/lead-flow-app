import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { RadarLeadGateUnitOfWork } from "./RadarLeadGateUnitOfWork"

/**
 * Achado do Codex no review do PR #1114 (P1). `reloadProfile` decide "o lead
 * do perfil" pelo vínculo `lead_id` MAIS RECENTE (regra 2), mas
 * `findIdentityMatches` buscava o candidato de telefone/e-mail pelo mais
 * ANTIGO (`orderBy: createdAt "asc"`). Depois de uma reabertura por status
 * (regra 1), o lead novo nasce com o MESMO telefone/e-mail do perfil — então
 * `leadIdMatch` aponta para o card novo (mais recente) e `phoneMatch`/
 * `emailMatch` continuam apontando para o card antigo. `distinctLeadIds` vê
 * dois ids diferentes e devolve `identity_conflict`, travando a próxima
 * submissão de anexar no card recém-reaberto — o oposto do que a regra 1
 * promete.
 */

const TEAM = "team-1"

type LeadRow = {
  id: string
  phone: string | null
  email: string | null
  status: string
  createdAt: Date
}

function makeGate(rows: LeadRow[]) {
  const findFirst = mock(async (args: { where: Record<string, unknown>; orderBy?: unknown }) => {
    const where = args.where
    const matches = rows.filter((row) => {
      if (where.id && row.id !== where.id) return false
      if (where.email && (where.email as { equals: string }).equals !== row.email) return false
      if (where.OR) {
        const or = where.OR as Array<Record<string, unknown>>
        const phoneMatches = or.some((clause) => {
          if (typeof clause.phone === "string") return clause.phone === row.phone
          const containsClause = clause.phone as { contains: string } | undefined
          return containsClause ? Boolean(row.phone?.includes(containsClause.contains)) : false
        })
        if (!phoneMatches) return false
      }
      return true
    })
    if (matches.length === 0) return null
    const sorted = [...matches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const orderByCreatedAt = (args.orderBy as { createdAt?: "asc" | "desc" } | undefined)?.createdAt
    return orderByCreatedAt === "desc" ? sorted[sorted.length - 1] : sorted[0]
  })
  const transaction = {
    $executeRaw: mock(async () => 1),
    lead: { findFirst },
  }
  const database = {
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) => work(transaction),
  } as unknown as PrismaClient
  return new RadarLeadGateUnitOfWork(database)
}

describe("RadarLeadGateUnitOfWork.findIdentityMatches — consistência com o vínculo mais recente", () => {
  it("phoneMatch aponta para o mesmo lead que leadIdMatch quando o card reaberto tem o telefone do perfil", async () => {
    const leadOld: LeadRow = {
      id: "lead-old",
      phone: "5511988887777",
      email: null,
      status: "opportunityLost",
      createdAt: new Date("2026-08-11T10:00:00.000Z"),
    }
    const leadNew: LeadRow = {
      id: "lead-new",
      phone: "5511988887777",
      email: null,
      status: "new_opportunity",
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
    }
    const gate = makeGate([leadOld, leadNew])

    const matches = await gate.execute({ teamId: TEAM, radarProfileId: "profile-1" }, (transaction) =>
      transaction.findIdentityMatches({
        id: "profile-1",
        teamId: TEAM,
        displayName: "Alexandre",
        normalizedName: "alexandre",
        displayPhone: "(11) 98888-7777",
        normalizedPhone: "5511988887777",
        primaryEmail: null,
        normalizedPrimaryEmail: null,
        // `reloadProfile` já resolveu isto para o vínculo MAIS RECENTE.
        leadId: "lead-new",
      }),
    )

    expect(matches.leadIdMatch?.leadId).toBe("lead-new")
    expect(matches.phoneMatch?.leadId).toBe("lead-new")
  })

  it("emailMatch aponta para o mesmo lead que leadIdMatch quando o card reaberto tem o e-mail do perfil", async () => {
    const leadOld: LeadRow = {
      id: "lead-old",
      phone: null,
      email: "alexandre@libercorretora.com.br",
      status: "opportunityLost",
      createdAt: new Date("2026-08-11T10:00:00.000Z"),
    }
    const leadNew: LeadRow = {
      id: "lead-new",
      phone: null,
      email: "alexandre@libercorretora.com.br",
      status: "new_opportunity",
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
    }
    const gate = makeGate([leadOld, leadNew])

    const matches = await gate.execute({ teamId: TEAM, radarProfileId: "profile-1" }, (transaction) =>
      transaction.findIdentityMatches({
        id: "profile-1",
        teamId: TEAM,
        displayName: "Alexandre",
        normalizedName: "alexandre",
        displayPhone: null,
        normalizedPhone: null,
        primaryEmail: "alexandre@libercorretora.com.br",
        normalizedPrimaryEmail: "alexandre@libercorretora.com.br",
        leadId: "lead-new",
      }),
    )

    expect(matches.leadIdMatch?.leadId).toBe("lead-new")
    expect(matches.emailMatch?.leadId).toBe("lead-new")
  })
})
