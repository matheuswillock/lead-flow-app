import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository"
import { ProviderRenewalRepository } from "./ProviderRenewalRepository"

/**
 * Fase C (renovação reativa): as consultas novas só tinham passado pelo typecheck. Os testes
 * unitários dos casos de uso usam portas simuladas, então nenhum deles enxerga um filtro
 * errado do Prisma. Este teste roda contra o Postgres real. Rode com:
 *   bun run test:integration:provider-renewal:local
 */
const RUN_INTEGRATION =
  process.env.PROVIDER_RENEWAL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

describe.skipIf(!RUN_INTEGRATION)("Fase C: consultas de renovação e carência contra o Postgres", () => {
  const repository = new ProviderRenewalRepository()
  const createdProfileIds: string[] = []

  afterAll(async () => {
    await prisma.profileSubscription.deleteMany({ where: { profileId: { in: createdProfileIds } } })
    await prisma.profile.deleteMany({ where: { id: { in: createdProfileIds } } })
    await prisma.$disconnect()
  })

  async function createAccount(input: {
    status: "active" | "past_due" | "canceled"
    subscriptionDue: Date | null
    profileDue?: Date | null
    provider?: string | null
    asaasSubscriptionId?: string | null
    permanent?: boolean
  }) {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `provider-renewal.${randomUUID()}@example.test`,
        fullName: "Fase C integração",
        isMaster: true,
        role: "manager",
        subscriptionStatus: input.status,
        subscriptionNextDueDate: input.profileDue === undefined ? input.subscriptionDue : input.profileDue,
        hasPermanentSubscription: input.permanent ?? false,
      },
      select: { id: true },
    })
    createdProfileIds.push(profile.id)
    await prisma.profileSubscription.create({
      data: {
        profileId: profile.id,
        subscriptionStatus: input.status,
        subscriptionNextDueDate: input.subscriptionDue,
        provider: input.provider ?? null,
        asaasSubscriptionId: input.asaasSubscriptionId ?? null,
        hasPermanentSubscription: input.permanent ?? false,
      },
    })
    return profile.id
  }

  const window = () => ({ dueSince: daysAgo(5), dueUntil: new Date(), limit: 1000 })
  const mine = (rows: ReadonlyArray<{ profileId: string }>) =>
    rows.map((row) => row.profileId).filter((id) => createdProfileIds.includes(id))

  describe("listActiveRouterSubscriptionsDueBetween", () => {
    it("traz só conta ativa do roteador, não vitalícia, vencida dentro da janela", async () => {
      const inWindow = await createAccount({ status: "active", subscriptionDue: daysAgo(2), provider: "ROUTED_KEY" })
      await createAccount({ status: "active", subscriptionDue: daysAgo(2), provider: null, asaasSubscriptionId: "sub_legacy" })
      await createAccount({ status: "past_due", subscriptionDue: daysAgo(2), provider: "ROUTED_KEY" })
      await createAccount({ status: "active", subscriptionDue: daysAgo(2), provider: "ROUTED_KEY", permanent: true })
      await createAccount({ status: "active", subscriptionDue: daysAgo(9), provider: "ROUTED_KEY" })
      await createAccount({ status: "active", subscriptionDue: new Date(Date.now() + 3 * DAY_MS), provider: "ROUTED_KEY" })

      const rows = await repository.listActiveRouterSubscriptionsDueBetween(window())

      expect(mine(rows)).toEqual([inWindow])
    })

    it("pagina por profileId sem repetir nem pular linhas", async () => {
      const ids = [
        await createAccount({ status: "active", subscriptionDue: daysAgo(1), provider: "ROUTED_KEY" }),
        await createAccount({ status: "active", subscriptionDue: daysAgo(1), provider: "ROUTED_KEY" }),
        await createAccount({ status: "active", subscriptionDue: daysAgo(1), provider: "ROUTED_KEY" }),
      ].sort()

      const seen: string[] = []
      let after: string | undefined
      for (let page = 0; page < 1000; page += 1) {
        const rows = await repository.listActiveRouterSubscriptionsDueBetween({ ...window(), limit: 2, afterProfileId: after })
        seen.push(...mine(rows))
        if (rows.length < 2) break
        after = rows[rows.length - 1].profileId
      }

      expect(seen.filter((id) => ids.includes(id))).toEqual(ids)
    })
  })

  describe("markPastDueIfStillDue", () => {
    it("passa a conta e o perfil para past_due uma única vez", async () => {
      const due = daysAgo(2)
      const profileId = await createAccount({ status: "active", subscriptionDue: due, provider: "ROUTED_KEY" })

      expect(await repository.markPastDueIfStillDue(profileId, due)).toBe(true)
      expect(await repository.markPastDueIfStillDue(profileId, due)).toBe(false)

      const subscription = await prisma.profileSubscription.findUnique({ where: { profileId }, select: { subscriptionStatus: true } })
      const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { subscriptionStatus: true } })
      expect(subscription?.subscriptionStatus).toBe("past_due")
      expect(profile?.subscriptionStatus).toBe("past_due")
    })

    it("não reverte quem pagou no meio do caminho (vencimento mudou)", async () => {
      const staleDue = daysAgo(2)
      const profileId = await createAccount({ status: "active", subscriptionDue: staleDue, provider: "ROUTED_KEY" })
      await prisma.profileSubscription.update({
        where: { profileId },
        data: { subscriptionNextDueDate: new Date(Date.now() + 30 * DAY_MS) },
      })

      expect(await repository.markPastDueIfStillDue(profileId, staleDue)).toBe(false)

      const subscription = await prisma.profileSubscription.findUnique({ where: { profileId }, select: { subscriptionStatus: true } })
      expect(subscription?.subscriptionStatus).toBe("active")
    })
  })

  describe("corte legado", () => {
    it("acha a assinatura recorrente do Asaas só para conta sem provedor", async () => {
      const legacy = await createAccount({ status: "active", subscriptionDue: daysAgo(1), asaasSubscriptionId: "sub_abc" })
      const router = await createAccount({ status: "active", subscriptionDue: daysAgo(1), provider: "ROUTED_KEY", asaasSubscriptionId: "sub_old" })

      expect(await repository.findLegacyAsaasSubscription(legacy)).toEqual({ asaasSubscriptionId: "sub_abc", account: "primary" })
      expect(await repository.findLegacyAsaasSubscription(router)).toBeNull()
    })

    it("marca o provedor só quando a linha ainda não tem um (idempotente)", async () => {
      const profileId = await createAccount({ status: "active", subscriptionDue: daysAgo(1), asaasSubscriptionId: "sub_abc" })

      await repository.markOnRouter(profileId, "FIRST_KEY")
      await repository.markOnRouter(profileId, "SECOND_KEY")

      const row = await prisma.profileSubscription.findUnique({ where: { profileId }, select: { provider: true } })
      expect(row?.provider).toBe("FIRST_KEY")
      expect(await repository.findLegacyAsaasSubscription(profileId)).toBeNull()
    })
  })

  describe("findPastDueSubscriptionsInGrace (BillingEngineRepository)", () => {
    const graceStart = () => daysAgo(5)
    // Só as contas criadas dentro do teste: os testes anteriores deixam contas `past_due` na carência.
    const graceOf = async (candidates: string[], extra: { afterProfileId?: string } = {}) =>
      (await billingEngineRepository.findPastDueSubscriptionsInGrace({ take: 1000, graceStart: graceStart(), afterProfileId: extra.afterProfileId }))
        .map((row) => row.profileId)
        .filter((id) => candidates.includes(id))

    it("traz só past_due ainda na carência, pela data mais antiga entre assinatura e perfil", async () => {
      const inGrace = await createAccount({ status: "past_due", subscriptionDue: daysAgo(2) })
      const bothDatesInGrace = await createAccount({ status: "past_due", subscriptionDue: daysAgo(1), profileDue: daysAgo(3) })
      // O webhook do Asaas grava só a data do perfil: a data da assinatura fica nula e a conta ainda conta.
      const onlyProfileDate = await createAccount({ status: "past_due", subscriptionDue: null, profileDue: daysAgo(2) })
      const outsideGrace = [
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(8) }),
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(1), profileDue: daysAgo(8) }),
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(8), profileDue: daysAgo(1) }),
        await createAccount({ status: "past_due", subscriptionDue: null, profileDue: daysAgo(8) }),
        await createAccount({ status: "active", subscriptionDue: daysAgo(2) }),
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(2), permanent: true }),
        await createAccount({ status: "past_due", subscriptionDue: null, profileDue: null }),
      ]

      const found = await graceOf([inGrace, bothDatesInGrace, onlyProfileDate, ...outsideGrace])

      expect(found.sort()).toEqual([inGrace, bothDatesInGrace, onlyProfileDate].sort())
    })

    it("pagina por profileId", async () => {
      const ids = [
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(2) }),
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(2) }),
        await createAccount({ status: "past_due", subscriptionDue: daysAgo(2) }),
      ].sort()

      const afterFirst = await graceOf(ids, { afterProfileId: ids[0] })

      expect(afterFirst.sort()).toEqual(ids.slice(1))
    })
  })
})
