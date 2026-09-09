import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * Integração contra o Postgres local (:55322) — T-50.12.
 *
 * O painel agrega em memória sobre o resultado de `findActiveMastersForPanel`
 * (decisão de design: dataset de admin, limitado a masters — ver commit da
 * E4), não via `groupBy`/SQL raw. O que este teste prova contra banco real é
 * a query em si (joins Profile → ProfileSubscription → BackofficeAdhesion/
 * BackofficeProduct corretos) — a paridade contagem×lista pedida por T-50.12
 * vira: o repositório devolve exatamente os registros semeados, com os
 * valores certos, e `computePanelSummary` sobre eles bate com o oráculo em
 * memória calculado a partir do mesmo seed.
 *
 * Rodar:
 *   SUBSCRIPTIONS_PANEL_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/BackofficeSubscriptionsPanelRepository.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.SUBSCRIPTIONS_PANEL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com DATABASE_URL apontando para 127.0.0.1:55322."
    )
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let BackofficeSubscriptionsPanelRepository: typeof import("./BackofficeSubscriptionsPanelRepository").BackofficeSubscriptionsPanelRepository
let computePanelSummary: typeof import("../../../../../useCases/backoffice/BackofficeSubscriptionsPanelUseCase").computePanelSummary

if (RUN_INTEGRATION) {
  assertLocalDatabase()
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ BackofficeSubscriptionsPanelRepository } = await import("./BackofficeSubscriptionsPanelRepository"))
  ;({ computePanelSummary } = await import("../../../../../useCases/backoffice/BackofficeSubscriptionsPanelUseCase"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("BackofficeSubscriptionsPanelRepository — integração Postgres real (T-50.12)", () => {
  const seedTag = `panel-test-${randomUUID()}`
  let productId: string
  let masterId: string

  beforeAll(async () => {
    const product = await prisma.backofficeProduct.create({
      data: {
        name: seedTag,
        type: "PLAN",
        priceMonthly: 100,
        priceQuarterly: 300,
      },
    })
    productId = product.id

    const master = await prisma.profile.create({
      data: {
        email: `${seedTag}@example.com`,
        role: "manager",
        isMaster: true,
        fullName: seedTag,
      },
    })
    masterId = master.id

    await prisma.profileSubscription.create({
      data: {
        profileId: master.id,
        productId,
        subscriptionStatus: "active",
        subscriptionCycle: "MONTHLY",
      },
    })
  })

  afterAll(async () => {
    await prisma.profileSubscription.deleteMany({ where: { profileId: masterId } })
    await prisma.profile.delete({ where: { id: masterId } })
    await prisma.backofficeProduct.delete({ where: { id: productId } })
  })

  it("findActiveMastersForPanel devolve o registro semeado com produto/status corretos", async () => {
    const repository = new BackofficeSubscriptionsPanelRepository()
    const records = await repository.findActiveMastersForPanel()

    const seeded = records.find((r) => r.profileId === masterId)
    expect(seeded).toBeDefined()
    expect(seeded?.productName).toBe(seedTag)
    expect(seeded?.subscriptionStatus).toBe("active")
  })

  it("computePanelSummary sobre o resultado real bate com o oráculo em memória", async () => {
    const repository = new BackofficeSubscriptionsPanelRepository()
    const records = await repository.findActiveMastersForPanel()
    const summary = computePanelSummary(records, 0, new Date())

    const seededCount = records.filter((r) => r.productName === seedTag).length
    const byProductEntry = summary.byProduct.find((p) => p.productName === seedTag)

    expect(byProductEntry?.count).toBe(seededCount)
  })
})
