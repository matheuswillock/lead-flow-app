import { describe, expect, it, mock } from "bun:test"

/**
 * Adenda do owner (31/08, pós-#1107) — regra 2: o vínculo perfil↔lead vira
 * histórico (1:N). Antes, `linkLeadIdentity` lançava "Perfil Radar já está
 * vinculado a outro lead" no segundo vínculo — isso impedia a regra 1 (dedupe
 * sensível a status) de vincular o card novo ao perfil quando o lead casado
 * não está em `new_opportunity`. O teste entra pelo `execute`, caminho
 * público, para exercitar a fiação real da unit of work.
 *
 * O fake de `radarIdentity.findFirst` simula uma tabela em memória e resolve
 * o `where` genericamente (não amarrado à forma exata da query) — assim o
 * mesmo teste reproduz o vermelho contra a implementação ANTIGA (uma única
 * query sem filtro de `normalizedValue`) e continua válido contra a nova
 * (duas queries: match exato + prefixo `pending:`).
 */

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }))

const { RadarLeadGateUnitOfWork } = await import("./RadarLeadGateUnitOfWork")

type RadarIdentityRow = { id: string; normalizedValue: string; createdAt: Date }
type NormalizedValueWhere = string | { startsWith: string } | undefined

function matchesNormalizedValue(row: RadarIdentityRow, where: NormalizedValueWhere): boolean {
  if (where === undefined) return true
  if (typeof where === "string") return row.normalizedValue === where
  return row.normalizedValue.startsWith(where.startsWith)
}

function makeUnitOfWork(rows: RadarIdentityRow[]) {
  const findFirst = mock(async (args: { where: { normalizedValue?: NormalizedValueWhere } }) => {
    return rows.find((row) => matchesNormalizedValue(row, args.where.normalizedValue)) ?? null
  })
  const create = mock(async () => ({}) as RadarIdentityRow)
  const del = mock(async () => ({}) as RadarIdentityRow)
  const transaction = {
    $executeRaw: mock(async () => 1),
    radarIdentity: { findFirst, create, delete: del },
  }
  const database = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transaction),
  }
  return { unitOfWork: new RadarLeadGateUnitOfWork(database as never), findFirst, create, del }
}

const TEAM_ID = "team-1"
const PROFILE_ID = "profile-1"

function linkLead(unitOfWork: InstanceType<typeof RadarLeadGateUnitOfWork>, leadId: string) {
  return unitOfWork.execute({ teamId: TEAM_ID, radarProfileId: PROFILE_ID }, (transaction) =>
    transaction.linkLeadIdentity({
      teamId: TEAM_ID,
      radarProfileId: PROFILE_ID,
      leadId,
      source: "public_form_radar_gate",
    }),
  )
}

describe("linkLeadIdentity — vínculo perfil↔lead como histórico (regra 2)", () => {
  it("cria um segundo vínculo quando o perfil já está vinculado a OUTRO lead (era o bug: lançava e abortava a transação)", async () => {
    const { unitOfWork, create } = makeUnitOfWork([
      { id: "identity-vladicea", normalizedValue: "lead-vladicea", createdAt: new Date() },
    ])

    await expect(linkLead(unitOfWork, "lead-novo")).resolves.toBeUndefined()

    expect(create).toHaveBeenCalledWith({
      data: {
        teamId: TEAM_ID,
        profileId: PROFILE_ID,
        type: "lead_id",
        value: "lead-novo",
        normalizedValue: "lead-novo",
        source: "public_form_radar_gate",
        isPrimary: false,
      },
    })
  })

  it("é no-op quando o mesmo lead já está vinculado (idempotência do gate)", async () => {
    const { unitOfWork, create } = makeUnitOfWork([
      { id: "identity-1", normalizedValue: "lead-existente", createdAt: new Date() },
    ])

    await expect(linkLead(unitOfWork, "lead-existente")).resolves.toBeUndefined()

    expect(create).not.toHaveBeenCalled()
  })

  it("recusa quando há reserva pending FRESCA de promoção manual em andamento", async () => {
    const { unitOfWork, create } = makeUnitOfWork([
      { id: "pending-1", normalizedValue: "pending:abc123", createdAt: new Date() },
    ])

    await expect(linkLead(unitOfWork, "lead-novo")).rejects.toThrow(
      "Perfil Radar tem promoção manual em andamento",
    )
    expect(create).not.toHaveBeenCalled()
  })

  it("assume reserva pending ÓRFÃ (fora da janela de staleness) e cria o vínculo real", async () => {
    const { unitOfWork, create, del } = makeUnitOfWork([
      {
        id: "pending-1",
        normalizedValue: "pending:abc123",
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ])

    await expect(linkLead(unitOfWork, "lead-novo")).resolves.toBeUndefined()

    expect(del).toHaveBeenCalledWith({ where: { id: "pending-1" } })
    expect(create).toHaveBeenCalledTimes(1)
  })
})
