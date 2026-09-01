import { describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { matchesEmail, type EmailFilter } from "@/test/postgres-like-matcher"

/**
 * Trava do curinga de ILIKE nos dois lugares que casam `Lead.email` a partir de
 * um endereço vindo de fora (webhook de e-mail, contato de lista, perfil Radar).
 *
 * Medido em 24/08/2026 com Prisma 6.19.3 contra o Postgres local
 * (`supabase/postgres:17.6.1.149`): o filtro `{ equals: <email>, mode:
 * "insensitive" }` gera
 *
 *   WHERE "teamId" = $1 AND "email" ILIKE $2
 *
 * com o valor CRU no parâmetro — sem escape e sem cláusula ESCAPE. Em Postgres
 * `_` casa um caractere qualquer e `%` casa N, então o endereço buscado vira um
 * padrão. Também medido no mesmo banco:
 *
 *   'mariaXsilva@example.com' ILIKE 'maria_silva@example.com'  -> true
 *   'maria.silva@example.com' ILIKE 'maria_silva@example.com'  -> true
 *   'maria-silva@example.com' ILIKE 'maria_silva@example.com'  -> true
 *   'qualquer@example.com'    ILIKE '%@example.com'            -> true
 *   'mariaXsilva@example.com' =     'maria_silva@example.com'  -> false
 *
 * `nome_sobrenome@` vs `nome.sobrenome@` é a colisão mais comum em base
 * importada, e os dois consumidores abaixo agem sobre o lead casado:
 * `findLeadPhoneByEmail` devolve o telefone (vazamento de PII entre leads do
 * mesmo time) e `findIdentityMatches` alimenta o `existingLeadId` que o gate do
 * Radar usa para SOBRESCREVER nome/telefone/e-mail do lead.
 *
 * O fake abaixo reimplementa essa semântica de propósito: se alguém devolver
 * `mode: "insensitive"` para qualquer um dos dois filtros, os testes de curinga
 * voltam a falhar.
 */

type LeadRow = {
  id: string
  teamId: string
  email: string | null
  phone: string | null
  deletedAt: Date | null
  createdAt: Date
}

/**
 * `findFirst` fiel o bastante para os dois casos sob teste: só filtra por
 * `teamId`, `deletedAt` e `email`. Qualquer outro filtro faria o teste passar
 * por acidente, então explode.
 */
function makeLeadFindFirst(rows: LeadRow[]) {
  return mock(async (args: { where: Record<string, unknown> }) => {
    const { teamId, deletedAt, email, ...rest } = args.where
    if (Object.keys(rest).length > 0) {
      throw new Error(`filtro não previsto por este fake: ${JSON.stringify(rest)}`)
    }
    return (
      rows.find(
        (row) =>
          row.teamId === teamId &&
          (deletedAt === undefined || row.deletedAt === deletedAt) &&
          matchesEmail(row.email, email as EmailFilter | undefined),
      ) ?? null
    )
  })
}

const TEAM = "team-1"
const OUTRA_PESSOA: LeadRow = {
  id: "lead-outra-pessoa",
  teamId: TEAM,
  email: "mariaXsilva@example.com",
  phone: "11988887777",
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import("@/app/api/infra/data/repositories/radar/RadarRepository")
const { RadarLeadGateUnitOfWork } = await import(
  "@/app/api/infra/data/repositories/radar/RadarLeadGateUnitOfWork"
)

function makeRadarRepository(rows: LeadRow[]) {
  const findFirst = makeLeadFindFirst(rows)
  return {
    repo: new RadarRepository({ lead: { findFirst } } as unknown as PrismaClient),
    findFirst,
  }
}

describe("RadarRepository.findLeadPhoneByEmail — curinga de ILIKE", () => {
  it("não devolve o telefone de outro lead quando o e-mail buscado tem `_`", async () => {
    const { repo } = makeRadarRepository([OUTRA_PESSOA])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "maria_silva@example.com")

    expect(encontrado).toBeNull()
  })

  it("não varre o time inteiro quando o e-mail buscado tem `%`", async () => {
    const { repo } = makeRadarRepository([OUTRA_PESSOA])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "%@example.com")

    expect(encontrado).toBeNull()
  })

  it("casa o lead gravado em minúsculas mesmo quando o endereço chega em caixa mista", async () => {
    const { repo } = makeRadarRepository([
      { ...OUTRA_PESSOA, id: "lead-maria", email: "maria.silva@example.com", phone: "11977776666" },
    ])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "Maria.Silva@Example.com")

    expect(encontrado).toEqual({ phone: "11977776666" })
  })

  it("casa o lead gravado em caixa mista quando o endereço chega em minúsculas", async () => {
    // Codex apontou este caso (PR #993): `Lead.email` é gravado como veio, mas
    // os contatos e logs de e-mail chegam em minúsculas. Comparar por variantes
    // literais (`in: [endereço, minúsculas]`) perdia esta linha e fragmentava o
    // perfil; escapar mantém a insensibilidade de verdade.
    const { repo } = makeRadarRepository([
      { ...OUTRA_PESSOA, id: "lead-maria", email: "Maria.Silva@Example.com", phone: "11966665555" },
    ])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "maria.silva@example.com")

    expect(encontrado).toEqual({ phone: "11966665555" })
  })

  it("casa o lead cujo e-mail tem `_` de verdade, sem tratá-lo como curinga", async () => {
    const { repo } = makeRadarRepository([
      OUTRA_PESSOA,
      { ...OUTRA_PESSOA, id: "lead-maria", email: "maria_silva@example.com", phone: "11944443333" },
    ])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "MARIA_SILVA@EXAMPLE.COM")

    expect(encontrado).toEqual({ phone: "11944443333" })
  })

  it("não consulta o banco quando o endereço é vazio", async () => {
    const { repo, findFirst } = makeRadarRepository([
      { ...OUTRA_PESSOA, id: "lead-sem-email", email: "", phone: "11955554444" },
    ])

    const encontrado = await repo.findLeadPhoneByEmail(TEAM, "   ")

    expect(encontrado).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })
})

