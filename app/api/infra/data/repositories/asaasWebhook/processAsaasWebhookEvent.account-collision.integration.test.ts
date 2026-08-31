import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * E4 de [[10 — Fundações Multi-conta — Backend]] (C33, DA4) — T-10.10 e a
 * metade de T-10.12 que usa BackofficePayment (não BackofficeAdhesion).
 *
 * Prova o pior bug possível do achado C33: dois profiles/pagamentos com o
 * MESMO id Asaas (`cus_`/`pay_`) em contas diferentes — o evento de uma
 * conta MUST nunca enxergar/atualizar o registro da outra. Roda contra
 * Postgres real porque o filtro por conta é imposto no `where` do Prisma —
 * um mock provaria só que o código *tentou* filtrar, não que o banco
 * respeita.
 *
 * NÃO EXECUTADO nesta sessão: sem Postgres local disponível no sandbox
 * (ver resumo da sessão). Escrito por TDD para rodar assim que houver
 * ambiente — `bun run test:integration:asaas-webhook:local` (Postgres :55322).
 */
const RUN_INTEGRATION =
  process.env.ASAAS_WEBHOOK_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let processAsaasWebhookEvent: typeof import("@/app/api/webhooks/asaas/processAsaasWebhookEvent").processAsaasWebhookEvent
let BackofficePaymentRepository: typeof import(
  "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
).BackofficePaymentRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ processAsaasWebhookEvent } = await import("@/app/api/webhooks/asaas/processAsaasWebhookEvent"))
  ;({ BackofficePaymentRepository } = await import(
    "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
  ))
}

const scope = {
  profilePrimaryId: "",
  profileLegacyId: "",
  clientId: "",
  paymentPrimaryId: "",
  paymentLegacyId: "",
}

/** Mesmo id Asaas nas duas contas — o cenário exato que C33 teme. */
const COLLIDING_CUSTOMER_ID = `cus_collision_${randomUUID()}`
const COLLIDING_PAYMENT_ID = `pay_collision_${randomUUID()}`

async function seed(): Promise<void> {
  const [profilePrimary, profileLegacy] = await Promise.all([
    prisma.profile.create({
      data: {
        email: `spec10-e4-primary-${randomUUID()}@example.test`,
        fullName: "Spec 10 E4 Primary",
        role: "manager",
        asaasCustomerId: COLLIDING_CUSTOMER_ID,
        asaasCustomerAccount: "primary",
      },
      select: { id: true },
    }),
    prisma.profile.create({
      data: {
        email: `spec10-e4-legacy-${randomUUID()}@example.test`,
        fullName: "Spec 10 E4 Legacy",
        role: "manager",
        asaasCustomerId: COLLIDING_CUSTOMER_ID,
        asaasCustomerAccount: "legacy",
      },
      select: { id: true },
    }),
  ])
  scope.profilePrimaryId = profilePrimary.id
  scope.profileLegacyId = profileLegacy.id

  const client = await prisma.backofficeClient.create({
    data: { fullName: "Spec 10 E4 Client" },
    select: { id: true },
  })
  scope.clientId = client.id

  const [paymentPrimary, paymentLegacy] = await Promise.all([
    prisma.backofficePayment.create({
      data: {
        clientId: scope.clientId,
        asaasPaymentId: COLLIDING_PAYMENT_ID,
        asaasAccount: "primary",
        amount: 100,
        status: "PENDING",
      },
      select: { id: true },
    }),
    prisma.backofficePayment.create({
      data: {
        clientId: scope.clientId,
        asaasPaymentId: COLLIDING_PAYMENT_ID,
        asaasAccount: "legacy",
        amount: 200,
        status: "PENDING",
      },
      select: { id: true },
    }),
  ])
  scope.paymentPrimaryId = paymentPrimary.id
  scope.paymentLegacyId = paymentLegacy.id
}

async function cleanup(): Promise<void> {
  await prisma.backofficePayment.deleteMany({ where: { clientId: scope.clientId } })
  await prisma.backofficeClient.deleteMany({ where: { id: scope.clientId } })
  await prisma.profile.deleteMany({
    where: { id: { in: [scope.profilePrimaryId, scope.profileLegacyId].filter(Boolean) } },
  })
}

describe.if(RUN_INTEGRATION)("processAsaasWebhookEvent — colisão de id entre contas (T-10.10/T-10.12)", () => {
  beforeAll(async () => {
    await seed()
  })

  afterAll(async () => {
    await cleanup()
  })

  it("T-10.10: colisão de cus_ — evento legacy só atualiza o profile legacy", async () => {
    await processAsaasWebhookEvent(
      {
        id: `evt-${randomUUID()}`,
        event: "SUBSCRIPTION_UPDATED",
        subscription: {
          id: `sub_${randomUUID()}`,
          customer: COLLIDING_CUSTOMER_ID,
          cycle: "MONTHLY",
          nextDueDate: "10/09/2026",
        },
      },
      "legacy"
    )

    const [primaryAfter, legacyAfter] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: scope.profilePrimaryId } }),
      prisma.profile.findUniqueOrThrow({ where: { id: scope.profileLegacyId } }),
    ])

    expect(legacyAfter.asaasSubscriptionId).not.toBeNull()
    expect(legacyAfter.asaasSubscriptionAccount).toBe("legacy")
    // CONTROLE NEGATIVO documentado: comentar o filtro `asaasCustomerAccount`
    // em processAsaasWebhookEvent.ts faz esta asserção falhar — o profile
    // primary (criado antes, sem asaasSubscriptionId) passaria a ser
    // atualizado também, pois o `findFirst` sem filtro pegaria qualquer um
    // dos dois profiles com o cus_ colidente (ordem não garantida).
    expect(primaryAfter.asaasSubscriptionId).toBeNull()
  })

  it("T-10.12: colisão de pay_ em BackofficePayment — evento primary só atualiza o pagamento primary", async () => {
    await processAsaasWebhookEvent(
      {
        id: `evt-${randomUUID()}`,
        event: "PAYMENT_RECEIVED",
        payment: {
          id: COLLIDING_PAYMENT_ID,
          status: "RECEIVED",
        },
      },
      "primary"
    )

    const repo = new BackofficePaymentRepository()
    const [primaryAfter, legacyAfter] = await Promise.all([
      repo.findByAsaasPaymentId(COLLIDING_PAYMENT_ID, "primary"),
      repo.findByAsaasPaymentId(COLLIDING_PAYMENT_ID, "legacy"),
    ])

    expect(primaryAfter?.status).toBe("RECEIVED")
    // CONTROLE NEGATIVO documentado: sem o filtro de conta em
    // findByAsaasPaymentId, o `findUnique`/`findFirst` original (por
    // asaasPaymentId isolado) teria batido no primeiro registro criado
    // (legacy) e atualizado o pagamento errado.
    expect(legacyAfter?.status).toBe("PENDING")
  })
})
