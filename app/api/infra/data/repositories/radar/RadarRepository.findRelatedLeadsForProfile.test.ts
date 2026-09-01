import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { RadarRepository } from "./RadarRepository"

/**
 * Regra 3 (adenda 31/08, pós-#1107): "Leads no CRM" no perfil unificado —
 * todos os leads vinculados ao perfil, mais recente primeiro. A ordem vem do
 * vínculo (`radarIdentity.createdAt` desc), não da tabela `Lead` — dois leads
 * criados fora de ordem cronológica ainda respeitam a ordem em que se
 * vincularam ao perfil.
 */

type IdentityRow = { normalizedValue: string; createdAt: Date }
type LeadRow = {
  id: string
  leadCode: string
  name: string
  status: string
  createdAt: Date
  deletedAt: Date | null
}

function makeRepository(identities: IdentityRow[], leads: LeadRow[]) {
  const identityFindMany = mock(async (_args: unknown) => identities)
  const leadFindMany = mock(async (args: { where: { id: { in: string[] }; deletedAt?: null } }) => {
    const ids = new Set(args.where.id.in)
    return leads.filter((lead) => {
      if (!ids.has(lead.id)) return false
      if ("deletedAt" in args.where && lead.deletedAt !== args.where.deletedAt) return false
      return true
    })
  })
  const db = {
    radarIdentity: { findMany: identityFindMany },
    lead: { findMany: leadFindMany },
  } as unknown as PrismaClient
  return { repo: new RadarRepository(db), identityFindMany, leadFindMany }
}

const SCOPE = { teamId: "team-1", ctx: {} as never }

describe("RadarRepository.findRelatedLeadsForProfile", () => {
  it("lista os N leads vinculados na ordem do vínculo mais recente primeiro", async () => {
    const { repo } = makeRepository(
      [
        { normalizedValue: "lead-recente", createdAt: new Date("2026-08-31T10:00:00.000Z") },
        { normalizedValue: "lead-antigo", createdAt: new Date("2026-08-11T10:00:00.000Z") },
      ],
      [
        {
          id: "lead-antigo",
          leadCode: "R0001",
          name: "vladicea",
          status: "opportunityLost",
          createdAt: new Date("2026-08-11T10:00:00.000Z"),
          deletedAt: null,
        },
        {
          id: "lead-recente",
          leadCode: "R0002",
          name: "Alexandre",
          status: "new_opportunity",
          createdAt: new Date("2026-08-31T10:00:00.000Z"),
          deletedAt: null,
        },
      ],
    )

    const result = await repo.findRelatedLeadsForProfile(SCOPE, "profile-1")

    expect(result.map((lead) => lead.id)).toEqual(["lead-recente", "lead-antigo"])
  })

  it("devolve lista vazia sem consultar leads quando o perfil não tem vínculo real", async () => {
    const { repo, leadFindMany } = makeRepository([], [])

    const result = await repo.findRelatedLeadsForProfile(SCOPE, "profile-1")

    expect(result).toEqual([])
    expect(leadFindMany).not.toHaveBeenCalled()
  })

  it("ignora reserva pending (promoção manual em andamento) — não é lead de verdade", async () => {
    const { repo, identityFindMany } = makeRepository(
      [{ normalizedValue: "lead-real", createdAt: new Date() }],
      [
        {
          id: "lead-real",
          leadCode: "R0003",
          name: "Maria",
          status: "new_opportunity",
          createdAt: new Date(),
          deletedAt: null,
        },
      ],
    )

    await repo.findRelatedLeadsForProfile(SCOPE, "profile-1")

    const [args] = identityFindMany.mock.calls[0] as [{ where: { NOT: unknown } }]
    expect(args.where.NOT).toEqual({ normalizedValue: { startsWith: "pending:" } })
  })

  /**
   * Achado do Codex no review do PR #1114 (P2). `MergeLeadsUseCase` preserva
   * o vínculo Radar do lead de ORIGEM depois de soft-deletá-lo no merge —
   * sem filtrar `deletedAt`, o card mergeado aparecia na lista com um link
   * quebrado (`findByLeadCode` exige `deletedAt: null`).
   */
  it("exclui lead soft-deletado (mergeado) da lista — link quebraria sem o filtro", async () => {
    const { repo, leadFindMany } = makeRepository(
      [
        { normalizedValue: "lead-mergeado", createdAt: new Date("2026-08-11T10:00:00.000Z") },
        { normalizedValue: "lead-ativo", createdAt: new Date("2026-08-31T10:00:00.000Z") },
      ],
      [
        {
          id: "lead-mergeado",
          leadCode: "R0004",
          name: "vladicea (mergeado)",
          status: "opportunityLost",
          createdAt: new Date("2026-08-11T10:00:00.000Z"),
          deletedAt: new Date("2026-08-20T00:00:00.000Z"),
        },
        {
          id: "lead-ativo",
          leadCode: "R0005",
          name: "Alexandre",
          status: "new_opportunity",
          createdAt: new Date("2026-08-31T10:00:00.000Z"),
          deletedAt: null,
        },
      ],
    )

    const result = await repo.findRelatedLeadsForProfile(SCOPE, "profile-1")

    expect(result.map((lead) => lead.id)).toEqual(["lead-ativo"])
    const [args] = leadFindMany.mock.calls[0] as [{ where: { deletedAt?: null } }]
    expect(args.where.deletedAt).toBeNull()
  })
})