/**
 * O gate do Radar é a face mais cara do mesmo bug: `emailMatch` vira
 * `existingLeadId` em CreateCrmLeadFromRadarFormGateUseCase, e
 * `createOrUpdateFromRadarProfile` então roda `lead.update` gravando nome,
 * telefone e e-mail do perfil por cima do lead casado. Um falso positivo aqui
 * não vaza dado, sobrescreve o cadastro de outra pessoa.
 */
describe("RadarLeadGateUnitOfWork.findIdentityMatches — curinga de ILIKE", () => {
  function makeGate(rows: LeadRow[]) {
    const findFirst = makeLeadFindFirst(rows)
    const transaction = {
      $executeRaw: async () => 0,
      lead: { findFirst },
    }
    const database = {
      $transaction: async <T>(work: (tx: unknown) => Promise<T>) => work(transaction),
    } as unknown as PrismaClient

    return new RadarLeadGateUnitOfWork(database)
  }

  // Sem `leadId` e sem telefone, `findIdentityMatches` só emite a consulta de
  // e-mail — as outras duas são puladas antes de tocar o banco.
  const perfilBase = {
    id: "radar-profile-1",
    teamId: TEAM,
    displayName: "Maria Silva",
    normalizedName: "maria silva",
    displayPhone: null,
    normalizedPhone: null,
    leadId: null,
  }

  it("não casa o lead de outra pessoa quando o e-mail do perfil tem `_`", async () => {
    const gate = makeGate([OUTRA_PESSOA])

    const matches = await gate.execute(
      { teamId: TEAM, radarProfileId: perfilBase.id },
      (transaction) =>
        transaction.findIdentityMatches({
          ...perfilBase,
          primaryEmail: "maria_silva@example.com",
          normalizedPrimaryEmail: "maria_silva@example.com",
        }),
    )

    expect(matches.emailMatch).toBeNull()
  })

  it("casa o lead gravado em minúsculas quando o perfil traz o e-mail em caixa mista", async () => {
    const gate = makeGate([
      { ...OUTRA_PESSOA, id: "lead-maria", email: "maria.silva@example.com" },
    ])

    const matches = await gate.execute(
      { teamId: TEAM, radarProfileId: perfilBase.id },
      (transaction) =>
        transaction.findIdentityMatches({
          ...perfilBase,
          primaryEmail: "Maria.Silva@Example.com",
          normalizedPrimaryEmail: "maria.silva@example.com",
        }),
    )

    expect(matches.emailMatch?.leadId).toBe("lead-maria")
  })

  // Codex, PR #993: sem este caso o gate cria um lead duplicado só por
  // diferença de caixa — o cadastro existente ficou como o corretor digitou e o
  // perfil chega normalizado pela lista de contatos.
  it("casa o lead gravado em caixa mista quando o perfil chega normalizado", async () => {
    const gate = makeGate([
      { ...OUTRA_PESSOA, id: "lead-maria", email: "Maria.Silva@Example.com" },
    ])

    const matches = await gate.execute(
      { teamId: TEAM, radarProfileId: perfilBase.id },
      (transaction) =>
        transaction.findIdentityMatches({
          ...perfilBase,
          primaryEmail: "Maria.Silva@Example.com",
          normalizedPrimaryEmail: "maria.silva@example.com",
        }),
    )

    expect(matches.emailMatch?.leadId).toBe("lead-maria")
  })
})
