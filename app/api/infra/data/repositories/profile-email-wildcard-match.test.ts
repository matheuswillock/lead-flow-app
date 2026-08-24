import { describe, expect, it, mock } from "bun:test"
import { matchesEmail, type EmailFilter } from "@/test/postgres-like-matcher"

/**
 * Mesmo bug do curinga de ILIKE, agora nas consultas por `Profile.email`.
 *
 * Diferença que agrava: estas consultas NÃO têm escopo de time — `Profile.email`
 * é `@unique` global —, então o falso positivo atravessa contas de clientes
 * diferentes. `Profile.email` também é gravado como veio
 * (`ManagerUserRepository.createManager/createOperator` passam `data.email`
 * verbatim), então a comparação precisa continuar ignorando caixa de verdade:
 * escapar, não comparar variantes literais.
 *
 * Os fakes abaixo aplicam a semântica de ILIKE medida no Postgres
 * (`test/postgres-like-matcher.ts`), então tirar o `escapeLikePattern` de
 * qualquer um dos dois filtros derruba os testes de curinga.
 */

type ProfileRow = { id: string; email: string; activeTeamId: string | null; fullName: string | null }

const OUTRA_CONTA: ProfileRow = {
  id: "profile-outra-conta",
  email: "mariaXsilva@example.com",
  activeTeamId: "team-da-outra-conta",
  fullName: "Maria X Silva",
}

function makeProfileFindFirst(rows: ProfileRow[]) {
  return async (args: unknown) => {
    const { email, ...rest } = (args as { where: Record<string, unknown> }).where
    if (Object.keys(rest).length > 0) {
      throw new Error(`filtro não previsto por este fake: ${JSON.stringify(rest)}`)
    }
    return rows.find((row) => matchesEmail(row.email, email as EmailFilter | undefined)) ?? null
  }
}

const profileFindFirst = mock(async (_args: unknown) => null as ProfileRow | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { profile: { findFirst: profileFindFirst } },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { backofficeBotRepository } = await import(
  "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository"
)
const { BackofficeAdhesionRepository } = await import(
  "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
)

function seed(rows: ProfileRow[]) {
  profileFindFirst.mockImplementation(makeProfileFindFirst(rows))
}

describe("BackofficeBotRepository.findProfileByEmail — curinga de ILIKE", () => {
  const repo = backofficeBotRepository

  it("não devolve a conta de outra pessoa quando o e-mail tem `_`", async () => {
    // Este é o pior falso positivo do grupo: o Studio bot usa o retorno para
    // decidir QUEM está falando (`activeTeamId`), então casar errado dá acesso
    // ao time de outro cliente.
    seed([OUTRA_CONTA])

    expect(await repo.findProfileByEmail("maria_silva@example.com")).toBeNull()
  })

  it("não varre a base inteira quando o e-mail tem `%`", async () => {
    seed([OUTRA_CONTA])

    expect(await repo.findProfileByEmail("%@example.com")).toBeNull()
  })

  it("continua ignorando caixa — o perfil é gravado como veio", async () => {
    seed([{ ...OUTRA_CONTA, id: "profile-maria", email: "Maria.Silva@Example.com" }])

    const encontrado = await repo.findProfileByEmail("maria.silva@example.com")

    expect(encontrado?.id).toBe("profile-maria")
  })

  it("casa o perfil cujo e-mail tem `_` de verdade", async () => {
    seed([OUTRA_CONTA, { ...OUTRA_CONTA, id: "profile-maria", email: "maria_silva@example.com" }])

    const encontrado = await repo.findProfileByEmail("MARIA_SILVA@EXAMPLE.COM")

    expect(encontrado?.id).toBe("profile-maria")
  })
})

describe("BackofficeAdhesionRepository.findProfileIdByEmail — curinga de ILIKE", () => {
  const repo = new BackofficeAdhesionRepository()

  it("não devolve o id da conta de outra pessoa quando o e-mail tem `_`", async () => {
    seed([OUTRA_CONTA])

    expect(await repo.findProfileIdByEmail("maria_silva@example.com")).toBeNull()
  })

  it("continua ignorando caixa", async () => {
    seed([{ ...OUTRA_CONTA, id: "profile-maria", email: "Maria.Silva@Example.com" }])

    expect(await repo.findProfileIdByEmail("maria.silva@example.com")).toBe("profile-maria")
  })
})
