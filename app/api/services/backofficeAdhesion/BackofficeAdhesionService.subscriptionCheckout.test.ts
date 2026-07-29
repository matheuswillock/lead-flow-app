import { describe, expect, it } from "bun:test"
import { BackofficeAdhesionService } from "./BackofficeAdhesionService"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

function buildAdhesion(
  overrides: Partial<BackofficeAdhesionWithRelations>
): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    leadId: "lead-1",
    fullName: "William Santos Cruz",
    phone: "11999999999",
    email: "meu@universo.top",
    status: "pending",
    createdProfileId: "profile-1",
    createdSupabaseId: "supabase-1",
    installmentLedger: [
      {
        index: 0,
        amount: 1200,
        status: "paid",
        paymentSource: "EXTERNAL",
        asaasPaymentId: null,
        paidAt: "2026-07-28T22:40:17.000Z",
      },
      {
        index: 1,
        amount: 990,
        status: "pending",
        paymentSource: "ASAAS",
        asaasPaymentId: "pay_1",
        paidAt: null,
      },
    ],
    lead: {
      id: "lead-1",
      name: "William Santos Cruz",
      email: "meu@universo.top",
      phone: "11999999999",
      cpfCnpj: null,
      status: "new_adhesion",
      sdrBackofficeUserId: null,
      closerBackofficeUserId: null,
    },
    sdrBackofficeUser: null,
    closerBackofficeUser: null,
    ...overrides,
  } as BackofficeAdhesionWithRelations
}

describe("BackofficeAdhesionService subscription checkout guards", () => {
  it("bloqueia reenvio de adesão quando a assinatura já está ativada", async () => {
    const repo = {
      findById: async () => buildAdhesion({}),
    } as unknown as IBackofficeAdhesionRepository

    const service = new BackofficeAdhesionService(repo)

    await expect(service.resend("adhesion-1")).rejects.toThrow(
      "Assinatura já ativada. Use o link de fatura das parcelas pendentes para cobrança."
    )
  })

  it("bloqueia cópia de link público quando a assinatura já está ativada", async () => {
    const repo = {
      findById: async () =>
        buildAdhesion({
          tokenPlain: "token-123",
          expiresAt: new Date(Date.now() + 60_000),
        }),
    } as unknown as IBackofficeAdhesionRepository

    const service = new BackofficeAdhesionService(repo)

    await expect(service.getPublicUrl("adhesion-1")).rejects.toThrow(
      "Assinatura já ativada. Use o link de fatura das parcelas pendentes para cobrança."
    )
  })

  it("exige assinatura ativada para obter links de fatura", async () => {
    const repo = {
      findById: async () =>
        buildAdhesion({
          createdProfileId: null,
          createdSupabaseId: null,
          installmentLedger: [],
        }),
    } as unknown as IBackofficeAdhesionRepository

    const service = new BackofficeAdhesionService(repo)

    await expect(service.getPendingInvoiceUrls("adhesion-1")).rejects.toThrow(
      "Checkout de fatura disponível apenas para assinaturas já ativadas"
    )
  })
})
