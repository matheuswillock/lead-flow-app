import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { asaasSubscriptionSyncRepository } from "@/app/api/infra/data/repositories/billing/AsaasSubscriptionSyncRepository"
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
    /** Conta legada só com o id no perfil (o fallback que o sync do Asaas também aceita). */
    withoutSubscriptionRow?: boolean
    profileAsaasSubscriptionId?: string | null
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
        asaasSubscriptionId: input.profileAsaasSubscriptionId ?? null,
        subscriptionCycle: "monthly",
      },
      select: { id: true },
    })
    createdProfileIds.push(profile.id)
    if (!input.withoutSubscriptionRow) {
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
    }
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

    it("usa o vencimento efetivo: o mais antigo entre assinatura e perfil decide, e é o que volta", async () => {
      const future = new Date(Date.now() + 30 * DAY_MS)
      const profileOlder = await createAccount({ status: "active", subscriptionDue: future, profileDue: daysAgo(2), provider: "ROUTED_KEY" })
      const subscriptionOlder = await createAccount({ status: "active", subscriptionDue: daysAgo(2), profileDue: future, provider: "ROUTED_KEY" })
      // O perfil já passou do fim da carência: o efetivo está fora da janela, mesmo com a assinatura dentro.
      const effectiveBeyondWindow = await createAccount({ status: "active", subscriptionDue: daysAgo(2), profileDue: daysAgo(9), provider: "ROUTED_KEY" })
      const ids = [profileOlder, subscriptionOlder, effectiveBeyondWindow]

      const rows = (await repository.listActiveRouterSubscriptionsDueBetween(window())).filter((row) => ids.includes(row.profileId))

      expect(rows.map((row) => row.profileId).sort()).toEqual([profileOlder, subscriptionOlder].sort())
      for (const row of rows) {
        expect(row.dueDate.toISOString().slice(0, 10)).toBe(daysAgo(2).toISOString().slice(0, 10))
      }
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

    it("compara com o vencimento efetivo (o do perfil, mais antigo): só a data efetiva marca a conta", async () => {
      const effective = daysAgo(2)
      const profileId = await createAccount({
        status: "active",
        subscriptionDue: new Date(Date.now() + 30 * DAY_MS),
        profileDue: effective,
        provider: "ROUTED_KEY",
      })

      expect(await repository.markPastDueIfStillDue(profileId, daysAgo(10))).toBe(false)
      expect(await repository.markPastDueIfStillDue(profileId, effective)).toBe(true)

      const subscription = await prisma.profileSubscription.findUnique({ where: { profileId }, select: { subscriptionStatus: true } })
      expect(subscription?.subscriptionStatus).toBe("past_due")
    })

    it("não reverte quem pagou no meio do caminho (vencimento mudou)", async () => {
      const staleDue = daysAgo(2)
      const profileId = await createAccount({ status: "active", subscriptionDue: staleDue, provider: "ROUTED_KEY" })
      // Um pagamento (completeAndRestoreAccess) adianta o vencimento na assinatura e no perfil.
      const renewedDue = new Date(Date.now() + 30 * DAY_MS)
      await prisma.profileSubscription.update({ where: { profileId }, data: { subscriptionNextDueDate: renewedDue } })
      await prisma.profile.update({ where: { id: profileId }, data: { subscriptionNextDueDate: renewedDue } })

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

    it("acha o id que está só no perfil (sem linha de assinatura): é o que o sync do Asaas também aceita", async () => {
      const profileOnly = await createAccount({
        status: "active",
        subscriptionDue: daysAgo(1),
        withoutSubscriptionRow: true,
        profileAsaasSubscriptionId: "sub_profile_only",
      })

      expect(await repository.findLegacyAsaasSubscription(profileOnly)).toEqual({ asaasSubscriptionId: "sub_profile_only", account: "primary" })
    })

    it("linha de assinatura sem id usa o do perfil; com id, o da assinatura vence", async () => {
      const subscriptionWithoutId = await createAccount({ status: "active", subscriptionDue: daysAgo(1), profileAsaasSubscriptionId: "sub_from_profile" })
      const subscriptionWins = await createAccount({
        status: "active",
        subscriptionDue: daysAgo(1),
        asaasSubscriptionId: "sub_from_subscription",
        profileAsaasSubscriptionId: "sub_from_profile",
      })

      expect(await repository.findLegacyAsaasSubscription(subscriptionWithoutId)).toMatchObject({ asaasSubscriptionId: "sub_from_profile" })
      expect(await repository.findLegacyAsaasSubscription(subscriptionWins)).toMatchObject({ asaasSubscriptionId: "sub_from_subscription" })
    })

    it("conta já marcada com provedor não tem o que cancelar, mesmo com id no perfil", async () => {
      const routed = await createAccount({
        status: "active",
        subscriptionDue: daysAgo(1),
        provider: "ROUTED_KEY",
        profileAsaasSubscriptionId: "sub_kept_for_audit",
      })

      expect(await repository.findLegacyAsaasSubscription(routed)).toBeNull()
    })

    it("marcar conta que só tem o id no perfil cria a linha espelhando o perfil e a tira do sync do Asaas", async () => {
      const profileOnly = await createAccount({
        status: "active",
        subscriptionDue: daysAgo(1),
        withoutSubscriptionRow: true,
        profileAsaasSubscriptionId: "sub_profile_only",
      })
      const profileBefore = await prisma.profile.findUnique({ where: { id: profileOnly }, select: { subscriptionNextDueDate: true } })

      await repository.markOnRouter(profileOnly, "FIRST_KEY")
      await repository.markOnRouter(profileOnly, "SECOND_KEY")

      const row = await prisma.profileSubscription.findUnique({ where: { profileId: profileOnly } })
      expect(row).toMatchObject({
        provider: "FIRST_KEY",
        subscriptionStatus: "active",
        subscriptionCycle: "monthly",
        asaasSubscriptionId: "sub_profile_only",
      })
      expect(row?.subscriptionNextDueDate?.getTime()).toBe(profileBefore?.subscriptionNextDueDate?.getTime())
      expect(await repository.findLegacyAsaasSubscription(profileOnly)).toBeNull()
      expect((await asaasSubscriptionSyncRepository.getSyncSnapshot(profileOnly))?.isRoutedByProvider).toBe(true)
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
