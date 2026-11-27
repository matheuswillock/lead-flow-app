import { describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import {
  executeMarkMasterUserInvoicePaidExternally,
  type ExternalPaymentUseCaseDeps,
} from "./markInvoicePaidExternally"

const actor = {
  profileId: "op-1",
  backofficeUserId: "bo-1",
  backofficeEmail: "ops@corretorstudio.com",
}

function makeDeps(overrides: Partial<ExternalPaymentUseCaseDeps> = {}): ExternalPaymentUseCaseDeps {
  return {
    findMasterById: mock(async () => ({
      id: "master-1",
      email: "master@corretora.com",
      asaasCustomerId: "cus_1",
      asaasCustomerAccount: "primary" as const,
    })),
    findAdhesionsByProfileId: mock(async () => []),
    findPendingActionById: mock(async () => ({
      id: "pa-1",
      masterId: "master-1",
      actionType: "add_user",
      status: "pending",
      paymentId: null,
      asaasAccount: null,
      provider: null,
      providerAttemptId: null,
      payload: { totalCharge: 99 },
    })),
    findPendingActionByPaymentId: mock(async () => null),
    findProviderAttemptById: mock(async () => null),
    queryProviderStatus: mock(async () => ({ status: "PENDING" })),
    cancelAsaasPayment: mock(async () => ({ ok: true as const })),
    clearPendingActionPaymentId: mock(async () => {}),
    findAsaasPaymentAcrossAccounts: mock(async () => null),
    resolveKnownAsaasAccounts: mock((profile) =>
      profile.asaasCustomerId
        ? [{ account: profile.asaasCustomerAccount, customerId: profile.asaasCustomerId }]
        : []
    ),
    guardLegacyInvoiceWrite: mock(() => null),
    applyExternalPayment: mock(async () => new Output(true, ["Aplicada"], [], {})),
    now: () => new Date("2026-11-27T16:00:00.000Z"),
    ...overrides,
  }
}

describe("executeMarkMasterUserInvoicePaidExternally (Fase D)", () => {
  it("aplica pending_action sem provedor gravando externalPayment", async () => {
    const deps = makeDeps()
    const output = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "PIX-RECIBO-01", proofUrl: "https://cdn.example.com/comprovante.pdf" },
      actor,
      deps
    )

    expect(output.isValid).toBe(true)
    expect(deps.cancelAsaasPayment).not.toHaveBeenCalled()
    expect(deps.applyExternalPayment).toHaveBeenCalledWith("pa-1", {
      reference: "PIX-RECIBO-01",
      proofUrl: "https://cdn.example.com/comprovante.pdf",
      operatorId: "op-1",
      paidAt: "2026-11-27T16:00:00.000Z",
    })
  })

  it("para pending_action com provider ABACATE_PAY pendente, consulta provedor agnóstico sem chamar Asaas", async () => {
    const deps = makeDeps({
      findPendingActionById: mock(async () => ({
        id: "pa-1",
        masterId: "master-1",
        actionType: "create_team",
        status: "pending",
        paymentId: null,
        asaasAccount: null,
        provider: "ABACATE_PAY",
        providerAttemptId: "att-1",
        payload: { totalCharge: 199 },
      })),
      findProviderAttemptById: mock(async () => ({
        id: "att-1",
        ownerType: "PENDING_ACTION_ADDON",
        ownerId: "pa-1",
        provider: "ABACATE_PAY",
        environment: "PRODUCTION" as const,
        externalAccountContext: "default",
        externalId: "bill_123",
        requestFingerprint: "PIX:fp",
        status: "PENDING",
      })),
      queryProviderStatus: mock(async () => ({ status: "PENDING" })),
    })

    const output = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "TED-998" },
      actor,
      deps
    )

    expect(output.isValid).toBe(true)
    expect(deps.queryProviderStatus).toHaveBeenCalledTimes(1)
    expect(deps.cancelAsaasPayment).not.toHaveBeenCalled()
    expect(deps.applyExternalPayment).toHaveBeenCalledTimes(1)
  })

  it("rejeita quando o provedor multi-provider já confirma pagamento (CONFIRMED)", async () => {
    const deps = makeDeps({
      findPendingActionById: mock(async () => ({
        id: "pa-1",
        masterId: "master-1",
        actionType: "create_team",
        status: "pending",
        paymentId: null,
        asaasAccount: null,
        provider: "ABACATE_PAY",
        providerAttemptId: "att-1",
        payload: { totalCharge: 199 },
      })),
      findProviderAttemptById: mock(async () => ({
        id: "att-1",
        ownerType: "PENDING_ACTION_ADDON",
        ownerId: "pa-1",
        provider: "ABACATE_PAY",
        environment: "PRODUCTION" as const,
        externalAccountContext: "default",
        externalId: "bill_123",
        requestFingerprint: "PIX:fp",
        status: "PENDING",
      })),
      queryProviderStatus: mock(async () => ({ status: "CONFIRMED" })),
    })

    const output = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "TED-998" },
      actor,
      deps
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("já está paga")
    expect(deps.applyExternalPayment).not.toHaveBeenCalled()
  })

  it("cancela cobrança Asaas pendente antes da baixa local", async () => {
    const deps = makeDeps({
      findAsaasPaymentAcrossAccounts: mock(async () => ({
        account: "primary" as const,
        payment: {
          id: "pay_123",
          status: "PENDING",
          externalReference: "pending-action-pa-1",
        },
      })),
      findPendingActionById: mock(async () => ({
        id: "pa-1",
        masterId: "master-1",
        actionType: "add_user",
        status: "pending",
        paymentId: "pay_123",
        asaasAccount: "primary" as const,
        provider: null,
        providerAttemptId: null,
        payload: { totalCharge: 99 },
      })),
    })

    const output = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pay_123",
      { reference: "DINHEIRO-01" },
      actor,
      deps
    )

    expect(output.isValid).toBe(true)
    expect(deps.cancelAsaasPayment).toHaveBeenCalledWith("pay_123", "primary")
    expect(deps.clearPendingActionPaymentId).toHaveBeenCalledWith("pa-1")
    expect(deps.applyExternalPayment).toHaveBeenCalledTimes(1)
  })

  it("rejeita tentativa em fatura já paga/aplicada", async () => {
    const deps = makeDeps({
      findPendingActionById: mock(async () => ({
        id: "pa-1",
        masterId: "master-1",
        actionType: "add_user",
        status: "applied",
        paymentId: null,
        asaasAccount: null,
        provider: null,
        providerAttemptId: null,
        payload: { paymentStatus: "CONFIRMED" },
      })),
    })

    const output = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "REC-2" },
      actor,
      deps
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("já foi paga")
    expect(deps.applyExternalPayment).not.toHaveBeenCalled()
  })

  it("rejeita referência vazia e URL de comprovante inválida", async () => {
    const deps = makeDeps()

    const noRef = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "   " },
      actor,
      deps
    )
    expect(noRef.isValid).toBe(false)

    const badProof = await executeMarkMasterUserInvoicePaidExternally(
      "master-1",
      "pending-action-pa-1",
      { reference: "REC-1", proofUrl: "ftp://example.com/comprovante.pdf" },
      actor,
      deps
    )
    expect(badProof.isValid).toBe(false)
    expect(deps.applyExternalPayment).not.toHaveBeenCalled()
  })
})
