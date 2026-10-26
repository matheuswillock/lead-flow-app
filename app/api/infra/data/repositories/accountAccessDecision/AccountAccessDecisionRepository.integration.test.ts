import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { AccountAccessDecisionRepository } from "./AccountAccessDecisionRepository"

/**
 * Regressão do E2E de 20/10/2026: o modelo `BillingAccessGrace` foi criado com
 * campos camelCase sem `@map`, mas a migration hand-written criou colunas
 * snake_case (`expires_at`, `team_id`, `is_active`). Toda chamada de
 * `resolveAccount` estourava dentro de `prisma.billingAccessGrace.findFirst`
 * ("column billing_access_graces.expiresAt does not exist"), o use case
 * engolia o erro e devolvia `isValid: false`, e `getTeamAccess` traduzia isso
 * em 403 "acesso pausado" para *toda* a API — 38 specs do Playwright caíram.
 *
 * Os testes unitários do repositório mockam o Prisma, então nenhum deles
 * enxerga o descompasso entre schema.prisma e o SQL. Só um teste contra o
 * Postgres real fecha essa lacuna. Rode com:
 *   bun run test:integration:account-access:local
 */
const RUN_INTEGRATION =
  process.env.ACCOUNT_ACCESS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

const DAY_MS = 24 * 60 * 60 * 1000

describe.skipIf(!RUN_INTEGRATION)("AccountAccessDecisionRepository × billing_access_graces", () => {
  const repository = new AccountAccessDecisionRepository()
  const createdProfileIds: string[] = []
  const createdTeamIds: string[] = []

  afterAll(async () => {
    await prisma.billingAccessGrace.deleteMany({ where: { teamId: { in: createdTeamIds } } })
    await prisma.teamMember.deleteMany({ where: { teamId: { in: createdTeamIds } } })
    await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } })
    await prisma.profileSubscription.deleteMany({ where: { profileId: { in: createdProfileIds } } })
    await prisma.profile.deleteMany({ where: { id: { in: createdProfileIds } } })
    await prisma.$disconnect()
  })

  async function createPastDueAccount(input: { nextDueDate: Date }) {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `e2e.account-access.${randomUUID()}@example.com`,
        fullName: "E2E Account Access Integration",
        isMaster: true,
        role: "manager",
        hasPermanentSubscription: false,
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: input.nextDueDate,
      },
      select: { id: true },
    })
    createdProfileIds.push(profile.id)

    const team = await prisma.team.create({
      data: { name: `E2E Account Access ${randomUUID().slice(0, 8)}`, masterId: profile.id },
      select: { id: true },
    })
    createdTeamIds.push(team.id)

    await prisma.teamMember.create({
      data: { teamId: team.id, profileId: profile.id, role: "manager" },
    })
    await prisma.profile.update({ where: { id: profile.id }, data: { activeTeamId: team.id } })
    await prisma.profileSubscription.create({
      data: {
        profileId: profile.id,
        hasPermanentSubscription: false,
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: input.nextDueDate,
      },
    })

    return { profileId: profile.id, teamId: team.id }
  }

  it("lê a janela de grace da coluna expires_at e libera acesso temporário", async () => {
    const { profileId, teamId } = await createPastDueAccount({
      nextDueDate: new Date(Date.now() - 10 * DAY_MS),
    })
    const expiresAt = new Date(Date.now() + 2 * DAY_MS)

    await prisma.billingAccessGrace.create({
      data: { teamId, reason: "card_recovery", expiresAt, isActive: true },
    })

    const account = await repository.resolveAccount({ profileId, teamId })

    expect(account).not.toBeNull()
    expect(account?.temporaryAccessUntil?.toISOString()).toBe(expiresAt.toISOString())
    expect(account?.temporaryAccessUntil).toEqual(expiresAt)
  })

  it("mantém o acesso dentro da janela de 5 dias mesmo sem linha de grace", async () => {
    const { profileId, teamId } = await createPastDueAccount({
      nextDueDate: new Date(Date.now() - 3 * DAY_MS),
    })

    const account = await repository.resolveAccount({ profileId, teamId })

    expect(account?.temporaryAccessUntil).toBeNull()
    expect(account?.subscriptionStatus).toBe("past_due")
  })

  it("vira read_only quando a janela de 5 dias venceu e não existe grace ativa", async () => {
    const { profileId, teamId } = await createPastDueAccount({
      nextDueDate: new Date(Date.now() - 10 * DAY_MS),
    })

    const account = await repository.resolveAccount({ profileId, teamId })

    expect(account).not.toBeNull()
    expect(account?.temporaryAccessUntil).toBeNull()
    expect(account?.subscriptionStatus).toBe("past_due")
  })
})
