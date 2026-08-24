import { describe, expect, it, mock } from "bun:test"
import { LeadStatus } from "@prisma/client"
import { matchesEmail, type EmailFilter } from "@/test/postgres-like-matcher"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

/**
 * Mesmo bug do curinga de ILIKE dos PRs anteriores, agora nos quatro filtros que
 * a varredura do PR #993 deixou de fora por estarem em `Lead`, não em `Profile`.
 * Todos são escopados por `teamId`, então o falso positivo NÃO atravessa times —
 * é por isso que ficaram para depois. Dentro do time, porém, dois deles decidem
 * sobre qual linha agir:
 *
 * - `PublicFormsRepository.findLeadCandidates` é o pior: alimenta
 *   `findMatchingLead`, cujo último critério é `candidates.filter(lead =>
 *   lead.name.toLowerCase() === normalizedName)` com `byName.length === 1`. O
 *   curinga injeta no pool candidatos que não casam por e-mail nenhum, então uma
 *   resposta de formulário PÚBLICO pode ser gravada por cima do lead errado — ou
 *   perder o match legítimo por empatar o `byName` em 2. Como `take: 20` não tem
 *   `orderBy`, `%@dominio.com` traz 20 linhas arbitrárias do time.
 * - `StudioBotActionRepository.findLeadIdByCode` devolve o id direto, sem
 *   reconferência: `LD_0001` casa `LD-0001`, e o bot age no lead errado.
 *
 * Os dois filtros de conflito de transferência (`LeadUseCase` e
 * `MultiskillTransferRepository`) reconferem com `toLowerCase()` exato depois da
 * consulta, então o falso positivo não muda a decisão — o que o curinga custa
 * ali é trazer o time destino inteiro para a memória num `findMany` sem `take`.
 * Por isso a asserção deles é sobre quantas linhas a consulta trouxe, não sobre
 * o retorno.
 *
 * Os fakes aplicam a semântica de ILIKE medida no Postgres
 * (`test/postgres-like-matcher.ts`): tirar o `escapeLikePattern` de qualquer um
 * dos quatro filtros faz os testes de curinga falharem de novo.
 */

const TEAM = "team-1"

type LeadRow = {
  id: string
  teamId: string
  email: string | null
  phone: string | null
  name: string
  cnpj: string | null
  leadCode: string | null
  status: LeadStatus
}

const OUTRA_PESSOA: LeadRow = {
  id: "lead-outra-pessoa",
  teamId: TEAM,
  email: "mariaXsilva@example.com",
  phone: "11988887777",
  name: "Maria Silva",
  cnpj: null,
  leadCode: "LD-0001",
  status: LeadStatus.new_opportunity,
}

/** `matchesEmail` é genérico sobre filtro de string do Prisma, não só e-mail. */
const matchesText = matchesEmail

function matchesOrClause(row: LeadRow, clause: Record<string, unknown>): boolean {
  if ("email" in clause) return matchesText(row.email, clause.email as EmailFilter | undefined)
  if ("phone" in clause) return row.phone === clause.phone
  if ("cnpj" in clause) return row.cnpj === clause.cnpj
  throw new Error(`cláusula OR não prevista por este fake: ${JSON.stringify(clause)}`)
}

/** Quantas linhas cada consulta trouxe, na ordem em que foram emitidas. */
const linhasTrazidas: number[] = []

function applyFindMany(rows: LeadRow[], where: Record<string, unknown>, take?: number) {
  const { teamId, OR, NOT, ...rest } = where
  if (Object.keys(rest).length > 0) {
    throw new Error(`filtro não previsto por este fake: ${JSON.stringify(rest)}`)
  }
  const excludeId = NOT ? (NOT as { id: string }).id : null
  const clauses = (OR ?? []) as Record<string, unknown>[]
  const matched = rows.filter(
    (row) =>
      row.teamId === teamId &&
      row.id !== excludeId &&
      clauses.some((clause) => matchesOrClause(row, clause)),
  )
  linhasTrazidas.push(matched.length)
  return typeof take === "number" ? matched.slice(0, take) : matched
}

const leadFindMany = mock(async (_args: unknown) => [] as LeadRow[])
const leadFindFirst = mock(async (_args: unknown) => null as LeadRow | null)

const fakePrisma = { lead: { findMany: leadFindMany, findFirst: leadFindFirst } }

