import { afterAll, describe, expect, it } from "bun:test"
import type {
  BackofficeSubscriptionChangeOrderRecord,
  ChangeOrderMasterContext,
  ChangeOrderTargetProduct,
  IBackofficeSubscriptionChangeOrderRepository,
} from "@/app/api/infra/data/repositories/backoffice/SubscriptionChangeOrderRepository/IBackofficeSubscriptionChangeOrderRepository"

/**
 * T-50.18 — integração REAL contra o sandbox Asaas (não mock).
 *
 * Prova a única coisa que um mock não prova: que o payload de
 * `generatePayment` (customer + payment) é aceito pela API de verdade, e
 * que a cobrança nasce na conta PRIMARY com `externalReference` correto.
 * "Nunca na legada" (DA6) é coberto no nível de unidade em
 * `BackofficeSubscriptionChangeOrderUseCase.test.ts` (mock de conta legacy
 * com controle negativo) — este ambiente não tem
 * `ASAAS_LEGACY_SANDBOX_API_KEY` configurada (pré-cutover, ver
 * [[10 — Fundações Multi-conta — Backend]] E2), então não há uma SEGUNDA
 * conta sandbox real para provar a exclusão por diferença observável.
 *
 * Repository é um FAKE em memória (não mocka Asaas, mocka só o Postgres) —
 * evita precisar do Postgres local compartilhado para este teste, cujo
 * único ponto em aberto é a integração externa.
 *
 * NÃO EXECUTADO nesta sessão (2026-09-10): `ASAAS_API_KEY` de `.env.test`
 * é um placeholder, não uma chave sandbox real — a API devolve 401 "O
 * valor fornecido não parece ser uma chave de API válida do Asaas".
 * Confirmado só pelo corpo do erro da própria API, sem inspecionar o
 * valor do segredo. Repor `ASAAS_SANDBOX_API_KEY`/`ASAAS_API_KEY` com uma
 * chave sandbox de verdade antes de rodar.
 *
 * Rodar:
 *   SUBSCRIPTION_CHANGE_ORDER_SANDBOX_INTEGRATION_TEST=1 \
 *   bun test app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase.sandbox.integration.test.ts
 */
const RUN_INTEGRATION = process.env.SUBSCRIPTION_CHANGE_ORDER_SANDBOX_INTEGRATION_TEST === "1"

let BackofficeSubscriptionChangeOrderUseCase: typeof import("./BackofficeSubscriptionChangeOrderUseCase").BackofficeSubscriptionChangeOrderUseCase
let buildChangeOrderExternalReference: typeof import("./BackofficeSubscriptionChangeOrderUseCase").buildChangeOrderExternalReference
let createAsaasClient: typeof import("@/lib/asaas").createAsaasClient

if (RUN_INTEGRATION) {
  const { assertAsaasSandbox } = await import("@/e2e/support/asaas")
  assertAsaasSandbox()
  ;({ BackofficeSubscriptionChangeOrderUseCase, buildChangeOrderExternalReference } = await import(
    "./BackofficeSubscriptionChangeOrderUseCase"
  ))
  ;({ createAsaasClient } = await import("@/lib/asaas"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("BackofficeSubscriptionChangeOrderUseCase.generatePayment — sandbox real (T-50.18)", () => {
  const ORDER_ID = "order-sandbox-1"
  const MASTER_ID = "master-sandbox-1"
  const PRODUCT_ID = "product-sandbox-1"
  let createdCustomerId: string | null = null
  let createdPaymentId: string | null = null

  /** Fake em memória — só o Postgres é mockado; Asaas é o real. */
  class FakeRepository implements IBackofficeSubscriptionChangeOrderRepository {
    order: BackofficeSubscriptionChangeOrderRecord = {
      id: ORDER_ID,
      masterProfileId: MASTER_ID,
      status: "draft",
      targetProductId: PRODUCT_ID,
      targetProductName: "CRM Sandbox",
      targetCycle: "monthly",
      listAmount: 79.9,
      proratedAmount: 79.9,
      overrideAmount: null,
      overrideStatus: "not_required",
      overrideApprovedByProfileId: null,
      chargeAmount: 79.9,
      asaasPaymentId: null,
      asaasAccount: "primary",
      paymentInvoiceUrl: null,
      createdAt: new Date(),
    }
    asaasCustomerId: string | null = null

    async findMasterContext(): Promise<ChangeOrderMasterContext | null> {
      return {
        hasPermanentSubscription: false,
        currentProductId: null,
        currentCycle: null,
        currentChargedAmount: null,
        currentSubscriptionStatus: "active",
        currentPeriodEnd: null,
        billingProfile: {
          id: MASTER_ID,
          fullName: "Master Sandbox T-50.18",
          email: `subscription-change-order-t5018-${Date.now()}@example.com`,
          cpfCnpj: "24971563792",
          phone: "11999999999",
          postalCode: "01310-100",
          address: "Avenida Paulista",
          addressNumber: "1000",
          neighborhood: "Bela Vista",
          complement: null,
          asaasCustomerId: this.asaasCustomerId,
          asaasCustomerAccount: "primary",
        },
      }
    }

    async findTargetProduct(): Promise<ChangeOrderTargetProduct | null> {
      return {
        id: PRODUCT_ID,
        name: "CRM Sandbox",
        isActive: true,
        priceMonthly: 79.9,
        priceQuarterly: null,
        priceQuadrimester: null,
        priceSemiannual: null,
        priceAnnual: null,
      }
    }

    async create(): Promise<BackofficeSubscriptionChangeOrderRecord> {
      return this.order
    }

    async findById(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
      return id === ORDER_ID ? this.order : null
    }

    async approveOverride(): Promise<BackofficeSubscriptionChangeOrderRecord> {
      return this.order
    }

    async updateMasterAsaasCustomer(_masterProfileId: string, customerId: string): Promise<void> {
      this.asaasCustomerId = customerId
      createdCustomerId = customerId
    }

    async attachPayment(
      _id: string,
      data: { asaasPaymentId: string; asaasAccount: "primary" | "legacy"; paymentInvoiceUrl: string | null }
    ): Promise<BackofficeSubscriptionChangeOrderRecord> {
      this.order = {
        ...this.order,
        status: "awaiting_payment",
        asaasPaymentId: data.asaasPaymentId,
        asaasAccount: data.asaasAccount,
        paymentInvoiceUrl: data.paymentInvoiceUrl,
      }
      createdPaymentId = data.asaasPaymentId
      return this.order
    }

    async applyChangeOrder(): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
      return this.order
    }

    async applyFreeChangeOrder(): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
      return this.order
    }

    async logEvent(): Promise<void> {}
  }

  const noopEmailService = { sendSubscriptionChangeOrderPaymentEmail: async () => undefined }

  afterAll(async () => {
    if (!RUN_INTEGRATION) return
    const client = createAsaasClient("primary")
    if (createdPaymentId) {
      await client.request(`${client.endpoints.payments}/${createdPaymentId}`, { method: "DELETE" }).catch(() => {})
    }
    if (createdCustomerId) {
      await client.request(`${client.endpoints.customers}/${createdCustomerId}`, { method: "DELETE" }).catch(() => {})
    }
  })

  it("gera customer + cobrança reais no sandbox primary, com externalReference = id da ordem", async () => {
    const repository = new FakeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository,
      (account) => createAsaasClient(account),
      undefined,
      noopEmailService
    )

    const output = await useCase.generatePayment(ORDER_ID)

    expect(output.isValid).toBe(true)
    const result = output.result as { asaasPaymentId: string; asaasAccount: string; paymentInvoiceUrl: string | null }
    expect(result.asaasAccount).toBe("primary")
    expect(result.asaasPaymentId).toBeTruthy()
    expect(result.paymentInvoiceUrl).toBeTruthy()

    // Confirma direto na API — não confia só no que o gateway devolveu.
    const client = createAsaasClient("primary")
    const payment = await client.request(`${client.endpoints.payments}/${result.asaasPaymentId}`)
    expect(payment.externalReference).toBe(buildChangeOrderExternalReference(ORDER_ID))
    expect(Number(payment.value)).toBeCloseTo(79.9, 2)
  }, 30_000)
})