// Algum módulo do grafo do LeadUseCase importa `server-only`, que explode fora
// do runtime do Next. Só precisa existir.
mock.module("server-only", () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: fakePrisma,
  default: fakePrisma,
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { publicFormsRepository } =
  await import("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository")
const { studioBotActionRepository } =
  await import("@/app/api/infra/data/repositories/backofficeBot/StudioBotActionRepository")
const { MultiskillTransferRepository } =
  await import("@/app/api/infra/data/repositories/multiskillTransfer/MultiskillTransferRepository")
const { LeadUseCase } = await import("@/app/api/useCases/leads/LeadUseCase")

function seed(rows: LeadRow[]) {
  linhasTrazidas.length = 0
  leadFindMany.mockImplementation(async (args) => {
    const { where, take } = args as { where: Record<string, unknown>; take?: number }
    return applyFindMany(rows, where, take)
  })
  leadFindFirst.mockImplementation(async (args) => {
    const { where } = args as { where: Record<string, unknown> }
    const { teamId, leadCode, OR, ...rest } = where
    if (Object.keys(rest).length > 0) {
      throw new Error(`filtro não previsto por este fake: ${JSON.stringify(rest)}`)
    }
    // `OR` aqui é o escopo de dono do lead (assignedTo/createdBy/closerId), que
    // não muda nada nos casos abaixo — todos rodam como manager.
    void OR
    return (
      rows.find(
        (row) =>
          row.teamId === teamId && matchesText(row.leadCode, leadCode as EmailFilter | undefined),
      ) ?? null
    )
  })
}

describe("PublicFormsRepository.findLeadCandidates — curinga de ILIKE", () => {
  it("não traz o lead de outra pessoa quando o e-mail do formulário tem `_`", async () => {
    seed([OUTRA_PESSOA])

    const candidatos = await publicFormsRepository.findLeadCandidates(
      TEAM,
      "maria_silva@example.com",
      "",
      "",
    )

    expect(candidatos).toEqual([])
  })

  it("não traz 20 linhas arbitrárias do time quando o e-mail tem `%`", async () => {
    seed([OUTRA_PESSOA])

    const candidatos = await publicFormsRepository.findLeadCandidates(TEAM, "%@example.com", "", "")

    expect(candidatos).toEqual([])
  })

  it("continua ignorando caixa — `Lead.email` é gravado como veio", async () => {
    seed([{ ...OUTRA_PESSOA, id: "lead-maria", email: "Maria.Silva@Example.com" }])

    const candidatos = await publicFormsRepository.findLeadCandidates(
      TEAM,
      "maria.silva@example.com",
      "",
      "",
    )

    expect(candidatos.map((lead) => lead.id)).toEqual(["lead-maria"])
  })

  it("casa o lead cujo e-mail tem `_` de verdade", async () => {
    seed([OUTRA_PESSOA, { ...OUTRA_PESSOA, id: "lead-maria", email: "maria_silva@example.com" }])

    const candidatos = await publicFormsRepository.findLeadCandidates(
      TEAM,
      "MARIA_SILVA@EXAMPLE.COM",
      "",
      "",
    )

    expect(candidatos.map((lead) => lead.id)).toEqual(["lead-maria"])
  })
})

describe("StudioBotActionRepository.findLeadIdByCode — curinga de ILIKE", () => {
  const access = {
    teamId: TEAM,
    profileId: "profile-1",
    isMaster: true,
    teamMember: { role: "master" },
  } as unknown as TeamAccess

  it("não devolve o lead errado quando o código tem `_`", async () => {
    seed([OUTRA_PESSOA])

    expect(await studioBotActionRepository.findLeadIdByCode(access, "LD_0001")).toBeNull()
  })

  it("não devolve um lead arbitrário quando o código tem `%`", async () => {
    seed([OUTRA_PESSOA])

    expect(await studioBotActionRepository.findLeadIdByCode(access, "LD-%")).toBeNull()
  })

  it("continua ignorando caixa no código", async () => {
    seed([{ ...OUTRA_PESSOA, id: "lead-maria", leadCode: "ld-0001" }])

    expect(await studioBotActionRepository.findLeadIdByCode(access, "LD-0001")).toBe("lead-maria")
  })
})

describe("guardas de conflito de transferência — curinga de ILIKE", () => {
  // Aqui o retorno já estava certo (há reconferência exata depois da consulta);
  // o que o curinga quebra é o tamanho da consulta. Por isso a asserção é sobre
  // quantas linhas o `findMany` trouxe.
  const leadEmOrigem = { id: "lead-origem", email: "maria_silva@example.com", cnpj: null }

  it("MultiskillTransferRepository não traz o time destino inteiro", async () => {
    seed([{ ...OUTRA_PESSOA, teamId: "team-destino" }])

    const resultado = await new MultiskillTransferRepository().resolveTransferTeamUniqueConflicts(
      leadEmOrigem,
      "team-destino",
    )

    expect(resultado.ok).toBe(true)
    expect(linhasTrazidas).toEqual([0])
  })

  it("LeadUseCase não traz o time destino inteiro", async () => {
    seed([{ ...OUTRA_PESSOA, teamId: "team-destino" }])

    const leadRepository = {
      findTransferConflictsInTeam: async (input: {
        targetTeamId: string
        excludeLeadId: string
        filters: Record<string, unknown>[]
      }) =>
        applyFindMany([{ ...OUTRA_PESSOA, teamId: "team-destino" }], {
          teamId: input.targetTeamId,
          NOT: { id: input.excludeLeadId },
          OR: input.filters,
        }),
    }
    const useCase = new LeadUseCase(leadRepository as never, {} as never) as unknown as {
      resolveTransferTeamUniqueConflicts: (
        lead: { id: string; email: string | null; cnpj: string | null },
        targetTeamId: string,
      ) => Promise<{ ok: boolean }>
    }

    const resultado = await useCase.resolveTransferTeamUniqueConflicts(leadEmOrigem, "team-destino")

    expect(resultado.ok).toBe(true)
    expect(linhasTrazidas).toEqual([0])
  })

  it("o conflito real continua sendo detectado, ignorando caixa", async () => {
    seed([{ ...OUTRA_PESSOA, teamId: "team-destino", email: "MARIA_SILVA@example.com" }])

    const resultado = await new MultiskillTransferRepository().resolveTransferTeamUniqueConflicts(
      leadEmOrigem,
      "team-destino",
    )

    expect(resultado.ok).toBe(false)
    expect(linhasTrazidas).toEqual([1])
  })
})
